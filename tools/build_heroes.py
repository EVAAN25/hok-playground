#!/usr/bin/env python3
"""raw/herolist.json + raw/gender.json (+ 可选 raw/hero_release.json) -> data/heroes.json
用法: python3 tools/build_heroes.py
"""
import json, os, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

HERO_TYPE = {1: "战士", 2: "法师", 3: "坦克", 4: "刺客", 5: "射手", 6: "辅助"}
ROLE = {1: "对抗路", 2: "打野", 3: "中路", 4: "发育路", 5: "游走"}

def main():
    heroes = json.load(open(f"{ROOT}/raw/herolist.json"))
    gender_raw = json.load(open(f"{ROOT}/raw/gender.json"))
    female = set(gender_raw["female"])
    special = gender_raw["special"]

    release = {}
    rel_path = f"{ROOT}/raw/hero_release.json"
    if os.path.exists(rel_path):
        rel = json.load(open(rel_path))
        entries = rel if isinstance(rel, list) else rel.get("heroes", [])
        for r in entries:
            key = r.get("id") or r.get("ename") or r.get("name")
            release[str(key)] = r
        print(f"merged release data for {len(release)} heroes")
    else:
        print("raw/hero_release.json not found -> release=null (之后跑 tools/merge_release.py 合并)")

    out = []
    for h in heroes:
        ename = str(h["ename"])
        cname = h["cname"]
        types = [HERO_TYPE[h["hero_type"]]]
        if h.get("hero_type2"):
            types.append(HERO_TYPE[h["hero_type2"]])
        roles = [ROLE[int(r)] for r in h.get("roles", "").split("|") if r.strip()]
        if cname in special:
            gender = special[cname]
        elif cname in female:
            gender = "女"
        else:
            gender = "男"
        skins = h["skin_name"].split("|")
        r = release.get(ename) or release.get(cname)
        rel = None
        if r:
            rel = {"date": r.get("date"), "precision": r.get("precision", "day"),
                   "confidence": r.get("confidence", "medium")}
        out.append({
            "id": ename,
            "name": cname,
            "pinyin": h.get("id_name", ""),
            "title": h.get("title", ""),
            "types": types,
            "roles": roles,
            "gender": gender,
            "skinCount": len(skins),
            "skins": skins,
            "release": rel,
            "avatar": f"assets/avatars/{ename}.jpg",
        })

    result = {
        "generated_at": datetime.datetime.now().isoformat(timespec="seconds"),
        "source": "https://pvp.qq.com/web201605/js/herolist.json + raw/gender.json(人工标注)",
        "count": len(out),
        "heroes": out,
    }
    os.makedirs(f"{ROOT}/data", exist_ok=True)
    with open(f"{ROOT}/data/heroes.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=1)
    print(f"heroes: {len(out)} -> data/heroes.json")

if __name__ == "__main__":
    main()
