#!/usr/bin/env python3
"""raw/quotes_full.json 压平清洗 -> data/quotes.json（紧凑 JSON）
清洗：去首尾空白；去掉清洗后长度<4 的条目；必须有 audio_url；同一英雄同名皮肤组合并。
用法: python3 tools/build_quotes.py
"""
import json, os, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def main():
    raw = json.load(open(f"{ROOT}/raw/quotes_full.json"))
    heroes = raw["heroes"]
    out = []
    dropped_no_audio = dropped_short = 0
    for hero, skins in heroes.items():
        # 同名皮肤组（可能出现于多个 key 时）合并：quotes_full 结构本身是一英雄多皮肤
        for skin, sd in skins.items():
            seen = set()
            for q in sd.get("quotes", []):
                audio = (q.get("audio_url") or "").strip()
                if not audio:
                    dropped_no_audio += 1
                    continue
                text = (q.get("quote") or "").strip()
                if len(text) < 4:
                    dropped_short += 1
                    continue
                if text in seen:  # 同皮肤内去重
                    continue
                seen.add(text)
                out.append({
                    "hero": hero,
                    "skin": skin,
                    "quote": text,
                    "scene": (q.get("trigger_scene") or "").strip(),
                    "emotion": (q.get("emotion_tag") or "").strip(),
                    "audio": audio,
                })
    result = {
        "generated_at": datetime.datetime.now().isoformat(timespec="seconds"),
        "source": "三方台词库 v2.4 (github xiao2769433/honor-king-quotes, 数据源 pvp.qq.com)",
        "count": len(out),
        "quotes": out,
    }
    path = f"{ROOT}/data/quotes.json"
    os.makedirs(f"{ROOT}/data", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, separators=(",", ":"))
    size = os.path.getsize(path)
    print(f"quotes: {len(out)} 条（原始 {raw['metadata']['total_quotes']}，"
          f"无audio丢弃 {dropped_no_audio}，过短丢弃 {dropped_short}）")
    print(f"file size: {size/1024/1024:.2f} MB -> data/quotes.json")
    hs = {q['hero'] for q in out}
    ss = {(q['hero'], q['skin']) for q in out}
    print(f"覆盖英雄 {len(hs)}，皮肤组 {len(ss)}")

if __name__ == "__main__":
    main()
