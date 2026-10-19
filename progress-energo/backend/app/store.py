"""Простое хранилище прототипа: один JSON-файл на диске.

Для боевой версии заменяется на PostgreSQL (+ PostGIS для координат),
а облака точек — на объектное хранилище (S3/MinIO). Интерфейс у
остального кода при этом не меняется: get / put / new_id.
"""
import json
import threading
import uuid
from pathlib import Path

from .seed import build_seed, load_local_examples, merge_example

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DB_FILE = DATA_DIR / "db.json"
UPLOADS = DATA_DIR / "uploads"


class Store:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        DATA_DIR.mkdir(exist_ok=True)
        UPLOADS.mkdir(exist_ok=True)
        if DB_FILE.exists():
            self.db = json.loads(DB_FILE.read_text(encoding="utf-8"))
            # новые разделы базы, появившиеся в обновлениях, — дополняем из демо-данных
            seed = build_seed()
            added = [k for k in seed if k not in self.db]
            for k in added:
                self.db[k] = seed[k]
            known = {m["id"] for m in self.db["materials"]}
            self.db["materials"] += [m for m in seed["materials"] if m["id"] not in known]
            for m in self.db["materials"]:
                m.setdefault("cert_sheets", 1)
                m.setdefault("passport_sheets", 4 if m.get("passport") else 0)
            seed_aosr = {a["id"]: a for a in seed["aosr"]}
            for a in self.db["aosr"]:
                if "volumes" not in a:
                    a["volumes"] = seed_aosr.get(a["id"], {}).get("volumes", [])
                    if a["id"] in seed_aosr:
                        a["source"] = seed_aosr[a["id"]].get("source")
            for ex in load_local_examples():
                added += ["example"] if merge_example(self.db, ex) else []
            if added:
                self.save()
        else:
            self.reset()

    def reset(self) -> None:
        self.db = build_seed()
        self.save()

    def save(self) -> None:
        with self._lock:
            tmp = DB_FILE.with_suffix(".tmp")
            tmp.write_text(json.dumps(self.db, ensure_ascii=False, indent=1), encoding="utf-8")
            tmp.replace(DB_FILE)

    @staticmethod
    def new_id(prefix: str) -> str:
        return f"{prefix}{uuid.uuid4().hex[:8]}"

    # --- удобные выборки ---
    def obj(self, object_id: str) -> dict | None:
        return next((o for o in self.db["objects"] if o["id"] == object_id), None)

    def checklist(self, object_id: str) -> dict:
        return self.db["checklists"].get(object_id) or empty_checklist()


def empty_checklist() -> dict:
    return {
        "constructions": {"foundation": "", "walls": "", "roof": "", "slabs": "", "notes": ""},
        "systems": {},
        "nodes": [], "materials": [],
        "works": [
            {"name": "Обмерные работы", "done": False},
            {"name": "Лазерное сканирование", "done": False},
            {"name": "Вскрытие конструкций", "done": False},
            {"name": "Фотофиксация", "done": False},
        ],
        "lab_required": False, "lab_test": "",
    }


store = Store()
