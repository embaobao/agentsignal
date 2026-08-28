# 决议：容器化部署基线

日期：2026-08-28
状态：**待站长放行**（放行后工程文件生效，按 [implementation-tasks](../design/implementation-tasks.md) T9 同步文档）
配套：[部署与运维手册](../design/deployment.md) · [瘦栈实施方案](../design/lean-stack-implementation-plan.md)
上位：[architecture.md](../design/architecture.md)（工程框架）· [overseas-deployment](2026-08-27-overseas-deployment.md)

---

## 背景

`architecture.md` 已排除微服务/K8s/Kafka/国内备案链路，海外部署用 Docker Compose。但缺工程文件与三环境操作口径，且 `frontend-architecture` / `backend-architecture` 两份文档未涉及容器。本次补齐，并固化若干易踩坑的取舍。

## 决定

**1. 单服务起步。** P3/P5 只有 `api` 一个常驻服务；前端是静态产物，由 `@fastify/static` 同域托管，不单独起前端服务、不引入 Nginx 做静态托管。省一整个服务 + 跨域 + 双域名。

**2. 基础镜像用 `oven/bun:1-slim`（Debian/glibc），不用 alpine。** `better-sqlite3` 是原生模块，musl 下无 prebuilt，需现场编译且易失败；多几十 MB 换稳定性值得。

**3. 运行时用 bun 直跑 TypeScript 源码，不做 bundle。** `apps/api/src/server.ts` 用 `import.meta.url` 读 `packages/skills/participant/SKILL.md` 与 `apps/api/src/ui.html`，打包成单文件会让这两个路径失效。要改打包，必须先完成 `implementation-tasks.md` 的 **C7（静态资源路径可配置化）**。同理，`packages/*` 源码必须进镜像（workspace 依赖实时解析）。

**4. 存储默认 SQLite + 命名卷**，PostgreSQL 以 `profiles: [pg]` 形式预留，Phase 2 生效；`depends_on` 用 `required: false`，未启用时不阻塞 api 启动。

**5. 三环境一套 compose + 覆盖文件**：基线 `docker-compose.yml` 即生产形态；`docker-compose.dev.yml`（bind mount + `bun --watch` + Vite 5173）；`docker-compose.test.yml`（tmpfs 临时库 + 一次性 e2e 容器，`--exit-code-from e2e`）。

**6. 镜像 tag 必须不可变**（git sha 或语义版本），**生产禁 `latest`**。回滚 = 换 tag 重建容器，不从源码重编。

**7. 数据库迁移遵守 expand → migrate → contract 三阶段**，保证「新 schema 能被旧代码跑」，使代码可独立回滚；contract 必须单独一个发布并观察至少一个周期，之后**不可回滚代码，只能前滚**。

**8. 健康检查双端点**：`/healthz`（liveness，不查依赖）与 `/readyz`（readiness，真实轻量查询，失败 503）。两端点不打业务日志。探针用 `bun -e fetch(...)`，不引入 curl。

**9. 日志**：pino JSON 走 stdout，`LOG_PRETTY=1` 仅限 dev；容器 `json-file` + `max-size=10m × max-file=5`；`redact` 覆盖 authorization/token/password；禁录 experience 正文全文。

**10. 备份**：SQLite 一律 `sqlite3 .backup`（在线一致快照），**禁止 `cp` 活库**（WAL 未落盘会拿到坏快照）；备份同时记录镜像 tag 以对应数据结构版本；保留 14 天，每日 cron，每月做一次还原演练。

**11. 安全基线**：固定 uid/gid 10001 非 root、`cap_drop: [ALL]`、`no-new-privileges:true`；生产 api 只 `expose` 不 `ports`，外网仅经 Caddy；密钥全部 env 注入不入镜像；依赖 `--frozen-lockfile`。

**12. 不引入**：K8s / 服务网格 / 消息队列 / 独立日志平台（P6 再评估 Loki 或 Vector）/ Prometheus 全家桶（先用日志 + 端点探活）。

## 影响

- 新增工程文件（仓根）：`Dockerfile`、`docker-compose.yml`、`docker-compose.dev.yml`、`docker-compose.test.yml`、`Caddyfile`、`.env.example`、`.dockerignore`；`scripts/backup.sh`、`scripts/restore.sh`（`scripts/` 已在 AGENTS.md 顶层目录全集内）。
- 新增文档：`docs/design/deployment.md`、`docs/design/implementation-tasks.md`。
- 需新增 API 端点：`GET /healthz`、`GET /readyz`（任务 S5）。
- 体积基线：镜像目标 < 200 MB（T3 实测记录）。

## 待确认

- 生产宿主形态（单机 Docker Compose vs 云厂商容器服务）—— 当前按单机 + Caddy 自动 HTTPS 设计。
- 镜像仓库：默认 `ghcr.io/agentsignal`，需确认组织名与推送凭据。
- 是否需要 HTTP/3（Caddyfile 已开 443/udp）—— 需宿主放通 UDP 443。
