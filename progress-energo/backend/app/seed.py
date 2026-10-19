"""Демо-данные прототипа: объекты, специалисты, справочники.

Всё, что здесь лежит, — выдуманные примеры, чтобы приложение можно было
«пощупать». При первом запуске они копируются в data/db.json.
"""
from datetime import date, timedelta

STAGES = [
    {"id": "plan", "name": "Планирование"},
    {"id": "field", "name": "Выезд"},
    {"id": "cloud", "name": "Облако точек"},
    {"id": "office", "name": "Камералка (ИД)"},
    {"id": "design", "name": "РД и смета"},
    {"id": "print", "name": "Печать и подпись"},
    {"id": "done", "name": "Сдано"},
]

ROLES = [
    {"id": "dispatcher", "name": "Диспетчер / Руководитель"},
    {"id": "scanner", "name": "Выездной специалист"},
    {"id": "engineer", "name": "Камеральщик / Инженер"},
    {"id": "designer", "name": "Проектировщик / Сметчик"},
    {"id": "archivist", "name": "Копирайтер / Архивариус"},
]

BUILDING_TYPES = {
    "mkd": "Жилой многоквартирный дом",
    "school": "Школа / детский сад",
    "admin": "Административное здание",
    "industrial": "Производственное здание",
}

SYSTEMS = {
    "EOM": "Электроснабжение (ЭОМ)",
    "VK": "Водоснабжение и канализация (ВК)",
    "OV": "Отопление и вентиляция (ОВ)",
    "TS": "Теплоснабжение (ТС)",
}


def _monday() -> date:
    today = date.today()
    return today - timedelta(days=today.weekday())


def build_seed() -> dict:
    mon = _monday()

    def d(offset: int) -> str:
        return (mon + timedelta(days=offset)).isoformat()

    specialists = [
        {"id": "s1", "name": "Иванов А.С.", "role": "scanner", "color": "#2563eb"},
        {"id": "s2", "name": "Петров Д.В.", "role": "scanner", "color": "#16a34a"},
        {"id": "s3", "name": "Сидорова Е.Н.", "role": "scanner", "color": "#d97706"},
        {"id": "s4", "name": "Кузнецов М.И.", "role": "engineer", "color": "#7c3aed"},
        {"id": "s5", "name": "Орлова Т.П.", "role": "designer", "color": "#db2777"},
        {"id": "s6", "name": "Белова Н.Ю.", "role": "archivist", "color": "#0891b2"},
    ]

    objects = [
        {"id": "o1", "code": "PE-2026-001", "name": "МКД ул. Ленина, 14",
         "address": "г. Москва, ул. Ленина, д. 14", "building_type": "mkd",
         "area": 4850, "floors": 9, "year": 1972, "systems": ["EOM", "VK", "OV", "TS"],
         "priority": 1, "stage": "office", "customer": "ГБУ «Жилищник района»",
         "deadline": d(18)},
        {"id": "o2", "code": "PE-2026-002", "name": "Школа № 1287",
         "address": "г. Москва, ул. Школьная, д. 3", "building_type": "school",
         "area": 6200, "floors": 4, "year": 1965, "systems": ["EOM", "VK", "OV"],
         "priority": 1, "stage": "field", "customer": "ДОНМ г. Москвы",
         "deadline": d(25)},
        {"id": "o3", "code": "PE-2026-003", "name": "Админ. здание пр. Мира, 72",
         "address": "г. Москва, пр-т Мира, д. 72, стр. 1", "building_type": "admin",
         "area": 2300, "floors": 5, "year": 1988, "systems": ["EOM", "OV"],
         "priority": 2, "stage": "plan", "customer": "АО «Мосинжпроект»",
         "deadline": d(32)},
        {"id": "o4", "code": "PE-2026-004", "name": "МКД ул. Гагарина, 5к2",
         "address": "г. Москва, ул. Гагарина, д. 5, корп. 2", "building_type": "mkd",
         "area": 3100, "floors": 5, "year": 1961, "systems": ["EOM", "VK", "TS"],
         "priority": 2, "stage": "cloud", "customer": "ГБУ «Жилищник района»",
         "deadline": d(21)},
        {"id": "o5", "code": "PE-2026-005", "name": "Котельная пос. Северный",
         "address": "МО, пос. Северный, ул. Заводская, 1", "building_type": "industrial",
         "area": 900, "floors": 1, "year": 1979, "systems": ["EOM", "TS"],
         "priority": 3, "stage": "design", "customer": "МУП «Теплосеть»",
         "deadline": d(40)},
        {"id": "o6", "code": "PE-2026-006", "name": "Детский сад № 45",
         "address": "г. Москва, ул. Садовая, д. 8", "building_type": "school",
         "area": 1800, "floors": 2, "year": 1983, "systems": ["EOM", "VK", "OV", "TS"],
         "priority": 2, "stage": "print", "customer": "ДОНМ г. Москвы",
         "deadline": d(9)},
        {"id": "o7", "code": "PE-2026-007", "name": "МКД ш. Энтузиастов, 31",
         "address": "г. Москва, ш. Энтузиастов, д. 31", "building_type": "mkd",
         "area": 7400, "floors": 12, "year": 1979, "systems": ["EOM", "VK", "OV", "TS"],
         "priority": 3, "stage": "plan", "customer": "Фонд капремонта",
         "deadline": d(45)},
    ]

    visits = [
        {"id": "v1", "object_id": "o2", "specialist_id": "s1", "date": d(0), "start": 9, "hours": 7, "status": "done"},
        {"id": "v2", "object_id": "o2", "specialist_id": "s2", "date": d(1), "start": 9, "hours": 6, "status": "planned"},
        {"id": "v3", "object_id": "o3", "specialist_id": "s3", "date": d(2), "start": 10, "hours": 5, "status": "planned"},
        {"id": "v4", "object_id": "o7", "specialist_id": "s1", "date": d(3), "start": 9, "hours": 8, "status": "planned"},
        {"id": "v5", "object_id": "o7", "specialist_id": "s2", "date": d(4), "start": 9, "hours": 8, "status": "planned"},
        {"id": "v6", "object_id": "o4", "specialist_id": "s3", "date": d(0), "start": 13, "hours": 4, "status": "done"},
    ]

    access_items = ["Места общего пользования (МОП)", "Подвал / техподполье",
                    "Чердак / кровля", "Электрощитовая", "ИТП / тепловой узел"]
    access = {}
    for o in objects:
        done = o["stage"] not in ("plan",)
        access[o["id"]] = [
            {"item": it, "status": "granted" if done else ("requested" if i < 2 else "needed")}
            for i, it in enumerate(access_items)
        ]

    materials = [
        {"id": "m1", "name": "Кабель ВВГнг(А)-LS 3×2,5", "category": "ЭОМ", "supplier": "ООО «Электрокабель»",
         "cert_no": "ЕАЭС RU С-RU.АД07.В.01234/25", "cert_until": "2030-05-14", "passport": True},
        {"id": "m2", "name": "Автоматический выключатель ВА47-29 16А", "category": "ЭОМ", "supplier": "IEK",
         "cert_no": "ЕАЭС RU С-RU.МЕ77.В.00561/24", "cert_until": "2029-03-01", "passport": True},
        {"id": "m3", "name": "Труба ПП-R PN20 Ø25", "category": "ВК", "supplier": "ООО «Политрон»",
         "cert_no": "РОСС RU.НВ61.Н12345", "cert_until": "2028-11-20", "passport": True},
        {"id": "m4", "name": "Радиатор биметаллический 500/80", "category": "ОВ", "supplier": "Rifar",
         "cert_no": "ЕАЭС RU С-RU.НА46.В.07788/25", "cert_until": "2030-08-09", "passport": True},
        {"id": "m5", "name": "Счётчик тепла ВКТ-9", "category": "ТС", "supplier": "ЗАО «Термотроник»",
         "cert_no": "Свид. об утв. типа СИ № 76543-19", "cert_until": "2029-12-31", "passport": True},
        {"id": "m6", "name": "Бетон В25 F150 W6", "category": "КР", "supplier": "ООО «БетонСтрой»",
         "cert_no": "Документ о качестве партии", "cert_until": "2027-01-01", "passport": False},
        {"id": "m7", "name": "Утеплитель минвата 100 мм", "category": "АР", "supplier": "ТехноНИКОЛЬ",
         "cert_no": "ЕАЭС RU С-RU.ПБ34.В.00112/23", "cert_until": "2028-06-30", "passport": True},
    ]

    nodes = [
        {"id": "n1", "system": "EOM", "type": "Ввод", "name": "ВРУ-0,4 кВ (вводно-распределительное устройство)"},
        {"id": "n2", "system": "EOM", "type": "Щит", "name": "Щит этажный ЩЭ"},
        {"id": "n3", "system": "EOM", "type": "Узел учёта", "name": "Общедомовой узел учёта электроэнергии"},
        {"id": "n4", "system": "VK", "type": "Ввод", "name": "Ввод холодного водоснабжения"},
        {"id": "n5", "system": "VK", "type": "Узел учёта", "name": "Водомерный узел ХВС"},
        {"id": "n6", "system": "OV", "type": "Узел", "name": "Элеваторный узел"},
        {"id": "n7", "system": "OV", "type": "Узел", "name": "Узел регулирования отопления"},
        {"id": "n8", "system": "TS", "type": "Узел учёта", "name": "Узел учёта тепловой энергии (УУТЭ)"},
        {"id": "n9", "system": "TS", "type": "Ввод", "name": "Тепловой ввод"},
    ]

    checklists = {
        "o1": {
            "constructions": {"foundation": "satisfactory", "walls": "limited", "roof": "satisfactory", "slabs": "satisfactory",
                              "notes": "Трещины в несущей стене подвала по оси 3, ширина раскрытия до 2 мм."},
            "systems": {
                "EOM": {"state": "limited", "notes": "ВРУ 1972 г., требуется замена."},
                "VK": {"state": "satisfactory", "notes": ""},
                "OV": {"state": "satisfactory", "notes": ""},
                "TS": {"state": "limited", "notes": "Нет узла учёта тепла."},
            },
            "nodes": ["n1", "n3", "n4", "n5", "n6"],
            "materials": ["m1", "m2", "m3", "m4"],
            "works": [
                {"name": "Обмерные работы", "done": True},
                {"name": "Лазерное сканирование", "done": True},
                {"name": "Вскрытие конструкций", "done": False},
                {"name": "Фотофиксация", "done": True},
            ],
            "lab_required": True, "lab_test": "Прочность бетона (неразрушающий метод)",
        },
    }

    lab_tickets = [
        {"id": "l1", "object_id": "o1", "address": "г. Москва, ул. Ленина, д. 14",
         "test_type": "Прочность бетона (неразрушающий метод)", "status": "in_work",
         "created": d(-3), "lab": "ТНК РФ"},
    ]

    pointclouds = [
        {"id": "p1", "object_id": "o1", "filename": "Lenina14_scan_01.e57", "format": "e57",
         "size_mb": 3820, "points_mln": 412, "uploaded": d(-5), "status": "vectorized"},
        {"id": "p2", "object_id": "o4", "filename": "Gagarina5k2_full.las", "format": "las",
         "size_mb": 2150, "points_mln": 236, "uploaded": d(0), "status": "indexed"},
        {"id": "p3", "object_id": "o2", "filename": "School1287_floor1.ptx", "format": "ptx",
         "size_mb": 1470, "points_mln": 158, "uploaded": d(0), "status": "uploaded"},
    ]

    tags = [
        {"id": "t1", "object_id": "o1", "x": 22, "y": 30, "label": "ВРУ-0,4 кВ", "kind": "node"},
        {"id": "t2", "object_id": "o1", "x": 70, "y": 62, "label": "Трещина, ось 3", "kind": "defect"},
    ]

    return {
        "specialists": specialists, "objects": objects, "visits": visits, "access": access,
        "materials": materials, "nodes": nodes, "checklists": checklists,
        "lab_tickets": lab_tickets, "pointclouds": pointclouds, "tags": tags, "scan_sessions": [],
    }
