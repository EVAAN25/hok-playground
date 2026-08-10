/* 猜皮肤 —— 海报渐进解 blur 猜英雄，答出皮肤全名加分 */
(function () {
  "use strict";
  const HOK = window.HOK;
  const UI = window.HOKUI;
  const { $, store, loadJSON, TODAY, dkey, avatarHTML, toast, copyText, shakeInput } = UI;

  let HEROES = [], POOL = [], byId = {};
  const G = { mode: "daily", daily: null, practice: null };

  const state = () => (G.mode === "daily" ? G.daily : G.practice);
  const entry = () => POOL[state().idx];
  const persist = () => { if (G.mode === "daily") store.set(dkey("skins"), JSON.stringify(G.daily)); };

  function newState(idx) { return { idx, guesses: [], status: "playing", bonus: null }; }

  function initDaily() {
    const idx = HOK.skinDaily(TODAY, POOL);
    const saved = loadJSON(dkey("skins"), null);
    G.daily = (saved && saved.idx === idx) ? saved : newState(idx);
  }
  function newPractice() { G.practice = newState(HOK.skinRandom(POOL)); }

  function blurLevel() {
    const wrongs = state().guesses.length;
    const done = state().status !== "playing";
    if (done) return 0;
    return HOK.SKIN_BLUR_LEVELS[Math.min(wrongs, HOK.SKIN_BLUR_LEVELS.length - 1)];
  }

  function renderPoster() {
    const img = $("#poster");
    const e = entry();
    const lv = blurLevel();
    if (img.dataset.src !== e.poster) {
      img.dataset.src = e.poster;
      img.src = e.poster;
      img.onerror = () => {
        img.onerror = null;
        // 海报热链失败兜底：用头像顶替并提示（极少见，skins.json 已逐条 HEAD 校验）
        img.src = "assets/avatars/" + e.heroId + ".jpg";
        toast("海报加载失败，已用英雄头像兜底");
      };
    }
    img.style.filter = lv > 0 ? `blur(${lv}px)` : "none";
  }

  function render() {
    const s = state();
    $("#banner").innerHTML = G.mode === "daily"
      ? UI.dailyBanner()
      : `无限模式 · 随机出题 · 不计入每日成绩`;
    renderPoster();
    const wrongs = s.guesses.length;
    const lv = Math.min(wrongs + 1, HOK.SKIN_BLUR_LEVELS.length);
    $("#levelText").innerHTML = s.status === "playing"
      ? `清晰度 <b>${lv}</b> / ${HOK.SKIN_BLUR_LEVELS.length} · 猜错一次清晰一档`
      : `已揭晓`;
    const left = HOK.SKINS_MAX_TRIES - s.guesses.length;
    $("#tries").innerHTML = `剩 <b>${left}</b> / ${HOK.SKINS_MAX_TRIES} 次`;
    $("#chips").innerHTML = s.guesses.map((id) => {
      const h = byId[id];
      return `<span class="chip wrong">${avatarHTML(h)}${h.name}</span>`;
    }).join("");

    const playing = s.status === "playing";
    $("#guessInput").disabled = !playing;
    $("#guessInput").placeholder = playing ? "猜英雄：输入英雄名或拼音" : "本局已结束";
    if (playing) $("#result").classList.add("hidden");
    else renderResult();
  }

  function renderResult() {
    const s = state();
    const e = entry();
    const h = byId[e.heroId];
    const won = s.status === "won";
    const tries = s.guesses.length + (won ? 1 : 0);

    // 加分题区块：猜中且尚未作答皮肤全名时出现
    const bonusBlock = (won && s.bonus === null) ? `
      <div class="skin-bonus">
        <div class="input-wrap">
          <input id="bonusInput" class="input" type="text" placeholder="⭐ 加分题：这款皮肤的全名是？"
                 autocomplete="off" autocapitalize="off" spellcheck="false">
        </div>
        <button class="btn" id="bonusBtn">提交</button>
        <button class="btn ghost" id="bonusSkip">跳过</button>
      </div>` : "";

    const grade = HOK.skinGrade(tries, won, s.bonus === true);
    $("#result").innerHTML = `
      ${avatarHTML(h, "r-portrait")}
      <h2>${won ? "猜中了！" : "揭晓答案"}：${h.name}</h2>
      <p class="r-meta">皮肤：${e.name} · ${h.title}</p>
      <p class="r-grade">${won ? tries : "X"}/${HOK.SKINS_MAX_TRIES} 次 · 评级 <b>${grade}</b>${s.bonus === true ? " ⭐" : ""}</p>
      ${bonusBlock}
      <div class="btn-row">
        <button class="btn" id="againBtn">🔄 再来一题</button>
        <button class="btn ghost" id="shareBtn">复制分享卡</button>
      </div>`;
    $("#result").classList.remove("hidden");

    if (won && s.bonus === null) {
      const submitBonus = () => {
        const v = $("#bonusInput").value;
        s.bonus = HOK.skinNameMatch(v, e.name);
        toast(s.bonus ? "加分题答对，分享卡 +⭐" : "皮肤名不对，也算过关");
        persist();
        render();
      };
      $("#bonusBtn").onclick = submitBonus;
      $("#bonusInput").addEventListener("keydown", (ev) => { if (ev.key === "Enter" && !ev.isComposing) submitBonus(); });
      $("#bonusSkip").onclick = () => { s.bonus = false; persist(); render(); };
    }
    $("#shareBtn").onclick = () => copyText(HOK.buildSkinShare({
      date: TODAY,
      rounds: s.guesses.map(() => ({ ok: false })).concat(won ? [{ ok: true }] : []),
      won, bonus: s.bonus === true, practice: G.mode === "practice",
    }));
    $("#againBtn").onclick = () => switchMode("practice", true);
  }

  function submit(hero) {
    const s = state();
    if (!s || s.status !== "playing") return;
    if (s.guesses.includes(hero.id)) { toast("这位英雄已经猜过了"); return; }
    if (hero.id === entry().heroId) {
      s.status = "won";
    } else {
      s.guesses.push(hero.id);
      if (s.guesses.length >= HOK.SKINS_MAX_TRIES) s.status = "lost";
      shakeInput($("#guessInput"));
    }
    persist();
    render();
  }

  function switchMode(mode, forceNew) {
    G.mode = mode;
    if (mode === "practice" && (forceNew || !G.practice || G.practice.status !== "playing")) newPractice();
    UI.syncModeTabs("skins", mode);
    render();
  }

  UI.withLoading($("#loadBox"), "data/heroes.json", (heroData) => {
    HEROES = heroData.heroes;
    byId = {};
    const byName = {};
    HEROES.forEach((h) => { byId[h.id] = h; byName[h.name] = h; });
    // skins.json 进本页才拉（懒加载）
    UI.withLoading($("#loadBox"), "data/skins.json", (skinData) => {
      POOL = HOK.skinsPool(skinData.skins, byName);
      initDaily();
      $("#loadBox").classList.add("hidden");
      $("#gameBox").classList.remove("hidden");
      UI.bindModeTabs("skins", (m) => switchMode(m, false));
      UI.attachAutocomplete({
        input: $("#guessInput"), list: $("#guessSuggest"), heroes: HEROES,
        getExclude: () => state().guesses,
        onPick: submit,
      });
      render();
    });
  });
})();
