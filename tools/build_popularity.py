#!/usr/bin/env python3
"""tools/bili_videos_cache.json + data/heroes.json -> data/popularity.json
匹配规则（宁严勿宽）:
- 标题含英雄名（元流之子系列去掉括号后缀匹配），且该标题命中的英雄名 ≤2 个（≥3 视为综合/盘点视频，噪声，跳过）;
- 黑名单关键词（赛事/综艺/周边等非英雄主题）: KPL/联赛/总决赛/战队/答疑时间/周边/快闪/手办/开箱;
- 单字英雄名（镜/瑶/澜/曜/影/铠…）只认强模式: 新英雄X / X(英雄|皮肤|语音|玩法|教学|攻略|CG|台词|命格) / 【X-…;
- popularity = 该英雄全部命中视频播放量合计；无命中 -> null（排排坐玩法跳过）。
用法: python3 tools/build_popularity.py
"""
import json, os, re, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

BLACKLIST = ["KPL", "联赛", "总决赛", "战队", "答疑时间", "周边", "快闪", "手办", "开箱", "主播"]
# 单字英雄名强模式：前面不能紧跟汉字（避免「前尘镜皮肤」「游龙清影皮肤」误配镜/影）
STRONG_SINGLE = (r"(新英雄{n})|"
                 r"(?<![\u4e00-\u9fff]){n}(?:英雄|皮肤|语音|玩法|教学|攻略|CG|台词|命格|调整|增强|削弱)|"
                 r"(【{n}[-—])")

def clean_title(t):
    # 「老亚瑟」是官号吉祥物/栏目名（老亚瑟的答疑时间等），不是英雄亚瑟
    return t.replace("老亚瑟", "")

def match_names(name):
    """返回用于标题匹配的名字列表（元流之子(法师)->元流之子）。"""
    base = re.sub(r"[（(].*?[）)]", "", name)
    return [base] if base != name else [name]

def main():
    videos = json.load(open(f"{ROOT}/tools/bili_videos_cache.json"))
    heroes = json.load(open(f"{ROOT}/data/heroes.json"))["heroes"]

    # 每个英雄: 匹配名列表（长名在前，避免「元流之子」抢配「元流之子(法师)」无影响——二者同源）
    hero_keys = []  # (hero_id, match_name)
    for h in heroes:
        for mn in match_names(h["name"]):
            hero_keys.append((h["id"], h["name"], mn))

    def title_hero_hits(title):
        hits = set()
        for hid, hname, mn in hero_keys:
            if len(mn) == 1:
                if re.search(STRONG_SINGLE.replace("{n}", re.escape(mn)), title):
                    hits.add(mn)
            elif mn in title:
                hits.add(mn)
        return hits

    out = {h["id"]: {"name": h["name"], "views": None, "videoCount": 0, "top": None}
           for h in heroes}
    # match_name -> hero_ids
    name2ids = {}
    for hid, hname, mn in hero_keys:
        name2ids.setdefault(mn, []).append(hid)

    skipped_multi = skipped_black = 0
    for v in videos:
        t = clean_title(v["title"])
        if any(b in t for b in BLACKLIST):
            skipped_black += 1
            continue
        hits = title_hero_hits(t)
        if not hits:
            continue
        if len(hits) > 2:
            skipped_multi += 1
            continue
        for mn in hits:
            for hid in name2ids[mn]:
                e = out[hid]
                e["views"] = (e["views"] or 0) + (v.get("play") or 0)
                e["videoCount"] += 1
                if not e["top"] or v.get("play", 0) > e["top"]["play"]:
                    e["top"] = {"title": v["title"], "bvid": v["bvid"], "play": v.get("play", 0)}

    matched = [e for e in out.values() if e["views"] is not None]
    unmatched = [e["name"] for e in out.values() if e["views"] is None]
    result = {
        "generated_at": datetime.datetime.now().isoformat(timespec="seconds"),
        "source": "B站官号「王者荣耀」(space.bilibili.com/57863910) 全部视频标题匹配聚合",
        "rule": "标题含英雄名且命中英雄≤2个；单字名只认强模式；赛事/周边类黑名单剔除；views=命中视频播放量合计",
        "video_total": len(videos),
        "matched": len(matched),
        "unmatched": unmatched,
        "data": out,
    }
    json.dump(result, open(f"{ROOT}/data/popularity.json", "w"), ensure_ascii=False, indent=1)
    print(f"videos={len(videos)} matched={len(matched)}/132  (综合视频跳过 {skipped_multi}, 黑名单跳过 {skipped_black})")
    print("unmatched:", "、".join(unmatched))

if __name__ == "__main__":
    main()
