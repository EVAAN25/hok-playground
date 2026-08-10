/*
 * 王者荣耀游乐场 —— 纯逻辑层（UMD：浏览器挂 window.HOK，node 可 require）
 * 不依赖 DOM；数据由调用方传入（各页 fetch data/*.json 后传入）
 */
(function (root, factory) {
  const HOK = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = HOK;
  else root.HOK = HOK;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SITE_NAME = "王者荣耀游乐场";
  const SITE_URL = "https://evaan25.github.io/hok-playground/";

  // ---------- 随机与每日种子 ----------

  // FNV-1a 32bit
  function hash32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 本地日期 YYYY-MM-DD（不用 UTC，保证"今天"符合玩家直觉）
  function dateStr(d) {
    d = d || new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${dd}`;
  }

  // 带 salt 的每日索引：各玩法 salt 不同，同一天各玩法的题互不干扰
  function dailyIndex(date, count, salt) {
    const rng = mulberry32(hash32((salt || "hok") + ":" + date));
    return Math.floor(rng() * count);
  }

  // 用 rng 原地洗牌（Fisher-Yates）
  function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ---------- 通用：英雄名/拼音模糊搜索 ----------

  function normalize(s) {
    // 全角括号（中文输入法默认）归一为半角，间隔号/空格/大小写不敏感
    return String(s == null ? "" : s).replace(/（/g, "(").replace(/）/g, ")")
      .replace(/[·•.\s・''""]/g, "").toLowerCase();
  }

  // 中文名/拼音模糊匹配，前缀命中排前；返回英雄对象数组
  function searchHeroes(heroes, query, excludeIds, limit) {
    const q = normalize(query);
    if (!q) return [];
    const ex = new Set(excludeIds || []);
    const out = [];
    for (const c of heroes) {
      if (ex.has(c.id)) continue;
      const name = normalize(c.name);
      const py = normalize(c.pinyin || "");
      let score = -1;
      if (name.startsWith(q) || py.startsWith(q)) score = 0;
      else if (name.includes(q) || py.includes(q)) score = 1;
      if (score >= 0) out.push({ c, score });
    }
    out.sort((a, b) => a.score - b.score || a.c.id.localeCompare(b.c.id));
    return out.slice(0, limit || 8).map((x) => x.c);
  }

  // ---------- 玩法 1：经典猜英雄（wordle 式五维比对） ----------

  const CLASSIC_MAX_TRIES = 8;
  const CLASSIC_CELL_ORDER = ["type", "roles", "release", "skins", "gender"];
  const CLASSIC_CELL_LABEL = {
    type: "定位", roles: "分路", release: "上线时间", skins: "皮肤数", gender: "性别",
  };
  const CLASSIC_CELL_EMOJI = { green: "🟩", yellow: "🟨", gray: "⬜", up: "⬆️", down: "⬇️" };

  // 题池：全部英雄（release 必有）
  function classicPool(heroes) {
    return heroes.filter((h) => h.release && h.release.date);
  }

  function classicDaily(date, pool) {
    return pool[dailyIndex(date, pool.length, "hok-classic")].id;
  }

  function classicRandom(pool, rand) {
    rand = rand || Math.random;
    return pool[Math.floor(rand() * pool.length)].id;
  }

  // 数值维度：0 相等；1 目标更高/更晚（提示 ⬆️）；-1 目标更低/更早（提示 ⬇️）
  function numCell(g, t) {
    if (g === t) return { status: "green" };
    return { status: t > g ? "up" : "down" };
  }

  function yearOf(dateStr) { return parseInt(dateStr.slice(0, 4), 10); }

  /*
   * 比对一次猜测。win=精确命中；cells 五维：
   * 定位：主定位相同=green，主副定位有交集=yellow，否则 gray
   * 分路：集合全同=green，有交集=yellow，无交集=gray
   * 上线时间：同年=green，否则 up/down（⬆️=答案更晚上线）
   * 皮肤数：相等=green，否则 up/down
   * 性别：相同=green，否则 gray
   */
  function classicCompare(g, t) {
    const gRoles = new Set(g.roles || []);
    const tRoles = new Set(t.roles || []);
    let inter = 0;
    gRoles.forEach((r) => { if (tRoles.has(r)) inter++; });
    let rolesStatus = "gray";
    if (gRoles.size === tRoles.size && inter === gRoles.size) rolesStatus = "green";
    else if (inter > 0) rolesStatus = "yellow";

    const gTypes = new Set(g.types || []);
    const tTypes = new Set(t.types || []);
    let typeStatus = "gray";
    if ((g.types || [])[0] === (t.types || [])[0]) typeStatus = "green";
    else {
      let ti = 0;
      gTypes.forEach((x) => { if (tTypes.has(x)) ti++; });
      if (ti > 0) typeStatus = "yellow";
    }

    let releaseCell;
    if (yearOf(g.release.date) === yearOf(t.release.date)) releaseCell = { status: "green" };
    else releaseCell = numCell(Date.parse(g.release.date), Date.parse(t.release.date));

    return {
      win: g.id === t.id,
      cells: {
        type: { status: typeStatus },
        roles: { status: rolesStatus },
        release: releaseCell,
        skins: numCell(g.skinCount, t.skinCount),
        gender: { status: g.gender === t.gender ? "green" : "gray" },
      },
    };
  }

  function classicGrade(tries, won) {
    if (!won) return "峡谷谜路人";
    if (tries === 1) return "天秀预判";
    if (tries <= 3) return "荣耀百星";
    if (tries <= 5) return "最强王者";
    if (tries <= 7) return "永恒钻石";
    return "压线过关";
  }

  // results: classicCompare 的结果数组；只含 emoji 与成绩，不含答案名
  function buildClassicShare(opts) {
    const { date, results, won, practice } = opts;
    const label = practice ? "经典猜英雄·练习" : `经典猜英雄 #${date}`;
    const rows = results.map((r) =>
      CLASSIC_CELL_ORDER.map((k) => CLASSIC_CELL_EMOJI[r.cells[k].status]).join(""));
    const lines = [
      `${SITE_NAME} · ${label}`,
      won ? `🎯 ${results.length}/${CLASSIC_MAX_TRIES}` : `🎯 X/${CLASSIC_MAX_TRIES}`,
      ...rows,
      `评级：${classicGrade(results.length, won)}`,
      SITE_URL,
    ];
    return lines.join("\n");
  }

  // ---------- 玩法 2：台词猜人（文字/语音双子模式） ----------

  const QUOTES_MAX_TRIES = 6;

  /*
   * 题池：quote 文本不含英雄名（防剧透）、英雄在 heroes 中存在。
   * 元素为原 quote 条目加 heroId。保持 quotes.json 原顺序（确定性）。
   */
  function quotesPool(quotes, heroesByName) {
    const pool = [];
    for (const q of quotes) {
      const h = heroesByName[q.hero];
      if (!h) continue; // 容错：quotes 里的英雄必须在 heroes.json
      if (!q.quote || q.quote.includes(q.hero)) continue;
      pool.push({
        heroId: h.id, hero: q.hero, skin: q.skin, quote: q.quote,
        scene: q.scene, emotion: q.emotion, audio: q.audio,
      });
    }
    return pool;
  }

  // 每个英雄的全部台词（含剧透句，供提示档「再放一条同英雄别的台词」用，仍过滤含英雄名的）
  function quotesByHero(quotes, heroesByName) {
    const map = {};
    for (const q of quotes) {
      const h = heroesByName[q.hero];
      if (!h || !q.quote || q.quote.includes(q.hero)) continue;
      (map[h.id] = map[h.id] || []).push(q.quote);
    }
    return map;
  }

  // 每日题：确定性选一条；salt 区分子模式（文字/语音同一天不同题）
  function quoteDaily(date, pool, submode) {
    return dailyIndex(date, pool.length, "hok-quotes-" + (submode || "text"));
  }

  function quoteRandom(pool, rand) {
    rand = rand || Math.random;
    return Math.floor(rand() * pool.length);
  }

  /*
   * 递进提示（确定性纯函数）：① 场景 ② 皮肤 ③ 情感 ④ 同英雄另一条台词。
   * wrongCount = 已猜错次数 = 已解锁条数。某档数据缺失则跳过该档。
   */
  function quoteHints(entry, byHeroMap, wrongCount) {
    const cands = [];
    if (entry.scene) cands.push(`🎬 场景：${entry.scene}`);
    if (entry.skin) cands.push(`👗 皮肤：${entry.skin}`);
    if (entry.emotion) cands.push(`💭 情感：${entry.emotion}`);
    const others = (byHeroMap[entry.heroId] || []).filter((t) => t !== entry.quote);
    if (others.length) {
      // 确定性选一条：用 entry.quote 做种子
      const rng = mulberry32(hash32("hok-hint:" + entry.quote));
      cands.push(`📜 另一条台词：“${others[Math.floor(rng() * others.length)]}”`);
    }
    return cands.slice(0, Math.max(0, Math.min(wrongCount, cands.length)));
  }

  function quoteGrade(tries, won) {
    if (!won) return "耳生得很";
    if (tries === 1) return "台词本人";
    if (tries <= 3) return "峡谷播音员";
    return "勉强对上号";
  }

  // rounds: [{ok:bool} | {skip:true}]
  function buildQuoteShare(opts) {
    const { date, submode, rounds, won, practice } = opts;
    const sub = submode === "audio" ? "语音台词" : "文字台词";
    const label = practice ? `台词猜人·${sub}·练习` : `台词猜人·${sub} #${date}`;
    const marks = rounds.map((r) => (r.skip ? "⬜" : r.ok ? "🟩" : "🟥")).join("");
    const icon = submode === "audio" ? "🎧" : "📜";
    const lines = [
      `${SITE_NAME} · ${label}`,
      won ? `${icon} ${rounds.length}/${QUOTES_MAX_TRIES}` : `${icon} X/${QUOTES_MAX_TRIES}`,
      marks,
      `评级：${quoteGrade(rounds.length, won)}`,
      SITE_URL,
    ];
    return lines.join("\n");
  }

  // ---------- 玩法 3：猜皮肤（渐进解 blur） ----------

  const SKINS_MAX_TRIES = 5;
  // 渐进揭示档：猜错一次降一档模糊；0 为完全清晰（结算用）
  const SKIN_BLUR_LEVELS = [24, 16, 9, 3, 0];

  // 题池：皮肤所属英雄必须在 heroes.json；元素加 heroId
  function skinsPool(skins, heroesByName) {
    const pool = [];
    for (const s of skins) {
      const h = heroesByName[s.hero];
      if (!h) continue;
      if (!s.poster) continue;
      pool.push({
        heroId: h.id, hero: s.hero, name: s.name, index: s.index,
        poster: s.poster, thumb: s.thumb,
      });
    }
    return pool;
  }

  function skinDaily(date, pool) {
    return dailyIndex(date, pool.length, "hok-skins");
  }

  function skinRandom(pool, rand) {
    rand = rand || Math.random;
    return Math.floor(rand() * pool.length);
  }

  // 皮肤全名判定：规范化后相等即可（忽略间隔号/空格/大小写）
  function skinNameMatch(input, skinName) {
    const a = normalize(input);
    return a.length > 0 && a === normalize(skinName);
  }

  function skinGrade(tries, won, bonus) {
    if (!won) return "脸盲晚期";
    if (tries === 1 && bonus) return "皮肤收藏家";
    if (tries === 1) return "火眼金睛";
    if (tries <= 3) return "外观党元老";
    return "擦线认出";
  }

  // rounds: [{ok:bool}]；bonus=答出皮肤全名
  function buildSkinShare(opts) {
    const { date, rounds, won, bonus, practice } = opts;
    const label = practice ? "猜皮肤·练习" : `猜皮肤 #${date}`;
    const marks = rounds.map((r) => (r.ok ? "🟩" : "🟥")).join("");
    const lines = [
      `${SITE_NAME} · ${label}`,
      won ? `🖼️ ${rounds.length}/${SKINS_MAX_TRIES}` : `🖼️ X/${SKINS_MAX_TRIES}`,
      marks + (bonus ? "⭐" : ""),
      `评级：${skinGrade(rounds.length, won, bonus)}`,
      SITE_URL,
    ];
    return lines.join("\n");
  }

  // ---------- 玩法 4：人气对决（Higher-Lower 连胜制） ----------

  const DUEL_DAILY_ROUNDS = 10;

  function formatViews(n) {
    if (n >= 100000000) return (Math.round(n / 10000000) / 10) + "亿";
    if (n >= 10000) {
      const w = n / 10000;
      return (Math.round(w * 10) / 10) + "万";
    }
    return String(n);
  }

  // 题池：views 为正数的英雄；data 为 popularity.json 的 data 字段（id → {name,views,...}）
  function duelPool(popData, heroesById) {
    const pool = [];
    for (const id of Object.keys(popData)) {
      const e = popData[id];
      if (!e || !Number.isFinite(e.views) || e.views <= 0) continue; // null/0 不进池
      const h = heroesById[id];
      pool.push({
        id, name: (h && h.name) || e.name, views: e.views,
        topTitle: e.top && e.top.title ? e.top.title : "",
      });
    }
    pool.sort((a, b) => a.id.localeCompare(b.id));
    return pool;
  }

  // 两个条目能否配对：播放量不同（排除平局）
  function duelPairable(a, b) {
    return a.views !== b.views;
  }

  // 每日固定 10 轮 → 需要 11 个条目串成链，种子决定序列
  function duelDailyChain(date, entries) {
    const rng = mulberry32(hash32("hok-duel:" + date));
    const shuffled = shuffle(entries.slice(), rng);
    const chain = [shuffled[0]];
    for (let i = 1; i < shuffled.length && chain.length < DUEL_DAILY_ROUNDS + 1; i++) {
      if (duelPairable(chain[chain.length - 1], shuffled[i])) chain.push(shuffled[i]);
    }
    return chain.map((e) => e.id);
  }

  // 无限模式：随机选一个能与 current 配对的下家
  function duelNext(entries, current, rand) {
    rand = rand || Math.random;
    const cands = entries.filter((e) => e.id !== current.id && duelPairable(e, current));
    return cands[Math.floor(rand() * cands.length)];
  }

  // 判定：guess ∈ {"higher","lower"}，right 相对 left
  function duelJudge(guess, left, right) {
    return (guess === "higher") === (right.views > left.views);
  }

  function duelGrade(score, total) {
    if (total && score >= total) return "人气预言家";
    if (score >= 7) return "峡谷顶流";
    if (score >= 4) return "老召唤师";
    return "回去补课";
  }

  // trail: [{dir:"higher"|"lower", ok:bool}]
  function buildDuelShare(opts) {
    const { date, score, trail, practice } = opts;
    const label = practice ? "人气对决·练习" : `人气对决 #${date}`;
    const scoreText = practice ? `🔥 连胜×${score}` : `🔥 连胜×${score}/${DUEL_DAILY_ROUNDS}`;
    const marks = trail.map((t) => (t.dir === "higher" ? "⬆️" : "⬇️") + (t.ok ? "✔️" : "❌")).join("");
    const lines = [
      `${SITE_NAME} · ${label}`,
      scoreText,
      marks,
      `评级：${duelGrade(score, practice ? 0 : DUEL_DAILY_ROUNDS)}`,
      SITE_URL,
    ];
    return lines.join("\n");
  }

  // ---------- 玩法 5：版本排排坐 ----------

  const TL_PICK = 5;
  const TL_MAX_TRIES = 3;
  const TL_MIN_GAP_DAYS = 30;

  // 题池：release 存在且 precision 不是 year（year 精度不出题）
  function timelinePool(heroes) {
    return heroes.filter((h) => h.release && h.release.date && h.release.precision !== "year");
  }

  function dayDiff(a, b) {
    return Math.abs(Date.parse(a) - Date.parse(b)) / 86400000;
  }

  /*
   * 选 5 个英雄：两两上线间隔 ≥30 天（自然带来年份分散）；
   * 极端情况凑不齐时放宽为「日期两两不同」，保证一定能出题。
   */
  function timelinePick(rng, pool) {
    const shuffled = shuffle(pool.slice(), rng);
    const picked = [];
    for (const h of shuffled) {
      if (picked.every((p) => dayDiff(p.release.date, h.release.date) >= TL_MIN_GAP_DAYS)) picked.push(h);
      if (picked.length === TL_PICK) return picked;
    }
    for (const h of shuffled) {
      if (picked.includes(h)) continue;
      if (picked.every((p) => p.release.date !== h.release.date)) picked.push(h);
      if (picked.length === TL_PICK) return picked;
    }
    return picked; // 理论上不会到这里
  }

  function timelineDaily(date, pool) {
    const rng = mulberry32(hash32("hok-timeline:" + date));
    return timelinePick(rng, pool).map((h) => h.id);
  }

  function timelineRandom(pool, rand) {
    rand = rand || Math.random;
    const rng = mulberry32(Math.floor(rand() * 0xffffffff));
    return timelinePick(rng, pool).map((h) => h.id);
  }

  // 正确顺序（早 → 晚）
  function timelineCorrect(ids, heroesById) {
    return ids.slice().sort((a, b) =>
      Date.parse(heroesById[a].release.date) - Date.parse(heroesById[b].release.date));
  }

  // 逐位判定：orderIds 为玩家当前排列，correctIds 为正确顺序
  function timelineMarks(orderIds, correctIds) {
    return orderIds.map((id, i) => id === correctIds[i]);
  }

  function timelineGrade(tries, won) {
    if (!won) return "时间线崩坏";
    if (tries === 1) return "活体编年史";
    if (tries === 2) return "版本考据党";
    return "翻资料型选手";
  }

  // attempts: 每次提交的 marks 数组（bool×5）
  function buildTimelineShare(opts) {
    const { date, attempts, won, practice } = opts;
    const label = practice ? "版本排排坐·练习" : `版本排排坐 #${date}`;
    const rows = attempts.map((m) => m.map((b) => (b ? "🟩" : "🟥")).join(""));
    const lines = [
      `${SITE_NAME} · ${label}`,
      won ? `⏳ ${attempts.length}/${TL_MAX_TRIES}` : `⏳ X/${TL_MAX_TRIES}`,
      ...rows,
      `评级：${timelineGrade(attempts.length, won)}`,
      SITE_URL,
    ];
    return lines.join("\n");
  }

  return {
    SITE_NAME, SITE_URL,
    hash32, mulberry32, dateStr, dailyIndex, shuffle, normalize, searchHeroes,
    // 经典猜英雄
    CLASSIC_MAX_TRIES, CLASSIC_CELL_ORDER, CLASSIC_CELL_LABEL, CLASSIC_CELL_EMOJI,
    classicPool, classicDaily, classicRandom, classicCompare, classicGrade, buildClassicShare,
    // 台词猜人
    QUOTES_MAX_TRIES, quotesPool, quotesByHero, quoteDaily, quoteRandom,
    quoteHints, quoteGrade, buildQuoteShare,
    // 猜皮肤
    SKINS_MAX_TRIES, SKIN_BLUR_LEVELS, skinsPool, skinDaily, skinRandom,
    skinNameMatch, skinGrade, buildSkinShare,
    // 人气对决
    DUEL_DAILY_ROUNDS, formatViews, duelPool, duelPairable, duelDailyChain,
    duelNext, duelJudge, duelGrade, buildDuelShare,
    // 版本排排坐
    TL_PICK, TL_MAX_TRIES, TL_MIN_GAP_DAYS, timelinePool, timelineDaily, timelineRandom,
    timelineCorrect, timelineMarks, timelineGrade, buildTimelineShare, dayDiff,
  };
});
