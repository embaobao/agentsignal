#!/usr/bin/env bash
# AgentSignal —— 服务器部署脚本（在服务器上运行；只需 docker + git + curl）
#
# 用法：
#   ./scripts/deploy.sh init        首次上线：目录/仓库/.env/登录 ghcr/起全栈（db+api+caddy）
#   ./scripts/deploy.sh <tag>       部署指定版本（如 0.2.0 或 v0.2.0，镜像 tag 取归一后的版本号）
#   ./scripts/deploy.sh rollback    回滚到上一个成功版本
#
# 前置：compose --profile prod（api + db + caddy 自动 HTTPS）；镜像来自 ghcr（release.yml 产物）。
set -euo pipefail

SERVER_DIR="${AGENTSIGNAL_DIR:-/srv/agentsignal}"
COMPOSE_CMD="${COMPOSE_CMD:-docker compose}"
CURRENT="$SERVER_DIR/.deploy-current"
PREVIOUS="$SERVER_DIR/.deploy-previous"

norm_tag() { case "$1" in v*) echo "${1#v}" ;; *) echo "$1" ;; esac; }

load_env() {
  # 读 CADDY_DOMAIN 等部署参数（不覆盖已导出变量）
  set -a; . "$SERVER_DIR/.env"; set +a
}

wait_healthy() {
  for _ in $(seq 1 60); do
    if $COMPOSE_CMD ps api 2>/dev/null | grep -q healthy; then return 0; fi
    sleep 2
  done
  echo "[deploy] api 120s 内未 healthy：docker compose logs api 排查"; return 1
}

cmd_init() {
  docker info >/dev/null 2>&1 || { echo "[init] docker 未运行"; exit 1; }
  if [ -d "$SERVER_DIR/.git" ]; then
    git -C "$SERVER_DIR" pull --ff-only
  else
    read -r -p "[init] 仓库地址（回车默认 https://github.com/embaobao/agentsignal.git）: " REPO
    git clone "${REPO:-https://github.com/embaobao/agentsignal.git}" "$SERVER_DIR"
  fi
  cd "$SERVER_DIR"
  if [ ! -f .env ]; then
    cp .env.example .env
    echo "[init] 已生成 .env —— 上线前必须确认：POSTGRES_PASSWORD / CADDY_DOMAIN / ACME_EMAIL / IMAGE_TAG / DATABASE_URL"
  fi
  echo "[init] 登录 ghcr（输入具备 read:packages 权限的 PAT）"
  docker login ghcr.io
  $COMPOSE_CMD up -d db --wait
  $COMPOSE_CMD --profile prod up -d --remove-orphans
  wait_healthy
  load_env
  bash scripts/smoke.sh "https://${CADDY_DOMAIN:-localhost}"
  echo "[init] 完成。后续升级：./scripts/deploy.sh <tag>"
}

cmd_deploy() {
  local tag
  tag=$(norm_tag "${1:?用法: $0 <tag>}")
  [ -f .env ] || { echo "[deploy] 缺少 .env —— 先跑 $0 init"; exit 1; }
  git pull --ff-only
  [ -f "$CURRENT" ] && cp "$CURRENT" "$PREVIOUS"
  export IMAGE_TAG="$tag"
  $COMPOSE_CMD --profile prod pull api
  $COMPOSE_CMD --profile prod up -d --remove-orphans
  wait_healthy
  load_env
  bash scripts/smoke.sh "https://${CADDY_DOMAIN:-localhost}"
  echo "$tag" > "$CURRENT"
  echo "[deploy] $tag 上线完成；出问题回滚：$0 rollback"
}

cmd_rollback() {
  [ -f "$PREVIOUS" ] || { echo "[rollback] 无 .deploy-previous 记录可回滚"; exit 1; }
  echo "[rollback] 回滚到 $(cat "$PREVIOUS")"
  "$0" "$(cat "$PREVIOUS")"
}

cd "$SERVER_DIR" 2>/dev/null || true
case "${1:-}" in
  init)     cmd_init ;;
  rollback) cmd_rollback ;;
  "")       echo "用法: $0 init | <tag> | rollback"; exit 1 ;;
  *)        cmd_deploy "$1" ;;
esac
