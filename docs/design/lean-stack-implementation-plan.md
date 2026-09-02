# 瘦栈实施方案 — 用成熟三方件压缩开发量（P3/P5 细化版）


> **ⓘ 归档注记（2026-08-28）**：本方案已被 [standardize-node-postgres 决议](../decisions/2026-08-28-standardize-node-postgres.md) 部分取代——运行时统一为 **Node ≥22.18 + pnpm 10**、存储统一为**标准 Postgres（node-postgres）**。文中选型对比（better-sqlite3 NAPI 崩溃实测等）与工时估算保留为历史依据；命令清单已按现行 Node + pnpm 口径改写。


> 状态：**待站长确认 · 确认后即取代 frontend-architecture.md / backend-architecture.md 中的选型条款**
> 配套：决议 [2026-08-28-lean-stack-adoption](../decisions/2026-08-28-lean-stack-adoption.md) · 提案 [design-driven-proposal](design-driven-proposal.md) · 视觉真源 [ui-blueprint-prompt](ui-blueprint-prompt.md) · 信息架构 [web-ia](web-ia.md)
> 上位约束：`AGENTS.md`（Node + pnpm 标准化 · 测试随行）· `docs/protocols/*`（v0.2）

---

## 0. TL;DR

**核心主张**：现有提案里「零 UI 库、全部自写」的条款（frontend-architecture §一 原则1、design.md 决策2、design-driven-proposal §四）用错了对象。真正该拒绝的是**带默认视觉的成品组件库**（MUI / AntD / Chakra / DaisyUI），而不是**headless 原语 + copy-in 源码**（Base UI / Radix + shadcn/ui）。前者会污染设计语言，后者一行默认样式都不带，全部走我们的 token。

| 项 | 结论 |
|---|---|
| 前端底座 | **Vite + React 19 + TS strict + Tailwind CSS v4（`@theme` 即 token 单真源）+ shadcn/ui（Base UI 原语，源码 copy-in）** |
| 组件策略 | shadcn 落 `components/ui/`（基础设施），设计稿命名组件落 `components/design/`（**btn/card/chip/step/verify-mark 命名契约一律不改**），后者套前者换皮 |
| 存储 | **标准 Postgres（node-postgres）** 直接写 PG SQL（P3/P5）；业务 SQL 零改。替代手写 FileStore + file-index。**不用 Kysely**（见下方实测） |
| 省下的量 | 前端 14 → 7 人日、后端 9 → 5 人日（P3+P5 合计，详见 §8 工时表） |
| 最大减量点 | ① 交互行为（键盘/焦点/ARIA/Portal）全部白拿 ② SQL 替代手写文件索引 ③ OpenAPI → TS 类型生成替代手写镜像 ④ zod schema 全栈同构 |

**方案三选一**（本文按 A 展开，B/C 仅作对照）：

| 方案 | 内容 | 前端工时 | 一致度风险 | 备注 |
|---|---|---|---|---|
| **A 推荐** | Tailwind v4 + shadcn/ui(Base UI) | **~7 人日** | 低（token 全量覆盖） | 省最多，CLI 可直接拉组件 |
| B 折中 | CSS Modules + 直接用 Base UI/Radix 原语 | ~10 人日 | 低 | 保留 tokens.css 手写，只白拿行为层 |
| C 现状 | 全自研（现提案口径） | ~14 人日 | 低 | 基线；交互 bug 自担 |

---

## 1. 提案现状盘点（细化的对象）

| 提案（openspec change） | 状态 | 与本文关系 |
|---|---|---|
| `publish-query-build` | **已实质完成**——apps/api 已跑通 register / publish / query / use / skill.md / ui.html；packages/protocol + packages/cli + skills/participant 在位 | 保留成果；仅替换存储层与补插件（§5） |
| `design-driven-ui-and-three-chains` | **待放行编码**（本文主目标） | M0–M4 任务按 §8 重写；D1/D2/D5 裁决点不变 |
| `audit-restore` | Phase 1B，依赖 D5 放行 | 本文 §5.4 预留其插座位；不改其范围 |

已识别冲突（**必须先立决议再改正文**，见 §10）：

| # | 位置 | 现有条款 | 冲突 |
|---|---|---|---|
| C1 | `frontend-architecture.md` §一 原则1 | 「绝不允许用任何第三方 UI 库默认样式污染」 | 需改写为「禁成品库，许 headless + copy-in」 |
| C2 | `design.md` 决策2 / 备选被拒 | 「零 UI 库：不引 Tailwind/Shadcn」 | 需推翻，理由见 §2 |
| C3 | `design.md` 备选被拒 | 「Tailwind 被拒：覆盖比从零写还多代码」 | 该判断基于 Tailwind v3；v4 的 `@theme` 反而是 token 最佳载体 |
| C4 | `design.md` 决策5 / `backend-architecture.md` §三 | P3/P5 文件存储 + 手写内存索引 | **已换标准 Postgres**（省 3 人日；且 SQL 与生产 PG 同方言） |
| C5 | `frontend-architecture.md` types/ | `types/signal.ts` 手写镜像 packages/protocol | 改为 OpenAPI 自动生成 |

---

## 2. 为什么「零 UI 库」这条判错了（逐条回应 C2/C3）

| 原判断 | 事实核对 |
|---|---|
| 「第三方 UI 库默认样式会污染设计语言」 | 对**成品库**成立（MUI/AntD 自带色板与组件观感）。但 shadcn/ui **不是 npm 库**——CLI 把组件源码写进 `components/ui/*.tsx`，无上游黑盒；其样式全部由 Tailwind class 调用我们自己的 CSS 变量。**不引入任何默认色**。 |
| 「Tailwind 覆盖比从零写还多代码」 | 该结论基于 v3（需 `tailwind.config.js` 里大面积 `extend/override`）。**v4 是 CSS-first**：`@theme inline { --color-bg: var(--bg) }` 一行即注册 utility，未使用的类 JIT 根本不生成 CSS。token 反而更集中（单文件可审），不是更散。 |
| 「UI 库省不了多少」 | 省的不是样式，是**行为**：Dialog 焦点陷阱与 Esc、Dropdown 的 ARIA + 键盘、⌘K 的 ↑↓/Enter/Esc、Select 移动端、Tooltip 定位、Toast 队列与无障碍播报。这部分手写 = 两周 + 一堆边缘 bug，且直接命中 D5.3 无障碍验收项。 |
| 「自写才能 1:1 还原设计稿」 | 命名契约可以两全：`components/design/KindBadge.tsx`（设计稿命名）内部渲染 `components/ui/badge.tsx`（换肤）。spec.md §3 的 `btn/card/chip/step/verify-mark` 命名一个都不动。 |

**Base UI 还是 Radix**（shadcn 2026-07 起默认 Base UI，Radix 未废弃）：

| | Base UI（`@base-ui-components/react`） | Radix（`radix-ui`） |
|---|---|---|
| 维护 | MUI 全职团队，月更 | WorkOS 收购后节奏放缓（仍 130M/月下载） |
| 体积 / API | 更小；`render` prop 替代 `asChild` | 生态与教程最多 |
| 选型 | **新项目选 Base UI**（默认，省事） | 需要 Radix 独有能力时 `--base radix` 切换 |

---

## 3. 前端依赖清单（方案 A）

> 版本一律取 npm latest；安装命令见 §9。下表「替代」= 原提案中需要自写的部分。

### 3.1 底座

| 包 | 用途 | 替代的自研工作 |
|---|---|---|
| `vite` + `@vitejs/plugin-react` | 构建/DevServer | —（原方案即有） |
| `react` `react-dom` (19) | UI 运行时 | — |
| `tailwindcss` (v4) + `@tailwindcss/vite` | 样式引擎 + **token 单真源载体** | 替代手写 tokens.css 的 utility 层（变量表仍手写，见 §4） |
| `clsx` + `tailwind-merge` + `class-variance-authority` | `cn()` 与变体 | 手写 class 拼接 |
| `shadcn` (CLI v4) | 组件源码 copy-in（**非运行时依赖**） | 25+ 组件的行为层 |

### 3.2 交互与功能

| 包 | 用途 | 替代的自研工作 |
|---|---|---|
| `cmdk`（经 shadcn `command`） | 06 ⌘K 命令面板：搜索/过滤/↑↓/Enter/Esc | CommandPalette + CommandItem + useCmdShortcut（~1 人日） |
| `sonner`（经 shadcn `sonner`） | Toast 栈：队列、右上滑入、无障碍播报 | ToastStack + toast-store（~0.5 人日） |
| `react-hook-form` + `@hookform/resolvers` + `zod` | 04 发布向导三步表单 + 校验 | 手写受控表单 + 校验 + 错误态（~1 人日） |
| `@tanstack/react-query` (v5) | 数据请求：缓存/重试/loading/error 态 | lib/api.ts 手写 fetch + 三态管理（~1 人日）；**直接喂 07 空态 / 08 骨架** |
| `react-router` (v7, declarative) | 路由 + 404 兜底 | routes.tsx 手写（0.3 人日） |
| `next-themes` | 主题切换 + 防闪 + `prefers-color-scheme`（`attribute="data-theme"`，非 Next 也能用） | theme.ts 防闪脚本（0.3 人日） |
| `lucide-react` | 图标（1000+，tree-shake） | components/primitives/Icon.tsx 自绘图标集（~1 人日） |
| `react-markdown` + `remark-gfm` + `shiki` | 03 详情四节正文渲染（默认无 `dangerouslySetInnerHTML`） | 自写 markdown 渲染（不可接受的风险自担） |
| `tw-animate-css`（Tailwind v4 版 tailwindcss-animate） | 动效原子类（scale-in / shimmer） | 手写 keyframes（0.3 人日） |
| `@tanstack/react-table`（P5 可选） | 1B 管理后台表格（audit-restore 2.8） | 纯 HTML 表格手写排序分页 |
| `date-fns` | 相对时间 / 格式化 | 自写（0.2 人日；若只做相对时间可用原生 `Intl.RelativeTimeFormat` 零依赖替代） |

### 3.3 开发期

| 包 | 用途 |
|---|---|
| `vitest` + `@testing-library/react` + `@testing-library/user-event` + `jsdom` | UI 组件测试（JSX/组件场景 node:test 支持差，独立跑） |
| `@playwright/test` | D1/D5 视觉对稿截图归集 + 三链路端到端 |
| `msw` | **前端 mock API**——D1 对稿不必等后端，前后端并行（关键减阻塞项） |
| `@types/react` `@types/react-dom` | 类型 |

> **测试纪律不变**（AGENTS.md §8）：`pnpm verify` 链含 `test:ui`（vitest）与 `test:e2e`（playwright）。

---

## 4. Token 落地：Tailwind v4 `@theme` 仍是单真源

原方案 `apps/ui/src/tokens.css` 的**地位不变**——它是唯一写死色值/字号/圆角的文件，只是从「裸 CSS 变量」升级为「裸 CSS 变量 + `@theme inline` 注册 utility」。

```css
/* apps/ui/src/index.css —— 唯一允许出现硬编码视觉值的文件 */
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));

/* 1) 真源变量（1:1 抄自 ui-blueprint-prompt.md §二） */
:root, [data-theme="light"] {
  --bg: #FAFAF9;  --surface: #FFFFFF;  --surface-2: #F4F4F5;
  --border: #E4E4E7;  --border-hi: #D4D4D8;
  --text: #18181B;  --muted: #71717A;  --faint: #A1A1AA;
  --green: #22C55E;  --blue: #0D9898;  --purple: #A78BFA;
  --glow-green: rgba(22,163,74,.22);  --glow-blue: rgba(13,152,152,.18);
}
[data-theme="dark"] {
  --bg: #09090B;  --surface: #111113;  --surface-2: #18181B;
  --border: #26262B;  --border-hi: #3F3F46;
  --text: #E4E4E7;  --muted: #A1A1AA;  --faint: #52525B;
  --green: #22C55E;  --blue: #3B82F6;  --purple: #A78BFA;
  --glow-green: rgba(34,197,94,.28);  --glow-blue: rgba(59,130,246,.22);
}

/* 2) 注册为 Tailwind utility（bg-surface / text-muted / rounded-card …） */
@theme inline {
  --color-bg: var(--bg);            --color-surface: var(--surface);
  --color-surface-2: var(--surface-2); --color-border: var(--border);
  --color-border-hi: var(--border-hi); --color-text: var(--text);
  --color-muted: var(--muted);      --color-faint: var(--faint);
  --color-green: var(--green);      --color-blue: var(--blue);
  --color-purple: var(--purple);    --color-glow-green: var(--glow-green);
  --radius-card: 16px;  --radius-ctl: 8px;  --radius-chip: 999px;
  --font-mono: ui-monospace, SF Mono, Menlo, monospace;
  --font-sans: -apple-system, "PingFang SC", "Segoe UI", sans-serif;
}
```

**shadcn 变量映射表**（init 后整体替换，杜绝 shadcn 默认 HSL 色板入库）：

| shadcn 变量 | 指向 | shadcn 变量 | 指向 |
|---|---|---|---|
| `--background` | `--bg` | `--primary` | `--green` |
| `--foreground` | `--text` | `--primary-foreground` | `#FFFFFF` |
| `--card` / `--popover` | `--surface` | `--accent` | `--blue` |
| `--secondary` | `--surface-2` | `--ring` | `--green` |
| `--muted-foreground` | `--muted` | `--border` / `--input` | `--border` |
| `--radius` | `--radius-card`(16px) | `--destructive` | 红（仅 guardrail block 用） |

**铁律（写进 lint/CI）**：
1. 色值/字号/圆角硬编码只允许出现在 `src/index.css`；其余文件出现 `#` 十六进制 → `biome lint` 报错（自定义规则或 grep 卡点）。
2. `components/ui/` 由 CLI 生成，允许整体重生成；**业务改动一律写在 `components/design/`**，避免 CLI 覆盖本地修改。

---

## 5. 后端依赖清单（架构层减量）

### 5.1 存储：标准 Postgres（node-postgres）直接写 PG SQL（取代 FileStore + file-index）

**理由**：文件存储要手写「by topic / by id / by q 倒排 / 分页 / related / bumpVerify 并发写 / seq 单调」，这些是 SQL 一行的事，手写约 3 人日且易错。

**标准 Postgres 的额外收益**：它是生产 PostgreSQL——DDL 直接对齐 `architecture.md` 冻结 schema（jsonb / timestamptz / 复合索引原生可用），**不再需要 SQLite↔PG 的 codec 兼容层**，也不再需要 Kysely 做方言抽象（反而少一层适配风险）。

| 包 | 用途 |
|---|---|
| `pg`（node-postgres） | 生产 PostgreSQL 驱动（node-postgres）。纯 JS，**无 ORM**，连接池原生 |
| — | **不引 ORM/查询构造器**：Postgres 即 PG，直接写 SQL 与生产完全一致；数据访问收敛在极小接口 `Db`（`query`/`exec`/`close`） |
| `pg` | Phase 2 才装。切换 = 换 dialect + 连接串，业务 SQL 不动 |

方言差异的收敛点（写进 `packages/protocol` 或 `apps/api/src/db/codec.ts`）：

标准 Postgres 就是 PostgreSQL，类型零差异：

| 冻结 DDL 类型 | Postgres 落法 | 说明 |
|---|---|---|
| `jsonb`（experience / origin） | `jsonb` | 原生支持，无需 codec |
| `timestamptz` | `integer`（epoch ms） | 同上 |
| `bigint` seq | `integer` | 无影响（ULID 主排序） |

> 保留 `IStore` 接口不变（design.md 决策5 的接口隔离仍然有效），`SqliteStore` 是其第二个实现。

### 5.2 Fastify 官方插件（替代手写）

| 包 | 替代 | 省 |
|---|---|---|
| `@fastify/rate-limit` | `src/auth/rate-limit.ts` 自写（写 10/min·agent，读 60/min·IP） | 0.5 人日，且自带 429 + `Retry-After` |
| `@fastify/cors` | 手写 CORS 头 | 0.1 |
| `@fastify/helmet` | 手写安全头 | 0.1 |
| `@fastify/cookie` | 手写 Set-Cookie 解析（OAuth state） | 0.2 |
| `@fastify/static` | 反向代理配置 | 0.3；**同域托管 apps/ui 产物**，D5 部署一步到位（配 SPA fallback 到 index.html） |
| `@fastify/swagger` + `@scalar/fastify-api-reference` | 手写 API 文档 | 0.5；顺带产出 `openapi.json` |
| `pino-pretty` | — | Fastify 内置 pino，只加 dev 美化 |

`@fastify/swagger` 与现有 `fastify-type-provider-zod` 的接线（`jsonSchemaTransform`）示例见 §9.4。

### 5.3 身份与 OAuth

| 包 | 用途 |
|---|---|
| `arctic` | GitHub OAuth：`createAuthorizationURL` + `validateAuthorizationCode` + 内建 `generateState`/PKCE。零依赖、仅用 Web API，跨运行时通用，50+ provider 预留 |
| `zod`（已有） | 环境变量校验：`src/env.ts` 30 行，启动即失败快（不引额外 env 库） |
| `conf`（CLI 侧） | `~/.config/agentsignal/config.json` 凭证持久化（token、默认 topic），省掉自写文件 IO 与权限处理 |

> **不使用** Better Auth / Auth.js / Clerk：本项目无密码体系（全 token `ags_` + GitHub OAuth 换 token），引入全栈 auth 框架是净负担。

### 5.4 预留插座位（不改动现有提案范围）

- `packages/audit`：`audit.injectHooks(store)` 仍挂在 `IStore` 之外的前后 hook（design.md 决策5 的接口隔离使其仍成立）。
- 管理后台表格：1B-2 任务 2.8 若改用 React，可复用 TanStack Table；保持「纯 HTML + vanilla」也行，不强制。

---

## 6. 全栈同构：三处最大减量

| # | 做法 | 省 |
|---|---|---|
| **S1** | **zod schema 单一真源**：`packages/protocol/src/schemas.ts` 导出 `SignalEnvelopeSchema / PublishRequestSchema / AgentSchema`，三处共用——Fastify 边界校验（type-provider-zod）、CLI `validate` 命令、前端 react-hook-form resolver | 三份校验逻辑 → 一份，约 0.8 人日 + 消除漂移 |
| **S2** | **类型自动生成**：`@fastify/swagger` 产 `openapi.json` → `openapi-typescript` 生成 `apps/ui/src/types/api.generated.ts`。删除 `frontend-architecture.md` 里「types/signal.ts 镜像 packages/protocol」的手写镜像 | 0.5 人日 + 永不漂移 |
| **S3** | **错误码统一**：`packages/protocol/src/errors.ts` 定义 `ErrorCode` 枚举 + Fastify `setErrorHandler` 统一出口 + `ApiError` 响应 zod schema（同步进 OpenAPI）。前端按 code 分支跳 401/404 | 0.3 人日 |

生成链路：`pnpm openapi`（起服务导出 json）→ 前端引用（类型改由 zod schema 直接 infer，见 apps/ui/src/types/api.ts）。**进 CI**：`pnpm verify` 里比对生成文件与提交版本是否一致。

---

## 7. 目录结构（改版）

```
apps/ui/
├─ index.html                    # 防闪 inline script（next-themes 注入）
├─ vite.config.ts                # @tailwindcss/vite + alias "@" → src
├─ components.json               # shadcn 配置：style=base-vega；tailwind.css=src/index.css
└─ src/
   ├─ index.css                  # ★ 唯一硬编码视觉值（@theme + 变量表，见 §4）
   ├─ main.tsx  routes.tsx
   ├─ components/
   │  ├─ ui/                     # shadcn CLI 生成（可整目录重生成，禁手改）
   │  └─ design/                 # ★ 设计稿命名层（btn/card/chip/step/verify-mark… 契约在此）
   │     ├─ KindBadge.tsx  VerifyMark.tsx  StepProgress.tsx
   │     ├─ SignalCard.tsx SignalList.tsx  MetadataChipRow.tsx
   │     ├─ EnvelopePreview.tsx  CmdBlock.tsx
   │     └─ illust/              # 空态/404/401 灰阶 SVG（自研，无第三方可替代）
   ├─ layout/                    # AppLayout / Topbar / Sidebar / RelatedSidebar
   ├─ pages/                     # Home / Topic / SignalDetail / PublishWizard / Auth / 404 / 401
   ├─ lib/                       # api(Query hooks) / auth / cn / format
   ├─ mocks/                     # ★ msw handlers（D1 对稿不等后端）
   └─ types/api.generated.ts     # ★ 自动生成，禁手改

apps/api/src/
├─ server.ts                     # 插件装配（cors/helmet/rate-limit/cookie/static/swagger）
├─ env.ts                        # zod 环境变量校验
├─ routes/{topics,signals,agents,auth-github,skills}.ts
├─ auth/{bearer.ts, token-hash.ts}          # rate-limit 迁到插件配置
├─ db/{client.ts, migrations.ts}            # Postgres 连接 + 幂等迁移（PG DDL）
├─ store/store.ts                           # IStore 接口 + PgStore 实现
└─ validate/{envelope.ts, four-sections.ts, digest-format.ts}
```

---

## 8. 任务拆解细化（M0–M4 重写版）

> 标注：`[三方]`=直接用现成，`[换肤]`=三方件上改 token/结构，`[自研]`=必须自己写，`[省]`=相对原 tasks.md 删减的条目。裁决点 D1/D2/D5 与原提案**完全一致，不放宽**。

### M0 基础设施（0.5 天，原 0.5 天）

| # | 任务 | 类型 | 细节 |
|---|---|---|---|
| M0.1 | 脚手架 | [三方] | `pnpm create vite apps/ui --template react-ts`；`@tailwindcss/vite`；alias `@`；根 package.json 加 `dev:ui / build:ui / test:ui / test:e2e / openapi`，并挂进 `verify` 链 |
| M0.2 | shadcn init | [三方] | `pnpm dlx shadcn@latest init` → style `base-vega`；随后**按 §4 映射表全量替换** shadcn 变量（禁留默认 HSL 色板） |
| M0.3 | tokens 落地 | [换肤] | `src/index.css` 写入 §4 全套；验收：`grep -rn "#[0-9A-Fa-f]\{6\}" src --exclude=index.css` 零命中 |
| M0.4 | 主题 | [三方] | `next-themes`：`attribute="data-theme"`，`defaultTheme="system"`，`disableTransitionOnChange` |
| M0.5 | 背景 | [自研] | 纯色背景（v5 单色极简，零装饰层） |
| M0.6 | msw mock | [三方] | `src/mocks/handlers.ts` 覆盖 §5 全部读端点 + 三态（loading/empty/error）。**使 D1 对稿不依赖后端** |
| M0.7 | 门禁 | [三方] | biome 自定义规则：禁硬编码色值；`tsc --noEmit` strict；vitest + Playwright 配置就绪 |

### M1 后端三链路（1.5 天 → **1.0 天**）

| # | 任务 | 类型 | 细节 |
|---|---|---|---|
| M1.1 | protocol 扩展 | [自研] | `schemas.ts`（zod 真源，供 S1/S2）、`ui-ext.ts`（UI 视图模型）、`errors.ts`（S3）；ids 追加 `ags_` |
| M1.2 | Postgres + 迁移 | [三方] | `db/client.ts`（`Db` 接口 + `PostgresDb`，测试无 PG 时由内嵌真 Postgres 兜底）；`db/migrations.ts` 幂等 PG DDL，DDL 对齐 `architecture.md` 冻结 schema，版本写入 `schema_meta` 供 `/readyz` 上报 |
| M1.3 | SqliteStore | [省] | 实现 `IStore`：list/get/put/related/frontpageStats/bumpVerify。**related / q 匹配 / 分页 / 排序全部 SQL**（原 file-index.ts 手写索引 [省]） |
| M1.4 | 插件装配 | [三方] | cors / helmet / rate-limit（写 10/min per agent，读 60/min per IP，429 + Retry-After）/ cookie / static（托管 UI + SPA fallback）/ swagger+Scalar（**原手写 rate-limit.ts [省]**） |
| M1.5 | register | [自研] | `ags_` + ULID；只存 sha256；限频 1/IP/min；明文仅一次性返回 |
| M1.6 | GitHub OAuth | [三方] | `arctic`：`generateState()` → cookie；`createAuthorizationURL` → `/auth/callback` → `validateAuthorizationCode` → 换 `ags_` → 302 回前端带 token |
| M1.7 | validate/publish | [自研] | `POST /validate/envelope`（digest 三段式软告警 + 四节标题率）；publish 走 zod + validate 流水线，写 `digest_valid` |
| M1.8 | 测试 | [三方] | node:test：SQL 迁移/查询、rate limit、token sha 不落日志、zod 非法拦截；`tests/e2e/three-chains.test.sh` 全通过 |
| M1.9 | OpenAPI | [三方] | `pnpm openapi` 导出；CI 比对生成物与提交一致 |

### D1 设计校准（2 天 · 裁决点，不放宽）

- D1.1–D1.6 与原 tasks.md 相同（Hero / stats 条 / 推荐 3 卡 / 信号流 / Sidebar+Topbar / 双主题）。
- **D1.7 对稿**：Playwright 一键截 8 屏 × 双主题 → `artifacts/screens/D1/`，与 `design/*.png` 并排人工勾选 `ui-blueprint-prompt §六` 前 4 项 ≥ 85%。
- **新增 D1.8 选型门禁**：抽查 `components/ui/` 三个组件，确认无任何 shadcn 默认色板残留（grep `--background: 0 0% 100%` 应零命中）。

### M2 P3 前端（3 天 → **1.5 天**）

| 原任务 | 处理 |
|---|---|
| M2.1 分区页 Tabs / 双形态 | [三方] shadcn `tabs` + `toggle-group`；仅改激活条为 2px 实线下划线 |
| M2.2 详情 SectionTabs | [三方] 同上 |
| M2.3 Runbook + Verify | [换肤] shadcn `switch` 换皮 + [自研] `VerifyMark` SVG 绿勾 |
| M2.4 RelatedSidebar | [省] 数据层用 TanStack Query；列表直接 `SignalCard` |
| M2.5 CTA 三按钮 | [换肤] shadcn `button` 三变体（solid 黑 pill/ghost/link） |
| M2.6 空态插画 | [自研] SVG（机器人举旗，无第三方可替代） |
| M2.7 骨架屏 | [三方] shadcn `skeleton` + shimmer 1.2s；reduced-motion 静态（媒体查询兜底） |
| — | [省] 原「列表/卡片/详情三态管理」由 Query 的 isLoading/isError 直接驱动 |

### D2 最小闭环裁决（1 天 · 不变）

D2.1 三态齐全 / D2.2 reduced-motion + 无 JS 可读 / D2.3 1280 + 768 断点 + lint + `tsc` 零 any。

### M3 身份底座（1.5 天 → **0.8 天**）

| 原任务 | 处理 |
|---|---|
| M3.1 登录页 | [换肤] shadcn `button` + `card` 布局；插画自研 |
| M3.2 回调写 token | [自研] 仅 20 行（URL → localStorage → auth-store → 回跳） |
| M3.3 IdentityPanel | [换肤] `input` + `label` + `CmdBlock`（自研等宽三行 + green pill） |
| M3.4 Topbar 用户区 | [三方] shadcn `dropdown-menu`（键盘可达，白拿） |
| M3.5 Bearer 注入 / 401 跳 /auth | [省] Query 全局 `queryClient` 拦截器 + `ErrorCode` 分支（S3） |

### M4 P5 全量（4 天 → **2 天**）

| 原任务 | 处理 |
|---|---|
| M4.1 发布向导 | [三方] react-hook-form（zodResolver 复用 protocol schema）+ shadcn `form`；StepProgress [自研]（无现成） |
| M4.2 Checklist + 成功态 | [换肤] `checkbox` + `alert`；信封预览卡 [自研] SVG |
| M4.3 ⌘K 面板 | [三方] **cmdk**（原 1 人日 → 0.2 人日：仅需换肤 + 三个数据源） |
| M4.4/4.5 404 / 401 | [自研] SVG 插画 + shadcn 布局 |
| M4.6 hover | [自研] 边框加深（v5：无发光无浮起） |
| M4.7 打字机 | [自研] 但 fail-open：DOM 初始含完整文本，JS 仅做遮罩动画 |
| M4.8 Toast | [三方] **sonner**（原 0.5 人日 → 0.1） |

### D5 总验收（1 天 · 不变 + 2 项）

- D5.1 逐屏对稿（§六 9 项）· D5.2 全链路 · D5.3 无障碍（**⌘K/Dropdown/Dialog 现在由原语保证，验收更稳**）· D5.4 `pnpm verify` 全绿 · D5.5 文档同步
- **新增 D5.6**：`pnpm openapi` 生成物与提交一致（防前后端漂移）
- **新增 D5.7**：`components/ui/` 可无损重生成（`pnpm dlx shadcn@latest add --overwrite` 后 diff 为空）

### 工时对照

| 阶段 | 原方案 | 方案 A | 方案 B |
|---|---|---|---|
| M0 | 0.5 | 0.5 | 0.5 |
| M1 后端 | 1.5 | **1.0** | 1.2 |
| M2 P3 | 3.0 | **1.5** | 2.2 |
| M3 身份 | 1.5 | **0.8** | 1.2 |
| M4 P5 | 4.0 | **2.0** | 3.0 |
| 前端+后端合计（不含裁决日） | 10.5 | **5.8** | 8.1 |
| 含 D1/D2/D5（4 天不变） | 14.5 | **9.8** | 12.1 |

---

## 9. 可直接执行的命令清单

```bash
# 9.1 前端脚手架
cd /Users/embaobao/workspace/agentsignal
pnpm create vite apps/ui --template react-ts
cd apps/ui
pnpm add react react-dom react-router @tanstack/react-query \
  react-hook-form @hookform/resolvers zod \
  cmdk sonner lucide-react next-themes react-markdown remark-gfm shiki \
  clsx tailwind-merge class-variance-authority date-fns
pnpm add -D tailwindcss @tailwindcss/vite tw-animate-css \
  vitest @testing-library/react @testing-library/user-event jsdom msw \
  @playwright/test @types/react @types/react-dom

# 9.2 shadcn 初始化（Base UI 原语；默认即 base-vega）
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button card badge input textarea label tabs dialog \
  dropdown-menu select tooltip switch checkbox skeleton separator \
  toggle-group alert sonner command table
# ⚠️ init/add 之后必须按 §4 映射表替换 src/index.css 中的 shadcn 变量

# 9.3 后端
cd ../api
pnpm add pg arctic conf \
  @fastify/cors @fastify/helmet @fastify/rate-limit @fastify/cookie @fastify/static
pnpm add -D @fastify/swagger @scalar/fastify-api-reference pino-pretty
cd ../.. && pnpm add -D openapi-typescript

# 9.4 swagger 与 zod 接线（apps/api/src/server.ts 片段）
#   import fastifySwagger from "@fastify/swagger";
#   import { jsonSchemaTransform } from "fastify-type-provider-zod";
#   await app.register(fastifySwagger, {
#     openapi: { info: { title: "AgentSignal API", version: "0.2.0" } },
#     transform: jsonSchemaTransform,
#   });

# 9.5 生成链路（根 package.json）
#   "openapi":  "node --experimental-strip-types apps/api/src/export-openapi.ts > openapi.json"
#   "types:gen":"openapi-typescript openapi.json -o apps/ui/src/types/api.generated.ts"

# 9.6 验证（追加进 verify 链）
pnpm check && pnpm lint && pnpm test \
  && pnpm test:ui && pnpm test:e2e
```

---

## 10. 风险与对策

| 风险 | 等级 | 对策 |
|---|---|---|
| shadcn 默认色板混入 | 高 | init 后按 §4 全量替换；D1.8 grep 门禁；`components/ui/` 只由 CLI 写 |
| CLI 重生成覆盖本地改动 | 中 | 业务改动只在 `components/design/`；D5.7 校验可无损重生成 |
| 设计稿 1:1 一致性被削弱 | 中 | 命名契约（`btn/card/chip/step/verify-mark`）原样保留；D1/D5 对稿标准不放宽；换肤全部经 `cn()` + token |
| Base UI 较新（v1.0 于 2025-12） | 中 | 仅用成熟件（Dialog/Select/Tabs/Switch）；需要时 `--base radix` 一键切回 |
| TS 7 + React 19 + Vite 类型链路 | 中 | M0.1 先做 30 分钟 spike：`tsc --noEmit` + 一次 build；不通则锁 TS 5.9 于 apps/ui |
| Postgres 外部服务依赖 | 低 | 依赖外部 Postgres（compose `db` 或 Neon）；断连由 pg Pool 重连兜底，readyz 探测保障 |
| Postgres 版本兼容 | 低 | 锁定 PG 16+；迁移 DDL 对齐冻结 schema，版本写入 `schema_meta` 供 `/readyz` 上报 |
| 依赖膨胀 | 低 | 全部 tree-shake；`components/ui/` 只 add 用到的；D5 记录 bundle 体积基线 |

---

## 11. 待站长确认后的传播清单（主动传播义务）

确认本文后，由执行 agent 一次性完成，不得等站长发现：

| # | 文件 | 动作 |
|---|---|---|
| 1 | `docs/design/frontend-architecture.md` §一 原则1、§二 文件结构、types/ | 改「禁成品库，许 headless + copy-in」；目录改 §7 版；删手写 types 镜像 |
| 2 | `docs/design/design-driven-proposal.md` §四 技术栈表 | 「零 UI 库 / 零 Tailwind」重写为方案 A 选型 |
| 3 | `openspec/changes/design-driven-ui-and-three-chains/design.md` 决策2 与「备选与被拒」 | 推翻 Tailwind/Shadcn 被拒条；补 Base UI vs Radix 结论 |
| 4 | `openspec/changes/design-driven-ui-and-three-chains/tasks.md` | 用 §8 重写 M0–M4；补 D1.8 / D5.6 / D5.7 |
| 5 | `docs/design/backend-architecture.md` §二 §三 | FileStore → SqliteStore；file-index 删除；补插件清单 |
| 6 | `docs/README.md` | 索引登记本文 + 决议 |
| 7 | `AGENTS.md` 命令段 | 补 `dev:ui / build:ui / test:ui / test:e2e / openapi / types:gen` |
| 8 | `docs/design/glossary.md` | 若新增术语（Lean Stack / Design Layer）按治理规程登记 |

**未确认前不动 1–5**（AGENTS.md：协议/定义变更先落决议再改正文）。
