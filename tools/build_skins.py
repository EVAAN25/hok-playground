#!/usr/bin/env python3
"""raw/herolist.json -> data/skins.json（全部 URL 实际 HEAD 验证，仅保留 200 的皮肤）
海报: https://game.gtimg.cn/images/yxzj/img201606/skin/hero-info/{ename}/{ename}-bigskin-{i}.jpg
缩略: https://game.gtimg.cn/images/yxzj/img201606/heroimg/{ename}/{ename}-mobileskin-{i}.jpg
i 为 1-based，对应 skin_name 顺序。CDN 上新皮肤可能滞后（404），这些皮肤被剔除并列入 missing。
用法: python3 tools/build_skins.py
"""
import json, os, datetime, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {"User-Agent": "Mozilla/5.0"}

POSTER = "https://game.gtimg.cn/images/yxzj/img201606/skin/hero-info/{e}/{e}-bigskin-{i}.jpg"
THUMB = "https://game.gtimg.cn/images/yxzj/img201606/heroimg/{e}/{e}-mobileskin-{i}.jpg"

def head_ok(url, tries=3):
    for _ in range(tries):
        try:
            req = urllib.request.Request(url, method="HEAD", headers=UA)
            with urllib.request.urlopen(req, timeout=15) as r:
                return r.status == 200
        except Exception:
            time.sleep(1)
    return False

def main():
    heroes = json.load(open(f"{ROOT}/raw/herolist.json"))
    entries = []
    for h in heroes:
        e = str(h["ename"])
        for i, name in enumerate(h["skin_name"].split("|"), start=1):
            entries.append({"hero": h["cname"], "ename": e, "name": name, "index": i,
                            "poster": POSTER.format(e=e, i=i), "thumb": THUMB.format(e=e, i=i)})
    print(f"expanded skins: {len(entries)}, verifying...")

    def check(en):
        return head_ok(en["poster"]), head_ok(en["thumb"])

    with ThreadPoolExecutor(max_workers=16) as ex:
        results = list(ex.map(check, entries))

    ok, missing_poster, missing_thumb = [], [], []
    for en, (p, t) in zip(entries, results):
        if p:
            ok.append(en)
            if not t:
                missing_thumb.append(en)
        else:
            missing_poster.append(en)

    result = {
        "generated_at": datetime.datetime.now().isoformat(timespec="seconds"),
        "source": "https://pvp.qq.com/web201605/js/herolist.json + game.gtimg.cn 图片 CDN（逐条 HEAD 验证）",
        "note": "index 1-based 对应 herolist skin_name 顺序；仅收录海报 URL 验证 200 的皮肤",
        "count": len(ok),
        "skins": ok,
        "missing_poster": [{"hero": m["hero"], "ename": m["ename"], "name": m["name"], "index": m["index"]} for m in missing_poster],
        "missing_thumb": [{"hero": m["hero"], "ename": m["ename"], "name": m["name"], "index": m["index"]} for m in missing_thumb],
    }
    os.makedirs(f"{ROOT}/data", exist_ok=True)
    with open(f"{ROOT}/data/skins.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=1)
    print(f"skins ok: {len(ok)}, poster 404: {len(missing_poster)}, thumb 404: {len(missing_thumb)}")
    for m in missing_poster:
        print("  poster404:", m["hero"], m["name"], f"({m['ename']}-{m['index']})")
    for m in missing_thumb[:20]:
        print("  thumb404:", m["hero"], m["name"], f"({m['ename']}-{m['index']})")

if __name__ == "__main__":
    main()
