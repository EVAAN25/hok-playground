# 王者荣耀游乐场（hok-playground）

## 需求

复刻星铁/明日方舟游乐场的玩法范式，做王者荣耀版猜谜游戏站。用户选定 4 组玩法：

1. **经典猜英雄**（Wordle 式属性比对：定位/分路/上线时间/皮肤数/性别，每日一题+无限模式）
2. **台词猜人**（文字台词 + 语音台词，19602 条台词池，给场景/皮肤/情感做递进提示）
3. **猜皮肤**（皮肤海报局部/渐进解Blur猜英雄，735 皮肤池）
4. **人气对决 + 版本排排坐**（B站官号视频播放量 Higher-Lower；按上线时间排序）

部署：GitHub Pages 个人号 EVAAN25，public 仓库，同前两个站。

## 数据源（已验证）

- 英雄列表：`https://pvp.qq.com/web201605/js/herolist.json` → 132 英雄，含 ename/cname/id_name/title/hero_type/hero_type2/skin_name/roles → `raw/herolist.json`
- 官方台词：`https://pvp.qq.com/zlkdatasys/data_zlk_lb.json` → 105 英雄 1697 条全带 mp3 → `raw/zlk_voice.json`
- 三方台词库 v2.4：`raw/quotes_full.json`（jsdelivr 拉自 github xiao2769433/honor-king-quotes）→ 130 英雄 / 735 皮肤 / 19602 条台词带 audio_url、场景、情感标签
- 图片：`https://game.gtimg.cn/images/yxzj/img201606/heroimg/{ename}/{ename}.jpg`（方头像）；皮肤海报 `https://game.gtimg.cn/images/yxzj/img201606/skin/hero-info/{ename}/{ename}-bigskin-{i}.jpg`（i 从 1 对应 skin_name 顺序）；均无 Referer 校验可热链
- B站官号「王者荣耀」mid=57863910；wbi 抓取管线复用 `~/Documents/tasks_kimi/20260805_133235_starrail-wordle-prototype/tools/fetch_popularity.py` + `wbi_test.py`（改 MID）
- 上线时间：research agent 产出 `raw/hero_release.json`
- 性别：人工标注 `raw/gender.json`

## 字段映射

- hero_type: 1=战士 2=法师 3=坦克 4=刺客 5=射手 6=辅助（hero_type2 为副定位）
- roles（分路）: 1=对抗路 2=打野 3=中路 4=发育路 5=游走

## 骨架复用

- 明日方舟游乐场：`~/Documents/tasks_kimi/20260805_153607_arknights-playground/`（hub+多玩法结构）
- 星铁：`~/Documents/tasks_kimi/20260805_133235_starrail-wordle-prototype/`
- localStorage 键加 `hok_` 前缀；每日题=日期种子前端算；分享卡 emoji 方格必须有

## 风格

暖纸底 + 王者金/深蓝点缀（延续前两站基调，换 IP 色）
