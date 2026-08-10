#!/usr/bin/env bash
# 部署王者荣耀游乐场到 182（http://182.254.155.14/hok/ 与 http://komozyw.com/hok/）
# 用法：bash tools/deploy_182.sh
# 前置（2026-08-10 已配好，一次性的）：
#   - 182 /var/www/hok/ 属主 ubuntu
#   - nginx sites-enabled/zgy-demo 已加 location /hok/ → /var/www/hok/
# 同步口径：GitHub 仓库 = 全量（含 tools/）；.io = Pages 自动；182 = 本脚本（排除开发件）
set -euo pipefail
cd "$(dirname "$0")/.."
KEY="$HOME/Documents/tasks_cc/服务器密钥/wzy.pem"
HOST="ubuntu@182.254.155.14"
rsync -az --delete -e "ssh -i $KEY" \
  --exclude=.git --exclude=.gitignore --exclude=raw --exclude=shots --exclude=tools \
  --exclude=test.js --exclude=smoke.sh --exclude=task.md --exclude=site_spec.md \
  --exclude=README.md --exclude=接手说明_下次继续.md \
  ./ "$HOST:/var/www/hok/"
curl -sf -o /dev/null -w "182 /hok/ 自检 HTTP %{http_code}\n" "http://182.254.155.14/hok/"
curl -sf -o /dev/null -w "182 /hok/ 头像自检 HTTP %{http_code}\n" "http://182.254.155.14/hok/assets/avatars/105.jpg"
curl -sf -o /dev/null -w "182 /hok/ 数据自检 HTTP %{http_code}\n" "http://182.254.155.14/hok/data/heroes.json"
echo "部署完成：http://182.254.155.14/hok/  https://komozyw.com/hok/"
