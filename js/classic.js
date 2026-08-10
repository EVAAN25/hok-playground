/* 经典猜英雄 —— wordle 式五维比对 */
(function () {
  "use strict";
  const HOK = window.HOK;
  const UI = window.HOKUI;
  const { $, store, loadJSON, TODAY, dkey, avatarHTML, toast, copyText, shakeInput } = UI;

  let HEROES = [], POOL = [], byId = {};
  const G = { mode: "daily", daily: null, practice: null };

  const state = () => (G.mode === "daily" ? G.daily : G.practice);
  const target = () => byId[state().targetId];
  const persist = () => { if (G.mode === "daily") store.set(dkey("classic"), JSON.stringify(G.daily)); };

  function newState(targetId) { return { targetId, guesses: [], results: [], status: "playing" }; }

  function initDaily() {
    const targetId = HOK.classicDaily(TODAY, POOL);
    const saved = loadJSON(dkey("classic"), null);
    G.daily = (saved && saved.targetId === targetId) ? saved : newState(targetId);
  }
  function newPractice() { G.practice = newState(HOK.classicRandom(POOL)); }

  function cellHTML(cell, text) {
    let arrow = "";
    if (cell.status === "up") arrow = '<span class="arrow">⬆</span>';
    if (cell.status === "down") arrow = '<span class="arrow">⬇</span>';
    return `<div class="cell ${cell.status}"><span>${text}</span>${arrow}</div>`;
  }

  function yearText(h) { return h.release.date.slice(0, 4) + " 年"; }

  function rowHTML(h, res) {
    const c = res.cells;
    return `<div class="row guess-grid">
      <div class="cell name">${avatarHTML(h)}<span>${h.name}</span></div>
      ${cellHTML(c.type, (h.types || []).join("/") || "—")}
      ${cellHTML(c.roles, (h.roles || []).join("、") || "—")}
      ${cellHTML(c.release, yearText(h))}
      ${cellHTML(c.skins, h.skinCount + " 款")}
      ${cellHTML(c.gender, h.gender)}
    </div>`;
  }

  function render() {
    const s = state();
    $("#banner").innerHTML = G.mode === "daily"
      ? UI.dailyBanner()
      : `无限模式 · 随机出题 · 不计入每日成绩`;
    const left = HOK.CLASSIC_MAX_TRIES - s.guesses.length;
    $("#tries").innerHTML = `剩 <b>${left}</b> / ${HOK.CLASSIC_MAX_TRIES} 次`;
    $("#rows").innerHTML = s.guesses.map((id, i) => rowHTML(byId[id], s.results[i])).join("");
    const playing = s.status === "playing";
    $("#guessInput").disabled = !playing;
    $("#guessInput").placeholder = playing ? "输入英雄名或拼音，如：李白 / libai" : "本局已结束";
    if (playing) $("#result").classList.add("hidden");
    else renderResult();
  }

  function renderResult() {
    const s = state();
    const t = target();
    const won = s.status === "won";
    const tries = s.guesses.length;
    $("#result").innerHTML = `
      ${avatarHTML(t, "r-portrait")}
      <h2>${won ? "猜中了！" : "揭晓答案"}：${t.name}</h2>
      <p class="r-meta">${t.title} · ${(t.types || []).join("/")} · ${(t.roles || []).join("、")} · ${t.gender} · ${t.skinCount} 款皮肤 · ${t.release.date} 上线</p>
      <p class="r-grade">${won ? tries : "X"}/${HOK.CLASSIC_MAX_TRIES} 次 · 评级 <b>${HOK.classicGrade(tries, won)}</b></p>
      <div class="btn-row">
        <button class="btn" id="againBtn">🔄 再来一题</button>
        <button class="btn ghost" id="shareBtn">复制分享卡</button>
      </div>`;
    $("#result").classList.remove("hidden");
    $("#shareBtn").onclick = () => copyText(HOK.buildClassicShare({
      date: TODAY, results: s.results, won, practice: G.mode === "practice",
    }));
    // 每日题结束后原地开随机局续玩；每日进度（localStorage）不受影响
    $("#againBtn").onclick = () => switchMode("practice", true);
  }

  function submit(hero) {
    const s = state();
    if (!s || s.status !== "playing") return;
    if (s.guesses.includes(hero.id)) { toast("这位英雄已经猜过了"); return; }
    const res = HOK.classicCompare(hero, target());
    s.guesses.push(hero.id);
    s.results.push(res);
    if (res.win) s.status = "won";
    else {
      if (s.guesses.length >= HOK.CLASSIC_MAX_TRIES) s.status = "lost";
      shakeInput($("#guessInput"));
    }
    persist();
    render();
  }

  function switchMode(mode, forceNew) {
    G.mode = mode;
    if (mode === "practice" && (forceNew || !G.practice || G.practice.status !== "playing")) newPractice();
    UI.syncModeTabs("classic", mode);
    render();
  }

  UI.withLoading($("#loadBox"), "data/heroes.json", (data) => {
    HEROES = data.heroes;
    byId = {};
    HEROES.forEach((h) => { byId[h.id] = h; });
    POOL = HOK.classicPool(HEROES);
    initDaily();
    $("#loadBox").classList.add("hidden");
    $("#gameBox").classList.remove("hidden");
    UI.bindModeTabs("classic", (m) => switchMode(m, false));
    UI.attachAutocomplete({
      input: $("#guessInput"), list: $("#guessSuggest"), heroes: POOL,
      getExclude: () => state().guesses,
      onPick: submit,
    });
    render();
  });
})();
