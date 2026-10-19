"""Расчёты: трудозатраты на объект, смета ПИР, «ИИ»-разбор текста, 2D-план.

Все коэффициенты — внутренние нормы-заглушки. Их легко поправить здесь,
не трогая остальной код.
"""
import hashlib
import re

from .seed import BUILDING_TYPES, SYSTEMS

# ---------------- Трудозатраты ----------------

TYPE_K = {"mkd": 1.0, "school": 1.15, "admin": 0.9, "industrial": 1.3}
FIELD_M2_PER_HOUR = 650      # м² сканирования за час работы на объекте
OFFICE_M2_PER_HOUR = 220     # м² камеральной обработки за час
SYSTEM_FIELD_H = 1.5         # обход одной инженерной системы, ч
SYSTEM_OFFICE_H = 4.0        # оформление ИД по одной системе, ч


def labour(obj: dict) -> dict:
    k = TYPE_K.get(obj["building_type"], 1.0)
    floors_k = 1 + max(obj["floors"] - 5, 0) * 0.03
    n_sys = len(obj["systems"])
    field = (obj["area"] / FIELD_M2_PER_HOUR) * k * floors_k + n_sys * SYSTEM_FIELD_H
    office = (obj["area"] / OFFICE_M2_PER_HOUR) * k + n_sys * SYSTEM_OFFICE_H
    design = 6 + n_sys * 5 + obj["area"] / 800
    field_days = max(1, round(field / 8 + 0.49))
    return {
        "field_hours": round(field, 1),
        "field_days": field_days,
        "specialists": 2 if obj["area"] > 4000 else 1,
        "office_hours": round(office, 1),
        "design_hours": round(design, 1),
        "total_hours": round(field + office + design, 1),
        "explain": [
            f"Тип здания «{BUILDING_TYPES.get(obj['building_type'])}»: коэффициент {k}",
            f"Этажность {obj['floors']}: коэффициент {floors_k:.2f}",
            f"Площадь {obj['area']} м² → {obj['area'] / FIELD_M2_PER_HOUR:.1f} ч сканирования",
            f"Инженерных систем: {n_sys} → +{n_sys * SYSTEM_FIELD_H:.1f} ч на объекте, +{n_sys * SYSTEM_OFFICE_H:.0f} ч в офисе",
        ],
    }


# ---------------- Смета ПИР ----------------

VAT = 0.22  # НДС с 01.01.2026

PRICE_PER_M2 = {          # руб/м², внутренние нормы (заглушка)
    "survey": ("Техническое обследование конструкций", 38.0),
    "scan": ("Лазерное сканирование и обмерные чертежи", 24.0),
    "AR": ("Раздел АР (заготовка по обмерам)", 18.0),
    "KR": ("Раздел КР", 21.0),
}
PRICE_PER_SYSTEM_M2 = {   # раздел РД на инженерную систему
    "EOM": ("Раздел ЭОМ", 16.0),
    "VK": ("Раздел ВК", 13.0),
    "OV": ("Раздел ОВ", 15.0),
    "TS": ("Раздел ТС", 12.0),
}
LAB_PRICE = 45000.0
ID_PRICE = 3500.0  # за том исполнительной документации


def estimate(obj: dict, checklist: dict) -> dict:
    area = obj["area"]
    age_k = 1.15 if obj["year"] < 1970 else 1.0
    floors_k = 1.1 if obj["floors"] > 9 else 1.0
    k = round(age_k * floors_k * TYPE_K.get(obj["building_type"], 1.0), 3)
    lines = []

    def add(code, name, basis, qty, unit, price):
        lines.append({"code": code, "name": name, "basis": basis, "qty": qty, "unit": unit,
                      "price": round(price, 2), "k": k, "sum": round(qty * price * k, 2)})

    works_done = {w["name"] for w in checklist.get("works", []) if w.get("done")}
    for code, (name, price) in PRICE_PER_M2.items():
        if code == "scan" and "Лазерное сканирование" not in works_done and checklist.get("works"):
            # сканирование не проводилось — в смету не берём
            continue
        add(code, name, "Внутр. норма ВПК-ПЭ-2026", area, "м²", price)
    for s in obj["systems"]:
        name, price = PRICE_PER_SYSTEM_M2[s]
        add(s, name, "Внутр. норма ВПК-ПЭ-2026", area, "м²", price)
    add("ID", "Комплектование исполнительной документации", "Внутр. норма ВПК-ПЭ-2026",
        len(obj["systems"]) + 1, "том", ID_PRICE)
    if checklist.get("lab_required"):
        add("LAB", f"Лабораторные испытания: {checklist.get('lab_test') or 'по заявке'}",
            "Прайс лаборатории", 1, "компл.", LAB_PRICE)

    total = round(sum(l["sum"] for l in lines), 2)
    return {
        "object_id": obj["id"], "k": k,
        "k_explain": f"Год постройки {obj['year']} (×{age_k}) · этажность {obj['floors']} (×{floors_k}) · тип здания (×{TYPE_K.get(obj['building_type'], 1.0)})",
        "lines": lines, "total": total, "vat": round(total * VAT, 2),
        "total_vat": round(total * (1 + VAT), 2), "vat_rate": VAT,
    }


# ---------------- «Промпт-сканер»: разбор голосовой заметки ----------------

STATE_WORDS = [
    (r"аварийн", "emergency"),
    (r"ограниченно|трещин|протечк|коррози|разруш|износ|прогиб|сырост|плесен", "limited"),
    (r"удовлетворительн|исправн|норм|без замечаний|хорош", "satisfactory"),
]
CONSTRUCTION_WORDS = {
    "foundation": r"фундамент|подвал|цокол",
    "walls": r"стен|кладк|фасад",
    "roof": r"кровл|крыш|чердак",
    "slabs": r"перекрыт|плит|балк",
}
SYSTEM_WORDS = {
    "EOM": r"электр|щит|вру|кабел|проводк|розетк|освещ",
    "VK": r"водо|канализ|стояк|хвс|гвс|сантех|труб",
    "OV": r"отоплен|вентиляц|радиатор|батаре|элеватор",
    "TS": r"теплоснаб|тепловой узел|теплов|итп|уутэ|теплосчет|теплосчёт",
}
LAB_WORDS = r"лаборатор|испытан|прочност|образец|керн|отбор проб"


def _state(text: str) -> str | None:
    for pat, st in STATE_WORDS:
        if re.search(pat, text):
            return st
    return None


def parse_note(text: str) -> dict:
    """Раскладывает свободный текст по полям чек-листа.

    Работает на правилах (ключевые слова), без внешних сервисов. В боевой
    версии здесь вызывается языковая модель — формат ответа тот же.
    """
    t = text.lower()
    sentences = [s.strip() for s in re.split(r"[.!?;\n]+", t) if s.strip()]
    result = {"constructions": {}, "systems": {}, "lab_required": False, "lab_test": "", "found": []}
    for s in sentences:
        st = _state(s)
        for key, pat in CONSTRUCTION_WORDS.items():
            if re.search(pat, s) and st:
                result["constructions"][key] = st
                result["found"].append(f"Конструкции: «{s}»")
        for key, pat in SYSTEM_WORDS.items():
            if re.search(pat, s):
                result["systems"][key] = {"state": st or "", "notes": s.capitalize()}
                result["found"].append(f"{SYSTEMS[key]}: «{s}»")
        if re.search(LAB_WORDS, s):
            result["lab_required"] = True
            result["lab_test"] = "Прочность бетона (неразрушающий метод)" if "бетон" in s or "прочност" in s else s.capitalize()
            result["found"].append(f"Лаб. контроль: «{s}»")
    result["notes"] = text.strip()
    return result


# ---------------- 2D-план из облака (имитация векторизации) ----------------

def floor_plan(obj: dict) -> dict:
    """Детерминированный «обмерный план» этажа: набор помещений в % координатах."""
    h = int(hashlib.md5(obj["id"].encode()).hexdigest(), 16)
    cols = 3 + h % 3
    rooms = []
    x = 0.0
    names = ["Лестничная клетка", "Коридор", "Электрощитовая", "Тамбур", "Помещение",
             "Санузел", "Тех. помещение", "Кабинет"]
    for c in range(cols):
        w = 100 / cols
        rows = 2 + (h >> (c * 3)) % 2
        y = 0.0
        for r in range(rows):
            hh = 100 / rows
            idx = (h >> (c * 5 + r)) % len(names)
            rooms.append({"x": round(x, 2), "y": round(y, 2), "w": round(w, 2), "h": round(hh, 2),
                          "name": names[idx], "area": round(obj["area"] / obj["floors"] / (cols * rows), 1)})
            y += hh
        x += w
    return {"rooms": rooms, "scale": "1:100", "floor_area": round(obj["area"] / obj["floors"], 1)}
