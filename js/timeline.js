/* 版本排排坐 —— 点两张卡片交换位置，按上线时间从早到晚排序 */
(function () {
  "use strict";
  const HOK = window.HOK;
  const UI = window.HOKUI;
  const { $, store, loadJSON, TODAY, dkey, avatarHTML, copyText } = UI;

  let POOL = [], byId = {};
  const G = { mode: "daily", daily: null, practice: null, sel: -1 };

  const state = () => (G.mode === "daily" ? G.daily : G.practice);
  const persist = () => { if (G.mode === "daily") store.set(dkey("timeline"), JSON.stringify(G.daily)); };
  const correctOrder = () => HOK.timelineCorrect(state().ids, byId);

  function newState(ids) {
    // ids 是出题顺序（已按种子洗牌），order 记录玩家当前排列
    return { ids, order: ids.slice(), attempts: [], status: "playing" };
  }

  function initDaily() {
    const ids = HOK.timelineDaily(TODAY, POOL);
    const saved = loadJSON(dkey("timeline"), null);
    G.daily = (saved && saved.ids && saved.ids.join() === ids.join()) ? saved : newState(ids);
  }
  function newPractice() { G.practice = newState(HOK.timelineRandom(POOL)); }

  function render() {
    const s = state();
    $("#banner").innerHTML = G.mode === "daily"
      ? UI.dailyBanner("点两张卡片交换位置，上早下晚")
      : `无限模式 · 随机出题 · 不计入每日成绩`;
    const done = s.status !== "playing";
    const correct = done ? correctOrder() : null;
    $("#tlList").innerHTML = s.order.map((id, i) => {
      const h = byId[id];
      const dateTd = done ? `<span class="tdate">${h.release.date}</span>` : "";
      return `<div class="tl-card${done ? " done" : ""}${i === G.sel ? " sel" : ""}" data-i="${i}">
        <span class="pos">${i + 1}</span>
        ${avatarHTML(h)}
        <span class="tname">${h.name}<small>${h.title}</small></span>
        ${dateTd}
      </div>`;
    }).join("");
    if (!done) {
      UI.$$("#tlList .tl-card").forEach((el) => {
        el.addEventListener("click", () => onCard(Number(el.dataset.i)));
      });
    }
    const left = HOK.TL_MAX_TRIES - s.attempts.length;
    $("#tries").innerHTML = `剩 <b>${left}</b> / ${HOK.TL_MAX_TRIES} 次提交`;
    $("#submitBtn").disabled = done;
    $("#attempts").innerHTML = s.attempts.map((m) =>
      `<div class="tl-marks">${m.map((b) => (b ? "🟩" : "🟥")).join("")}</div>`).join("");
    if (done) renderResult(correct);
    else $("#result").classList.add("hidden");
  }

  function onCard(i) {
    if (G.sel === -1) { G.sel = i; }
    else if (G.sel === i) { G.sel = -1; }
    else {
      const s = state();
      [s.order[G.sel], s.order[i]] = [s.order[i], s.order[G.sel]];
      G.sel = -1;
      persist();
    }
    render();
  }

  function submit() {
    const s = state();
    if (!s || s.status !== "playing") return;
    const correct = correctOrder();
    const marks = HOK.timelineMarks(s.order, correct);
    s.attempts.push(marks);
    if (marks.every(Boolean)) {
      s.status = "won";
      s.order = correct; // 落定正确顺序
    } else if (s.attempts.length >= HOK.TL_MAX_TRIES) {
      s.status = "lost";
      s.order = correct; // 展示正确顺序
    }
    G.sel = -1;
    persist();
    render();
  }

  function renderResult(correct) {
    const s = state();
    const won = s.status === "won";
    const tries = s.attempts.length;
    const names = correct.map((id) => byId[id].name).join(" → ");
    $("#result").innerHTML = `
      <h2>${won ? "排序正确！" : "机会用完"}</h2>
      <p class="r-meta">正确顺序（早 → 晚）：${names}</p>
      <p class="r-grade">${won ? tries : "X"}/${HOK.TL_MAX_TRIES} 次提交 · 评级 <b>${HOK.timelineGrade(tries, won)}</b></p>
      <div class="btn-row">
        <button class="btn" id="againBtn">🔄 再来一题</button>
        <button class="btn ghost" id="shareBtn">复制分享卡</button>
      </div>`;
    $("#result").classList.remove("hidden");
    $("#shareBtn").onclick = () => copyText(HOK.buildTimelineShare({
      date: TODAY, attempts: s.attempts, won, practice: G.mode === "practice",
    }));
    $("#againBtn").onclick = () => switchMode("practice", true);
  }

  function switchMode(mode, forceNew) {
    G.mode = mode;
    G.sel = -1;
    if (mode === "practice" && (forceNew || !G.practice || G.practice.status !== "playing")) newPractice();
    UI.syncModeTabs("timeline", mode);
    render();
  }

  UI.withLoading($("#loadBox"), "data/heroes.json", (data) => {
    data.heroes.forEach((h) => { byId[h.id] = h; });
    POOL = HOK.timelinePool(data.heroes);
    initDaily();
    $("#loadBox").classList.add("hidden");
    $("#gameBox").classList.remove("hidden");
    UI.bindModeTabs("timeline", (m) => switchMode(m, false));
    $("#submitBtn").addEventListener("click", submit);
    render();
  });
})();
