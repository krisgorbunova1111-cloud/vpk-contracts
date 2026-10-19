"""Исполнительная документация: папки по видам работ, реестр (форма 1.1),
проверка полноты, бланки проверки работ.

Структура папки повторяет образцы заказчика: реестр → приказы на ответственных
лиц → дефектный акт → АОСР + исполнительные схемы → акты испытаний → реестр
документов о качестве + сертификаты/паспорта → прочие акты → журналы.
"""
import json
import re
from datetime import date
from pathlib import Path

from .seed import AOSR_ROLES, DEFAULT_NORMS, EXPECTED_TESTS, NORMS

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
        if p and p.get("order_no"):  # без распорядительного документа в реестр не попадает
            f = p["fio"].split()
            kind = (p.get("order_kind") or "приказ").capitalize()
            rows.append({"name": f"{kind} от {ru_date(p.get('order_date'))} — {f[0]} {''.join(x[0] + '.' for x in f[1:])}", "no": p.get("order_no") or "—", "sheets": 1, "kind": "order"})
    da = folder.get("defect_act")
    if da:
        rows.append({"name": f"Дефектный акт от {ru_date(da['date'])}", "no": da["no"], "sheets": da.get("sheets", 1)})
    for a in folder_aosr(db, folder["id"]):
        rows.append({"name": f"АОСР от {ru_date(a['date'])}. {short(a['works'])}", "no": a["no"], "sheets": 1, "kind": "aosr", "id": a["id"]})
        s = a.get("scheme") or {}
        if s.get("no"):
            rows.append({"name": f"Исполнительная схема. {short(a['works'])}", "no": s["no"], "sheets": s.get("sheets", 1)})
    for i, t in enumerate(folder.get("tests", [])):
        rows.append({"name": t["name"], "no": t.get("no", "б/н"), "sheets": t.get("sheets", 1), "kind": "test", "idx": i})
    mats = folder_materials(db, folder["id"])
    if mats:
        rows.append({"name": "Реестр документов, подтверждающих качество", "no": "б/н", "sheets": 1, "kind": "quality"})
        for m in mats:
            doc_name = f"Сертификат соответствия до {ru_date(m['cert_until'])}" if m.get("cert_until") else "Документ о качестве"
            rows.append({"name": f"{doc_name} — {m['name']}", "no": m.get("cert_no") or "уточнить", "sheets": m.get("cert_sheets", 1)})
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
    nos = [a["no"] for a in aosrs if a["no"] not in ("", "б/н")]
    for n in {n for n in nos if nos.count(n) > 1}:
        add("bad", f"Повторяется номер АОСР {n}")
    unnumbered = len(aosrs) - len(nos)
    if unnumbered:
        add("warn", f"АОСР без номера: {unnumbered} — присвойте номера по журналу")
    for a in aosrs:
        tag = f"АОСР № {a['no']}"
        if not (a.get("scheme") or {}).get("no"):
            add("bad", f"{tag}: нет исполнительной схемы")
        if a["start"] and a["end"] and a["start"] > a["end"]:
            add("bad", f"{tag}: дата начала позже даты окончания")
        if not a["date"]:
            add("warn", f"{tag}: не указана дата акта")
        elif a["end"] and a["date"] < a["end"]:
            add("warn", f"{tag}: акт датирован раньше окончания работ")
        if not a["materials"] and "демонтаж" not in a["works"].lower():
            add("warn", f"{tag}: не указаны применённые материалы")
        for mid in a["materials"]:
            m = next((x for x in db["materials"] if x["id"] == mid), None)
            if m and not m.get("cert_no"):
                add("warn", f"{tag}: нет реквизитов документа о качестве «{m['name']}»")
            elif not m or not m.get("cert_until"):
                continue
            elif a["start"] and m["cert_until"] < a["start"]:
                add("bad", f"{tag}: сертификат «{m['name']}» истёк {ru_date(m['cert_until'])} — до начала работ")
            elif a["end"] and m["cert_until"] < a["end"]:
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


# ---------------- Дефектный акт → папки и черновики АОСР ----------------

SECTION_WORDS = [
    ("Отопление", r"отоплен|радиатор|элеватор|конвектор|терморегул|термоголов"),
    ("Электроснабжение", r"кабел|провод|щит|светильник|автомат|электр|вру|розетк|выключател|освещ"),
    ("Водоснабжение и канализация", r"канализ|водопровод|хвс|гвс|водоснаб|водоотвед|ливнев|стояк|сантех|унитаз|смесител"),
    ("Кровля", r"кровл|крыш|стропил|обрешет|водосто|снегозадерж|парапет|слухов"),
    ("Окна и двери", r"окон|окна|двер|откос|подоконн|отлив|люк|доводчик"),
    ("Фасад и отмостка", r"фасад|отмост|цокол|козыр"),
    ("Места общего пользования", r"подъезд|моп|лестни|штукатур|окраск|шпатлев|побелк|перил|поручн|почтов"),
    ("Конструктив", r"стен|плит|кладк|балкон|перекрыт|трещин|перегородк"),
]
SECTION_TITLE = {
    "Отопление": ("системы отопления", "Монтаж"),
    "Водоснабжение и канализация": ("систем водоснабжения и канализации", "Монтаж"),
    "Электроснабжение": ("внутренних систем электроснабжения", "Монтаж"),
    "Кровля": ("кровли", "Устройство"),
    "Окна и двери": ("оконных и дверных блоков", "Монтаж"),
    "Фасад и отмостка": ("фасада и отмостки", "Ремонт"),
    "Места общего пользования": ("отделки мест общего пользования", "Ремонт"),
    "Конструктив": ("конструктивных элементов", "Ремонт"),
}
DEMOLITION = r"^\s*(демонтаж|разборк|снятие|вырубк|расчистк)"


def guess_section(name: str) -> str:
    low = name.lower()
    for sec, pat in SECTION_WORDS:
        if re.search(pat, low):
            return sec
    return "Конструктив"


def parse_defect_text(text: str) -> list[dict]:
    """Строки, скопированные из Excel/Word: «наименование ⇥ ед. ⇥ количество» (номер п/п в начале допускается)."""
    rows = []
    for line in text.splitlines():
        cells = [c.strip() for c in re.split(r"\t|;", line) if c.strip()]
        if cells and re.fullmatch(r"\d+\.?", cells[0]):
            cells = cells[1:]
        if not cells:
            continue
        name = cells[0]
        unit = cells[1] if len(cells) > 1 else ""
        qty_s = cells[2] if len(cells) > 2 else ""
        try:
            qty = float(qty_s.replace(" ", "").replace(",", "."))
            qty = int(qty) if qty == int(qty) else qty
        except ValueError:
            qty = qty_s
        rows.append({"section": guess_section(name), "name": name, "unit": unit, "qty": qty})
    return rows


def fmt_qty(q) -> str:
    return str(q).replace(".", ",")


def works_text(title: str, volumes: list[dict]) -> str:
    return f"{title}: " + "; ".join(f"{v['name'].lower() if i else v['name']} — {fmt_qty(v['qty'])} {v['unit']}".strip()
                                     for i, v in enumerate(volumes)) if volumes else title


def build_from_defect(db, obj, new_id) -> dict:
    """Раскладывает строки дефектного акта по папкам (разделам) и создаёт/обновляет черновики АОСР:
    отдельно демонтаж и монтаж — как в образцах заказчика."""
    da = db["defect_acts"].get(obj["id"])
    if not da or not da["rows"]:
        return {"error": "Дефектный акт пуст"}
    stats = {"folders_created": 0, "aosr_created": 0, "aosr_updated": 0, "sections": []}
    by_section: dict[str, list] = {}
    for r in da["rows"]:
        by_section.setdefault(r["section"], []).append(r)
    folders = [f for f in db["id_folders"] if f["object_id"] == obj["id"]]
    stats["skipped"] = []
    for sec, rows in by_section.items():
        sec_folders = {x["id"] for x in folders if x["section"] == sec}
        if any(a["folder_id"] in sec_folders and not a.get("source") for a in db["aosr"]):
            stats["skipped"].append(sec)  # там уже есть АОСР, введённые вручную, — не задваиваем
            continue
        what, verb = SECTION_TITLE.get(sec, (sec.lower(), "Монтаж"))
        f = next((x for x in folders if x["section"] == sec), None)
        if not f:
            f = {"id": new_id("f"), "object_id": obj["id"], "no": max([x["no"] for x in folders], default=0) + 1,
                 "title": f"Демонтаж-{verb.lower()} {what}" if verb == "Монтаж" else f"{verb} {what}", "section": sec,
                 "tests": [], "journals": [{"name": "Общий журнал работ", "no": "", "sheets": 1}], "extra": []}
            db["id_folders"].append(f)
            folders.append(f)
            stats["folders_created"] += 1
        f["defect_act"] = {"no": da["no"], "date": da["date"], "sheets": da.get("sheets", 1)}
        stats["sections"].append(sec)
        dem = [r for r in rows if re.search(DEMOLITION, r["name"].lower())]
        mon = [r for r in rows if r not in dem]
        for kind, part, title in (("dem", dem, f"Демонтаж {what}"), ("mon", mon, f"{verb} {what}")):
            if not part:
                continue
            vols = [{"name": r["name"], "unit": r["unit"], "qty": r["qty"]} for r in part]
            src = f"da:{sec}:{kind}"
            a = next((x for x in db["aosr"] if x["folder_id"] == f["id"] and x.get("source") == src), None)
            if a:
                # текст, поправленный вручную, не трогаем — обновляем только объёмы
                if not a["works"] or a["works"] == works_text(title, a.get("volumes", [])):
                    a["works"] = works_text(title, vols)
                a["volumes"] = vols
                stats["aosr_updated"] += 1
                continue
            n = len([x for x in db["aosr"] if x["folder_id"] == f["id"]]) + 1
            house = "".join(ch for ch in obj["name"].split(",")[-1] if ch.isalnum())
            db["aosr"].append({
                "id": new_id("a"), "folder_id": f["id"], "source": src, "no": f"{n}/д.{house}" if house else str(n),
                "date": "", "works": works_text(title, vols), "volumes": vols, "basis": "", "materials": [],
                "scheme": {"no": str(n), "date": "", "sheets": 1}, "start": "", "end": "",
                "norms": NORMS.get(sec, DEFAULT_NORMS)[:3], "next_works": "", "extra_info": "нет", "copies": 4})
            stats["aosr_created"] += 1
    return stats


def summary(db) -> list[dict]:
    """Сводка по объектам: папки ИД, ошибки, открытые замечания проверок."""
    out = []
    for o in db["objects"]:
        fs = [f for f in db["id_folders"] if f["object_id"] == o["id"]]
        ins = [i for i in db["inspections"] if i["object_id"] == o["id"]]
        bad = warn = ready = 0
        for f in fs:
            lv = [x["level"] for x in check_folder(db, f)]
            bad += lv.count("bad")
            warn += lv.count("warn")
            ready += lv == ["ok"]
        out.append({"object_id": o["id"], "folders": len(fs), "ready": ready, "bad": bad, "warn": warn,
                    "aosr": sum(1 for a in db["aosr"] if any(a["folder_id"] == f["id"] for f in fs)),
                    "checks": len(ins), "open_remarks": sum(1 for i in ins if has_discrepancy(i) and i.get("status") != "closed"),
                    "has_defect_act": bool((db.get("defect_acts") or {}).get(o["id"], {}).get("rows"))})
    return out
