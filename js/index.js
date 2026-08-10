/* 枢纽页：今日完成状态 dot */
(function () {
  "use strict";
  const { $, dkey, loadJSON } = window.HOKUI;

  function done(game) {
    const s = loadJSON(dkey(game), null);
    return !!(s && s.status && s.status !== "playing");
  }
  // 台词页文字/语音任一子模式完成即点亮
  function quotesDone() { return done("quotes_text") || done("quotes_audio"); }

  const map = {
    classic: done("classic"),
    quotes: quotesDone(),
    skins: done("skins"),
    duel: done("duel"),
    timeline: done("timeline"),
  };
  for (const g of Object.keys(map)) {
    const el = $("#dot-" + g);
    if (el && map[g]) el.classList.add("done");
  }
})();
