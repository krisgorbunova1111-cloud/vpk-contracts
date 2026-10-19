"""Исполнительная документация: папки по видам работ, реестр (форма 1.1),
проверка полноты, бланки проверки работ.

Структура папки повторяет образцы заказчика: реестр → приказы на ответственных
лиц → дефектный акт → АОСР + исполнительные схемы → акты испытаний → реестр
документов о качестве + сертификаты/паспорта → прочие акты → журналы.
"""
import json
from datetime import date
from pathlib import Path

from .seed import AOSR_ROLES, EXPECTED_TESTS

BLANKS = json.loads((Path(__file__).parent / "check_blanks.json").read_text(encoding="utf-8"))
BLANKS_BY_ID = {b["id"]: b for b in BLANKS}


def ru_date(iso: str | None) -> str:
    return date.fromisoformat(iso).strftime("%d.%m.%Y") if iso else "___________"


def roles_of(db, oid: str) -> dict:
    return db["object_roles"].get(oid) or {"orgs": {}, "people": {"others": []}}


def person(db, pid):
    return next((p for p in db["people"] if p["id"] == pid), None)


def org(db, gid):
    return next((g for g in db["organizations"] if g["id"] == gid), None)


def folder_aosr(db, fid):
    return sorted([a for a in db["aosr"] if a["folder_id"] == fid], key=lambda a: (a["date"], a["no"]))


def folder_materials(db, fid):
    ids = []
    for a in folder_aosr(db, fid):
        ids += [m for m in a["materials"] if m not in ids]
    return [m for m in db["materials"] if m["id"] in ids]


def basis_text(folder):
    da = folder.get("defect_act") or {}
    return f"Дефектный акт № {da.get('no', '—')} от {ru_date(da.get('date'))}" if da else ""


def registry(db, folder) -> list[dict]:
    """Строки реестра ИД (форма 1.1) с автоматической нумерацией листов."""
    rows = [{"name": "Реестр исполнительной документации", "no": f"{folder['no']}", "sheets": 1}]
    r = roles_of(db, folder["object_id"])
    pids = [r["people"].get(x["id"]) for x in AOSR_ROLES] + r["people"].get("others", [])
    for pid in dict.fromkeys(p for p in pids if p):
        p = person(db, pid)
        if p:
            f = p["fio"].split()
            rows.append({"name": f"Приказ от {ru_date(p.get('order_date'))} — {f[0]} {''.join(x[0] + '.' for x in f[1:])}", "no": p.get("order_no") or "—", "sheets": 1, "kind": "order"})
    da = folder.get("defect_act")
    if da:
        rows.append({"name": f"Дефектный акт от {ru_date(da['date'])}", "no": da["no"], "sheets": da.get("sheets", 1)})
    for a in folder_aosr(db, folder["id"]):
        rows.append({"name": f"АОСР от {ru_date(a['date'])}. {short(a['works'])}", "no": a["no"], "sheets": 1, "kind": "aosr", "id": a["id"]})
        s = a.get("scheme") or {}
        if s.get("no"):
            rows.append({"name": f"Исполнительная схема. {short(a['works'])}", "no": s["no"], "sheets": s.get("sheets", 1)})
    for t in folder.get("tests", []):
        rows.append({"name": t["name"], "no": t.get("no", "б/н"), "sheets": t.get("sheets", 1)})
    mats = folder_materials(db, folder["id"])
    if mats:
        rows.append({"name": "Реестр документов, подтверждающих качество", "no": "б/н", "sheets": 1, "kind": "quality"})
        for m in mats:
            rows.append({"name": f"Сертификат соответствия до {ru_date(m['cert_until'])} — {m['name']}", "no": m["cert_no"], "sheets": m.get("cert_sheets", 1)})
            if m.get("passport"):
                rows.append({"name": f"Технический паспорт изделия — {m['name']}", "no": "б/н", "sheets": m.get("passport_sheets", 1)})
    for e in folder.get("extra", []) + folder.get("journals", []):
        rows.append({"name": e["name"], "no": e.get("no", "б/н"), "sheets": e.get("sheets", 1)})
    page = 1
    for i, row in enumerate(rows):
        row["n"] = i + 1
        row["pages"] = str(page) if row["sheets"] == 1 else f"{page}-{page + row['sheets'] - 1}"
        page += row["sheets"]
    return rows


def short(works: str) -> str:
    first = works.split(":")[0].split(".")[0].strip()
    return first[:90]


def check_folder(db, folder) -> list[dict]:
    """Проверка полноты и непротиворечивости папки — то, на чём обычно «заворачивают» ИД."""
    issues = []

    def add(level, text):
        issues.append({"level": level, "text": text})

    r = roles_of(db, folder["object_id"])
    for role in AOSR_ROLES:
        if role["id"] == "designer":
            continue  # при работах по дефектному акту проектировщика может не быть
        pid = r["people"].get(role["id"])
        if not pid:
            add("bad", f"Не назначен: {role['name'].lower()}")
        elif not (person(db, pid) or {}).get("order_no"):
            add("warn", f"Нет приказа у {person(db, pid)['fio']}")
    if not folder.get("defect_act"):
        add("bad", "Нет основания работ (дефектный акт / рабочая документация)")
    aosrs = folder_aosr(db, folder["id"])
    if not aosrs:
        add("bad", "В папке нет ни одного АОСР")
    nos = [a["no"] for a in aosrs]
    for n in {n for n in nos if nos.count(n) > 1}:
        add("bad", f"Повторяется номер АОСР {n}")
    for a in aosrs:
        tag = f"АОСР № {a['no']}"
        if not (a.get("scheme") or {}).get("no"):
            add("bad", f"{tag}: нет исполнительной схемы")
        if a["start"] and a["end"] and a["start"] > a["end"]:
            add("bad", f"{tag}: дата начала позже даты окончания")
        if a["end"] and a["date"] < a["end"]:
            add("warn", f"{tag}: акт датирован раньше окончания работ")
        if not a["materials"] and "демонтаж" not in a["works"].lower():
            add("warn", f"{tag}: не указаны применённые материалы")
        for mid in a["materials"]:
            m = next((x for x in db["materials"] if x["id"] == mid), None)
            if m and a["start"] and m["cert_until"] < a["start"]:
                add("bad", f"{tag}: сертификат «{m['name']}» истёк {ru_date(m['cert_until'])} — до начала работ")
            elif m and a["end"] and m["cert_until"] < a["end"]:
                add("warn", f"{tag}: сертификат «{m['name']}» истёк в период работ ({ru_date(m['cert_until'])})")
    have = {t["name"] for t in folder.get("tests", [])}
    for t in EXPECTED_TESTS.get(folder["section"], []):
        if t not in have:
            add("warn", f"Нет документа: {t}")
    if not issues:
        add("ok", "Замечаний нет — папку можно передавать на подпись")
    return issues


# ---------------- Бланки проверки работ ----------------

RESULT_KEYS = {
    "composition": ("Состав работ", {"ok": "подтвержден", "diff": "расхождение", "none": "не предъявлен"}),
    "volumes": ("Объемы", {"ok": "подтверждены", "diff": "расхождение", "none": "не измерены"}),
    "chars": ("Характеристики", {"ok": "соответствуют", "diff": "расхождение", "none": "нет данных"}),
    "hidden": ("Скрытые этапы", {"ok": "подтверждены документами", "diff": "требуется уточнение"}),
}
ACCESS = {"open": "открыто", "partial": "частично", "hidden": "скрыто"}


def new_inspection(blank_id: str, object_id: str) -> dict:
    b = BLANKS_BY_ID[blank_id]
    return {
        "object_id": object_id, "blank_id": blank_id, "date": date.today().isoformat(),
        "inspector": "", "contractor_rep": "", "place": {"entrance": "", "floor": "", "apt": "", "axes": ""},
        "aosr_id": "", "access": "",
        "rows": [{"name": r["name"], "unit": r["unit"], "doc": r["hint"], "m1": "", "m2": "", "total": ""} for r in b["rows"]],
        "calc": "", "notes": "", "results": {k: "" for k in RESULT_KEYS},
        "action": "", "responsible": "", "deadline": "", "photos": "", "method": "",
        "status": "draft",
    }


def has_discrepancy(insp: dict) -> bool:
    return any(v == "diff" for v in insp["results"].values())
