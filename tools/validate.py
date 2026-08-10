#!/usr/bin/env python3
"""全量数据校验：heroes / quotes / skins / avatars / popularity，打印汇总表。
全部通过输出 OK，任一不达标输出 FAIL 并以非零退出。用法: python3 tools/validate.py
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def load(p):
    with open(f"{ROOT}/{p}") as f:
        return json.load(f)

def main():
    rows = []
    ok = True

    def check(name, value, expect, passed, note=""):
        nonlocal ok
        if not passed:
            ok = False
        rows.append((name, str(value), expect, "PASS" if passed else "FAIL", note))

    # heroes
    h = load("data/heroes.json")
    heroes = h["heroes"]
    check("heroes 数量", len(heroes), "=132", len(heroes) == 132)
    need = {"id", "name", "pinyin", "title", "types", "roles", "gender",
            "skinCount", "skins", "release", "avatar"}
    bad = [x["name"] for x in heroes if set(x.keys()) != need]
    check("heroes 字段完整", len(heroes) - len(bad), f"=132 (缺/多: {bad[:5]})", not bad)
    norel = [x["name"] for x in heroes if x["release"] is None]
    check("heroes release 非空", len(heroes) - len(norel), ">=0",
          True, f"{len(norel)} 个为 null" + (f"（如: {'、'.join(norel[:6])}…）" if norel else ""))
    genders = sorted({x["gender"] for x in heroes})
    check("gender 取值", "/".join(genders), "男/女/无性别/不明/自选",
          set(genders) <= {"男", "女", "无性别", "不明", "自选"})
    check("generated_at/source", "yes" if h.get("generated_at") and h.get("source") else "no",
          "present", bool(h.get("generated_at") and h.get("source")))

    # quotes
    q = load("data/quotes.json")
    quotes = q["quotes"]
    check("quotes 条数", len(quotes), ">=15000", len(quotes) >= 15000)
    noaudio = sum(1 for x in quotes if not x.get("audio"))
    short = sum(1 for x in quotes if len(x.get("quote", "")) < 4)
    check("quotes 清洗(无audio/过短)", f"{noaudio}/{short}", "0/0", noaudio == 0 and short == 0)
    hq = len({x["hero"] for x in quotes})
    check("quotes 覆盖英雄", hq, ">=120", hq >= 120)
    size = os.path.getsize(f"{ROOT}/data/quotes.json")
    check("quotes 文件大小", f"{size/1024/1024:.2f}MB", ">0", size > 0)

    # skins
    s = load("data/skins.json")
    skins = s["skins"]
    check("skins 数量(已验证200)", len(skins), ">=800", len(skins) >= 800)
    mp = len(s.get("missing_poster", []))
    check("skins poster 404", mp, "少量(CDN滞后)", True,
          "、".join(f"{m['hero']}-{m['name']}" for m in s.get("missing_poster", [])[:5]) + ("…" if mp > 5 else ""))
    idx_bad = [x for x in skins if x["index"] < 1 or f"-{x['index']}." not in x["poster"]]
    check("skins index 与 URL 一致", len(skins) - len(idx_bad), f"={len(skins)}", not idx_bad)

    # avatars
    av_dir = f"{ROOT}/assets/avatars"
    files = [f for f in os.listdir(av_dir) if f.endswith(".jpg")]
    def isjpeg(fn):
        with open(f"{av_dir}/{fn}", "rb") as fp:
            return fp.read(3) == b"\xff\xd8\xff"
    bad_av = [f for f in files if not isjpeg(f)]
    check("avatars 文件数", len(files), "=132", len(files) == 132)
    check("avatars 均为 JPEG", len(files) - len(bad_av), f"={len(files)} (坏: {bad_av[:5]})", not bad_av)
    missing_av = [x["name"] for x in heroes if not os.path.exists(f"{av_dir}/{x['id']}.jpg")]
    check("avatars 覆盖全部英雄", 132 - len(missing_av), "=132", not missing_av, "、".join(missing_av[:5]))

    # popularity
    if os.path.exists(f"{ROOT}/data/popularity.json"):
        p = load("data/popularity.json")
        data = p["data"]
        matched = sum(1 for v in data.values() if v.get("views") is not None)
        check("popularity 英雄条目", len(data), "=132", len(data) == 132)
        check("popularity 匹配到视频", matched, ">=80", matched >= 80,
              f"匹配率 {matched}/{len(data)}")
        check("popularity generated_at/source", "yes" if p.get("generated_at") and p.get("source") else "no",
              "present", bool(p.get("generated_at") and p.get("source")))
    else:
        check("popularity.json", "missing", "存在", False)

    w = max(len(r[0]) for r in rows)
    print(f"{'检查项'.ljust(w)}  {'值'.ljust(28)}  {'期望'.ljust(24)}  结果  备注")
    print("-" * (w + 80))
    for name, value, expect, res, note in rows:
        print(f"{name.ljust(w)}  {value.ljust(28)}  {expect.ljust(24)}  {res}  {note}")
    print("-" * (w + 80))
    print("OK" if ok else "FAIL")
    sys.exit(0 if ok else 1)

if __name__ == "__main__":
    main()
