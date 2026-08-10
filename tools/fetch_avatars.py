#!/usr/bin/env python3
"""下载全部英雄方头像 -> assets/avatars/{ename}.jpg
源: https://game.gtimg.cn/images/yxzj/img201606/heroimg/{ename}/{ename}.jpg
并发 8，校验非空且为 JPEG。失败重试 3 次，仍失败记入 missing 清单。
用法: python3 tools/fetch_avatars.py
"""
import json, os, subprocess, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {"User-Agent": "Mozilla/5.0"}
URL = "https://game.gtimg.cn/images/yxzj/img201606/heroimg/{e}/{e}.jpg"

def is_jpeg(path):
    with open(path, "rb") as f:
        return f.read(3) == b"\xff\xd8\xff"

def save_as_jpeg(data, path):
    """CDN 部分头像实为 PNG（扩展名仍是 .jpg），统一转成 JPEG 保存。"""
    if data[:3] == b"\xff\xd8\xff":
        with open(path, "wb") as f:
            f.write(data)
        return True
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        tmp = path + ".tmp.png"
        with open(tmp, "wb") as f:
            f.write(data)
        r = subprocess.run(["sips", "-s", "format", "jpeg", tmp, "--out", path],
                           capture_output=True)
        os.remove(tmp)
        return r.returncode == 0 and os.path.exists(path) and is_jpeg(path)
    return False

def fetch(ename):
    path = f"{ROOT}/assets/avatars/{ename}.jpg"
    if os.path.exists(path) and os.path.getsize(path) > 1000 and is_jpeg(path):
        return ename, True, "cached"
    url = URL.format(e=ename)
    err = "unknown"
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers=UA)
            data = urllib.request.urlopen(req, timeout=20).read()
            if len(data) > 1000 and save_as_jpeg(data, path):
                return ename, True, "ok"
            return ename, False, f"bad content ({len(data)} bytes)"
        except Exception as ex:
            time.sleep(1 + attempt)
            err = str(ex)
    return ename, False, err

def main():
    heroes = json.load(open(f"{ROOT}/raw/herolist.json"))
    os.makedirs(f"{ROOT}/assets/avatars", exist_ok=True)
    enames = [str(h["ename"]) for h in heroes]
    with ThreadPoolExecutor(max_workers=8) as ex:
        results = list(ex.map(fetch, enames))
    ok = [r for r in results if r[1]]
    missing = [(e, m) for e, s, m in results if not s]
    print(f"avatars ok: {len(ok)}/{len(enames)}")
    if missing:
        print("missing:")
        for e, m in missing:
            print(f"  {e}: {m}")
        with open(f"{ROOT}/assets/avatars/_missing.json", "w") as f:
            json.dump([{"ename": e, "error": m} for e, m in missing], f, ensure_ascii=False, indent=1)

if __name__ == "__main__":
    main()
