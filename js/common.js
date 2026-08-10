/* 王者荣耀游乐场 —— UI 共用层（依赖 js/core.js 的 window.HOK） */
(function () {
  "use strict";
  const HOK = window.HOK;

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  // ---------- 本地存储（hok_ 前缀；file:// 下也尽量可用，失败降级为内存） ----------
  const store = (() => {
    try { localStorage.setItem("hok.__t", "1"); localStorage.removeItem("hok.__t"); }
    catch (e) { const m = {}; return { get: (k) => m[k], set: (k, v) => { m[k] = v; } }; }
    return {
      get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
      set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
    };
  })();
  function loadJSON(k, fallback) {
    try { const v = JSON.parse(store.get(k)); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  }
  const TODAY = HOK.dateStr();
  const dkey = (game) => `hok_${game}_${TODAY}`;

  // ---------- 头像（缺失时换成首字圆形色块） ----------
  const AV_COLORS = ["#1f2a44", "#a37f27", "#4c8a52", "#7d5ba6", "#4a6a9e", "#8f5135"];
  window.__hokAv = function (img) {
    const name = img.dataset.name || "?";
    const h = HOK.hash32(img.dataset.id || name);
    const div = document.createElement("div");
    div.className = img.className.replace(/\bavatar\b/, "avatar-fallback");
    div.style.background = AV_COLORS[h % AV_COLORS.length];
    div.textContent = name[0];
    img.replaceWith(div);
  };
  function avatarHTML(hero, extraCls) {
    return `<img class="avatar ${extraCls || ""}" loading="lazy" src="assets/avatars/${hero.id}.jpg"
      alt="${hero.name}" data-id="${hero.id}" data-name="${hero.name}" onerror="window.__hokAv(this)">`;
  }

  // ---------- 复制与提示 ----------
  let toastTimer = null;
  function toast(msg) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 2200);
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); } catch (e) { toast("复制失败，请手动复制"); }
    document.body.removeChild(ta);
  }
  function copyText(text) {
    const done = () => toast("分享卡已复制，去粘贴吧");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    } else fallbackCopy(text, done);
  }

  // 输入框错误抖动（≤300ms）
  function shakeInput(input) {
    if (!input) return;
    input.classList.add("shake");
    setTimeout(() => input.classList.remove("shake"), 320);
  }

  // ---------- 数据加载（带 loading 态；大 JSON 进对应页才 fetch） ----------
  const _dataCache = {};
  function loadData(url) {
    if (_dataCache[url]) return _dataCache[url];
    _dataCache[url] = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`加载失败：${url}（HTTP ${r.status}）`);
      return r.json();
    }, () => { throw new Error(`加载失败：${url}（网络错误）`); });
    return _dataCache[url];
  }
  // el 显示 loading，完成后替换为内容或错误
  function withLoading(el, url, onOk) {
    if (el) el.innerHTML = `<div class="loading"><span class="spinner"></span>数据加载中…</div>`;
    loadData(url).then((data) => {
      if (el) el.innerHTML = "";
      onOk(data);
    }).catch((err) => {
      if (el) el.innerHTML = `<div class="loading error">⚠ ${err.message}，请刷新重试</div>`;
    });
  }

  // ---------- 自动补全（中文/拼音模糊匹配） ----------
  /*
   * attachAutocomplete({input, list, heroes, getExclude, onPick, placeholderOf})
   * heroes: 候选英雄数组；getExclude(): 已猜 id 数组；onPick(hero): 选中回调
   */
  function attachAutocomplete(opts) {
    const { input, list, heroes, onPick } = opts;
    const getExclude = opts.getExclude || (() => []);
    let items = [], active = -1;

    function close() { list.classList.add("hidden"); items = []; active = -1; }
    function open() {
      const q = input.value.trim();
      items = HOK.searchHeroes(heroes, q, getExclude(), 8);
      active = items.length ? 0 : -1;
      if (!items.length) { close(); return; }
      list.innerHTML = items.map((h, i) => `
        <li data-i="${i}" class="${i === active ? "active" : ""}">
          ${avatarHTML(h)}
          <span class="s-name">${h.name}</span>
          <span class="s-meta">${h.title || ""} · ${(h.types || []).join("/")}</span>
        </li>`).join("");
      list.classList.remove("hidden");
      list.querySelectorAll("li").forEach((li) => {
        li.addEventListener("mousedown", (e) => { e.preventDefault(); pick(Number(li.dataset.i)); });
      });
    }
    function pick(i) {
      if (i < 0 || i >= items.length) return;
      const h = items[i];
      input.value = "";
      close();
      onPick(h);
    }
    input.addEventListener("input", open);
    input.addEventListener("focus", open);
    input.addEventListener("blur", () => setTimeout(close, 120));
    input.addEventListener("keydown", (e) => {
      if (e.isComposing || e.keyCode === 229) return; // 中文输入法组词中，Enter/Esc 归输入法
      if (list.classList.contains("hidden")) {
        if (e.key === "Enter") { // 无候选直接精确匹配一次
          const exact = HOK.searchHeroes(heroes, input.value.trim(), getExclude(), 1);
          if (exact.length && HOK.normalize(exact[0].name) === HOK.normalize(input.value.trim())) onPick(exact[0]);
          else if (input.value.trim()) { toast("没认出这位英雄，换个写法试试"); shakeInput(input); }
          input.value = "";
        }
        return;
      }
      if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(active + 1, items.length - 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(active - 1, 0); }
      else if (e.key === "Enter") { e.preventDefault(); pick(active); return; }
      else if (e.key === "Escape") { close(); return; }
      else return;
      list.querySelectorAll("li").forEach((li, i) => li.classList.toggle("active", i === active));
    });
    return { close };
  }

  // ---------- 模式 tab（每日 / 无限） ----------
  function syncModeTabs(game, mode) {
    $$(`.mode-tabs[data-game="${game}"] .mode-tab`).forEach((b) => {
      b.classList.toggle("active", b.dataset.mode === mode);
    });
  }
  function bindModeTabs(game, onSwitch) {
    $$(`.mode-tabs[data-game="${game}"] .mode-tab`).forEach((b) => {
      b.addEventListener("click", () => onSwitch(b.dataset.mode));
    });
  }

  function dailyBanner(text) {
    return `今日题目 <b>#${TODAY}</b> · ${text || "全站同题 · 进度自动保存"}`;
  }

  window.HOKUI = {
    $, $$, store, loadJSON, TODAY, dkey,
    avatarHTML, toast, copyText, shakeInput,
    loadData, withLoading,
    attachAutocomplete, syncModeTabs, bindModeTabs, dailyBanner,
  };
})();
