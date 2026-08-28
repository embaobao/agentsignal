# 决议：运行时与存储标准化 —— Node + pnpm + Postgres（取代 Bun-first 与 PGlite）

日期：2026-08-28 · 状态：Accepted · 决策人：站长（zhumeng）
**取代**：[runtime-bun-first](2026-08-27-runtime-bun-first.md) · [storage-pglite](2026-08-28-storage-pglite.md)（两文归档不回写，按本决议阅读）
关联：[Payload 调研方案](../design/payload-cms-evaluation.md)（结案：全量接入否决）· [mcp-early-access](2026-08-27-mcp-early-access.md)（本决议落地其工程前提）

## 背景与动机

1. **Bun-first 动机被证伪**：better-sqlite3 在 Bun 下 NAPI 崩溃（storage-pglite 决议的成因）暴露了非标运行时的原生模块税；bun/node 双跑纪律让测试面翻倍；agent 生态 SDK（MCP 等）以 Node 为第一目标；开发体感「命令行和安装粗糙」本质是非标工具链摩擦。
2. **PGlite 动机随 Bun 一起消失**：PGlite 是为绕开 Bun NAPI 问题选的 WASM 内嵌方案；非标准、主流工具不支持（Payload 官方 adapter 仅 Mongo/Postgres/SQLite）、无连接池生态。
3. **标准化诉求**（站长裁决）：不绑定特定运行时，回归行业标准 = Node LTS + pnpm + 标准 Postgres；同步评估提供 MCP 服务能力。

## 裁决

### D1 运行时：Node ≥22.18 LTS（CI 跑 Node 24），弃用 Bun

- Node 22.18+ 默认开启 TS type stripping（erasable-syntax TS 直接运行），仓库代码零转换即可跑。
- 测试口径收敛：**node:test（api/单测/e2e）+ vitest（UI）单口径**，废除 bun/node 双跑；`bun test` 从命令与文档中移除。
- `tsx` 不引入；`node --watch` 提供 dev 热重启。

### D2 包管理：pnpm 10（`pnpm-workspace.yaml` + `pnpm-lock.yaml`），移除 bun.lock

- 全部脚本改为 pnpm 口径（`pnpm --filter` / `pnpm dlx`）；CI 用 `pnpm/action-setup` + `actions/setup-node`。

### D3 存储：Postgres（标准驱动 node-postgres），SQLite 否决

- `Db` 接口不变（当初「Phase 2 只换 driver」的兑现时刻）：`db/client.ts` 改为 `pg` Pool 实现；业务 SQL **零改写**（timestamptz / jsonb / make_interval 全保）。
- 部署：docker-compose 默认带 `postgres:16-alpine` 服务，`DATABASE_URL` 必填（fail-fast）；`DATA_DIR`/`DB_DRIVER` 环境变量废除。
- **SQLite 否决理由**：现有 SQL 为 PG 方言，换 SQLite 需重写全部迁移与查询，且失去与生产 PG 的方言对等——与「标准化」目标背道而驰。
- **测试夹具**：本地/CI 无 PG 服务时，测试用内嵌真 Postgres（PGlite WASM）实现同一 `Db` 接口兜底；`TEST_DATABASE_URL` 指向真 PG 时优先生效。PGlite 仅存于 devDependencies 与测试代码，**从运行时、部署面、文档存储口径中移除**。

### D4 MCP：提供（落地 mcp-early-access 决议）

- 新增 `packages/mcp`：stdio MCP server，五工具 1:1 镜像 REST（list_spaces / query_signals / use_signal / publish_signal / report_outcome），不新增协议语义；`AGENTSIGNAL_BASE_URL` + `AGENTSIGNAL_TOKEN` 环境变量。

### D5 Payload：全量接入否决

- 调研方案 [payload-cms-evaluation](../design/payload-cms-evaluation.md) 中一票否决项成立（Next.js-native 与协议总线错位、信封语义需 custom endpoints 全覆盖、schema 双真源）；运营后台缺口（recommended/stats_tag 无写路径、audit-restore 预留）后续以轻量方案另立 ADR。

### 保持不变

Fastify + zod 协议单一真源（packages/protocol）· 信封语义与六端点 · `Db` 接口与 IStore 边界 · Docker Compose 单服务部署形态（镜像基底换 node）。

## 影响

- AGENTS.md（技术栈/命令/测试纪律/目录全集）、deployment.md、backend-architecture.md、architecture.md、docs/README 同步修订。
- 遗留清扫（后续 PR）：implementation-tasks.md / lean-stack-implementation-plan.md / design-driven-proposal.md 等文中的 Bun/PGlite 话术，按本决议口径改写；openspec 历史提案不回写。
- 脚手架与 CI、Dockerfile（oven/bun → node:24-slim + corepack pnpm）、compose（新增 postgres 服务）同步替换。
