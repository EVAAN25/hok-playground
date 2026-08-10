# 站点构建规格（hok-playground）

## 总体

- 纯静态 SPA 多页（vanilla JS 无构建），仓库根即站点根。GitHub Pages EVAAN25/hok-playground。
- 骨架复用 `~/Documents/tasks_kimi/20260805_153607_arknights-playground/`：index.html 为玩法导航枢纽，每玩法一页一 JS。
- 每日题 = 日期种子（mulberry32 之类）前端算；每日/无限双模式；localStorage 键 `hok_` 前缀；**分享卡 emoji 方格必须有**（核心传播机制）。
- 风格：暖纸底 + 王者金(#c9a063 类)/深蓝点缀；hero 卡片用 assets/avatars 方头像。
- 数据：fetch data/*.json（heroes.json 必有；quotes.json ~2-3MB 懒加载——进台词页才拉；skins.json 进皮肤页才拉；popularity.json 进对决页才拉）。

## 玩法页

### 1. classic.html 经典猜英雄
- 输入英雄名（拼音/中文模糊 autocomplete，132 池），猜中即胜。
- 反馈列：定位（主 hero_type，精确=绿）、分路（多值，全中=绿/部分中=黄/无交集=灰）、上线时间（↑↓箭头+年份差，同年=绿）、皮肤数（↑↓）、性别（绿/灰）。
- 每日一题 + 无限模式；8 次机会；分享卡用 🟩🟨⬜ + ↑↓ 行。

### 2. quotes.html 台词猜人
- 两个子模式切换：文字台词（屏幕给一条 quote）/ 语音台词（放 audio mp3）。
- 每猜错一次解锁一条提示：① 场景(scene) ② 皮肤(skin) ③ 情感(emotion) ④ 再放一条同英雄别的台词。
- 每日+无限；分享卡。
- quotes.json 2-3MB 懒加载，loading 态要有。

### 3. skins.html 猜皮肤
- 735 皮肤池。展示皮肤海报的高度模糊/局部裁切版本（CSS overflow crop 或 blur 滤镜，图热链 gtimg，加 referrerpolicy="no-referrer"），猜**英雄名**。
- 每猜错一次降低模糊度/扩大可见区域（4-5 档渐进揭示）；答出皮肤全名加分（可选输入）。
- 每日+无限；分享卡。

### 4. duel.html 人气对决
- Higher-Lower：左边英雄显示播放量，右边猜更高/更低；连胜计分，错了结束结算。
- popularity=null 的英雄不进池。页面底部注明数据抓取日期与来源（B站官号 mid 57863910）。

### 5. timeline.html 版本排排坐
- 给 5-6 个英雄按上线时间先后拖拽/点选排序，提交判定，显示正确日期。
- release.precision 为 year 的题不出；每日+无限。

## index.html 枢纽
- 5 玩法卡片（图标+一句话简介+今日完成状态 dot），站点标题「王者荣耀游乐场」，页脚数据来源与免责声明（非官方粉丝作品）。

## 验收
- test.js 或自测脚本：各页 fetch 数据正常、每日题种子稳定（同一天两次进入同一题）、分享卡生成正常。
- 无头 Chrome 冒烟（参考 arknights 的做法）。
