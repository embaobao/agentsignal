# 设计驱动开发提案 — AgentSignal UI P3/P5（Design-First Proposal）

> 状态：**规划稿，待编码放行** · 2026-08-28 v1
> **上位约束**：`AGENTS.md` / `docs/protocols/*` / `docs/design/ui-blueprint-prompt.md`（v4 设计真源）/ `docs/design/web-ia.md`（信息架构真源）
> 输入素材：`/Users/embaobao/workspace/agentsignal/design/` 下 54 张豆包 AI 设计稿。

---

## 一句话提案

以 **v4 UI 蓝图** 为唯一真源，按 **P3 最小可用（1 屏 · 可跑通检索浏览）→ P5 八屏全量** 两阶段交付：先让"方案库看起来像设计稿"通过第一眼，再把登录/发布向导/⌘K/空态/加载态补齐。后端复用已有的 Fastify + Zod + 文件存储骨架（apps/api），前端新建 Vite + TS 严格 SPA（零 UI 库，全手写 CSS token 系统）。

> ⚠️ **2026-08-28 视觉已推翻**：v4 工程图纸风废弃，全站改为 ollama 式单色极简。视觉描述以 [ui-blueprint-prompt.md](ui-blueprint-prompt.md)（v5）与 [决议](../decisions/2026-08-28-minimal-redesign-ollama.md) 为准；本文其余视觉相关段落（设计稿比对、吉祥物、图纸标注、发光/渐变）仅作历史记录。

---

## 一、设计 → 代码：权威映射（MUST TRACK）

所有 UI 像素决策必须来自以下 2 份文档；擅自扩展 = 自动脱轨：

| 权威文档 | 覆盖 | 代码侧锚点 |
|---|---|---|
| `docs/design/ui-blueprint-prompt.md` §二 设计语言 | 色 token、字体、布局、组件、动效 | `apps/ui/src/tokens.scss`（单一真源） |
| `docs/design/ui-blueprint-prompt.md` §三 界面清单 | 8 张屏内容结构 | `apps/ui/src/pages/` 目录与路由 |
| `docs/design/web-ia.md` | 八屏骨架、三栏布局、字段冻结、Tab/Runbook/Related/Verify 行为 | 页面 data/state 设计 |
| `/design/*.png` 设计稿源文件 | 视觉感觉（图纸标注、吉祥物表情、插画细节）| 视觉验收时唯一比对依据 |

**改动铁律**：任何视觉修改先改 `ui-blueprint-prompt.md` → 改 IA → 最后才改代码。永远不直接改代码来改视觉。

---

## 二、分期与范围（P3 → P5）

### P3 · 最小可用（1 屏 · 2 周）

目标：**第一眼过关**——打开首页，用户能检索、能点进详情、能切换主题，视觉感觉跟设计稿一致度 ≥ 85%。

| 编号 | 屏 | 页面 | 最低要求 |
|---|---|---|---|
| 01 | 首页 Hero + 推荐卡 + 信号流 | `/` | Hero 文案+背景+双CTA；推荐3卡；信号列表；主题切换生效 |
| 02 | 分区页简化（列表） | `/topics/:slug` | 分区头 + 最新/最多验证 Tab + 信号列表（卡片/列表切换） |
| 03 | 方案详情页（四节 + Runbook + Related） | `/signals/:id` | kind+digest+元信息；四节正文；Runbook Verify 绿勾；Related 侧栏 |
| 07 | 空态插画（信号列表空） | 嵌入列表 | 机器人举旗 SVG（三色语义）+ Publish CTA |
| 08 | 加载态（列表 + 详情双骨架） | 嵌入 01/02/03 | Shimmer 1.2s infinite |

**必须交付**：双主题切换、响应式 1280/768、`prefers-reduced-motion` 降级、无假数据。

### P5 · 八屏全量（再 2 周）

目标：**设计稿全 8 张可点可用**——能完整走分享→检索→验证→登录链路。

| 编号 | 屏 | 页面/模块 | 新增依赖 |
|---|---|---|---|
| 04 | 发布向导三步 | `/publish` | 登录态（Bearer `ags_`）+ 模板校验 + digest 预览 |
| 05 | 登录 + 身份页 | `/auth` | GitHub OAuth（第三方平台）+ token 三行命令 |
| 06 | ⌘K 命令面板 | 全局组件 | `window.dispatchEvent(new CustomEvent('open-cmd'))` |
| 07 | 404 / 401 页 | `/404`、`/401` | 堆叠方块 / 挂锁 SVG 插画 |
| 04/05 | 步骤进度圆 + 命令块箭头 Green pill | 公共组件 | 与 Step 组件复用 |
| 01 | 3D 吉祥物机器人 | Hero 右 | 可 CSS 简化或 Lottie/SVG 分层（见前端架构 §动效策略） |

---

## 三、里程碑与裁决点（设计稿校准优先）

| 里程碑 | 内容 | 通过条件 |
|---|---|---|
| **D1 设计校准** | 前端脚手架 + 色彩 token 系统 + 01 首页首稿开 PR | 与设计稿并排对比≥85% 一致。**不通过则不推进任何编码** |
| **D2 最小闭环** | P3 全量：01/02/03/07空/08加载 | 走通 首页搜索→进详情→回首页 三态；主题切换 + 动效 fail-open 成立 |
| **D3 身份底座** | `/auth` GitHub OAuth + `ags_` token 签发 | `apps/api` 端点通、CLI 也能复用同一 token |
| **D4 全量八屏** | P5 全量 + 发布向导校验 + ⌘K | 走通 `GitHub 登录 → 发向导 → 提交 → 首页可见 → 点击详情` 完整流 |
| **D5 验收** | 视觉逐张校准 + 响应式实测（1280/768）+ 无障碍（键盘 ⌘K / Tab / Focus 圈） | 逐张勾选 ui-blueprint-prompt §六 设计确认清单 9 项全通过 |

---

## 四、技术栈（设计驱动的选型）

**为什么不 Next.js？** 设计稿是静态+SPA 级交互，不是 SSR SEO 场景；我们要零依赖、手写 CSS token 系统。**Vite + TS strict + 零 UI 库**是最小爆炸半径。

| 层 | 选型 | 理由 |
|---|---|---|
| **前端** | **Vite 6 + TypeScript strict** + **CSS Modules + CSS Variables** | 主题切换靠 `[data-theme]` 切换变量；零 Tailwind/Shadcn（它们的默认色板会污染设计语言） |
| **路由** | **react-router-dom v7**（若用 React）或 **vanilla JS 路由**（若坚持零框架，当前 apps/api/ui.html 路径） | 推荐 React —— 发布向导/⌘K 等复杂组件需要状态管理，但 React 仅做组织，不引 UI 库 |
| **组件库** | **零**，全部自写；图标用内联 SVG，插画 SVG 直接导入 | 设计图组件名（`btn`/`card`/`kind-badge`/`chip`/`step`/`verify-mark`/`toast`/`skeleton`）直接映射成类名/组件名 |
| **状态** | **Zustand** 或无；登录态存 `localStorage.as_token` | 极轻；避免 Redux 爆炸 |
| **工程** | Node ≥22.18 + pnpm 10 + TS strict + Biome Lint/Format + `tsc --noEmit` | 同仓约定（见 standardize-node-postgres 决议） |
| **后端** | **Fastify 5 + Zod**（apps/api 已存在）+ 文件存储 → PG（Phase 2 切换） | 复用既有；端点对齐 `docs/protocols/api.md` v0.2 |
| **鉴权** | **GitHub OAuth**（第三方平台集成，不要自建密码）→ 签发 `ags_` token（Bearer，sha256 存） | 同提案，M4 后自注册走 `POST /agents/register` |
| **动效** | **100% 纯 CSS 可实现**；打字机效果 + stagger 用 JavaScript 但 fail-open | 设计稿所有动效都标注可实现；CSS 不能才 JS，JS 不能 → 设计稿降级 |

---

## 五、仓库结构（变更后）

```
agentsignal/
├── apps/
│   ├── api/                 (已存在：Fastify 后端，端点扩展见 backend.md)
│   │   └── src/{server.ts, routes/{signals,topics,agents,auth}, auth/github-oauth.ts}
│   ├── share/               (保持不动，已废弃方向；D2 后删)
│   └── ui/                  (★ 新建：前端 SPA)
│       ├── index.html
│       ├── package.json     # pnpm dev → vite
│       ├── tsconfig.json
│       ├── src/
│       │   ├── main.tsx
│       │   ├── tokens.css           # 单真源：色彩/字体/间距/圆角
│       │   ├── global.css           # reset + 背景网格 + 高光条 + 图纸标注
│       │   ├── components/
│       │   │   ├── Topbar.tsx
│       │   │   ├── Sidebar.tsx
│       │   │   ├── RelatedSidebar.tsx
│       │   │   ├── SignalCard.tsx   / SignalList.tsx
│       │   │   ├── KindBadge.tsx    (三色 + 几何 icon)
│       │   │   ├── VerifyMark.tsx   (绿勾开关)
│       │   │   ├── StepProgress.tsx (向导三步圆)
│       │   │   ├── CommandPalette.tsx (⌘K)
│       │   │   ├── Skeleton.tsx
│       │   │   ├── Toast.tsx        (Sheen hover 扫光)
│       │   │   └── Illust/          (空态/404/401 SVG 插画 + 吉祥物)
│       │   ├── pages/
│       │   │   ├── HomePage.tsx         # 01
│       │   │   ├── TopicPage.tsx        # 02
│       │   │   ├── SignalDetail.tsx     # 03
│       │   │   ├── PublishWizard.tsx    # 04
│       │   │   ├── AuthPage.tsx         # 05
│       │   │   ├── NotFoundPage.tsx     # 07 404
│       │   │   └── UnauthorizedPage.tsx # 07 401
│       │   ├── lib/
│       │   │   ├── api.ts             (fetch apps/api：useQuery/useSignal)
│       │   │   ├── auth.ts            (token 存读 + Bearer 注入)
│       │   │   └── theme.ts           (localStorage.as_theme + prefers-color-scheme)
│       │   └── stores/
│       │       └── ui-store.ts        (⌘K 开/关 + toast 栈)
├── design/                         (保持不动，设计图真源)
├── docs/design/
│   ├── ui-blueprint-prompt.md       (保持不动，v4 设计真源)
│   ├── web-ia.md                    (保持不动)
│   └── design-driven-proposal.md    (本文)
├── openspec/changes/
│   └── design-driven-ui-p3-p5/      (★ 新建：本提案的 openspec change)
│       ├── design.md / proposal.md / tasks.md / specs/*
└── package.json   # workspace 加 apps/ui，加 dev:ui / build:ui 脚本
```

---

## 六、关键决策点（需你拍板，或默认按推荐走）

| 决策 | 推荐 | 备选 |
|---|---|---|
| **前端框架** | **React 19 + Vite**（发布向导/⌘K 状态管理最省） | Vanilla TS（更轻，但组件组织痛苦）|
| **吉祥物 3D 实现** | **SVG 分层版**（保持"可爱"但纯 SVG 手绘，不过 Lottie/Three） | Lottie 动图（动效更丰富）|
| **工程图纸标注**（外框色值/刻度）：真的画出来 vs 仅 Figma 导出装饰 | **生产环境关闭**，只在 dev 模式按快捷键 `D` 打开标注层（设计对稿时用）| 常驻（像设计图一样，真实用户也能看到）|
| **后端部署策略**：apps/api + apps/ui 是**一台机器两条服务**（Nginx 反代 `/api` → 3000、`/` → 5173） | 是，最小爆炸半径 | Vercel 部署 UI（海外），海外部署独立 API |
| **登录第三方**：GitHub OAuth 用哪一个开源轻量方案 | **node-openid-client**（最库直写，不引 SaaS） | 上 Authelia 自托管 |

**默认我按推荐实现**；有不同意见请直接在这条后面给回复。

---

## 七、验收（逐张对齐设计稿）

每屏交付时，PR 描述**必须**附：
1. 设计稿并排截图（左 design/、右当前实现）
2. 勾选 `ui-blueprint-prompt.md §六 设计确认清单` 9 项
3. 浏览器实测 1280 × 800 + 768 × 1024 两张截图
4. `prefers-reduced-motion` 开启与关闭两张动效状态截图

**D2/P3** & **D5/P5** 放行前站长/产品要对稿通过，不允许"先实现再改风格"。

---

## 八、风险与回退

| 风险 | 回退 |
|---|---|
| Vite 脚手架与 React 版本兼容问题 | 回到 vanilla TS（复用 apps/api/ui.html 最小骨架，按页增量重写）|
| 吉祥物插画版权/AI 图风险 | 替换成更简单的线稿 SVG（仅机器人剪影 + 旗子），不使用 3D |
| GitHub OAuth 海外部署回调失败 | 预留 `--auth-mock` 开发模式（固定 `#42 agent-42`）|
| 设计图与真实数据不匹配（stats 条）| stats 组件在无真数据时整块 `display:none`（按 IA 要求）|
| 图纸标注让用户困惑 | 生产默认关 + `?drawing=1` 才显示（给设计/运营对稿用）|
