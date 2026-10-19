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

    materials += [
        {"id": "m8", "name": "Радиатор биметаллический 500/100 (секционный)", "category": "ОВ", "supplier": "ООО «ТеплоПрибор»",
         "cert_no": "ЕАЭС RU С-RU.АЯ09.В.00049/24", "cert_until": "2029-06-18", "passport": True},
        {"id": "m9", "name": "Кран термостатический с термоголовкой", "category": "ОВ", "supplier": "ООО «АрмаТех»",
         "cert_no": "ЕАЭС RU С-RU.МЕ77.В.00911/23", "cert_until": "2026-03-01", "passport": True},
        {"id": "m10", "name": "Фитинги PP-R (соединительные детали)", "category": "ОВ", "supplier": "ООО «Политрон»",
         "cert_no": "РОСС RU.НВ27.Н00536", "cert_until": "2028-05-21", "passport": True},
        {"id": "m11", "name": "Эмаль ПФ-115 для радиаторов", "category": "ОВ", "supplier": "ООО «ЛКМ-Завод»",
         "cert_no": "РОСС RU.НВ25.Н02517", "cert_until": "2028-02-25", "passport": False},
    ]
    for m in materials:
        m.setdefault("cert_sheets", 1)
        m.setdefault("passport_sheets", 4 if m["passport"] else 0)

    return {
        "specialists": specialists, "objects": objects, "visits": visits, "access": access,
        "materials": materials, "nodes": nodes, "checklists": checklists,
        "lab_tickets": lab_tickets, "pointclouds": pointclouds, "tags": tags, "scan_sessions": [],
        **seed_id(d),
    }


# ---------------- Исполнительная документация (по образцам заказчика) ----------------
# Роли участников в АОСР (форма по приказу Минстроя России от 16.05.2023 № 344/пр)
AOSR_ROLES = [
    {"id": "customer_control", "name": "Представитель застройщика (технического заказчика) по вопросам строительного контроля"},
    {"id": "builder", "name": "Представитель лица, осуществляющего строительство"},
    {"id": "builder_control", "name": "Представитель лица, осуществляющего строительство, по вопросам строительного контроля (специалист по организации строительства)"},
    {"id": "designer", "name": "Представитель лица, осуществляющего подготовку проектной документации"},
    {"id": "executor", "name": "Представитель лица, выполнившего работы, подлежащие освидетельствованию"},
]
ORG_ROLES = {
    "developer": "Застройщик / технический заказчик",
    "builder": "Лицо, осуществляющее строительство",
    "designer": "Лицо, осуществляющее подготовку проектной документации",
    "executor": "Лицо, выполнившее работы",
}

# Какие акты испытаний обычно нужны в папке по разделу (для проверки полноты)
EXPECTED_TESTS = {
    "Отопление": ["Акт о проведении гидростатического (манометрического) испытания на герметичность",
                  "Акт о проведении промывки (продувки) трубопроводов",
                  "Акт испытания системы отопления на равномерность прогрева"],
    "Водоснабжение и канализация": ["Акт о проведении гидростатического (манометрического) испытания на герметичность",
                                    "Акт о проведении промывки (продувки) трубопроводов"],
    "Электроснабжение": ["Протокол измерения сопротивления изоляции",
                         "Протокол проверки цепи между заземлителями и заземляемыми элементами"],
}

ID_SECTIONS = ["Отопление", "Водоснабжение и канализация", "Электроснабжение", "Кровля", "Конструктив",
               "Окна и двери", "Места общего пользования", "Фасад и отмостка"]

NORMS = {
    "Отопление": ["СП 48.13330.2019 «Организация строительства»",
                  "СП 54.13330.2022 «Здания жилые многоквартирные»",
                  "СП 60.13330.2020 «Отопление, вентиляция и кондиционирование воздуха»",
                  "СП 73.13330.2016 «Внутренние санитарно-технические системы зданий»"],
    "Водоснабжение и канализация": ["СП 48.13330.2019 «Организация строительства»",
                                    "СП 30.13330.2020 «Внутренний водопровод и канализация зданий»",
                                    "СП 73.13330.2016 «Внутренние санитарно-технические системы зданий»"],
    "Электроснабжение": ["СП 48.13330.2019 «Организация строительства»",
                         "СП 76.13330.2016 «Электротехнические устройства»",
                         "СП 256.1325800.2016 «Электроустановки жилых и общественных зданий»"],
    "Кровля": ["СП 48.13330.2019 «Организация строительства»", "СП 17.13330.2017 «Кровли»",
               "СП 71.13330.2017 «Изоляционные и отделочные покрытия»"],
}
DEFAULT_NORMS = ["СП 48.13330.2019 «Организация строительства»", "СП 70.13330.2012 «Несущие и ограждающие конструкции»"]


def seed_id(d) -> dict:
    orgs = [
        {"id": "g1", "name": "ГКУ «Фонд капитального ремонта» (демо)", "ogrn": "1027700000001", "inn": "7700000001",
         "address": "г. Москва, ул. Примерная, д. 1", "sro": "", "phone": "+7 (495) 000-00-01"},
        {"id": "g2", "name": "ООО «Генподряд-Строй» (демо)", "ogrn": "1226100000002", "inn": "6100000002",
         "address": "г. Ростов-на-Дону, ул. Строителей, д. 2", "sro": "СРО-С-000-00000 Ассоциация «Строители» (демо)", "phone": "+7 (863) 000-00-02"},
        {"id": "g3", "name": "ООО ВПК «Прогресс Энерго»", "ogrn": "—", "inn": "—",
         "address": "—", "sro": "—", "phone": "—"},
        {"id": "g4", "name": "ФАУ «Технадзор-Эксперт» (демо)", "ogrn": "1027700000004", "inn": "7700000004",
         "address": "г. Москва, ул. Контрольная, д. 4", "sro": "", "phone": "+7 (495) 000-00-04"},
    ]
    people = [
        {"id": "h1", "fio": "Соколов Игорь Петрович", "position": "Главный специалист группы строительного контроля", "org_id": "g4",
         "order_no": "15", "order_date": "2026-01-10", "nrs": ""},
        {"id": "h2", "fio": "Морозов Андрей Валерьевич", "position": "Руководитель проекта", "org_id": "g2",
         "order_no": "5", "order_date": "2026-01-12", "nrs": ""},
        {"id": "h3", "fio": "Волков Дмитрий Сергеевич", "position": "Руководитель отдела строительного контроля", "org_id": "g2",
         "order_no": "11", "order_date": "2026-01-15", "nrs": "С-77-000001"},
        {"id": "h4", "fio": "Лебедев Владимир Владимирович", "position": "Руководитель проекта", "org_id": "g3",
         "order_no": "1", "order_date": "2026-02-01", "nrs": ""},
        {"id": "h5", "fio": "Новиков Алексей Сергеевич", "position": "Главный специалист строительного контроля", "org_id": "g3",
         "order_no": "122-ск", "order_date": "2026-02-01", "nrs": "С-34-000002"},
        {"id": "h6", "fio": "Зайцев Андрей Анатольевич", "position": "Начальник участка", "org_id": "g3",
         "order_no": "2285-лс", "order_date": "2026-03-01", "nrs": ""},
    ]
    object_roles = {
        "o1": {"orgs": {"developer": "g1", "builder": "g2", "designer": "", "executor": "g3"},
               "people": {"customer_control": "h1", "builder": "h2", "builder_control": "h3", "designer": "",
                          "executor": "h4", "others": ["h5", "h6"]}},
    }
    folders = [
        {"id": "f1", "object_id": "o1", "no": 1, "title": "Демонтаж-монтаж системы отопления (верхняя разводка)",
         "section": "Отопление", "defect_act": {"no": "1", "date": d(-60), "sheets": 4},
         "tests": [
             {"name": "Акт о проведении гидростатического (манометрического) испытания на герметичность", "no": "б/н", "date": d(-6), "sheets": 1},
             {"name": "Акт о проведении промывки (продувки) трубопроводов", "no": "б/н", "date": d(-5), "sheets": 1},
         ],
         "journals": [
             {"name": "Общий журнал работ", "no": "4", "sheets": 16},
             {"name": "Журнал входного контроля и контроля качества получаемых деталей, материалов, конструкций и оборудования", "no": "б/н", "sheets": 4},
         ],
         "extra": [{"name": "Акты об отказе в предоставлении допуска к общему имуществу МКД", "no": "б/н", "sheets": 3}]},
        {"id": "f2", "object_id": "o1", "no": 2, "title": "Демонтаж-монтаж внутренних систем электроснабжения МОП",
         "section": "Электроснабжение", "defect_act": {"no": "1", "date": d(-60), "sheets": 4},
         "tests": [], "journals": [{"name": "Общий журнал работ", "no": "4", "sheets": 16}], "extra": []},
    ]
    aosr = [
        {"id": "a1", "folder_id": "f1", "no": "1/д.14", "date": d(-8),
         "works": "Демонтаж системы отопления с 1-го по 9-й этаж: демонтаж стальных стояков Ø20–25 мм — 648 м.п., демонтаж чугунных радиаторов — 214 шт.",
         "basis": "", "materials": [], "scheme": {"no": "1", "date": d(-8), "sheets": 6},
         "start": d(-40), "end": d(-25), "norms": NORMS["Отопление"][:3], "next_works": "Монтаж системы отопления",
         "extra_info": "нет", "copies": 4},
        {"id": "a2", "folder_id": "f1", "no": "2/д.14", "date": d(-7),
         "works": "Монтаж системы отопления с 1-го по 9-й этаж: монтаж биметаллических радиаторов — 214 шт., монтаж полипропиленовых труб Ø20 мм — 110 м.п., Ø25 мм — 790 м.п.",
         "basis": "", "materials": ["m3", "m8", "m9", "m10", "m11"], "scheme": {"no": "2", "date": d(-7), "sheets": 8},
         "start": d(-24), "end": d(-7), "norms": NORMS["Отопление"][:3], "next_works": "Гидравлические испытания системы отопления",
         "extra_info": "нет", "copies": 4},
    ]
    return {"organizations": orgs, "people": people, "object_roles": object_roles,
            "id_folders": folders, "aosr": aosr, "inspections": []}
