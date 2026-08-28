# 决议：瘦栈 adoption — 采用成熟三方件压缩 P3/P5 开发量

日期：2026-08-28
状态：**待站长放行**（放行后即生效，并按配套方案 §11 传播清单同步全库）
配套：[lean-stack-implementation-plan](../design/lean-stack-implementation-plan.md)（细化方案）
关联合约：`AGENTS.md`（Bun-first · Node-safe · 测试随行）· `docs/protocols/api.md` v0.2 · `docs/design/ui-blueprint-prompt.md`（视觉真源）

---

## 背景

`frontend-architecture.md §一 原则1`、`design-driven-proposal.md §四`、`openspec/changes/design-driven-ui-and-three-chains/design.md` 决策2 均规定「零 UI 库 · 全部自写 · 不引 Tailwind/Shadcn」，理由有二：(a) 第三方默认样式污染设计语言；(b) Tailwind 覆盖成本高于从零写。

按该口径，前端需自写 50+ 组件（含 25 个交互组件的行为层）、后端需手写文件索引与限频，P3+P5 合计约 14.5 人日。

## 决定

**1. 修订「零 UI 库」条款为「禁成品库，许 headless + copy-in」。**

| 禁止 | 允许 |
|---|---|
| 带默认视觉的成品组件库：MUI / AntD / Chakra / DaisyUI / Bootstrap | headless 无样式原语：**Base UI**（首选，shadcn 2026-07 起默认）/ Radix（备选，`--base radix`） |
| 以 npm 依赖形式引入黑盒组件 | **shadcn/ui**：CLI 把组件源码写入 `components/ui/`，自有可改，无上游运行时依赖 |
| 引入第三方默认色板 | Tailwind CSS v4 `@theme`，**token 单真源地位不变**（仍是 `src/index.css` 唯一硬编码处） |

理由：原判断 (a) 对成品库成立，对 headless + copy-in 不成立——Base UI 零样式、shadcn 样式全部调用我方 CSS 变量；原判断 (b) 基于 Tailwind v3，v4 的 CSS-first `@theme` 反而使 token 更集中、未使用类不生成 CSS。

**2. 命名契约不破。** spec.md §3 锁定的 `btn / card / chip / step / verify-mark / kind-badge` 命名全部保留于 `components/design/`，底层套 `components/ui/` 原语换肤。设计稿 → 代码的可追溯性不受影响。

**3. 存储层换 Kysely + better-sqlite3。** P3/P5 用 SQLite 单文件（同为零基础设施），取代手写 FileStore + file-index；`IStore` 接口保留，Phase 2 换 `pg` 方言，业务 SQL 不动。迁移用 Kysely schema builder 写，方言无关。不使用 `bun:sqlite`（违反 Node-safe 约束）。

**4. 后端通用能力一律用 Fastify 官方插件**：`@fastify/rate-limit` / `cors` / `helmet` / `cookie` / `static` / `swagger`(+Scalar)。GitHub OAuth 用 `arctic`。删除自写 `auth/rate-limit.ts`。

**5. 三处全栈同构**：① zod schema 单一真源（packages/protocol 导出，Fastify + CLI + 前端表单共用）；② OpenAPI → `openapi-typescript` 生成前端类型（删除手写镜像）；③ `ErrorCode` 枚举 + Fastify `setErrorHandler` 统一出口。

**6. 测试纪律放宽范围仅限 UI 层**：`packages/` 与 `apps/api` 维持 `bun test` + `node --test` 双跑（AGENTS.md §8）；新增 `apps/ui` 用 Vitest + Testing Library，端到端用 Playwright（含 D1/D5 视觉对稿截图）。前端用 `msw` mock，使 D1 对稿不阻塞于后端。

## 影响

- 工时：P3+P5 由 ~14.5 人日降至 ~9.8 人日（裁决日 D1/D2/D5 共 4 天不放宽）。
- 新增门禁：D1.8（无 shadcn 默认色板残留）、D5.6（生成类型与 OpenAPI 一致）、D5.7（`components/ui/` 可无损重生成）。
- 裁决点 D1（≥85% 对稿）、D2（三态闭环）、D5（九项设计确认 + 无障碍）**标准一律不放宽**。

## 不做

- 不引全栈 auth 框架（Better Auth / Auth.js / Clerk）——本项目无密码体系。
- 不引 SSR（Next.js 仍被拒，SEO 非当前目标，见原 design.md 备选被拒）。
- 不引图表库 / 状态机库 / i18n 框架（当前无需求）。
- 不改 audit-restore（Phase 1B）的范围与排期。

## 风险登记

详见配套方案 §10；最高两项：shadcn 默认色板混入（靠 §4 替换表 + D1.8 grep 门禁）、TS 7 × React 19 类型链路（M0.1 先做 30 分钟 spike，不通则锁 TS 5.9 于 apps/ui）。
