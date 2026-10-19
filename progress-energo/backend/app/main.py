"""API «ВПК Платформа» — ООО ВПК «Прогресс Энерго».

Запуск:  python -m uvicorn app.main:app --port 8010   (из папки backend)
Документация API появляется автоматически: http://localhost:8010/docs
"""
import json
from datetime import date, datetime, timedelta
from pathlib import Path
from xml.sax.saxutils import escape

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import calc, docgen, routes_id
from .seed import BUILDING_TYPES, ROLES, STAGES, SYSTEMS
from .store import UPLOADS, store

app = FastAPI(title="ВПК Платформа — ВПК «Прогресс Энерго»", version="0.2-прототип")
app.include_router(routes_id.router)

DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
CLOUD_FORMATS = {"las", "laz", "e57", "ptx"}


def _404(what: str):
    raise HTTPException(404, f"{what} не найден")


def _obj(oid: str) -> dict:
    return store.obj(oid) or _404("Объект")


def _attachment(data: bytes, filename: str, media: str) -> Response:
    return Response(data, media_type=media,
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


# ---------------- Справочная информация ----------------

@app.get("/api/meta")
def meta():
    return {"stages": STAGES, "roles": ROLES, "building_types": BUILDING_TYPES,
            "systems": SYSTEMS, "rd_sections": {k: v[1] for k, v in docgen.RD_SECTIONS.items()}}


@app.post("/api/reset")
def reset():
    """Вернуть демо-данные в исходное состояние."""
    store.reset()
    return {"ok": True}


# ---------------- Модуль 1: объекты и планирование ----------------

class ObjectIn(BaseModel):
    name: str
    address: str
    building_type: str = "mkd"
    area: float
    floors: int = 5
    year: int = 1970
    systems: list[str] = ["EOM", "VK", "OV", "TS"]
    priority: int = 2
    customer: str = ""
    deadline: str | None = None


@app.get("/api/objects")
def objects():
    return [{**o, "labour": calc.labour(o)} for o in store.db["objects"]]


@app.post("/api/objects")
def create_object(data: ObjectIn):
    n = len(store.db["objects"]) + 1
    o = {"id": store.new_id("o"), "code": f"PE-{date.today().year}-{n:03d}", "stage": "plan",
         **data.model_dump()}
    o["deadline"] = o["deadline"] or (date.today() + timedelta(days=30)).isoformat()
    store.db["objects"].append(o)
    store.db["access"][o["id"]] = [{"item": it["item"], "status": "needed"}
                                   for it in next(iter(store.db["access"].values()))]
    store.save()
    return {**o, "labour": calc.labour(o)}


@app.patch("/api/objects/{oid}")
def update_object(oid: str, patch: dict):
    o = _obj(oid)
    allowed = {"priority", "stage", "deadline", "name", "address", "area", "floors", "systems", "customer"}
    o.update({k: v for k, v in patch.items() if k in allowed})
    store.save()
    return {**o, "labour": calc.labour(o)}


@app.get("/api/specialists")
def specialists():
    return store.db["specialists"]


@app.get("/api/visits")
def visits():
    return store.db["visits"]


class VisitIn(BaseModel):
    object_id: str
    specialist_id: str
    date: str
    start: int = 9
    hours: float = 8


@app.post("/api/visits")
def create_visit(v: VisitIn):
    _obj(v.object_id)
    rec = {"id": store.new_id("v"), "status": "planned", **v.model_dump()}
    store.db["visits"].append(rec)
    store.save()
    return rec


@app.patch("/api/visits/{vid}")
def update_visit(vid: str, patch: dict):
    v = next((x for x in store.db["visits"] if x["id"] == vid), None) or _404("Выезд")
    v.update({k: patch[k] for k in ("date", "specialist_id", "start", "hours", "status") if k in patch})
    store.save()
    return v


@app.delete("/api/visits/{vid}")
def delete_visit(vid: str):
    store.db["visits"] = [x for x in store.db["visits"] if x["id"] != vid]
    store.save()
    return {"ok": True}


@app.post("/api/visits/auto/{oid}")
def auto_plan(oid: str):
    """Ставит выезды на ближайшие свободные рабочие дни наименее загруженных сканерщиков."""
    o = _obj(oid)
    lab = calc.labour(o)
    scanners = [s for s in store.db["specialists"] if s["role"] == "scanner"]
    busy = {(v["specialist_id"], v["date"]) for v in store.db["visits"]}
    day, created = date.today(), []
    need = lab["field_days"] * lab["specialists"]
    while len(created) < need and day < date.today() + timedelta(days=60):
        if day.weekday() < 5:
            for s in sorted(scanners, key=lambda s: sum(1 for b in busy if b[0] == s["id"])):
                if (s["id"], day.isoformat()) not in busy and len(created) < need:
                    hours = min(8, round(lab["field_hours"] / need + 0.49))
                    rec = {"id": store.new_id("v"), "object_id": oid, "specialist_id": s["id"],
                           "date": day.isoformat(), "start": 9, "hours": max(hours, 2), "status": "planned"}
                    store.db["visits"].append(rec)
                    busy.add((s["id"], day.isoformat()))
                    created.append(rec)
        day += timedelta(days=1)
    if o["stage"] == "plan":
        o["stage"] = "field"
    store.save()
    return created


@app.get("/api/access/{oid}")
def get_access(oid: str):
    _obj(oid)
    return store.db["access"].get(oid, [])


@app.put("/api/access/{oid}")
def put_access(oid: str, items: list[dict]):
    _obj(oid)
    store.db["access"][oid] = [{"item": i["item"], "status": i["status"]} for i in items]
    store.save()
    return store.db["access"][oid]


@app.get("/api/access/{oid}/letter")
def access_letter(oid: str):
    o = _obj(oid)
    items = [i["item"] for i in store.db["access"].get(oid, []) if i["status"] != "granted"]
    for i in store.db["access"].get(oid, []):
        if i["status"] == "needed":
            i["status"] = "requested"
    store.save()
    return _attachment(docgen.build_access_request(o, items or ["Места общего пользования"]),
                       f"{o['code']}_zayavka_dopusk.docx", DOCX)


# ---------------- Модуль 2: планшет ----------------

@app.get("/api/checklists/{oid}")
def get_checklist(oid: str):
    _obj(oid)
    return store.checklist(oid)


@app.put("/api/checklists/{oid}")
def put_checklist(oid: str, data: dict):
    o = _obj(oid)
    store.db["checklists"][oid] = data
    ticket = None
    if data.get("lab_required"):
        open_t = [t for t in store.db["lab_tickets"] if t["object_id"] == oid and t["status"] != "done"]
        if not open_t:
            ticket = {"id": store.new_id("l"), "object_id": oid, "address": o["address"],
                      "test_type": data.get("lab_test") or "Уточнить вид испытаний",
                      "status": "new", "created": date.today().isoformat(), "lab": "ТНК РФ"}
            store.db["lab_tickets"].append(ticket)
    store.save()
    return {"checklist": data, "lab_ticket_created": ticket}


class NoteIn(BaseModel):
    text: str


@app.post("/api/ai/parse")
def ai_parse(note: NoteIn):
    return calc.parse_note(note.text)


@app.post("/api/ai/photo")
async def ai_photo(object_id: str = Form(...), file: UploadFile = File(...)):
    """Заглушка ИИ-анализа фото. Возвращает типовую подсказку для проверки сценария."""
    _obj(object_id)
    await file.read()
    name = (file.filename or "").lower()
    if any(w in name for w in ("щит", "vru", "shit", "panel")):
        hint = "На фото распознан электрощит. Состояние: ограниченно работоспособное — следы нагрева контактов."
    else:
        hint = ("Распознано: несущая стена, видимые трещины шириной до 1–2 мм, следы намокания. "
                "Рекомендуется лабораторный контроль прочности.")
    return {"demo": True, "text": hint, "parsed": calc.parse_note(hint)}


class ScanStart(BaseModel):
    object_id: str
    specialist_id: str | None = None
    lat: float | None = None
    lon: float | None = None


@app.post("/api/scan/start")
def scan_start(s: ScanStart):
    _obj(s.object_id)
    rec = {"id": store.new_id("sc"), "started": datetime.now().isoformat(timespec="seconds"), **s.model_dump()}
    store.db["scan_sessions"].append(rec)
    store.save()
    return rec


# ---------------- Модуль 3: облака точек ----------------

@app.get("/api/pointclouds")
def pointclouds():
    return store.db["pointclouds"]


@app.post("/api/pointclouds/upload")
async def upload_cloud(object_id: str = Form(...), file: UploadFile = File(...)):
    o = _obj(object_id)
    ext = Path(file.filename or "").suffix.lower().lstrip(".")
    if ext not in CLOUD_FORMATS:
        raise HTTPException(400, f"Формат .{ext} не поддерживается. Нужны: {', '.join(sorted(CLOUD_FORMATS))}")
    pid = store.new_id("p")
    dest = UPLOADS / f"{pid}.{ext}"
    size = 0
    with dest.open("wb") as fh:  # пишем по частям — облака бывают в гигабайты
        while chunk := await file.read(1024 * 1024):
            fh.write(chunk)
            size += len(chunk)
    rec = {"id": pid, "object_id": object_id, "filename": file.filename, "format": ext,
           "size_mb": round(size / 1048576, 2), "points_mln": round(size / 1048576 * 0.11, 1),
           "uploaded": date.today().isoformat(), "status": "uploaded"}
    store.db["pointclouds"].append(rec)
    if o["stage"] in ("plan", "field"):
        o["stage"] = "cloud"
    store.save()
    return rec


@app.post("/api/pointclouds/{pid}/process")
def process_cloud(pid: str):
    """Следующий шаг обработки: загружено → проиндексировано → векторизовано."""
    p = next((x for x in store.db["pointclouds"] if x["id"] == pid), None) or _404("Облако")
    p["status"] = {"uploaded": "indexed", "indexed": "vectorized"}.get(p["status"], p["status"])
    if p["status"] == "vectorized":
        o = store.obj(p["object_id"])
        if o and o["stage"] == "cloud":
            o["stage"] = "office"
    store.save()
    return p


@app.get("/api/plan/{oid}")
def plan(oid: str):
    o = _obj(oid)
    ready = any(p["object_id"] == oid and p["status"] == "vectorized" for p in store.db["pointclouds"])
    return {"ready": ready, **(calc.floor_plan(o) if ready else {})}


@app.get("/api/tags")
def tags(object_id: str):
    return [t for t in store.db["tags"] if t["object_id"] == object_id]


@app.post("/api/tags")
def add_tag(tag: dict):
    rec = {"id": store.new_id("t"), **{k: tag[k] for k in ("object_id", "x", "y", "label", "kind")}}
    store.db["tags"].append(rec)
    store.save()
    return rec


@app.delete("/api/tags/{tid}")
def del_tag(tid: str):
    store.db["tags"] = [t for t in store.db["tags"] if t["id"] != tid]
    store.save()
    return {"ok": True}


# ---------------- Лаборатория ----------------

@app.get("/api/lab")
def lab():
    return store.db["lab_tickets"]


@app.patch("/api/lab/{lid}")
def update_lab(lid: str, patch: dict):
    t = next((x for x in store.db["lab_tickets"] if x["id"] == lid), None) or _404("Заявка")
    if "status" in patch:
        t["status"] = patch["status"]
    store.save()
    return t


# ---------------- Модуль 4: справочники и генератор документов ----------------

@app.get("/api/materials")
def materials():
    return store.db["materials"]


@app.post("/api/materials")
def add_material(m: dict):
    rec = {"id": store.new_id("m"), "passport": bool(m.get("passport")),
           **{k: m.get(k, "") for k in ("name", "category", "supplier", "cert_no", "cert_until")}}
    store.db["materials"].append(rec)
    store.save()
    return rec


@app.get("/api/nodes")
def nodes():
    return store.db["nodes"]


@app.get("/api/docs/{oid}/readiness")
def readiness(oid: str):
    """Что уже есть для сборки тома, а чего не хватает."""
    o = _obj(oid)
    cl = store.db["checklists"].get(oid)
    pl = plan(oid)
    lab_t = [t for t in store.db["lab_tickets"] if t["object_id"] == oid]
    mats = [m for m in store.db["materials"] if cl and m["id"] in cl.get("materials", [])]
    expired = [m["name"] for m in mats if m["cert_until"] < date.today().isoformat()]
    return [
        {"item": "Чек-лист с планшета", "ok": bool(cl), "hint": "Заполнить на выезде"},
        {"item": "Обмерный план из облака точек", "ok": pl["ready"], "hint": "Запустить векторизацию в модуле «Облака точек»"},
        {"item": "Материалы выбраны", "ok": bool(mats), "hint": "Отметить материалы в чек-листе"},
        {"item": "Сертификаты действуют", "ok": bool(mats) and not expired,
         "hint": ("Просрочены: " + ", ".join(expired)) if expired else "Нет материалов"},
        {"item": "Лабораторные протоколы", "ok": not (cl and cl.get("lab_required")) or any(t["status"] == "done" for t in lab_t),
         "hint": "Ожидается протокол из лаборатории"},
        {"item": "Инженерные системы описаны", "ok": bool(cl) and all(s in cl.get("systems", {}) for s in o["systems"]),
         "hint": "Заполнить раздел «Инженерные системы»"},
    ]


@app.get("/api/docs/{oid}/id.docx")
def doc_id(oid: str):
    o = _obj(oid)
    data = docgen.build_id_volume(store.db, o, store.checklist(oid), calc.floor_plan(o))
    return _attachment(data, f"{o['code']}_ID.docx", DOCX)


@app.get("/api/docs/{oid}/rd/{section}.docx")
def doc_rd(oid: str, section: str):
    o = _obj(oid)
    if section not in docgen.RD_SECTIONS:
        _404("Раздел")
    data = docgen.build_rd_section(store.db, o, store.checklist(oid), calc.floor_plan(o), section)
    return _attachment(data, f"{o['code']}_RD_{section}.docx", DOCX)


# ---------------- Модуль 5: смета и интеграции ----------------

@app.get("/api/estimate/{oid}")
def get_estimate(oid: str):
    return calc.estimate(_obj(oid), store.checklist(oid))


@app.get("/api/export/grand/{oid}")
def export_grand(oid: str):
    """XML для импорта в Гранд-Смету. Структура упрощена — точную схему (АРПС) согласуем позже."""
    o = _obj(oid)
    e = calc.estimate(o, store.checklist(oid))
    rows = "\n".join(
        f'    <Position Number="{i + 1}" Code="{escape(l["code"])}" Caption="{escape(l["name"])}" '
        f'Units="{l["unit"]}" Quantity="{l["qty"]}" Price="{l["price"]}" K="{l["k"]}" Total="{l["sum"]}" '
        f'Basis="{escape(l["basis"])}"/>'
        for i, l in enumerate(e["lines"]))
    xml = (f'<?xml version="1.0" encoding="UTF-8"?>\n'
           f'<Document Program="VPK-Platforma" Version="0.1">\n'
           f'  <Properties Caption="Смета на ПИР: {escape(o["name"])}" Address="{escape(o["address"])}" '
           f'Code="{o["code"]}" VAT="{int(e["vat_rate"] * 100)}"/>\n'
           f'  <Chapter Caption="Проектно-изыскательские работы">\n{rows}\n  </Chapter>\n'
           f'  <Totals Total="{e["total"]}" VAT="{e["vat"]}" TotalWithVAT="{e["total_vat"]}"/>\n'
           f'</Document>\n')
    return _attachment(xml.encode("utf-8"), f"{o['code']}_GrandSmeta.xml", "application/xml")


@app.get("/api/export/axon/{oid}")
def export_axon(oid: str):
    """Пакет данных для «Аксон» (СОУ/РД). Формат-заглушка до получения API Аксона."""
    o = _obj(oid)
    payload = {"source": "VPK-Platforma", "object": o, "checklist": store.checklist(oid),
               "plan": calc.floor_plan(o),
               "tags": [t for t in store.db["tags"] if t["object_id"] == oid]}
    return _attachment(json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8"),
                       f"{o['code']}_Axon.json", "application/json")


# ---------------- Раздача собранного фронтенда ----------------

DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        f = (DIST / path).resolve()
        ok = path and f.is_file() and f.is_relative_to(DIST.resolve())
        return FileResponse(f if ok else DIST / "index.html")
