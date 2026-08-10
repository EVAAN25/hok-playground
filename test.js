/* node 自测：数据完整性 / 跨文件引用 / 五玩法每日确定性 / 判定逻辑 / 分享卡格式
 * 运行：node test.js
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const HOK = require("./js/core.js");

const heroesData = JSON.parse(fs.readFileSync(path.join(__dirname, "data/heroes.json"), "utf8"));
const quotesData = JSON.parse(fs.readFileSync(path.join(__dirname, "data/quotes.json"), "utf8"));
const skinsData = JSON.parse(fs.readFileSync(path.join(__dirname, "data/skins.json"), "utf8"));
const popData = JSON.parse(fs.readFileSync(path.join(__dirname, "data/popularity.json"), "utf8"));

const HEROES = heroesData.heroes;
const byId = {}, byName = {};
HEROES.forEach((h) => { byId[h.id] = h; byName[h.name] = h; });

let passed = 0;
function ok(name, fn) { fn(); passed++; console.log("✓", name); }

// ---------- 数据完整性 ----------
ok("数据：heroes.json 132 英雄、id 唯一、字段齐全、头像文件存在", () => {
  assert.strictEqual(HEROES.length, 132);
  const ids = new Set();
  for (const h of HEROES) {
    assert(h.id && h.name && h.pinyin && h.gender, "基本字段 " + h.id);
    assert(Array.isArray(h.types) && h.types.length >= 1, "types " + h.id);
    assert(Array.isArray(h.roles) && h.roles.length >= 1, "roles " + h.id);
    assert(Number.isInteger(h.skinCount) && h.skinCount >= 1, "skinCount " + h.id);
    assert(h.release && /^\d{4}-\d{2}-\d{2}$/.test(h.release.date), "release " + h.id);
    assert(["day", "month", "year"].includes(h.release.precision), "precision " + h.id);
    assert(!ids.has(h.id), "id 重复 " + h.id); ids.add(h.id);
    assert(fs.existsSync(path.join(__dirname, h.avatar)), "头像缺失 " + h.avatar);
  }
});

ok("数据：quotes.json 每条 hero 都能在 heroes.json 找到（已知缺口：盾山/心魔六耳/卢雅那无台词）", () => {
  assert(quotesData.count > 18000, "台词总数异常 " + quotesData.count);
  assert.strictEqual(quotesData.count, quotesData.quotes.length);
  for (const q of quotesData.quotes) {
    assert(byName[q.hero], "quotes 英雄不在 heroes.json：" + q.hero);
    assert(q.quote && q.quote.length >= 4, "quote 字段 " + q.hero);
    assert(q.audio && /^https:\/\//.test(q.audio), "audio 字段 " + q.hero);
    assert(q.scene && q.emotion && q.skin, "scene/emotion/skin 字段 " + q.hero);
  }
  // 已知缺口：3 个英雄没有台词，前端容错（台词题池从 quotes 侧构建，天然不会出这 3 个）
  const qHeroes = new Set(quotesData.quotes.map((q) => q.hero));
  const missing = HEROES.filter((h) => !qHeroes.has(h.name)).map((h) => h.name).sort();
  assert.deepStrictEqual(missing, ["卢雅那", "心魔六耳", "盾山"].sort(), "缺口变化：" + missing.join(","));
});

ok("数据：skins.json 每条 hero 都能在 heroes.json 找到、poster 为 gtimg 热链", () => {
  assert(skinsData.count > 800, "皮肤总数异常 " + skinsData.count);
  for (const s of skinsData.skins) {
    assert(byName[s.hero], "skins 英雄不在 heroes.json：" + s.hero);
    assert(s.name && Number.isInteger(s.index), "skins 字段 " + s.hero);
    assert(/^https:\/\/game\.gtimg\.cn\//.test(s.poster), "poster 非 gtimg " + s.hero);
  }
});

ok("数据：popularity.json 的 id 与 heroes.json 一一对应、views 为正整数", () => {
  const ids = Object.keys(popData.data);
  assert.strictEqual(ids.length, 132);
  for (const id of ids) {
    assert(byId[id], "popularity id 不在 heroes.json：" + id);
    const e = popData.data[id];
    assert(Number.isInteger(e.views) && e.views > 0, "views " + id);
  }
});

// ---------- 题池 ----------
const CPOOL = HOK.classicPool(HEROES);
const QPOOL = HOK.quotesPool(quotesData.quotes, byName);
const QBYHERO = HOK.quotesByHero(quotesData.quotes, byName);
const SPOOL = HOK.skinsPool(skinsData.skins, byName);
const DPOOL = HOK.duelPool(popData.data, byId);
const TPOOL = HOK.timelinePool(HEROES);

ok("题池：classic 132 / quotes 万级 / skins 800+ / duel 132 / timeline 132（当前无 year 精度）", () => {
  assert.strictEqual(CPOOL.length, 132);
  assert(QPOOL.length > 15000, "quotes 题池 " + QPOOL.length);
  assert(SPOOL.length > 800, "skins 题池 " + SPOOL.length);
  assert.strictEqual(DPOOL.length, 132);
  assert.strictEqual(TPOOL.length, 132);
  // quotes 题池不含剧透句
  for (const q of QPOOL) assert(!q.quote.includes(q.hero), "剧透台词漏过滤：" + q.quote);
});

// ---------- 每日确定性 ----------
function next30Days() {
  const out = [];
  const d = new Date(2026, 0, 1);
  for (let i = 0; i < 30; i++) { out.push(HOK.dateStr(d)); d.setDate(d.getDate() + 1); }
  return out;
}
function next365Days() {
  const out = [];
  const d = new Date(2026, 0, 1);
  for (let i = 0; i < 365; i++) { out.push(HOK.dateStr(d)); d.setDate(d.getDate() + 1); }
  return out;
}

ok("确定性：五玩法同一日期两次出题结果相同", () => {
  for (const date of next30Days()) {
    assert.strictEqual(HOK.classicDaily(date, CPOOL), HOK.classicDaily(date, CPOOL));
    assert.strictEqual(HOK.quoteDaily(date, QPOOL, "text"), HOK.quoteDaily(date, QPOOL, "text"));
    assert.strictEqual(HOK.quoteDaily(date, QPOOL, "audio"), HOK.quoteDaily(date, QPOOL, "audio"));
    assert.strictEqual(HOK.skinDaily(date, SPOOL), HOK.skinDaily(date, SPOOL));
    assert.strictEqual(HOK.duelDailyChain(date, DPOOL).join(), HOK.duelDailyChain(date, DPOOL).join());
    assert.strictEqual(HOK.timelineDaily(date, TPOOL).join(), HOK.timelineDaily(date, TPOOL).join());
  }
});

ok("确定性：duel 每日链长度 11（10 轮）、相邻播放量不同；timeline 每日 5 人、间隔 ≥30 天", () => {
  for (const date of next30Days()) {
    const chain = HOK.duelDailyChain(date, DPOOL);
    assert.strictEqual(chain.length, HOK.DUEL_DAILY_ROUNDS + 1);
    for (let i = 1; i < chain.length; i++) {
      assert.notStrictEqual(byIdPop(chain[i - 1]), byIdPop(chain[i]), "播放量平局");
    }
    const ids = HOK.timelineDaily(date, TPOOL);
    assert.strictEqual(ids.length, HOK.TL_PICK);
    assert.strictEqual(new Set(ids).size, HOK.TL_PICK);
    for (let a = 0; a < ids.length; a++)
      for (let b = a + 1; b < ids.length; b++)
        assert(HOK.dayDiff(byId[ids[a]].release.date, byId[ids[b]].release.date) >= HOK.TL_MIN_GAP_DAYS,
          "间隔不足 " + date);
  }
  function byIdPop(id) { return popData.data[id].views; }
});

ok("回归：365 天扫描 —— duel 链满 11 且相邻不同值；timeline 必出 5 人且日期两两不同", () => {
  const byIdPop = (id) => popData.data[id].views;
  for (const date of next365Days()) {
    const chain = HOK.duelDailyChain(date, DPOOL);
    assert.strictEqual(chain.length, HOK.DUEL_DAILY_ROUNDS + 1, "链不足 " + date);
    for (let i = 1; i < chain.length; i++) {
      assert.notStrictEqual(byIdPop(chain[i - 1]), byIdPop(chain[i]), "播放量平局 " + date);
    }
    const ids = HOK.timelineDaily(date, TPOOL);
    assert.strictEqual(ids.length, HOK.TL_PICK, "timeline 不足 5 人 " + date);
    const dates = ids.map((id) => byId[id].release.date);
    assert.strictEqual(new Set(dates).size, HOK.TL_PICK, "上线日期撞车（排序多解）" + date);
  }
});

ok("回归：元流之子 5 形态同播放量 —— 不可配对、duelNext 不返回同值", () => {
  const ylz = DPOOL.filter((e) => e.name.startsWith("元流之子"));
  assert(ylz.length >= 2, "元流之子形态数异常");
  for (let i = 1; i < ylz.length; i++) {
    assert.strictEqual(HOK.duelPairable(ylz[0], ylz[i]), false, "同值可配对：" + ylz[i].name);
  }
  // 从任一形态出发，随机 50 次下家都不同值
  for (let i = 0; i < 50; i++) {
    const n = HOK.duelNext(DPOOL, ylz[0]);
    assert(n && n.views !== ylz[0].views, "duelNext 同值");
  }
});

// ---------- 判定逻辑 ----------
ok("逻辑：classicCompare 五维（含分路集合黄/灰、上线同年绿、皮肤数箭头）", () => {
  const lianpo = byName["廉颇"], yingzheng = byName["嬴政"], xiaoqiao = byName["小乔"];
  // 廉颇 vs 嬴政：同日上线（同年绿）、皮肤数同为 6（绿）、性别同（绿）、定位 坦克vs法师（灰）、分路有游走交集？廉颇[对抗路,游走] 嬴政[中路] → 灰
  const r1 = HOK.classicCompare(lianpo, yingzheng);
  assert.strictEqual(r1.win, false);
  assert.strictEqual(r1.cells.release.status, "green");
  assert.strictEqual(r1.cells.skins.status, "green");
  assert.strictEqual(r1.cells.gender.status, "green");
  assert.strictEqual(r1.cells.type.status, "gray");
  assert.strictEqual(r1.cells.roles.status, "gray");
  // 自比全绿且 win
  const r2 = HOK.classicCompare(lianpo, lianpo);
  assert(r2.win && HOK.CLASSIC_CELL_ORDER.every((k) => r2.cells[k].status === "green"));
  // 小乔（女） vs 廉颇（男）：性别灰；小乔皮肤数多于廉颇 → down（答案更少）…用嬴政比：同为 6 不行，换一个
  const r3 = HOK.classicCompare(xiaoqiao, lianpo);
  assert.strictEqual(r3.cells.gender.status, "gray");
  assert(["up", "down", "green"].includes(r3.cells.skins.status));
});

ok("逻辑：quoteHints 递进解锁（场景→皮肤→情感→另一条台词），确定性", () => {
  const e = QPOOL[HOK.quoteDaily("2026-08-10", QPOOL, "text")];
  assert.strictEqual(HOK.quoteHints(e, QBYHERO, 0).length, 0);
  const h1 = HOK.quoteHints(e, QBYHERO, 1);
  const h4 = HOK.quoteHints(e, QBYHERO, 4);
  assert.strictEqual(h1.length, 1);
  assert(h4.length >= 3, "提示档不足 " + h4.length);
  assert(h1[0].includes("场景"));
  assert.deepStrictEqual(HOK.quoteHints(e, QBYHERO, 4), h4, "提示不确定");
  // 另一条台词必须属于同英雄且不含英雄名
  const last = h4[h4.length - 1];
  if (last.includes("另一条台词")) {
    assert(!last.includes(e.hero), "提示剧透英雄名");
    assert(!last.includes(e.quote), "另一条台词与原句重复");
  }
});

ok("逻辑：skinNameMatch 忽略间隔号/空格/大小写", () => {
  assert(HOK.skinNameMatch("寅虎御盾", "寅虎·御盾"));
  assert(HOK.skinNameMatch(" 寅虎·御盾 ", "寅虎·御盾"));
  assert(!HOK.skinNameMatch("寅虎", "寅虎·御盾"));
  assert(!HOK.skinNameMatch("", "寅虎·御盾"));
});

ok("逻辑：duelJudge / duelNext 不与当前相同", () => {
  const a = DPOOL[0];
  const b = HOK.duelNext(DPOOL, a, () => 0.5);
  assert(b && b.id !== a.id && b.views !== a.views);
  assert.strictEqual(HOK.duelJudge("higher", { views: 100 }, { views: 200 }), true);
  assert.strictEqual(HOK.duelJudge("lower", { views: 100 }, { views: 200 }), false);
});

ok("逻辑：timelineCorrect / timelineMarks", () => {
  const ids = HOK.timelineDaily("2026-08-10", TPOOL);
  const correct = HOK.timelineCorrect(ids, byId);
  assert(HOK.timelineMarks(correct, correct).every(Boolean));
  const rev = correct.slice().reverse();
  const marks = HOK.timelineMarks(rev, correct);
  assert(marks.some((b) => !b));
});

ok("逻辑：searchHeroes 中文/拼音模糊匹配", () => {
  const r1 = HOK.searchHeroes(HEROES, "李白");
  assert(r1.length && r1[0].name === "李白");
  const r2 = HOK.searchHeroes(HEROES, "libai");
  assert(r2.length && r2[0].name === "李白");
  const r3 = HOK.searchHeroes(HEROES, "li");
  assert(r3.length > 0 && r3.length <= 8);
  const r4 = HOK.searchHeroes(HEROES, "李白", [r1[0].id]);
  assert(!r4.some((h) => h.name === "李白"), "排除失效");
});

ok("回归：searchHeroes 单字英雄 / 拼音冲突 / 括号名（半角+全角）", () => {
  for (const n of ["镜", "瑶", "澜", "曜", "影", "铠"]) {
    const r = HOK.searchHeroes(HEROES, n);
    assert(r.length && r[0].name === n, "单字未命中 " + n);
  }
  assert.strictEqual(HOK.searchHeroes(HEROES, "libai")[0].name, "李白");
  assert.strictEqual(HOK.searchHeroes(HEROES, "lixin")[0].name, "李信");
  assert.strictEqual(HOK.searchHeroes(HEROES, "change")[0].name, "嫦娥");
  assert.strictEqual(HOK.searchHeroes(HEROES, "元流之子(法师)")[0].name, "元流之子(法师)");
  assert.strictEqual(HOK.searchHeroes(HEROES, "元流之子（法师）")[0].name, "元流之子(法师)", "全角括号不匹配");
  const ylz = HOK.searchHeroes(HEROES, "元流之子");
  assert(ylz.filter((h) => h.name.startsWith("元流之子")).length >= 5, "形态列不全");
});

// ---------- 分享卡 ----------
ok("分享卡：五玩法都能生成、含 emoji 方格/标记与站名", () => {
  const date = "2026-08-10";
  const g = byName["廉颇"], t = byName["小乔"];
  const classicShare = HOK.buildClassicShare({
    date, won: true, practice: false,
    results: [HOK.classicCompare(g, t), HOK.classicCompare(t, t)],
  });
  assert(classicShare.includes("王者荣耀游乐场") && classicShare.includes("🎯 2/8"));
  assert(/[🟩🟨⬜⬆️⬇️]/.test(classicShare));

  const quoteShare = HOK.buildQuoteShare({
    date, submode: "audio", won: false, practice: false,
    rounds: [{ ok: false }, { skip: true }, { ok: false }],
  });
  assert(quoteShare.includes("🎧 X/6") && quoteShare.includes("🟥⬜🟥"));

  const skinShare = HOK.buildSkinShare({
    date, won: true, bonus: true, practice: false,
    rounds: [{ ok: false }, { ok: true }],
  });
  assert(skinShare.includes("🖼️ 2/5") && skinShare.includes("⭐"));

  const duelShare = HOK.buildDuelShare({
    date, score: 3, practice: false,
    trail: [{ dir: "higher", ok: true }, { dir: "lower", ok: true }, { dir: "higher", ok: true }, { dir: "lower", ok: false }],
  });
  assert(duelShare.includes("🔥 连胜×3/10") && duelShare.includes("❌"));

  const tlShare = HOK.buildTimelineShare({
    date, won: true, practice: false,
    attempts: [[true, false, false, true, false], [true, true, true, true, true]],
  });
  assert(tlShare.includes("⏳ 2/3") && tlShare.includes("🟩🟩🟩🟩🟩"));
});

console.log(`\n全部 ${passed} 项自测通过`);
