/* 台词猜人 —— 文字 / 语音双子模式 */
(function () {
  "use strict";
  const HOK = window.HOK;
  const UI = window.HOKUI;
  const { $, store, loadJSON, TODAY, dkey, avatarHTML, toast, copyText, shakeInput } = UI;

  let HEROES = [], POOL = [], BYHERO_QUOTES = {}, byId = {};
  // 两个子模式各自独立的每日/练习局
  const G = {
    sub: "text", mode: "daily",
    daily: { text: null, audio: null },
    practice: { text: null, audio: null },
    hintShown: 0,
  };
  let audioEl = null;

  const storeKey = () => dkey("quotes_" + G.sub);
  const state = () => (G.mode === "daily" ? G.daily[G.sub] : G.practice[G.sub]);
  const entry = () => POOL[state().idx];
  const persist = () => { if (G.mode === "daily") store.set(storeKey(), JSON.stringify(G.daily[G.sub])); };

  function newState(idx) { return { idx, guesses: [], rounds: [], status: "playing" }; }

  function initDaily(sub) {
    const idx = HOK.quoteDaily(TODAY, POOL, sub);
    const saved = loadJSON(dkey("quotes_" + sub), null);
    G.daily[sub] = (saved && saved.idx === idx) ? saved : newState(idx);
  }
  function newPractice(sub) { G.practice[sub] = newState(HOK.quoteRandom(POOL)); }

  function stopAudio() { if (audioEl) { audioEl.pause(); audioEl.currentTime = 0; } }

  function wrongCount() { return state().rounds.filter((r) => !r.ok).length; }

  function renderHints() {
    const s = state();
    if (s.rounds.length === 0) G.hintShown = 0; // 新局重置
    const hints = HOK.quoteHints(entry(), BYHERO_QUOTES, wrongCount());
    const freshIdx = hints.length > (G.hintShown || 0) ? hints.length - 1 : -1;
    G.hintShown = hints.length;
    $("#hints").innerHTML = hints.map((t, i) =>
      `<div class="clue${i === freshIdx ? " fresh" : ""}"><span class="clue-text">${t}</span></div>`).join("");
  }

  function render() {
    const s = state();
    const e = entry();
    $("#banner").innerHTML = G.mode === "daily"
      ? UI.dailyBanner(G.sub === "audio" ? "语音子模式 · 全站同题" : "文字子模式 · 全站同题")
      : `无限模式 · 随机出题 · 不计入每日成绩`;

    // 子模式舞台切换
    const isAudio = G.sub === "audio";
    $("#quoteCard").classList.toggle("hidden", isAudio);
    $("#voiceStage").classList.toggle("hidden", !isAudio);
    $("#quoteText").textContent = e.quote;

    const left = HOK.QUOTES_MAX_TRIES - s.rounds.length;
    $("#tries").innerHTML = `剩 <b>${left}</b> / ${HOK.QUOTES_MAX_TRIES} 次`;
    $("#chips").innerHTML = s.guesses.map((id, i) => {
      const r = s.rounds[i];
      if (r.skip) return `<span class="chip skip">跳过</span>`;
      const h = byId[id];
      return `<span class="chip ${r.ok ? "hit" : "wrong"}">${avatarHTML(h)}${h.name}</span>`;
    }).join("");

    renderHints();

    const playing = s.status === "playing";
    $("#guessInput").disabled = !playing;
    $("#skipBtn").disabled = !playing;
    $("#guessInput").placeholder = playing ? "输入英雄名或拼音，如：李白 / libai" : "本局已结束";
    if (playing) $("#result").classList.add("hidden");
    else renderResult();
  }

  function renderResult() {
    const s = state();
    const e = entry();
    const h = byId[e.heroId];
    const won = s.status === "won";
    const tries = s.rounds.length;
    $("#result").innerHTML = `
      ${avatarHTML(h, "r-portrait")}
      <h2>${won ? "猜中了！" : "揭晓答案"}：${h.name}</h2>
      <p class="r-meta">${h.title} · ${(h.types || []).join("/")} · ${e.skin}</p>
      <p class="r-quote">“${e.quote}”</p>
      <p class="r-grade">${won ? tries : "X"}/${HOK.QUOTES_MAX_TRIES} 次 · 评级 <b>${HOK.quoteGrade(tries, won)}</b></p>
      <div class="btn-row">
        <button class="btn" id="againBtn">🔄 再来一题</button>
        <button class="btn ghost" id="shareBtn">复制分享卡</button>
      </div>`;
    $("#result").classList.remove("hidden");
    $("#shareBtn").onclick = () => copyText(HOK.buildQuoteShare({
      date: TODAY, submode: G.sub, rounds: s.rounds, won, practice: G.mode === "practice",
    }));
    $("#againBtn").onclick = () => switchMode("practice", true);
  }

  function finishRound(heroOrNull) {
    const s = state();
    if (!s || s.status !== "playing") return;
    if (heroOrNull) {
      if (s.guesses.includes(heroOrNull.id)) { toast("这位英雄已经猜过了"); return; }
      const ok = heroOrNull.id === entry().heroId;
      s.guesses.push(heroOrNull.id);
      s.rounds.push({ ok });
      if (ok) s.status = "won";
    } else {
      s.guesses.push(null);
      s.rounds.push({ skip: true });
    }
    if (s.status === "playing") {
      if (s.rounds.length >= HOK.QUOTES_MAX_TRIES) s.status = "lost";
      shakeInput($("#guessInput"));
    }
    if (s.status !== "playing") stopAudio();
    persist();
    render();
  }

  function switchMode(mode, forceNew) {
    stopAudio();
    G.mode = mode;
    if (mode === "practice" && (forceNew || !G.practice[G.sub] || G.practice[G.sub].status !== "playing")) {
      newPractice(G.sub);
    }
    UI.syncModeTabs("quotes", mode);
    render();
  }

  function switchSub(sub) {
    if (G.sub === sub) return;
    stopAudio();
    G.sub = sub;
    UI.$$("#subTabs .sub-tab").forEach((b) => b.classList.toggle("active", b.dataset.sub === sub));
    if (G.mode === "daily" && !G.daily[sub]) initDaily(sub);
    if (G.mode === "practice" && !G.practice[sub]) newPractice(sub);
    render();
  }

  function playAudio() {
    const e = entry();
    if (!e.audio) { toast("这条台词没有音频"); return; }
    stopAudio();
    audioEl = new Audio(e.audio);
    audioEl.play().catch(() => toast("音频加载失败，可切换文字模式"));
    audioEl.onerror = () => toast("音频加载失败，可切换文字模式");
  }

  // 先拉小 heroes.json 建索引，再懒加载大 quotes.json（4.3MB）
  UI.withLoading($("#loadBox"), "data/heroes.json", (heroData) => {
    HEROES = heroData.heroes;
    byId = {};
    const byName = {};
    HEROES.forEach((h) => { byId[h.id] = h; byName[h.name] = h; });
    UI.withLoading($("#loadBox"), "data/quotes.json", (quoteData) => {
      POOL = HOK.quotesPool(quoteData.quotes, byName);
      BYHERO_QUOTES = HOK.quotesByHero(quoteData.quotes, byName);
      initDaily("text");
      $("#loadBox").classList.add("hidden");
      $("#gameBox").classList.remove("hidden");
      UI.bindModeTabs("quotes", (m) => switchMode(m, false));
      UI.$$("#subTabs .sub-tab").forEach((b) => b.addEventListener("click", () => switchSub(b.dataset.sub)));
      UI.attachAutocomplete({
        input: $("#guessInput"), list: $("#guessSuggest"), heroes: HEROES,
        getExclude: () => state().guesses.filter(Boolean),
        onPick: (h) => finishRound(h),
      });
      $("#skipBtn").addEventListener("click", () => finishRound(null));
      $("#playBtn").addEventListener("click", playAudio);
      render();
    });
  });
})();
