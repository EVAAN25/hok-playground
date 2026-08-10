# 王者荣耀游乐场（hok-playground）

非官方王者荣耀粉丝同人小游戏站，纯静态多页（vanilla JS 无构建），仓库根即站点根。

## 页面

| 页面 | 玩法 | 数据 |
|---|---|---|
| `index.html` | 枢纽：5 玩法卡片 + 今日完成状态 dot | — |
| `classic.html` | 经典猜英雄：定位/分路/上线时间/皮肤数/性别五维比对，8 次机会 | `data/heroes.json` |
| `quotes.html` | 台词猜人：文字/语音双子模式，猜错解锁场景→皮肤→情感→另一条台词，6 次机会 | `data/quotes.json`（4.3MB 懒加载） |
| `skins.html` | 猜皮肤：海报 5 档渐进解 blur 猜英雄，答出皮肤全名加 ⭐，5 次机会 | `data/skins.json`（懒加载，海报热链 gtimg） |
| `duel.html` | 人气对决：B 站官号播放量 Higher-Lower 连胜制，每日 10 轮 | `data/popularity.json`（懒加载） |
| `timeline.html` | 版本排排坐：5 英雄按上线时间排序，3 次提交机会（year 精度不出题） | `data/heroes.json` |

## 机制

- 每日题 = 本地日期种子（FNV-1a + mulberry32）前端确定性随机，同一天全站同题；每日/无限双模式。
- localStorage 键 `hok_` 前缀；每个玩法结算页都有 emoji 方格分享卡（复制到剪贴板）。
- 英雄输入支持中文/拼音模糊 autocomplete（`heroes.json` 带 pinyin）。
- 纯逻辑层 `js/core.js`（UMD，node 可 require）；UI 共用层 `js/common.js`；每玩法一页一 JS（`js/<game>.js`）。

## 自测与冒烟

```bash
node test.js    # 14 项：数据完整性/跨文件引用/每日确定性/判定逻辑/分享卡格式
bash smoke.sh   # 无头 Chrome 逐页截图到 shots/ + 控制台错误捕获 + 同日两次加载 DOM 一致性
```

## 已知缺口

- 台词库未收录盾山 / 心魔六耳 / 卢雅那 3 位英雄（三方库 v2.4 现状），不会作为台词题答案。
- 皮肤海报与台词音频为 game.gtimg.cn 热链（已验证无 Referer 校验，图片带 `referrerpolicy="no-referrer"`）。

## 数据来源与免责

王者荣耀官网资料站（pvp.qq.com 英雄/皮肤/台词音频）、三方台词库 honor-king-quotes v2.4、B站官号「王者荣耀」(mid 57863910) 视频播放量快照（2026-08-10）。非官方粉丝同人作品，素材版权归原厂商所有。
