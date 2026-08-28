#!/usr/bin/env bash
# AgentSignal —— 数据还原
#
# ⚠️ 危险操作：会覆盖现有数据。执行前必须先跑 scripts/backup.sh 留一份当前快照。
# 用法：
#   ./scripts/restore.sh backups/pglite-20260828T120000Z.tar.gz
#   ./scripts/restore.sh backups/pg-20260828T120000Z.sql.gz
set -euo pipefail

SRC="${1:?用法: $0 <backup-file>}"
[ -f "$SRC" ] || { echo "[restore] 文件不存在: $SRC"; exit 1; }
COMPOSE="${COMPOSE_CMD:-docker compose}"

case "$SRC" in
  *.sql.gz) MODE=pg ;;
  *.tar.gz) MODE=pglite ;;
  *) echo "[restore] 无法识别的文件类型: $SRC"; exit 1 ;;
esac

read -r -p "[restore] 将用 $SRC 覆盖当前 ${MODE} 数据，且需停止 API。确认？输入 YES 继续: " CONFIRM
[ "$CONFIRM" = "YES" ] || { echo "[restore] 已取消"; exit 1; }

echo "[restore] 停止 API"
$COMPOSE stop api

if [ "$MODE" = "pglite" ]; then
  CID="$($COMPOSE run -d --no-deps --entrypoint sh api -c 'sleep 60')"
  # 清空目标目录后再解包，避免残留文件与新数据混在一起
  $COMPOSE exec -T "$CID" sh -c 'rm -rf "${DATA_DIR:-/app/data}"/*'
  docker cp "$SRC" "$CID":/tmp/restore.tar.gz
  $COMPOSE exec -T "$CID" sh -c 'mkdir -p "${DATA_DIR:-/app/data}" && tar xzf /tmp/restore.tar.gz -C "${DATA_DIR:-/app/data}" && rm -f /tmp/restore.tar.gz'
  docker rm -f "$CID" >/dev/null
else
  echo "[restore] 重建 schema"
  $COMPOSE exec -T db sh -c "dropdb -U \${POSTGRES_USER:-agentsignal} --if-exists \${POSTGRES_DB:-agentsignal} && createdb -U \${POSTGRES_USER:-agentsignal} \${POSTGRES_DB:-agentsignal}"
  gunzip -c "$SRC" | $COMPOSE exec -T db psql -U "${POSTGRES_USER:-agentsignal}" -d "${POSTGRES_DB:-agentsignal}"
fi

echo "[restore] 启动 API"
$COMPOSE start api

echo "[restore] 等待就绪"
for _ in $(seq 1 30); do
  sleep 1
  if curl -fsS "http://localhost:${API_PORT:-3000}/readyz" >/dev/null 2>&1; then
    echo "[restore] readyz OK"
    break
  fi
done

echo "[restore] 完成。请人工验证：curl -fsS http://localhost:${API_PORT:-3000}/healthz"
