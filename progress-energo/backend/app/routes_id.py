"""API исполнительной документации: участники, папки ИД, АОСР, бланки проверки работ."""
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from . import docgen_id, id_docs
from .seed import AOSR_ROLES, DEFAULT_NORMS, EXPECTED_TESTS, ID_SECTIONS, NORMS, ORG_ROLES
from .store import store

router = APIRouter(prefix="/api")
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def _find(coll: str, xid: str, what: str) -> dict:
    x = next((i for i in store.db[coll] if i["id"] == xid), None)
    if not x:
        raise HTTPException(404, f"{what} не найден")
    return x


def _obj(oid):
    o = store.obj(oid)
    if not o:
        raise HTTPException(404, "Объект не найден")
    return o


def _docx(data: bytes, name: str):
    return Response(data, media_type=DOCX, headers={"Content-Disposition": f'attachment; filename="{name}"'})


@router.get("/id/meta")
def id_meta():
    return {"aosr_roles": AOSR_ROLES, "org_roles": ORG_ROLES, "sections": ID_SECTIONS, "norms": NORMS,
            "default_norms": DEFAULT_NORMS, "expected_tests": EXPECTED_TESTS, "result_keys": {k: {"name": n, "options": o} for k, (n, o) in id_docs.RESULT_KEYS.items()},
            "access": id_docs.ACCESS}


# ---------------- Справочник участников ----------------

def _crud(coll: str, prefix: str, fields: tuple):
    @router.get(f"/{coll}", name=f"list_{coll}")
    def list_():
        return store.db[coll]

    @router.post(f"/{coll}", name=f"add_{coll}")
    def add(data: dict):
        rec = {"id": store.new_id(prefix), **{k: data.get(k, "") for k in fields}}
        store.db[coll].append(rec)
        store.save()
        return rec

    @router.patch(f"/{coll}/{{xid}}", name=f"upd_{coll}")
    def upd(xid: str, data: dict):
        rec = _find(coll, xid, "Запись")
        rec.update({k: v for k, v in data.items() if k in fields})
        store.save()
        return rec


_crud("organizations", "g", ("name", "ogrn", "inn", "address", "sro", "phone"))
_crud("people", "h", ("fio", "position", "org_id", "order_no", "order_date", "nrs"))


@router.get("/roles/{oid}")
def get_roles(oid: str):
    _obj(oid)
    return id_docs.roles_of(store.db, oid)


@router.put("/roles/{oid}")
def put_roles(oid: str, data: dict):
    _obj(oid)
    store.db["object_roles"][oid] = {"orgs": data.get("orgs", {}), "people": data.get("people", {"others": []})}
    store.save()
    return store.db["object_roles"][oid]


# ---------------- Папки ИД и АОСР ----------------

def _folder_view(f):
    aosrs = id_docs.folder_aosr(store.db, f["id"])
    return {**f, "aosr": aosrs, "registry": id_docs.registry(store.db, f), "issues": id_docs.check_folder(store.db, f)}


@router.get("/folders")
def folders(object_id: str):
    return [_folder_view(f) for f in sorted(store.db["id_folders"], key=lambda f: f["no"]) if f["object_id"] == object_id]


@router.post("/folders")
def add_folder(data: dict):
    _obj(data["object_id"])
    same = [f for f in store.db["id_folders"] if f["object_id"] == data["object_id"]]
    f = {"id": store.new_id("f"), "object_id": data["object_id"], "no": max([x["no"] for x in same], default=0) + 1,
         "title": data.get("title") or "Новый вид работ", "section": data.get("section") or ID_SECTIONS[0],
         "defect_act": data.get("defect_act") or None, "tests": [], "journals": [
             {"name": "Общий журнал работ", "no": "", "sheets": 1},
             {"name": "Журнал входного контроля и контроля качества получаемых деталей, материалов, конструкций и оборудования", "no": "б/н", "sheets": 1}],
         "extra": []}
    store.db["id_folders"].append(f)
    store.save()
    return _folder_view(f)


@router.patch("/folders/{fid}")
def upd_folder(fid: str, data: dict):
    f = _find("id_folders", fid, "Папка")
    f.update({k: v for k, v in data.items() if k in ("title", "section", "defect_act", "tests", "journals", "extra", "no")})
    store.save()
    return _folder_view(f)


@router.delete("/folders/{fid}")
def del_folder(fid: str):
    store.db["id_folders"] = [f for f in store.db["id_folders"] if f["id"] != fid]
    store.db["aosr"] = [a for a in store.db["aosr"] if a["folder_id"] != fid]
    store.save()
    return {"ok": True}


AOSR_FIELDS = ("no", "date", "works", "volumes", "basis", "materials", "scheme", "start", "end", "norms", "next_works", "extra_info", "copies")


@router.post("/aosr")
def add_aosr(data: dict):
    f = _find("id_folders", data["folder_id"], "Папка")
    n = len(id_docs.folder_aosr(store.db, f["id"])) + 1
    obj = store.obj(f["object_id"])
    suffix = "".join(ch for ch in obj["name"].split(",")[-1] if ch.isalnum()) if obj else ""
    a = {"id": store.new_id("a"), "folder_id": f["id"], "no": f"{n}/д.{suffix}" if suffix else str(n), "date": "", "works": "",
         "basis": "", "materials": [], "scheme": {"no": str(n), "date": "", "sheets": 1}, "start": "", "end": "",
         "norms": NORMS.get(f["section"], DEFAULT_NORMS)[:3], "next_works": "", "extra_info": "нет", "copies": 4,
         "volumes": []}
    a.update({k: v for k, v in data.items() if k in AOSR_FIELDS})
    store.db["aosr"].append(a)
    store.save()
    return a


@router.patch("/aosr/{aid}")
def upd_aosr(aid: str, data: dict):
    a = _find("aosr", aid, "АОСР")
    a.update({k: v for k, v in data.items() if k in AOSR_FIELDS})
    store.save()
    return a


@router.delete("/aosr/{aid}")
def del_aosr(aid: str):
    store.db["aosr"] = [a for a in store.db["aosr"] if a["id"] != aid]
    store.save()
    return {"ok": True}


@router.get("/folders/{fid}/docx")
def folder_docx(fid: str):
    f = _find("id_folders", fid, "Папка")
    o = _obj(f["object_id"])
    return _docx(docgen_id.build_folder(store.db, o, f), f"{o['code']}_ID_papka_{f['no']}.docx")


@router.get("/aosr/{aid}/docx")
def aosr_docx(aid: str):
    a = _find("aosr", aid, "АОСР")
    f = _find("id_folders", a["folder_id"], "Папка")
    o = _obj(f["object_id"])
    safe = "".join(ch if ch.isascii() and ch.isalnum() else "_" for ch in a["no"])
    return _docx(docgen_id.build_aosr(store.db, o, f, a), f"{o['code']}_AOSR_{safe}.docx")


# ---------------- Бланки проверки работ ----------------

@router.get("/blanks")
def blanks():
    return id_docs.BLANKS


@router.get("/inspections")
def inspections(object_id: str):
    return [i for i in store.db["inspections"] if i["object_id"] == object_id]


@router.post("/inspections")
def add_inspection(data: dict):
    _obj(data["object_id"])
    if data["blank_id"] not in id_docs.BLANKS_BY_ID:
        raise HTTPException(400, "Нет такого бланка")
    i = {"id": store.new_id("i"), **id_docs.new_inspection(data["blank_id"], data["object_id"])}
    store.db["inspections"].append(i)
    store.save()
    return i


@router.put("/inspections/{iid}")
def put_inspection(iid: str, data: dict):
    i = _find("inspections", iid, "Проверка")
    keep = {"id": i["id"], "object_id": i["object_id"], "blank_id": i["blank_id"]}
    i.clear()
    i.update({**data, **keep})
    store.save()
    return i


@router.delete("/inspections/{iid}")
def del_inspection(iid: str):
    store.db["inspections"] = [i for i in store.db["inspections"] if i["id"] != iid]
    store.save()
    return {"ok": True}


@router.get("/inspections/report/{oid}")
def inspections_report(oid: str):
    o = _obj(oid)
    items = sorted([i for i in store.db["inspections"] if i["object_id"] == oid], key=lambda i: i["blank_id"])
    if not items:
        raise HTTPException(400, "По объекту ещё нет заполненных бланков")
    return _docx(docgen_id.build_inspections(store.db, o, items), f"{o['code']}_proverka_rabot.docx")


# ---------------- Дефектный акт ----------------

@router.get("/defect/{oid}")
def get_defect(oid: str):
    _obj(oid)
    return store.db["defect_acts"].get(oid) or {"no": "", "date": "", "sheets": 1, "rows": []}


@router.put("/defect/{oid}")
def put_defect(oid: str, data: dict):
    _obj(oid)
    rows = [{"id": r.get("id") or store.new_id("r"), "section": r.get("section") or id_docs.guess_section(r.get("name", "")),
             "name": r.get("name", ""), "unit": r.get("unit", ""), "qty": r.get("qty", "")} for r in data.get("rows", []) if r.get("name")]
    store.db["defect_acts"][oid] = {"no": data.get("no", ""), "date": data.get("date", ""), "sheets": data.get("sheets", 1), "rows": rows}
    store.save()
    return store.db["defect_acts"][oid]


@router.post("/defect/parse")
def parse_defect(data: dict):
    return id_docs.parse_defect_text(data.get("text", ""))


@router.post("/defect/{oid}/build")
def build_defect(oid: str):
    res = id_docs.build_from_defect(store.db, _obj(oid), store.new_id)
    if "error" in res:
        raise HTTPException(400, res["error"])
    store.save()
    return res


@router.get("/id/summary")
def id_summary():
    return id_docs.summary(store.db)


@router.get("/folders/{fid}/tests/{idx}/docx")
def test_docx(fid: str, idx: int):
    f = _find("id_folders", fid, "Папка")
    if idx >= len(f["tests"]) or not docgen_id.test_form(f["tests"][idx]["name"]):
        raise HTTPException(404, "Для этого документа нет формы")
    o = _obj(f["object_id"])
    return _docx(docgen_id.build_test(store.db, o, f, f["tests"][idx]), f"{o['code']}_akt_ispytaniya_{idx + 1}.docx")
