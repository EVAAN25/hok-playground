#!/usr/bin/env python3
"""抓 B站官号「王者荣耀」(mid 57863910) 全部视频 -> tools/bili_videos_cache.json
通道: 优先直连 wbi API；被风控(412/-352)时走 WebBridge（tools/wb_bili.py，用户真实浏览器）。
12s/页退避，cache 断点续抓。用法: python3 tools/fetch_popularity.py [--fetch-only]
"""
import json, os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = f"{ROOT}/tools/bili_videos_cache.json"
MID = 57863910

def fetch_all():
    videos = []
    if os.path.exists(CACHE):
        videos = json.load(open(CACHE))
        print("resume from cache:", len(videos))
    pn = len(videos) // 30 + 1
    # 直连通道
    direct = None
    try:
        import wbi_test
        wbi_test.bootstrap_cookies()
        mk = wbi_test.get_mixin_key()
        def direct(pn_):
            q = wbi_test.wbi_sign({"mid": MID, "ps": 30, "pn": pn_, "order": "pubdate"}, mk)
            d = json.loads(wbi_test.get(f"https://api.bilibili.com/x/space/wbi/arc/search?{q}"))
            if d.get("code") != 0:
                raise RuntimeError(f"code={d.get('code')}")
            return d["data"]
        direct(pn)  # probe
        print("channel: direct wbi")
    except Exception as e:
        print(f"direct blocked ({e}), fallback: webbridge")
        import wb_bili
        def bridge(pn_):
            r = wb_bili.fetch_page(pn_)
            if not r or r.get("code") != 0:
                raise RuntimeError(f"bridge resp: {r if not r else {k: r.get(k) for k in ('code', 'msg')}}")
            return {"list": {"vlist": r["vlist"]}, "page": {"count": r["count"]}}
        direct = bridge
        print("channel: webbridge")

    fails = 0
    while True:
        try:
            data = direct(pn)
        except Exception as e:
            fails += 1
            print(f"  pn{pn} fail {fails}: {e}")
            time.sleep(20)
            if fails >= 10:
                json.dump(videos, open(CACHE, "w"), ensure_ascii=False)
                raise RuntimeError(f"page {pn} failed x{fails}, partial={len(videos)} saved")
            continue
        fails = 0
        vl = data["list"]["vlist"]
        videos += vl
        json.dump(videos, open(CACHE, "w"), ensure_ascii=False)
        total = data["page"]["count"]
        print(f"page {pn}: {len(vl)} (cum {len(videos)}/{total})", flush=True)
        if len(videos) >= total or not vl:
            break
        pn += 1
        time.sleep(12)
    return videos

if __name__ == "__main__":
    vs = fetch_all()
    print("done:", len(vs))
