# syntax=docker/dockerfile:1.7
# AgentSignal API —— 多阶段构建（deps → build → runtime）
#
# 约束说明（改动前必读，见决议 2026-08-28-standardize-node-postgres）：
# 1. 运行时 Node ≥22.18（type stripping 默认开启）直跑 TypeScript 源码，**不做 bundle**。
#    原因：server.ts 用 `new URL(..., import.meta.url)` 读取同仓静态资源（SKILL.md / ui.html），
#    打包成单文件会让资源路径失效。
# 2. 包管理 pnpm（packageManager 字段锁版本）；存储为标准 Postgres（pg 驱动，纯 JS，无原生模块）。
# 3. packages/* 源码必须进运行时镜像：@agentsignal/protocol 是 workspace 依赖，直跑实时解析。

ARG NODE_IMAGE=node:24-slim

# ───────────────────────── Stage 1 · deps ─────────────────────────
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
RUN corepack enable

COPY --parents package.json pnpm-lock.yaml pnpm-workspace.yaml apps/*/package.json packages/*/package.json ./
RUN pnpm install --frozen-lockfile

# ───────────────────────── Stage 2 · build ─────────────────────────
FROM deps AS build
WORKDIR /app
COPY . .

# 类型门禁：编译不过直接构建失败（AGENTS.md 测试随行纪律）
ARG SKIP_CHECK=0
RUN if [ "$SKIP_CHECK" = "1" ]; then \
      echo "[build] SKIP_CHECK=1 — 类型门禁已跳过"; \
    else \
      pnpm run check; \
    fi

# 前端产物（同域托管）
RUN if [ -f apps/ui/package.json ]; then \
      pnpm run build:ui; \
    else \
      echo "[build] apps/ui not present — skip UI build"; \
    fi

# 兜底：保证 runtime 的 COPY 恒定成功
RUN mkdir -p apps/ui/dist && touch apps/ui/dist/.gitkeep

# ───────────────────────── Stage 3 · runtime ─────────────────────────
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    LOG_PRETTY=0

WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd -g 10001 app \
 && useradd -u 10001 -g app -m -d /home/app -s /bin/sh app

# 仅生产依赖（workspace 链接由 pnpm 维护，与 deps 阶段共享 lock）
COPY --parents package.json pnpm-lock.yaml pnpm-workspace.yaml apps/api/package.json packages/*/package.json ./
RUN corepack enable && pnpm install --frozen-lockfile --prod && pnpm store prune

COPY --from=build --chown=app:app /app/apps/api/src ./apps/api/src
COPY --from=build --chown=app:app /app/packages ./packages
COPY --from=build --chown=app:app /app/apps/ui/dist ./apps/ui/dist

USER app
EXPOSE 3000

# 健康检查用 Node 自带 fetch，不引入 curl/wget
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "apps/api/src/index.ts"]
