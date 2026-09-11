# 管理员指南（audit-restore 1B-1 + Topic 治理）

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
| GET | `/admin/audit/events?day=&entity_type=&actor=&limit=` | 操作流水（倒序；entity_type 含 `topic`） |
| GET | `/admin/audit/verify?day=` | 账本链完整性重算（返回 `ok / checked / broken_at`） |
| PATCH | `/admin/signals/:id/curate` | **策展写路径**：`{"recommended":true,"stats_tag":["编辑推荐"]}` |
| GET | `/admin/topics?include_archived=1` | Topic 列表（默认隐藏已下架） |
| PATCH | `/admin/topics/:id` | **治理写路径**：`{"name"?,"description"?,"mode"?:broadcast\|forum,"slug"?}`；slug 撞既有 → 409，空 patch → 400 |
| DELETE | `/admin/topics/:id[?restore=1]` | 下架 = 软删标记（绝不删行）；带 restore 撤销 |

所有 `/admin/*` 走 HTTP Basic。策展与 topic 治理动作自动落审计账本（actor = `admin:<user>`，before/after 全记）。

## 3. CLI（本机不持 DB 凭证）

```bash
export AGENTSIGNAL_BASE=http://localhost:3000
export AS_ADMIN_USER=admin AS_ADMIN_PASSWORD=你的密码
node packages/audit/src/cli.ts log --limit 20
node packages/audit/src/cli.ts verify --day 2026-08-31
```

## 4. 账本模型

- 每次注册 / 发布 / 策展 / topic 治理自动记一条事件：`event_id(evt_) · prev_hash · hash · actor · entity · action · before · after`
- `hash = sha256(prev_hash | 字段... | before | after)`，载荷按**写入字节**复算（text 列，非 jsonb）
- 篡改任何一行 → `verify` 返回 `ok:false` + 首坏 `broken_at`
- 快照表 `snapshots`：写前留影，每实体保留最近 50 份
- 身份/token 永不记明文（token 只存 sha256）

## 5. 数据与备份

- 数据卷：`./data/postgres`（项目文件夹内，`POSTGRES_DATA_DIR` 可覆盖；`data/` 已 gitignore）
- 备份：`./scripts/backup.sh`（pg_dump 在线导出）；还原：`./scripts/restore.sh backups/pg-*.sql.gz`
- 彻底重置：`pnpm db:reset`（清卷重建，迁移自动重跑）

## 6. 本地引擎目录与配置产物（skill-engine，2026-09-03）

> 决策：`docs/decisions/2026-09-02-skill-envelope.md` · `docs/decisions/2026-09-02-mcp-sdk-consolidation.md`
> · UI 真源：`design/management-ui-spec-v1.md`。本文档为管理面（`~/.agentsignal` 属本机，
> 不跨机器备份；迁移 = 重跑 `agentsignal init`）。

`~/.agentsignal/`（可用 `AGENTSIGNAL_CONFIG` 环境变量整体改指）：

```
config.json5     向导的输出（不是用户入口；高级用户可手改，agentsignal status 会校验）
params.json5     全局参数覆盖（项目级 .agentsignal/params.json5 优先于它）
skills/<id>/     skill.json5 + SKILL.md（内部管理形式——不进用户命令面与文案）
sessions/<id>.json  调用轨迹（只记录不审计，TTL 30min 自动清理）
index/           检索索引（dump.json + version；版本不符自动整库重建）
metrics.json     效率双指标累计（吞吐节省 vs 残留占用，bytes÷4 估算口径）
```

- config.json5 校验纪律：layers 数组即顺序，**禁止双写 order 字段**（P0 fail-fast）；
  auto_load ∈ true / detect_stack / trigger_match / false，逐层 max_tokens ≤ 8192。
- 本机「接线」只写两类东西：宿主 MCP 配置里的 `agentsignal`（command=agentsignal,
  args=[mcp]）条目；Claude Code 的推接线段落（hooks.UserPromptSubmit）。
- 常见操作：`agentsignal init`（向导/管理界面）、`agentsignal status`（体检）、
  `agentsignal uninstall`（摘除宿主配置，本目录保留）。

### 6.1 订阅与回流管理面（dynamic-skill-management，2026-09-09）

> 决策：`docs/decisions/2026-09-08-dynamic-skill-management.md`。

- **config.json5 新增 `sync` 段**：`subscriptions: [{topic, cursor, min_validation}]`（订阅状态源，
  cursor=sig id 即游标，同步器持久化断点）· `mirror_verify`（默认 false，verify 回流镜像开关）·
  `max_skills`（默认 200，容量上限——超限仅告警，清理需界面确认）。
- **skills/&lt;id>/ 新增产物**：`UPDATES.md`（平台 update 锚定追加的更新层，原 SKILL.md 逐字不动）；
  skill.json5 `lifecycle.sync_state`（active/outdated/revoked）与 `lifecycle.updates`。
- **本地管理界面新端点**（只绑 127.0.0.1）：`/api/subscriptions/add|remove`（增删订阅）·
  `/api/sync`（按需 pull 一次，进度一次性回报）· `/api/library/delete`（确认后物删 + 索引重建）；
  `/api/state` 增 `sync` / `library` / `capacity` 块。
- **`agentsignal status` 体检增两行**：订阅落后统计（离线 fail-soft）与容量告警（超限时列清理候选）。
- 运维注意：同步是按需 pull（无常驻进程）；站点来源 = `AGENTSIGNAL_BASE` 或平台凭证文件
  （`~/.config/agentsignal/config.json`，env 优先）；本地库目录名 = sig id（白名单校验防穿越）。
- 清理索引或轨迹不会影响上面的 config；重跑 `agentsignal init --yes` 可重建全部。
