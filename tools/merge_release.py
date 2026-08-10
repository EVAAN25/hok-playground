#!/usr/bin/env python3
"""把 raw/hero_release.json 合并进 data/heroes.json 的 release 字段。
raw/hero_release.json 期望格式（research agent 产出）:
  {"heroes": [{"ename": 105（或 "id": "105"）, "name": "廉颇"(可选),
               "date": "2015-10-30", "precision": "day|month|year",
               "confidence": "high|medium|low", "source": "..."}, ...]}
匹配优先级: id(ename) > name(cname)。未匹配到的英雄 release 保持 null 并打印清单。
用法: python3 tools/merge_release.py
"""
import json, os, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def main():
    rel_path = f"{ROOT}/raw/hero_release.json"
    if not os.path.exists(rel_path):
        raise SystemExit("raw/hero_release.json 不存在，无数据可合并")
    rel = json.load(open(rel_path))
    entries = rel.get("heroes", rel if isinstance(rel, list) else [])
    by_id = {str(r.get("id") if r.get("id") is not None else r.get("ename")): r
             for r in entries if r.get("id") is not None or r.get("ename") is not None}
    by_name = {r.get("name"): r for r in entries if r.get("name")}

    heroes_path = f"{ROOT}/data/heroes.json"
    doc = json.load(open(heroes_path))
    merged, missing = 0, []
    for h in doc["heroes"]:
        r = by_id.get(str(h["id"])) or by_name.get(h["name"])
        if r and r.get("date"):
            h["release"] = {"date": r["date"],
                            "precision": r.get("precision", "day"),
                            "confidence": r.get("confidence", "medium")}
            merged += 1
        else:
            h["release"] = None
            missing.append(h["name"])
    doc["generated_at"] = datetime.datetime.now().isoformat(timespec="seconds")
    doc["source"] += " + raw/hero_release.json(上线时间)"
    json.dump(doc, open(heroes_path, "w"), ensure_ascii=False, indent=1)
    print(f"merged release: {merged}/{len(doc['heroes'])}")
    if missing:
        print("no release data:", "、".join(missing))

if __name__ == "__main__":
    main()
