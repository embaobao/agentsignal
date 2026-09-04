# AGENTS.md — AgentSignal（agentsignal.vip）

## 定位

> **Give your agent a memory.**
> *The shared experience layer for AI agents.*
> **品类定位（2026-09-02 起）**：**Agent 自主学习基础设施**——Agent 自己发现、学习、验证、沉淀；竞品全假设「人类选 skill 装给 Agent」，我们假设「Agent 自主完成闭环」（[决议](docs/decisions/2026-09-02-agent-native-repositioning.md)）
> **Slogan**：*Share once. Reuse everywhere. Think only when it matters.*（分享即复用 · 订阅即继承 · 只想值得想的事）
> 技术定位（L1，协议语境专用）：**A pub/sub signal bus** —— 经验层底下的传输总线

核心命题：能否在空闲时零 LLM token 前提下让 Agent 持续接收有用经验。解法是认知准入控制——信封先于体验包、过滤先于推理。GitHub 记录 Agent 修改了什么，AgentSignal 记录 Agent 学到了什么；互补不竞争。

- **北极星验证问题**：一个真实的 Agent 是否愿意长期订阅一个 Space 并依赖收到的信息做事？每个动议先过此问
- **接入唯一总入口**：把 `https://agentsignal.vip/skills` 丢给任何 Agent，即完成自动接入与引导（自足响应）；交付物为双 Skill——packages/skills/**participant**（用户侧，动态版本化+全模板内建）/ **builder**(工程侧,M1 自举)，Hermes 为一等测试宿主
- 原语两级：`Topic › Signal`（Signal 曾用名 Message，id=`sig_<ulid>`，kind ∈ solution/update/discussion；正文=Experience 曾用名 Payload）
- Topic 双模式 broadcast/forum 仅限发布权，全员公开可读；Space 仅是 Topic 的 UI 别名，永不实体化
- 三层格式 [Overview]/[Blueprint]/[Signal Exec] 是推荐模板非门禁

原则：Protocol First · Agent Native · Zero-LLM Watch · Envelope Before Experience · 无验证不建设。权威文档：`docs/design/product.md`、术语表 `docs/design/glossary.md`。

## 架构要点（细节见 docs/design/architecture.md）

| 层 | 谁干活 | 成本 |
|---|---|---|
| 传输层 | 无 LLM 的瘦 watch 进程持 SSE 或按游标轮询 | 空闲零 token |
| 认知层 | Think Gate 判 PASS 后才注入模型上下文 | 按需付费 |

Token Firewall 三层归属：Server Filter（发布权/TTL/限频/body 上限）· Watch Filter（kind/priority/tokens_est/digest/sender 口碑）· Agent Policy（think/defer/ignore）。Think Gate = Watch Filter 的对外产品语言。
watch 类进程要求：游标持久化（cursor=sig id）、at-least-once+按 id 幂等去重、指数退避、graceful shutdown、结构化日志、永不内嵌 LLM。

## 接入与协议

- 信封 v0.2：`docs/protocols/message-envelope.md`（now/never 边界、三 kind、digest 三段式、origin/outcome）
- API v0.2：`docs/protocols/api.md` —— 六端点含 **GET /skills 总入口**
- 五动作 join/discover/subscribe/watch/publish 经 skill/CLI/SDK/REST 四通道同权暴露
- 身份：M0–M3 管理员手工签发 → M4 起 `POST /agents/register` 自注册（限频防护即刻生效）；人类公开注册仍禁止
- 技术栈：**Node ≥22.18 LTS + pnpm 10（标准化，CI 跑 Node 24）**+ TypeScript strict + Fastify（通用能力一律官方插件）+ zod + **Postgres**（node-postgres 驱动；无 ORM，`Db` 接口直写 PG SQL，`DATABASE_URL` 必填——见 [standardize-node-postgres 决议](docs/decisions/2026-08-28-standardize-node-postgres.md)）+ 前端 React 19 / Vite / Tailwind v4 / Base UI（禁成品 UI 库，见 [lean-stack 决议](docs/decisions/2026-08-28-lean-stack-adoption.md)）。id 一律 `<前缀>_<ULID>`（sig_/topic_/agt_/ags_；另有 tok_ 作 token 行主键、snap_ 作审计快照 id）。单服务 + Docker Compose 海外部署（UI 静态产物由 API 同域托管）。排除微服务/K8s/Kafka/国内备案链路

## 文档治理（强制规范）

1. 一切文档与沉淀只进 `docs/`；根级豁免仅 README×2 / LICENSE / CLAUDE.md（CHANGELOG 由 changesets 按包生成，不入根级）。
2. 目录职责：`design/`(活文档) · `design/diagrams/`(图表资产) · `protocols/`(对外规范) · `notes/`(外部输入归档) · `decisions/`(决议,YYYY-MM-DD-slug.md)。
3. **[glossary](docs/design/glossary.md) 是术语与功能定义的唯一权威源**：每概念一行定义+canonical 指针；每功能一个 canonical 文档（注册表在内）。其余位置只引用不定义。
4. **主动传播义务**：任何定义变更，由执行 agent 当场完成「改 canonical → grep 全库同步引用 → 更新 docs/README 索引 → 需要时立决议」全链路；不得等站长发现。变更后验证：grep 旧词在活文档区应零命中。
5. 文档卫生纪律：不符合当前架构的旧描述一律删除或重写为当下事实，禁止以历史备注留存旧话术。
6. 协议语义变更先落 decisions 再改正文；ADR 与 notes 归档文本不回写（旧词按 glossary 曾用名列映射阅读）。
7. 内容资产目录：`solutions/ discussions/ templates/` 顶层各居其位。
8. **测试随行纪律**：任何功能开发/重构必须同步维护测试并跑绿（node:test 单口径，UI 用 vitest），先测后合；无测试的代码视为未完成（DoD 既有条款的执行口径）。
9. **CLI 命令面 ↔ participant SKILL 同步**：CLI 命令/参数/校验规则变更的 PR 必须同 PR 更新 `packages/skills/participant/SKILL.md`（metadata.version 与 CLI 同版本 lockstep），并跑绿护栏测试（G1 版本/G2 命令面双向一致见 `packages/cli/test/skill-sync.test.ts`，G3 /skills 托管一致见 e2e）；机制见 [participant-skill-redesign.md](docs/design/participant-skill-redesign.md) §5。
10. **账实同步（免查账纪律）**：[implementation-tasks.md](docs/design/implementation-tasks.md) 是唯一进度台账。功能/修复落地的**同一 PR** 必须当场：勾选台账与对应 openspec change 的 tasks.md、把新发现的缺口写进台账、刷新本文件「当前阶段/剩余」节。台账与代码不一致 = **P0 流程缺陷**；严禁攒账最后补，严禁为核实进度发起全仓重盘式查账（2026-09-02 那次是最后一次，成本已付）。多 Agent 并行时各自只勾自己完成的项，遇到他人「开发中」标记只读不覆盖。
11. **手册随行（双手册纪律）**：影响用户或 Agent 可感知行为的 PR 必须同步对应手册——用户面（UI/REST 行为/新命令效果）→ [user-manual](docs/design/user-manual.md)；Agent 面（接入/命令面/流程）→ participant SKILL（§9 lockstep）；管理面 → [admin-guide](docs/design/admin-guide.md)；部署面 → [deployment](docs/design/deployment.md)。手册只写**已上线**能力，与代码不一致 = P0 流程缺陷（同 §10 执行口径）。手册是对外 docs 资产的源头（分级见 [site-publishing-policy](docs/site-publishing-policy.md)），描述须人与 Agent 都能看懂。

## 工作流纪律

每特性九步：说明问题→最小解→更新协议→写测试→实现→集成测试→度量→落盘 docs→才继续。DoD 八件套见 roadmap。实验一律预登记 [validation.md](docs/design/validation.md)，Result 必答五问。编译通过≠完成。
**操作范式**：完整开发闭环、DoD「四本账 + 两手册」、多 Agent 并行约定见 [agent-dev-paradigm](docs/design/agent-dev-paradigm.md)；动码前先查 [maintenance-cheatsheet](docs/design/maintenance-cheatsheet.md)（30 秒定位 + 变更配方 + 坑速查）。

当前阶段：**三链路已上线 npm（@agentssignal/* 0.3.0 lockstep）并公网全通**（agentsignal.netlify.app + Neon PG，deployment §9.1）；ux-foundation Phase 0–2 + 5 主体已实施（2026-09-02 账实对照确认）。**本地技能引擎（[skill-engine](openspec/changes/skill-engine/proposal.md)，2026-09-03 落地 Phase 1 + Phase 2 主体）**：用户面四个命令 init（一条命令接入：向导→接线→完成）/ mcp / status / uninstall；MCP 唯一 server = `agentsignal mcp`，工具面 9 = 5 平台 + 3 本地 + open_setup（[mcp-sdk-consolidation](docs/decisions/2026-09-02-mcp-sdk-consolidation.md)）；本地管理界面 = 单文件 HTML 零外部请求（真源 [management-ui-spec-v1](docs/design/management-ui-spec-v1.md)）；「技能（内部形式）」不进用户命令面/文案（[skill-envelope](docs/decisions/2026-09-02-skill-envelope.md)）；`@agentsignal/mcp` 兼容壳已随包整体移除（未发版无存量用户，见决议修订注记）。零触碰 apps/api。**Payload CMS 已结案否决**（standardize-node-postgres 决议 D5）。身份模型 Q1–Q7 + 超管已于 2026-09-01 定档（1:N · 先注册后绑定 · 双层 /me · 5 agent 上限 · 结构化 verdict · 公开聚合 · 反馈需身份 · 超管=站长），**不再开放讨论**。

剩余（2026-09-02 账实对照更新；盘查明细见 [台账对照节](docs/design/implementation-tasks.md)）：

- **P0 修复包（✅ 已完成 2026-09-02 当日，pnpm verify 全绿）**：requireAdminBasic 补 bcrypt · feedback.test.ts 9 用例 · CLI/UI verify 三选 verdict（SKILL lockstep 0.3.1）· _ui_ext 详情下发 verdict 聚合 · `--color-paper` 注册 · GitHub 按钮文案对齐；另修 0.7（verify_logs.agent_id FK 致 admin 代验 500 → 迁移 006_verify_actor，**007 起为 Phase 1 迁移编号**）→ [user-domain-completion 提案](openspec/changes/user-domain-completion/proposal.md) Phase 0。
- **P1 用户域收尾（[user-domain-completion 提案](openspec/changes/user-domain-completion/proposal.md) 四阶段 · 已批准 2026-09-02）**：**主线优先（站长令 2026-09-02）：先完成个人 Agent 创建与管理闭环 = Phase 0 修复包 → Phase 1 creds**（better-auth 四表迁移 007_auth + session↔agents 桥接 + claim 流【=/auth 粘 token 绑定】+ token 管理 + **1.8 用户域创建 agent【出生即绑定·≤5】** + /me 页增量 + Netlify `/api/*`、`/auth/github` 转发【注意：`/auth` 是 UI SPA 路由，禁止整段 `/auth/*` 转发】）→ 私有 topic + 引用式书签（依赖 creds）→ apps/docs 公开站（已定：文档站取 `/docs`，Scalar 迁 `/api-docs`）。排队其后：[human-auth-providers 提案](openspec/changes/human-auth-providers/proposal.md)（Google OAuth + 邮箱 OTP，Draft；配套决议 [human-auth-email-otp](docs/decisions/2026-09-02-human-auth-email-otp.md) 窄推翻「邮箱注册不做」，密码仍禁）。CMS/低代码平台（Payload/Strapi/NocoBase/NocoDB）全部再否决，勿重议（复审条件见 payload-cms-evaluation §七）。
  - **⚠️ Phase 1 现状态：WIP 暂停（站长令 2026-09-02：保留为 WIP，待审完文档讨论后再动）**。后端四块（007_auth 迁移 / bridge + `/agents/me/session` / claim 端点 / token 三端点 / `POST /agents`）代码已落盘，**测试未跑通、未提交、未上公网**；CLI 1.5 · UI 1.6 · Netlify 1.7 · /me 页入口 1.8 均未开工。恢复第一件事：跑通 `apps/api/test/userdomain.test.ts`（口径根 `pnpm test`，node:test；勿用 `exec tsx`，tsx 不在依赖）。明细见 [openspec tasks.md Phase 1](openspec/changes/user-domain-completion/tasks.md) 与 [台账 WIP 节](docs/design/implementation-tasks.md)。
  - **暂停原因**：两份战略文档待站长审完讨论——[v2 agent-native 战略](docs/notes/2026-09-02-v2-strategy-agent-native.md)（已落 ADR [agent-native-repositioning](docs/decisions/2026-09-02-agent-native-repositioning.md)）· [三痛点解决方案](docs/notes/2026-09-02-three-pain-solution.md)（已附采纳/不采纳注记）。二者可能改写 Phase 2/3 排期，主线代码不抢跑。
- **P2 人工/环境**：视觉基准 v5.1 确认 + 八屏终审（太空猫吉祥物已定案，方案草成待确认）· T3–T5 容器演练（需 Docker daemon）· Netlify 三 OAuth 变量（BETTER_AUTH_SECRET/GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET）仪表盘手加 · 1B-2（还原+裁决+双签，audit-restore 既有排期）。

任务台账 [implementation-tasks.md](docs/design/implementation-tasks.md)，里程碑状态见 roadmap。

## 背景

填平落地鸿沟 · 人机双向共治 · A2A 密语生态（Signal & Backchannel）。

## 命令（pnpm workspace 统一口径；全部标准命令，定义在根与各包 package.json）

启动生命周期（首次 `pnpm bootstrap` 一次到位，日常 `pnpm dev` 一条命令全栈并行）：

```
pnpm bootstrap       # 首次引导：corepack/pnpm → 装依赖 → 生成 .env → 拉起 Postgres（compose --wait 等 healthy）
pnpm dev             # 全栈并行起 api :3000 + ui :5173（Turborepo 编排统一日志；api 侧 predev 自动 DB 预检）
pnpm dev:api         # 只起 api     pnpm dev:ui 只起 ui    pnpm smoke 对 BASE_URL 跑启动冒烟
pnpm db:up|down|reset|psql   # 本地 Postgres 生命周期（compose db 服务；reset 清卷重建）
pnpm changeset       # 提交一条版本变更说明（lockstep 发版流程见 deployment.md §发布与升级）
```

质量与交付：

```
pnpm test            # node --test（api 单测 + e2e + mcp）· test:ui = vitest
pnpm test:e2e        # 三链路脚本打真实服务（E2E_BASE 可指环境，默认 localhost:3000）
pnpm openapi         # 导出 openapi.json（前端类型生成的单一源头）
pnpm check           # tsc --noEmit（api + ui 双查，TS strict）
pnpm lint            # biome check              lint:fix 自动修
pnpm verify          # check + lint + test + test:ui 全链（Turborepo 缓存加速）
pnpm --filter @agentsignal/mcp dev   # 本地起 MCP stdio server（调试）
```

运维脚本（scripts/ 仅保留备份还原两件）：`./scripts/backup.sh` · `./scripts/restore.sh`（pg_dump/psql 在线备份）

## 顶层目录全集

`apps/(api ui) packages/(protocol cli audit skills/participant wizard-ui) skills/ openspec/ solutions/ discussions/ templates/ docs/ tests/ scripts/` + 根级门面（README×2/LICENSE/CLAUDE.md）+ 根级部署件（Dockerfile · Caddyfile · docker-compose*.yml · .github/ · openapi.json）。**根级 `skills/`**：skills.sh（`npx skills add`）分发镜像——`skills/agentsignal-participant/SKILL.md` 与 canonical（packages/skills/participant）逐字节一致（G4 护栏），只改 canonical 再复制。UI 设计稿 PNG 资产在 `docs/design/diagrams/mockups/`。`packages/mcp` 已移除（唯一 MCP server = CLI 内 `agentsignal mcp`）。新增 `packages/wizard-ui`（构建期包：单文件 HTML 产物注入 `packages/cli/src/skills/wizard/html.ts`）。规划未建：packages/(sdk watch) · skills/builder。新增须先改 AGENTS.md 登记。
