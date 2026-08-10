# tools/ 数据管线说明

王者荣耀游乐场数据管线。所有产物落在仓库根的 `data/` 与 `assets/`。
原则：全真抓取无估算；每个 data 文件带 `generated_at` 和 `source`。

## 脚本一览

| 脚本 | 产物 | 数据源 | 重跑时机 |
|---|---|---|---|
| `build_heroes.py` | `data/heroes.json`（132 英雄） | `raw/herolist.json`（源 `https://pvp.qq.com/web201605/js/herolist.json`）+ `raw/gender.json`（人工标注） | 新英雄上线后：重抓 herolist → 跑本脚本 |
| `build_quotes.py` | `data/quotes.json`（台词池，紧凑 JSON） | `raw/quotes_full.json`（三方台词库 v2.4，github xiao2769433/honor-king-quotes） | 台词库更新版本后 |
| `build_skins.py` | `data/skins.json`（逐条 HEAD 验证过的皮肤） | `raw/herolist.json` + `https://game.gtimg.cn/images/yxzj/img201606/skin/hero-info/{ename}/{ename}-bigskin-{i}.jpg` / `heroimg/{ename}/{ename}-mobileskin-{i}.jpg` | 新皮肤上线后；CDN 图滞后于皮肤列表，404 的会列入 `missing_poster` |
| `fetch_avatars.py` | `assets/avatars/{ename}.jpg`（132 个方头像） | `https://game.gtimg.cn/images/yxzj/img201606/heroimg/{ename}/{ename}.jpg`（部分实为 PNG，已用 sips 转 JPEG） | 新英雄上线后 |
| `fetch_popularity.py` | `tools/bili_videos_cache.json`（官号全量视频） | B站 `https://api.bilibili.com/x/space/wbi/arc/search?mid=57863910`（wbi 签名 + buvid3，12s/页退避，断点续抓） | 人气数据刷新（月度即可） |
| `wb_bili.py` | （fetch_popularity 的备用通道） | 同上接口，但走 Kimi WebBridge 在用户真实浏览器内发请求，绕 412/-352 风控 | 直连被风控时自动启用 |
| `build_popularity.py` | `data/popularity.json`（按英雄聚合播放量） | `tools/bili_videos_cache.json` + `data/heroes.json` | 抓完新视频后 |
| `merge_release.py` | 合并 release 进 `data/heroes.json` | `raw/hero_release.json`（research agent 产出，尚未到位） | hero_release.json 到位后 |
| `validate.py` | 终端汇总表 | 校验以上全部产物 | 任何重跑之后 |

## 典型重跑流程（新英雄上线）

```bash
curl -s https://pvp.qq.com/web201605/js/herolist.json -o raw/herolist.json
python3 tools/build_heroes.py      # 新英雄 release=null，等 hero_release 更新后跑 merge_release.py
python3 tools/build_skins.py       # 新英雄海报可能 404（CDN 滞后），会列入 missing
python3 tools/fetch_avatars.py     # 增量下载新头像
python3 tools/fetch_popularity.py && python3 tools/build_popularity.py
python3 tools/validate.py
```

## 注意

- `raw/gender.json` 有人工标注的新英雄时需手动补（female/special）。
- B站抓取走 WebBridge 时会打开「王者人气数据抓取」标签组，勿手动关闭；抓完可关。
- quotes 清洗规则：去空白、长度<4 丢弃、无 audio_url 丢弃、同皮肤内去重。
