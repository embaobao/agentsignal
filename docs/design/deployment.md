# 容器化部署与运维手册

> 状态：**实施蓝本** · 2026-08-28 v1 · 配套 [瘦栈实施方案](lean-stack-implementation-plan.md) · 决议 [2026-08-28-container-deployment](../decisions/2026-08-28-container-deployment.md)
> 上位约束：`AGENTS.md`（Node ≥22.18 + pnpm 标准化，见 [standardize-node-postgres 决议](../decisions/2026-08-28-standardize-node-postgres.md)）· [architecture.md](architecture.md)（工程框架/冻结 DDL）· [backend-architecture.md](backend-architecture.md)
> 工程文件（仓根）：`Dockerfile` · `docker-compose.yml` · `docker-compose.dev.yml` · `docker-compose.test.yml` · `Caddyfile` · `.env.example` · `.dockerignore` · `scripts/backup.sh` · `scripts/restore.sh`

---

## 1. 部署拓扑与服务划分

```text
                        ┌──────────────────────────────────────┐
   Internet  :80/:443 ─▶│  caddy (profile=prod)                │ 自动 HTTPS · 反代 · 安全头
                        └───────────────┬──────────────────────┘
                                        │ api:3000（容器网络内）
                        ┌───────────────▼──────────────────────┐
                        │  api  Fastify + Node ≥22.18          │
                        │   · REST v0.2 + /skills 总入口         │
                        │   · @fastify/static 同域托管 apps/ui   │
                        │   · node-postgres → PostgreSQL       │
                        │   · pino JSON → stdout               │
                        └───────┬───────────────────┬──────────┘
                                │                   │
                    ┌───────────▼────────┐   ┌──────▼──────────┐
                    │ 卷 agentsignal-data│   │ db (profile=pg) │ Phase 2 才启用
                    │ —（数据在 PG 卷）   │   │ postgres:16     │ SQL 同方言
                    └────────────────────┘   └─────────────────┘
```

| 服务 | 镜像 | Profile | 职责 | 何时启动 |
|---|---|---|---|---|
| `api` | 自建 `agentsignal-api:<tag>`（基 `node:24-slim`） | 默认 | REST API + 同域静态 UI + 健康检查 | 总是 |
| `db` | `postgres:16-alpine` | 默认 | 主数据库（标准 Postgres） | 总是 |
| `caddy` | `caddy:2-alpine` | `prod` | 自动 HTTPS + 反代 + 访问日志 | 生产 |
| `ui`（dev） | `node:24-slim` | `dev` | Vite dev server（HMR） | 仅开发 |
| `e2e`（test） | 同 api 构建 | 测试覆盖文件 | 一次性跑完即退 | 仅测试 |

**设计取舍**：

- **单进程单服务**：P3/P5 只有 `api` 一个常驻服务。前端是静态产物，由 `@fastify/static` 同域托管——省掉一个 Nginx/前端服务、省掉跨域与双域名。
- **标准 Postgres**：node-postgres 驱动 + `Db` 接口直写 PG SQL（见 [standardize-node-postgres 决议](../decisions/2026-08-28-standardize-node-postgres.md)，取代 storage-pglite）；compose 的 `db` 服务（postgres:16-alpine）为默认依赖，本地开发 `docker compose up -d db`。
- **不用 K8s / 微服务 / 消息队列**：与 AGENTS.md 排除项一致。

### 1.1 镜像依赖

| 层 | 内容 | 备注 |
|---|---|---|
| 基础运行时 | `node:24-slim`（Debian slim + glibc） | pnpm 经 corepack 启用（packageManager 字段锁版本） |
| Stage 1 `deps` | + 全量依赖（pg 驱动纯 JS，无原生模块、无编译工具链） | 与 dev/test 共享 |
| Stage 2 `build` | + 源码 + `pnpm run check`（tsc 门禁）+ UI 产物 | 编译失败即构建失败 |
| Stage 3 `runtime` | + `ca-certificates` + **仅生产依赖** + 源码 + UI dist | 最终产物（pg 纯 JS，无需编译工具链） |
| 非 root | 固定 uid/gid `10001`（`app:app`） | 不依赖基础镜像自带用户 |
| 体积预估 | ~250 MB（node slim ~75 MB + node_modules ~150 MB + 源码 ~1 MB） | `docker images` 实测为准 |

**Dockerfile 三条硬约束**（改动前必读，已写在文件头注释）：

1. **运行时不做 bundle**：`apps/api/src/server.ts` 用 `import.meta.url` 读 `packages/skills/participant/SKILL.md` 与 `apps/api/src/ui.html`，打包成单文件会让这两个路径失效。要改打包，先做任务 **C7（静态资源路径可配置化）**。
2. **`packages/*` 源码必须进镜像**：`@agentsignal/protocol` 是 workspace 依赖，Node type-stripping 直跑时实时解析。
3. **`COPY --parents` 需 BuildKit ≥1.7 / Docker ≥25**，好处是新增 workspace 包无需改 Dockerfile。

### 1.2 端口映射

| 服务 | 容器端口 | dev（宿主） | test（宿主） | prod（宿主） | 说明 |
|---|---|---|---|---|---|
| `api` | 3000 | `${API_PORT:-3000}` | 不映射 | **不映射** | 生产只经 caddy 暴露；调试用 `docker compose exec` |
| `ui` (dev) | 5173 | `${UI_PORT:-5173}` | — | — | Vite HMR |
| `db` | 5432 | 可选 `5432` | 不映射 | 不映射 | compose 内网；本地 CLI 连库时映射 |
| `caddy` | 80 / 443 / 443udp | — | — | `80` `443` `443/udp` | udp 为 HTTP/3 |

### 1.3 数据卷挂载

| 卷 | 挂载点 | 类型 | 内容 | 备份 |
|---|---|---|---|---|
| `pg-data` | `/var/lib/postgresql/data` | 命名卷 | PostgreSQL 数据目录 | `./scripts/backup.sh`（pg_dump，在线不停机） |
| `caddy-data` / `caddy-config` | `/data` `/config` | 命名卷 | ACME 证书与配置 | 证书可重签，建议留 |
| 源码（dev） | `./apps/api/src` `./packages` | bind mount | 热重载 | — |
| `/tmp`（test） | tmpfs 256m | tmpfs | 测试库，销毁即清 | — |

> **禁止**：把数据卷放在 NFS/SMB/FUSE 网络盘上——文件系统锁在网盘上不可靠，会静默损坏。

### 1.4 启动顺序与依赖

```text
1. db（healthcheck: pg_isready）                       ← 默认服务
2. api（depends_on: db condition=service_healthy）
   └─ 启动时：env 校验(zod) → 迁移 up（幂等 SQL）→ 连接就绪 → /readyz 变绿 → 监听 3000
3. caddy（depends_on: api condition=service_healthy）
4. e2e（测试覆盖，depends_on: api condition=service_healthy，跑完退出）
```

db 是默认服务（标准 Postgres，见 [standardize-node-postgres 决议](../decisions/2026-08-28-standardize-node-postgres.md)），api 强依赖其健康才启动。

**应用内启动序列**（`apps/api/src/index.ts`，任务 C1 交付）：

```
loadEnv(zod) → buildApp() → await migrateToLatest() → store.ready()
   → registerRoutes → app.listen({ port, host }) → 就绪（/readyz 200）
```

任一步失败 → 非零退出（**不要吞异常启动**），由 `restart: unless-stopped` + 告警接住。

---

## 2. 三环境操作手册

> 前置：`cp .env.example .env` 并按环境改；Docker ≥25（BuildKit）；`docker compose version` ≥ v2.24。

### 2.1 开发（dev）

**宿主原生开发（日常推荐，最快路径）**：

```bash
pnpm bootstrap   # 首次一次到位：装依赖 + 生成 .env + 拉起 compose Postgres（--wait 等 healthy）
pnpm dev         # API :3000（predev 先做 DB 连通预检，失败给可执行提示）
pnpm dev:ui      # UI :5173
pnpm db:reset    # 重置本地库（清卷重建）
```

**容器化开发（调试部署形态时用）**：

```bash
# 构建 + 启动（API 热重载 + Vite dev server）
docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile dev up --build

# 仅起 API（不跑前端）
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build api

# 停（保留数据卷）
docker compose -f docker-compose.yml -f docker-compose.dev.yml down

# 重置开发数据（危险：清空 dev 卷）
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v
```

- API：`http://localhost:3000` · UI：`http://localhost:5173`
- `LOG_PRETTY=1` 人类可读；限频放宽到 1000/10000，避免自测误伤
- 源码改动即热重载（`node --watch`）；新增依赖需 `up --build`

### 2.2 测试（test）

```bash
# 一次性跑完整 e2e（数据落 tmpfs，跑完全清）
docker compose -f docker-compose.yml -f docker-compose.test.yml \
  up --build --abort-on-container-exit --exit-code-from e2e

# 退出码即测试结果：0=通过，非0=失败
docker compose -f docker-compose.yml -f docker-compose.test.yml down -v
```

- 单元测试在宿主跑更快：`pnpm test`（node:test：api 单测 + e2e 注入 + mcp）+ `pnpm run test:ui`（vitest）
- CI 顺序：`check → lint → test → test:ui → build 镜像 → test:e2e（真实服务 + PG service）`

### 2.3 生产（prod）

**发布走流水线（推荐）**：打 tag → CI 构建推送镜像 → 服务器脚本部署并冒烟：

```bash
# 本地：发布一个版本（详见 §发布与升级）
git tag v0.2.0 && git push origin v0.2.0      # 触发 release.yml：verify → ghcr → 镜像冒烟

# 服务器（首次先跑 scripts/deploy.sh init）
./scripts/deploy.sh 0.2.0                     # pull + up + 等 healthy + smoke；自动记录可回滚版本
./scripts/deploy.sh rollback                  # 一键回滚到上一版本
```

**手动运维（调试/兜底）**：

```bash
docker compose --profile prod pull            # 拉最新镜像
docker compose --profile prod up -d           # 起 db + api + caddy
docker compose ps                             # 关注 STATUS=healthy
pnpm smoke https://${CADDY_DOMAIN}            # 启动冒烟（或 bash scripts/smoke.sh，服务器无 node 可用）

# 停（保留卷）
docker compose --profile prod down
```

**发布前置检查清单**：

| # | 检查 | 命令 |
|---|---|---|
| 1 | `pnpm verify` 全绿 | check + lint + test + test:ui |
| 2 | 迁移已 review（可前滚、旧代码兼容） | 见 §6.4 |
| 3 | 备份已执行 | `./scripts/backup.sh` |
| 4 | 镜像 tag 非 latest | `docker compose config --images` |
| 5 | 密钥不在镜像内 | `docker run --rm <img> env \| grep -i secret`（应为空） |

### 2.4 日志查看

```bash
docker compose logs -f --tail=200 api          # 实时跟
docker compose logs --since 30m api            # 时间窗
docker compose logs --since 1h api 2>&1 | grep '"level":50'   # 只看 error（pino level 数值）
docker compose logs -f --tail=100 caddy        # 访问日志/证书签发

# 结构化日志用 jq 解析（LOG_PRETTY=0 时每行一个 JSON）
docker compose logs --no-log-prefix api | jq -c 'select(.reqId != null) | {t:.time,lvl:.level,msg:.msg,url:.url,status:.status,ms:.durationMs}'

# 宿主日志轮转由 compose logging 驱动控制：json-file max-size=10m × max-file=5（每个服务约 50MB 上限）
```

### 2.5 版本回滚

```bash
# ① 确认当前版本
docker compose config --images | grep api        # 或查 backups/images-<stamp>.txt

# ② 回滚代码（换 tag 重建容器；镜像本地无缓存则从 registry 拉）
export IMAGE_TAG=<上一个已知良好 tag>
docker compose --profile prod up -d api

# ③ 等待健康
docker compose ps api                            # STATUS 必须 healthy
curl -fsS https://${CADDY_DOMAIN}/readyz

# ④ 跑三链路冒烟（见 backend-architecture §十一）
bash tests/e2e/three-chains.test.sh https://${CADDY_DOMAIN}

# ⑤ 失败则连数据一起回滚（会丢失回滚点之后写入的数据）
./scripts/restore.sh backups/pg-<目标时间点>.sql.gz

# ⑥ 记录：原因/影响/修复 写 docs/notes/YYYY-MM-DD-rollback-<tag>.md
```

**回滚铁律**：

- 代码回滚**不等于**数据回滚。默认只回滚代码；只有出现数据损坏才动数据。
- 迁移必须遵守 **expand → migrate → contract 三阶段**（§6.4），保证「新 schema 能被旧代码跑」，这样代码随时可独立回滚。
- 已执行 contract（删列/改名）的发布**不可回滚代码**，只能前滚修复。因此 contract 必须单独一个发布、观察至少一个发布周期。

---

## 3. 环境变量全表

> 权威可复制版本见仓根 `.env.example`。下表补充语义与边界；**默认值即生产建议值**，dev/test 的放宽值在 compose 覆盖文件里。

### 3.1 镜像与构建

| 变量 | 默认值 | 说明 |
|---|---|---|
| `NODE_IMAGE` | `node:24-slim` | 基础镜像；pnpm 由 corepack 按 packageManager 字段启用 |
| `IMAGE_REGISTRY` | `ghcr.io/embaobao` | 镜像仓库（ghcr 包为 private，服务器需 docker login） |
| `IMAGE_TAG` | `0.1.0` | **生产必须不可变 tag**（git sha 或语义版本），禁 `latest` |

### 3.2 API 运行时

| 变量 | 默认值 | 说明 |
|---|---|---|
| `NODE_ENV` | `production` | compose 内固定，不从 .env 读 |
| `PORT` | `3000` | 容器内监听端口 |
| `HOST` | `0.0.0.0` | 必须为 `0.0.0.0`，容器内网才可访问 |
| `LOG_LEVEL` | `info` | `trace\|debug\|info\|warn\|error\|fatal`；生产 `info`，排障临时 `debug` |
| `LOG_PRETTY` | `0` | `1`=pino-pretty（仅 dev）；生产必须 `0`（结构化 JSON 便于采集） |
| `BODY_LIMIT_BYTES` | `65536` | 请求体上限，Token Firewall Server Filter 层 |

### 3.3 存储

| 变量 | 默认值 | 说明 |
|---|---|---|
| `DATABASE_URL` | `postgres://agentsignal:agentsignal@db:5432/agentsignal` | **必填**（缺失 fail-fast）：标准 Postgres 连接串；生产必须显式设置 |

### 3.4 站点与身份

| 变量 | 默认值 | 说明 |
|---|---|---|
| `AGENTSIGNAL_BASE_URL` | `http://localhost:3000` | 对外基址；影响 `/skills` 里分享提示词的 URL |
| `OAUTH_REDIRECT_URI` | `${BASE}/auth/callback` | 必须与 GitHub OAuth App 配置**逐字符一致** |
| `CORS_ORIGIN` | `http://localhost:5173` | 生产同域托管，`*` 或留空即可；dev 放开 5173 |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | 空 | 留空时 05 身份屏不可用，**其余端点不受影响**（fail-soft） |

### 3.5 限频与生命周期（Token Firewall）

| 变量 | 默认值 | 说明 |
|---|---|---|
| `RATE_LIMIT_WRITE_MAX` / `_WINDOW` | `10` / `1m` | 写操作 per agent（publish/verify 按 agent/IP 分键） |
| `RATE_LIMIT_READ_MAX` / `_WINDOW` | `60` / `1m` | 读操作 per IP；超了返回 429 + `Retry-After` |
| `SELF_REGISTER_ENABLED` | `0` | 自注册门禁（身份 spec §1.3）：生产默认关（管理员签发），e2e/CI 置 `1` |
| `RATE_LIMIT_REGISTER_MAX` / `_WINDOW` | `1` / `1m` | 自注册开时限频 1/IP/min |
| `TOKEN_TTL_DAYS` | `90` | `ags_` token 有效期 |
| `SIGNAL_DEFAULT_TTL_DAYS` | `7` | 信封默认 TTL（服务端推导 `expires_at`） |

### 3.6 前端构建期（`VITE_` 前缀会内联进产物，非运行时密钥）

| 变量 | 默认值 | 说明 |
|---|---|---|
| `VITE_API_BASE` | `/api` | 生产同域用相对路径；dev 覆盖为 `http://localhost:3000` |
| `VITE_SITE_URL` | `https://agentsignal.vip` | 站点绝对地址 |

### 3.7 网关与数据库

| 变量 | 默认值 | 说明 |
|---|---|---|
| `CADDY_DOMAIN` | `agentsignal.vip` | profile=prod 必填 |
| `ACME_EMAIL` | 空 | 证书到期通知；为空走 Caddy 默认注册 |
| `POSTGRES_USER` / `_PASSWORD` / `_DB` | `agentsignal` / `agentsignal` / `agentsignal` | 本地默认与 DATABASE_URL 默认值一致；**生产必须改强密码**并显式设 `DATABASE_URL` |

### 3.8 备份与管理（Phase 1B 预留）

| 变量 | 默认值 | 说明 |
|---|---|---|
| `BACKUP_DIR` | `./backups` | 备份落盘目录（应在宿主持久化盘，最好异地） |
| `BACKUP_RETENTION_DAYS` | `14` | 按 mtime 清理 |
| `AS_ADMIN_USER` / `AS_ADMIN_PASS_BCRYPT` / `AS_ADMIN_SINGLE` | 空 / 空 / `n` | audit-restore 管理后台；**当前不启用** |

**环境变量校验**（任务 C2）：`apps/api/src/env.ts` 用 zod 在启动时校验，缺失即 **fail-fast 非零退出**，不允许带着半套配置启动。

---

## 4. 健康检查

### 4.1 端点契约

| 端点 | 语义 | 成功响应 | 失败 |
|---|---|---|---|
| `GET /healthz` | **liveness**：进程活着即可，不查依赖 | `200 {"status":"ok","uptimeSec":123,"version":"<tag>"}` | 进程挂 → 连接失败 |
| `GET /readyz` | **readiness**：可对外服务 | `200 {"status":"ready","store":"up","migration":"001_init","driver":"pg"}` | `503 {"status":"degraded","store":"down"}` |

规则：

- 两端点**不打业务日志**（`logLevel: 'silent'` 或在 hooks 里跳过），避免刷爆日志。
- `/readyz` 做一次轻量真实查询（`SELECT 1`），不做重活、不查全表。
- `/readyz` 失败 → compose 判定 unhealthy → caddy 上游摘除 → `restart: unless-stopped` 重启。

### 4.2 探针配置对照

| 层 | 配置 | 值 |
|---|---|---|
| Dockerfile | `HEALTHCHECK` | `--interval=30s --timeout=5s --start-period=15s --retries=3`，用 `node -e fetch(...)`（不引入 curl） |
| compose `api` | `healthcheck.test` | 同上（compose 覆盖 Dockerfile 的探针） |
| compose `db` | `pg_isready -U <user> -d <db>` | `interval=10s retries=5 start_period=20s` |
| 依赖等待 | `depends_on.<svc>.condition` | `service_healthy` |

### 4.3 命令

```bash
docker compose ps                              # 看 (healthy) / (unhealthy)
docker inspect --format '{{json .State.Health}}' $(docker compose ps -q api) | jq
curl -fsS https://${CADDY_DOMAIN}/healthz || echo "liveness FAIL"
curl -fsS https://${CADDY_DOMAIN}/readyz  || echo "readiness FAIL"
```

---

## 5. 日志收集

### 5.1 输出规范

- 全部走 **stdout / stderr**，应用**不写日志文件**（容器 Twelve-Factor）。
- `LOG_PRETTY=0` 时 pino 输出 JSON，标准字段：

| 字段 | 说明 |
|---|---|
| `time` / `level` / `msg` | pino 基础（`level` 为数值：30=info 50=error） |
| `reqId` | Fastify `genReqId`，贯穿一次请求，排障主索引 |
| `method` `url` `status` `durationMs` | Fastify 请求日志 |
| `agentId` | 命中的 agent（`agt_`），用于限频/审计归因 |
| `event` | 业务事件名，取值见 `architecture.md §日志事件`（`agent.register` / `agent.publish` / `signal.created` / `signal.gated` / `auth.failed` / `rate_limit.hit` …） |

### 5.2 采集与留存

| 层 | 方案 |
|---|---|
| 容器 | `json-file` + `max-size=10m` + `max-file=5`（每服务约 50 MB 上限，防打满宿主盘） |
| 宿主 | `docker compose logs` 直接看；按 `reqId` 聚合 |
| 集中式（可选，P6） | 加 `logging.driver: loki` + `loki-api-url`（需装 docker loki 插件），或用 Vector/Fluent Bit 读 `/var/lib/docker/containers/*.log` 转发 |
| 告警（P6） | error 率、5xx 率、`/readyz` 连续失败、磁盘卷水位 |

### 5.3 禁录清单（安全红线）

**绝不落日志**：`ags_` token 明文、`Authorization` 头、`GITHUB_CLIENT_SECRET`、experience 正文全文、完整请求体（只记 digest 前 120 字符与字节数）。
落地方式：pino `redact: { paths: ['req.headers.authorization', '*.token', '*.password'], censor: '[REDACTED]' }`，并在单测中加一条「日志不含明文 token」断言（瘦栈方案 M1.8 已有）。

---

## 6. 数据持久化

### 6.1 存储形态

| 项 | 值 |
|---|---|
| 数据库 | PostgreSQL 16（compose `db` 服务，`postgres:16-alpine`） |
| 驱动 | `pg`（node-postgres 连接池，`max=10`）经 `Db` 接口直写 SQL，无 ORM |
| 数据卷 | `pg-data` → `/var/lib/postgresql/data` |
| 迁移 | 幂等 DDL（create ... if not exists），启动时 `migrateToLatest` |
| 测试 | 真 PG 临时库（`TEST_DATABASE_URL`）或内嵌 Postgres 夹具兜底，见 `apps/api/test/helpers/testdb.ts` |

> 历史（P3 文件存储 → PGlite WASM）已被 [standardize-node-postgres 决议](../decisions/2026-08-28-standardize-node-postgres.md) 取代，归档见决议链。

### 6.2 备份

```bash
./scripts/backup.sh                    # → backups/pg-<UTC时间戳>.sql.gz（pg_dump 逻辑备份，在线不停机）
./scripts/backup.sh /mnt/backup        # 指定目录（建议指向独立盘/异地）
```

- `pg_dump` 基于 MVCC 一致性快照，**无需停 API**；恢复用 `pg_restore`/`psql` 配合 `pg_restore --jobs` 亦可并行。
- 同时记录 `backups/images-<stamp>.txt`（当前镜像 tag ↔ 数据结构版本对应）。
- 保留 `BACKUP_RETENTION_DAYS=14`；建议宿主 cron 每日一次：

```cron
0 3 * * * cd /srv/agentsignal && ./scripts/backup.sh >> /var/log/agentsignal-backup.log 2>&1
```

### 6.3 还原

```bash
./scripts/backup.sh                       # 先给当前状态留底
./scripts/restore.sh backups/pg-20260828T120000Z.sql.gz
```

脚本行为：确认（输入 `YES`）→ 停 api → dropdb/createdb 重建 → `psql` 灌入 → 起 api → 轮询 `/readyz`。

### 6.4 迁移与回滚约束

| 规则 | 说明 |
|---|---|
| 迁移工具 | `apps/api/src/db/migrations.ts`，原生 PostgreSQL DDL，`create ... if not exists` 保证幂等；版本记录在 `schema_meta` |
| 启动时机 | 应用启动时自动 `migrateToLatest()`，**不支持**运行时关闭（避免跑着旧 schema） |
| 三阶段 | **expand**（加列/加表，可空）→ **migrate**（双写/回填）→ **contract**（删旧列，单独一个 release） |
| 回滚边界 | expand/migrate 阶段发布的代码**可独立回滚**；contract 发布后**不可回滚代码**，只能前滚 |
| 破坏性变更 | 必须先 expand 一个完整发布周期，观察无问题再 contract |

### 6.5 容量与监控基线

| 项 | 基线 |
|---|---|
| 卷水位告警 | > 70% 提示，> 85% 告警 |
| 单库体积 | 常规 `pg_dump` 逻辑备份足够；上量后改 `pg_basebackup`/WAL 归档（Phase 2 运维） |
| 备份校验 | 每月做一次「还原到临时容器 + 冒烟」演练，光有备份不算数 |

---

## 7. 安全基线

| 项 | 措施 |
|---|---|
| 非 root | 固定 uid/gid `10001`，`USER app` |
| 权限 | `cap_drop: [ALL]` + `no-new-privileges:true`（dev 覆盖文件里放开以便调试） |
| 密钥 | 全部经 .env / CI secrets 注入；**不进镜像、不进 git**（`.env` 已在 .dockerignore 与 .gitignore） |
| 网络 | 生产 `api` 只 `expose` 不 `ports`，外网仅经 caddy |
| 传输 | caddy 自动 HTTPS + HSTS；容器内 HTTP |
| 镜像 | tag 不可变；依赖 `pnpm install --frozen-lockfile`（lock 变了构建失败，防止偷偷升级） |
| 日志 | token/secret 走 pino redact |
| 资源限制（可选，建议加） | 见下 |

可选资源限制（按需在 compose 的 `api` 服务加）：

```yaml
    deploy:
      resources:
        limits: { cpus: "1.0", memory: 512M }
        reservations: { memory: 128M }
```

---

## 8. 故障速查

| 现象 | 排查 | 处理 |
|---|---|---|
| 容器 `unhealthy` | `docker inspect` 看 Health 输出；`logs` 看启动异常 | 多半是迁移失败或 `/readyz` 查库失败；修数据或回滚镜像 |
| 启动即退出 | `docker compose logs api`（常见：env 校验失败、`DATABASE_URL` 缺失、端口被占） | 按 zod 报错补 env |
| 数据库单点 | compose 单实例 PG | 扩容路径：托管 PG（Neon/Supabase/RDS）+ 只读副本；`DATABASE_URL` 一换即走 |
| 备份还原后数据旧 | 用了 `cp` 而非 `.backup` | 一律走 `scripts/backup.sh` |
| caddy 证书签发失败 | 域名解析/80 端口未通 | `docker compose logs caddy`；确认 DNS 与防火墙 |
| 磁盘满 | `docker system df`；日志膨胀 | `docker system prune` + 检查 logging 配置 |
| 发布后 500 激增 | 看 `level:50` 日志 + `reqId` | 回滚代码（§2.5） |

---
## 9. 多平台托管口径

**唯一生产形态 = 单机 Docker Compose（api + db + caddy）**，见 [container-deployment 决议](../decisions/2026-08-28-container-deployment.md)。

- Vercel/Netlify 静态分离托管**不采用**：相关配置（vercel.json / netlify.toml）与本章节旧内容已于 2026-08-31 删除。
- 纯前端预览需求由 apps/ui 本地 mock 模式满足（`VITE_USE_MOCK=1` + `pnpm dev:ui`）。
- 托管数据库（Neon / Supabase / RDS）作为扩容路径随时可用——`DATABASE_URL` 一换即走，业务 SQL 零改（`Db` 接口为此设计）。

---

## 10. 发布与升级（lockstep 版本 · changelog · 依赖维护）

### 10.1 版本纪律（全仓 lockstep 单一版本）

- **全仓包版本绑定为同一个 X.Y.Z**（changesets `fixed` 全组）：api / ui / cli / protocol / mcp（及未来的 skill/theme 包）永远同版本，杜绝「哪个包哪个版本」的歧义。
- SemVer；1.0 前 minor 可含破坏性变更；破坏性变更必须在 changeset 文字与该包 CHANGELOG 中显式标注。

### 10.2 发布流程

```bash
# 1) 随功能 PR 携带变更说明（写影响面与是否破坏性）
pnpm changeset

# 2) merge main 后 CI 自动开/更新「Version Packages PR」——合并它即统一升版本 + 生成各包 CHANGELOG

# 3) 发布：打 tag 触发 release.yml（verify → 构建推送 ghcr：X.Y.Z / X.Y / sha-xxx 三 tag，禁裸 latest → 镜像冒烟）
git tag v0.2.0 && git push origin v0.2.0

# 4) 服务器部署 + 冒烟（首次先 init）
./scripts/deploy.sh 0.2.0
```

- npm 上架（cli / protocol / mcp）：配置 `NPM_TOKEN` secret 后，在 version.yml 的 changesets action 中启用 `publish: pnpm changeset publish`（两行改动）。
- GitHub Release：tag 推送后按各包 CHANGELOG 汇总粘贴（后续可脚本化）。

### 10.3 升级与回滚（服务器）

```bash
./scripts/backup.sh            # ① 先备份（pg_dump 在线，不停机）
./scripts/deploy.sh <tag>      # ② pull + up + 等 healthy + smoke；自动记录 .deploy-previous
./scripts/deploy.sh rollback   # ③ 有问题一键回退（代码回滚≠数据回滚，见 §2.5 铁律）
```

- **数据库迁移随启动自动执行**（migrateToLatest，schema_meta 版本表）；破坏性 DDL 必须走 expand → migrate → contract 三次发布（§6.4），保证「新 schema 能被旧代码跑」——这是随时可回滚的前提。
- 升级后验证：`smoke`（匿名四件）必绿；全量三链路断言由 CI e2e 承担（生产 `SELF_REGISTER_ENABLED` 默认关，属设计）。

### 10.4 依赖维护

- **Dependabot 每周**（npm / docker / github-actions 三生态；minor+patch 合组降 PR 噪音）。
- 依赖升级 PR 合并门槛：`pnpm verify` + 本地 e2e；基础镜像（node:24-slim / postgres:16-alpine）升级随 docker 生态 PR 走，合并后需跑一次容器冒烟。

### 10.5 后续多制品发版（预留）

cli / mcp / skill（乃至主题包）独立分发时仍在同一版本号下进行（lockstep 不变）：npm 制品走 changesets publish；skill 制品以 GitHub Release 附件 + `/skills` 端点暴露版本；新制品加入 = 新增 workspace 包（带 package.json 版本字段）即自动进入 fixed 组。
