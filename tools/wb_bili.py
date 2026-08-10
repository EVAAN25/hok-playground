#!/usr/bin/env python3
"""通过 Kimi WebBridge（用户真实浏览器会话）抓 B站官号视频列表的驱动工具。
直连 api.bilibili.com 的 space/wbi 接口被风控(412/-352) 时的备用链：
在 space.bilibili.com 页面上下文里注入 md5 + 复刻 wbi 签名，带登录 cookie 调 arc/search。
用法:
  python3 tools/wb_bili.py test            # 抓第 1 页打印样本
  python3 tools/wb_bili.py page <pn>       # 抓第 pn 页，打印 JSON 到 stdout
"""
import json, subprocess, sys

SESSION = "hok-popularity"
DAEMON = "http://127.0.0.1:10086/command"

JS = r"""
(async () => {
  if (!window.md5) {
    await new Promise((res,rej)=>{const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/js-md5@0.8.3/src/md5.min.js';
      s.onload=res;s.onerror=rej;document.head.appendChild(s)});
  }
  if (!window.__mixin || (Date.now()-window.__mixinT)>600000) {
    const nav = await (await fetch('https://api.bilibili.com/x/web-interface/nav',{credentials:'include'})).json();
    const w = nav.data.wbi_img;
    const kk = (u)=>u.split('/').pop().split('.')[0];
    const raw = kk(w.img_url)+kk(w.sub_url);
    const tab=[46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,28,14,39,12,38,41,13,37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,57,62,11,36,20,34,44,52];
    window.__mixin = tab.map(i=>raw[i]).join('').slice(0,32);
    window.__mixinT = Date.now();
  }
  const params = {mid:57863910, ps:30, pn:PN, order:'pubdate', wts: Math.floor(Date.now()/1000)};
  const enc = (o)=>Object.keys(o).sort().map(k2=>encodeURIComponent(k2)+'='+encodeURIComponent(String(o[k2]).replace(/[!'()*]/g,''))).join('&');
  const q = enc(params);
  const rid = md5(q+window.__mixin);
  const r = await (await fetch('https://api.bilibili.com/x/space/wbi/arc/search?'+q+'&w_rid='+rid,{credentials:'include'})).json();
  if (r.code !== 0) return {code:r.code, msg:r.message};
  return {code:0, count:r.data.page.count,
    vlist:r.data.list.vlist.map(v=>({bvid:v.bvid,title:v.title,play:v.play,created:v.created,length:v.length,typename:v.typename}))};
})()
"""

def call(action, args):
    body = json.dumps({"action": action, "args": args, "session": SESSION})
    out = subprocess.run(["curl", "-s", "-m", "120", "-X", "POST", DAEMON,
                          "-H", "Content-Type: application/json", "-d", body],
                         capture_output=True, text=True).stdout
    return json.loads(out)

def fetch_page(pn):
    js = JS.replace("PN", str(pn))
    r = call("evaluate", {"code": js})
    data = r.get("data", {})
    val = data.get("value")
    if isinstance(val, str):
        val = json.loads(val)
    return val

if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "test":
        v = fetch_page(1)
        print(json.dumps(v, ensure_ascii=False, indent=1)[:3000])
    elif len(sys.argv) >= 3 and sys.argv[1] == "page":
        print(json.dumps(fetch_page(int(sys.argv[2])), ensure_ascii=False))
    else:
        print(__doc__)
