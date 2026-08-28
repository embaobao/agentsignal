#!/usr/bin/env bash
# AgentSignal —— 数据备份
#
# PGlite 是目录型数据（WASM VFS），**禁止 cp/tar 活库**（写入中途会拿到不一致快照）。
# 做法：先停 API（停止写入）→ 打包数据目录 → 立刻起 API。停机窗口通常 <2s。
#
# 用法：
#   ./scripts/backup.sh              # 备份到 $BACKUP_DIR（默认 ./backups）
#   ./scripts/backup.sh /path/to/dir # 指定目录（建议独立盘/异地）
set -euo pipefail

BACKUP_DIR="${1:-${BACKUP_DIR:-./backups}}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
COMPOSE="${COMPOSE_CMD:-docker compose}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"

DRIVER="${DB_DRIVER:-pglite}"
echo "[backup] driver=$DRIVER"

# 记录当前镜像 tag —— 回滚时用它对应数据结构版本
$COMPOSE config --images 2>/dev/null | grep api >"$BACKUP_DIR/images-$STAMP.txt" || true

if [ "$DRIVER" = "pg" ]; then
  OUT="$BACKUP_DIR/pg-$STAMP.sql.gz"
  echo "[backup] postgres → $OUT"
  $COMPOSE exec -T db pg_dump -U "${POSTGRES_USER:-agentsignal}" "${POSTGRES_DB:-agentsignal}" | gzip >"$OUT"
else
  OUT="$BACKUP_DIR/pglite-$STAMP.tar.gz"
  echo "[backup] 停止 API（停止写入，保证快照一致）"
  $COMPOSE stop api
  echo "[backup] pglite → $OUT"
  $COMPOSE run --rm --no-deps --entrypoint sh api -c \
    'cd "${DATA_DIR:-/app/data}" && tar czf - .' >"$OUT"
  echo "[backup] 启动 API"
  $COMPOSE start api
fi

echo "[backup] prune older than ${RETENTION_DAYS}d"
find "$BACKUP_DIR" -type f \( -name 'pglite-*.tar.gz' -o -name 'pg-*.sql.gz' \) -mtime "+${RETENTION_DAYS}" -print -delete || true

echo "[backup] done"
ls -lh "$BACKUP_DIR" | tail -n 5
