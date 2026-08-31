#!/usr/bin/env bash
# AgentSignal —— 数据备份（标准 Postgres，pg_dump 逻辑备份）
#
# pg_dump 走单连接一致性快照（MVCC），**无需停 API**，在线备份即可。
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

echo "[backup] postgres (compose 服务 db)"

# 记录当前镜像 tag —— 回滚时用它对应数据结构版本
$COMPOSE config --images 2>/dev/null | grep api >"$BACKUP_DIR/images-$STAMP.txt" || true

OUT="$BACKUP_DIR/pg-$STAMP.sql.gz"
echo "[backup] pg_dump → $OUT"
$COMPOSE exec -T db pg_dump -U "${POSTGRES_USER:-agentsignal}" "${POSTGRES_DB:-agentsignal}" | gzip >"$OUT"

echo "[backup] prune older than ${RETENTION_DAYS}d"
find "$BACKUP_DIR" -type f -name 'pg-*.sql.gz' -mtime "+${RETENTION_DAYS}" -print -delete || true

echo "[backup] done"
ls -lh "$BACKUP_DIR" | tail -n 5
