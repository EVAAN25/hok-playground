/* 人气对决 —— B 站官号播放量 Higher-Lower 连胜制 */
(function () {
  "use strict";
  const HOK = window.HOK;
  const UI = window.HOKUI;
  const { $, store, loadJSON, TODAY, dkey, avatarHTML, toast, copyText } = UI;

  let POOL = [], entryById = {};
  const G = { mode: "daily", daily: null, practice: null, locking: false };

  const state = () => (G.mode === "daily" ? G.daily : G.practice);
  const persist = () => { if (G.mode === "daily") store.set(dkey("duel"), JSON.stringify(G.daily)); };
  const pair = () => {
    const s = state();
    if (G.mode === "daily") return [entryById[s.chain[s.pos]], entryById[s.chain[s.pos + 1]]];
    return [entryById[s.leftId], entryById[s.rightId]];
  };

  function initDaily() {
    const chain = HOK.duelDailyChain(TODAY, POOL);
    const saved = loadJSON(dkey("duel"), null);
    G.daily = (saved && saved.chain && saved.chain.join() === chain.join())
      ? saved
      : { chain, pos: 0, score: 0, trail: [], status: "playing" };
  }
  function newPractice() {
    const first = POOL[Math.floor(Math.random() * POOL.length)];
    const second = HOK.duelNext(POOL, first);
    G.practice = { leftId: first.id, rightId: second.id, score: 0, trail: [], status: "playing" };
  }

  function cardHTML(e, showViews, cls) {
    const hero = { id: e.id, name: e.name };
    return `
      ${avatarHTML(hero)}
      <div class="pop-name">${e.name}</div>
      <div class="pop-play ${showViews ? "" : "unknown"}">
        ${showViews ? HOK.formatViews(e.views) + "<small>次播放</small>" : "? ? ?"}
      </div>
      ${showViews && e.topTitle ? `<div class="pop-title">最热视频：${e.topTitle}</div>` : ""}`;
  }

  function render(revealRight, markCls) {
    const s = state();
    $("#banner").innerHTML = G.mode === "daily"
      ? UI.dailyBanner(`固定 ${HOK.DUEL_DAILY_ROUNDS} 轮 · 猜错即结算`)
      : `无限模式 · 一直打到错 · 历史最佳 ${loadJSON("hok_duel_best", 0)} 连胜`;
    const [left, right] = pair();
    $("#cardLeft").innerHTML = cardHTML(left, true);
    $("#cardRight").innerHTML = cardHTML(right, !!revealRight);
    $("#cardLeft").className = "pop-card" + (markCls ? " " + markCls.l : "");
    $("#cardRight").className = "pop-card" + (markCls ? " " + markCls.r : "");
    const playing = s.status === "playing" && !revealRight;
    $("#btnHigher").disabled = !playing;
    $("#btnLower").disabled = !playing;
    $("#streak").innerHTML = `当前连胜 <b>${s.score}</b>${G.mode === "daily" ? ` · 第 ${Math.min(s.pos + 1, HOK.DUEL_DAILY_ROUNDS)} / ${HOK.DUEL_DAILY_ROUNDS} 轮` : ""}`;
    if (s.status === "playing") $("#result").classList.add("hidden");
  }

  function renderResult() {
    const s = state();
    const daily = G.mode === "daily";
    const title = daily
      ? (s.score >= HOK.DUEL_DAILY_ROUNDS ? "十连胜，全程无失误！" : `本局结束：连胜 ${s.score}`)
      : `本局结束：连胜 ${s.score}`;
    const best = loadJSON("hok_duel_best", 0);
    const bestLine = !daily ? `<p class="r-meta">历史最佳：${best} 连胜</p>` : "";
    $("#result").innerHTML = `
      <h2>${title}</h2>
      ${bestLine}
      <p class="r-grade">评级 <b>${HOK.duelGrade(s.score, daily ? HOK.DUEL_DAILY_ROUNDS : 0)}</b></p>
      <div class="btn-row">
        <button class="btn" id="againBtn">🔄 再来一局</button>
        <button class="btn ghost" id="shareBtn">复制分享卡</button>
      </div>`;
    $("#result").classList.remove("hidden");
    $("#shareBtn").onclick = () => copyText(HOK.buildDuelShare({
      date: TODAY, score: s.score, trail: s.trail, practice: !daily,
    }));
    $("#againBtn").onclick = () => switchMode("practice", true);
  }

  function answer(guess) {
    const s = state();
    if (!s || s.status !== "playing" || G.locking) return;
    G.locking = true;
    const [left, right] = pair();
    const ok = HOK.duelJudge(guess, left, right);
    s.trail.push({ dir: guess, ok });
    if (ok) s.score++;
    render(true, { l: ok ? "ok" : "bad", r: ok ? "ok" : "bad" });

    setTimeout(() => {
      G.locking = false;
      if (!ok) {
        s.status = "ended";
      } else if (G.mode === "daily") {
        s.pos++;
        if (s.pos >= HOK.DUEL_DAILY_ROUNDS) s.status = "ended";
      } else {
        // 无限模式：右边变左边，抽新右边
        s.leftId = s.rightId;
        s.rightId = HOK.duelNext(POOL, entryById[s.leftId]).id;
      }
      if (s.status !== "playing" && G.mode === "practice") {
        const best = loadJSON("hok_duel_best", 0);
        if (s.score > best) store.set("hok_duel_best", JSON.stringify(s.score));
      }
      persist();
      render(false);
      if (s.status !== "playing") renderResult();
    }, 900);
  }

  function switchMode(mode, forceNew) {
    G.mode = mode;
    if (mode === "practice" && (forceNew || !G.practice || G.practice.status !== "playing")) newPractice();
    UI.syncModeTabs("duel", mode);
    render(false);
    if (state().status !== "playing") renderResult();
  }

  // popularity.json 进本页才拉（懒加载）
  UI.withLoading($("#loadBox"), "data/popularity.json", (pop) => {
    // 英雄名以 heroes.json 为准（popularity 里也带 name，双保险）
    UI.loadData("data/heroes.json").then((heroData) => {
      const heroesById = {};
      heroData.heroes.forEach((h) => { heroesById[h.id] = h; });
      POOL = HOK.duelPool(pop.data, heroesById);
      entryById = {};
      POOL.forEach((e) => { entryById[e.id] = e; });
      initDaily();
      $("#dataNote").textContent =
        `播放量为 B 站官号「王者荣耀」(mid 57863910) 视频标题匹配聚合快照（${(pop.generated_at || "").slice(0, 10)}）：` +
        `${pop.rule || "标题含英雄名即计入"}。`;
      $("#loadBox").classList.add("hidden");
      $("#gameBox").classList.remove("hidden");
      UI.bindModeTabs("duel", (m) => switchMode(m, false));
      $("#btnHigher").addEventListener("click", () => answer("higher"));
      $("#btnLower").addEventListener("click", () => answer("lower"));
      render(false);
      if (state().status !== "playing") renderResult();
    });
  });
})();
