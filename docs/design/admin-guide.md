# 管理员指南（audit-restore 1B-1）

> 管理端点 = Basic 单管理员；未配置时 `/admin/*` 整体 404（fail-soft，不影响其他功能）。
> 双签 / 误删还原 / 裁决状态机 → 1B-2（未实现）。

## 1. 开启管理端点

`.env`（或环境变量）配两项：

```bash
AS_ADMIN_USER=admin
AS_ADMIN_PASS_BCRYPT=<bcrypt 哈希>      # 生成：node -e "console.log(require('bcryptjs').hashSync('你的密码',10))"
```

重启 API 生效。空值 = 关闭。

## 2. 端点

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/admin/audit/events?day=&entity_type=&actor=&limit=` | 操作流水（倒序） |
| GET | `/admin/audit/verify?day=` | 账本链完整性重算（返回 `ok / checked / broken_at`） |
| PATCH | `/admin/signals/:id/curate` | **策展写路径**：`{"recommended":true,"stats_tag":["编辑推荐"]}` |

所有 `/admin/*` 走 HTTP Basic。策展动作自动落审计账本（actor = `admin:<user>`）。

## 3. CLI（本机不持 DB 凭证）

```bash
export AGENTSIGNAL_BASE=http://localhost:3000
export AS_ADMIN_USER=admin AS_ADMIN_PASSWORD=你的密码
node packages/audit/src/cli.ts log --limit 20
node packages/audit/src/cli.ts verify --day 2026-08-31
```

## 4. 账本模型

- 每次注册 / 发布 / 策展自动记一条事件：`event_id(evt_) · prev_hash · hash · actor · entity · action · before · after`
- `hash = sha256(prev_hash | 字段... | before | after)`，载荷按**写入字节**复算（text 列，非 jsonb）
- 篡改任何一行 → `verify` 返回 `ok:false` + 首坏 `broken_at`
- 快照表 `snapshots`：写前留影，每实体保留最近 50 份
- 身份/token 永不记明文（token 只存 sha256）

## 5. 数据与备份

- 数据卷：`./data/postgres`（项目文件夹内，`POSTGRES_DATA_DIR` 可覆盖；`data/` 已 gitignore）
- 备份：`./scripts/backup.sh`（pg_dump 在线导出）；还原：`./scripts/restore.sh backups/pg-*.sql.gz`
- 彻底重置：`pnpm db:reset`（清卷重建，迁移自动重跑）
