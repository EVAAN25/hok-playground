#!/bin/bash
# 无头 Chrome 冒烟：逐页截图 + 控制台错误捕获 + 每日题 DOM 二次加载一致性
# 用法：bash smoke.sh  （需先无 server 时自动起 python3 http.server 8787）
set -u
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT=8787
BASE="http://127.0.0.1:$PORT"
PAGES="index classic quotes skins duel timeline"
mkdir -p shots

# 起本地 server（已在跑就复用）
STARTED=0
if ! curl -s -o /dev/null "$BASE/index.html"; then
  python3 -m http.server $PORT >/dev/null 2>&1 &
  SRV=$!
  STARTED=1
  sleep 1
fi

FAIL=0
for p in $PAGES; do
  "$CHROME" --headless=new --disable-gpu --window-size=1280,1500 \
    --virtual-time-budget=10000 --enable-logging=stderr \
    --screenshot="shots/${p}.png" "$BASE/${p}.html" 2>"shots/${p}.log" >/dev/null
  # 控制台 JS 错误
  if grep -qE "Uncaught|CONSOLE.*[Ee]rror|Failed to load resource" "shots/${p}.log"; then
    echo "✗ ${p}：控制台有错误"
    grep -E "Uncaught|CONSOLE.*[Ee]rror|Failed to load resource" "shots/${p}.log" | head -5
    FAIL=1
  else
    echo "✓ ${p}：无 JS 错误，截图 shots/${p}.png"
  fi
  # 每日题确定性：两次加载 DOM 一致
  "$CHROME" --headless=new --disable-gpu --virtual-time-budget=10000 --dump-dom "$BASE/${p}.html" 2>/dev/null >"shots/${p}.dom1.html"
  "$CHROME" --headless=new --disable-gpu --virtual-time-budget=10000 --dump-dom "$BASE/${p}.html" 2>/dev/null >"shots/${p}.dom2.html"
  if diff -q "shots/${p}.dom1.html" "shots/${p}.dom2.html" >/dev/null; then
    echo "✓ ${p}：同日两次加载 DOM 一致"
  else
    echo "✗ ${p}：两次加载 DOM 不一致"
    diff "shots/${p}.dom1.html" "shots/${p}.dom2.html" | head -10
    FAIL=1
  fi
  # 核心元素渲染检查
  case ${p} in
    index)    SEL='class="home-card"' ;;
    classic)  SEL='id="guessInput"' ;;
    quotes)   SEL='id="quoteText"' ;;
    skins)    SEL='id="poster"' ;;
    duel)     SEL='id="btnHigher"' ;;
    timeline) SEL='class="tl-card' ;;
  esac
  if grep -q "${SEL}" "shots/${p}.dom1.html"; then
    echo "✓ ${p}：核心元素已渲染（${SEL}）"
  else
    echo "✗ ${p}：核心元素未渲染（${SEL}）"
    FAIL=1
  fi
done

rm -f shots/*.dom1.html shots/*.dom2.html
[ $STARTED -eq 1 ] && kill $SRV 2>/dev/null
echo "---"
[ $FAIL -eq 0 ] && echo "冒烟全部通过" || echo "冒烟存在失败项"
exit $FAIL
