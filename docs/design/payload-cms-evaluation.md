# Payload CMS 适配性评估 —— 业务诉求复核与结案

> 状态：**已结案（2026-08-28）——全量接入否决**；结论落于 [standardize-node-postgres 决议](../decisions/2026-08-28-standardize-node-postgres.md) **D5**。
> **2026-08-31 复核**：业务诉求视角重新论证，结论**维持否决且更强**（新增「无 ORM」硬约束）；本文正文按当下事实重写，移除已失效的 Bun/PGlite 探针章节（[文档卫生纪律](../design/roadmap.md)）。
> 触发问句（站长）：「我们是否很合适直接用 [Payload headless CMS](https://payloadcms.com/use-cases/headless-cms)，不用自己开发还得管理？」
> 上位约束：[standardize-node-postgres](../decisions/2026-08-28-standardize-node-postgres.md) · [lean-stack-adoption](../decisions/2026-08-28-lean-stack-adoption.md) · [container-deployment](../decisions/2026-08-28-container-deployment.md) · AGENTS.md

---

## 一、先问业务诉求：我们到底要什么

技术约束能否决一个方案，但**只有业务诉求能解释「为什么根本不该走这条路」**。先把诉求摆出来（来源：D5 缺口、roadmap Phase 8/9、产品现状）。

### 1.1 运营侧诉求（站长，人）

| # | 诉求 | 来源 | 现状（2026-08-31 核实） | 规模 |
|---|---|---|---|---|
| **B1** | 给 Signal **打标/推荐**（`recommended` → `stats_tag`「编辑推荐」） | D5、产品已展示该标签 | **缺口**：`migrations.ts:57` 有列、`routes/signals.ts:56` 有读、**零写路径** | 1 人 · 低频 |
| **B2** | **审计与追溯**（谁发布 / 谁消费 / outcome） | audit-restore（Phase 1B） | 预留 `AS_ADMIN_*` 未启用；`apps/api/src` 零 admin 端点 | 1 人 · 低频 |
| **B3** | 违规/低质 Signal **处置**（下架、降权） | 运营常识 + Phase 8 signal quality | 无入口 | 1 人 · 极低频 |
| **B4** | 组织 / RBAC / 私有空间 | roadmap Phase 9 | 未启动 | 未来 |

### 1.2 Agent 侧诉求（核心业务，机器）

六端点契约 · `GET /skills` 总入口 · 四通道同权（skill/CLI/SDK/REST）· 信封语义（**默认剥正文**、`include=experience` 才下发）· 游标/watch/`at-least-once`+幂等去重 · 零 LLM watch · Token Firewall 三层。

**这才是产品的主体。** 运营侧（B1–B4）是支撑面，不是主体。

### 1.3 诉求规模结论

> **我们要的运营能力 = 1 个站长、2–3 个低频编辑动作（打标 / 审计 / 处置）。**

---

## 二、范式错配：这是抽象不对，不是成本高

**AgentSignal 是 append-only 的事件总线，不是可编辑的内容仓库。** 这是否决的根本原因。

| 维度 | CMS 抽象（Payload） | AgentSignal 现实 |
|---|---|---|
| 内容性质 | **可编辑文档**（草稿 → 版本 → 发布） | **不可变事件**（`sig_<ULID>`，append-only） |
| 生命周期 | 人驱动：创建/编辑/发布/归档 | 机器驱动：发布 → TTL 过期（`expires_at`） |
| 消费者 | **人**（Admin UI 编辑、前端浏览） | **机器**（Agent 经四通道消费） |
| 读取语义 | 默认返回全字段 | **默认剥正文**，`include` 才下发（Token Firewall 核心） |
| 顺序/游标 | 无此概念 | 游标持久化（`cursor=sig id`）+ 幂等去重 |
| 编辑者 | 多人协作、审批流 | **1 个站长的低频动作** |

逐条对照业务诉求：

| 诉求 | Payload 能否满足 | 判断 |
|---|---|---|
| B1 打标 | 能 | 杀鸡用牛刀 |
| B2 审计 | 部分 | **语义不同**：Payload 的 versions/drafts 是「文档改了几次」；我们要的是「谁发布 / 谁消费 / outcome」 |
| B3 处置 | 部分 | **语义不同**：draft/publish 是文档状态机；我们是事件流，处置 = **标记**而非删除 |
| B4 RBAC | 能（多租户） | Phase 9 未启动；且我们要的是「**Agent 发布权**」，不是「人编辑权」 |
| Agent 侧契约 | 需 custom endpoints **全覆盖** | 自动 API 增益趋零（原假设 **H2 成立**） |

---

## 三、结论：为什么不接入（四条，业务视角在前）

1. **范式错配**（根本）：append-only 事件流 vs 可编辑文档。Signal 的不可变性、TTL、游标语义、机器消费——CMS 抽象里一个都没有。
2. **需求错位**（原假设 **H3 已被证实**）：缺的不是「内容管理框架」，是「**一个站长运营面板**」。2026-08-31 核实：缺口就是 B1 打标 + B2 审计两个动作。
3. **投入产出失衡**：为 1 个用户的 2–3 个低频动作，引入 Next.js 运行时 + Drizzle ORM + Admin bundle + 框架升级跟随成本。
4. **时机与锁定成本**：M4 Testnet（北极星）之前换后端 = 自杀；Payload 的退出成本是「数据迁出 + 契约面重写」（见 §五账本）。

---

## 四、硬约束清单（2026-08-31 当下事实）

> 原清单 C1（Bun-first）、C2（PGlite）两根「一票否决」支柱已随 08-28 运行时决议**消失**——这正是需要复核的原因。以下为**当前仍成立**的约束。

| # | 约束 | 来源 | Payload 冲突 |
|---|---|---|---|
| **C3** | 协议单一真源：`packages/protocol` zod schema 被 api/cli/ui/mcp 共用，**禁止复制字段定义** | AGENTS.md · lean-stack | collection 配置自成 schema 真源 → **双真源漂移** |
| **C4** | 信封语义：默认剥正文、扩展字段 `include` 才下发、错误体形状稳定 | protocols/message-envelope.md · api.md | CMS 默认返回全字段，语义相反 → custom endpoints 全覆盖 |
| **C5** | 禁成品 UI 库（许 headless + copy-in）；前端 React 19/Vite/Tailwind v4/Base UI | lean-stack 决议 | Admin UI 是成品 React 应用，需专项裁决合规性 |
| **C6** | 单服务 + 单机 Docker Compose 海外部署 | container-deployment 决议 | Payload 3 = Next.js-native，运行时与构建链不同 |
| **C7** | 北极星：真实 Agent 长期订阅并依赖信号做事 | AGENTS.md | watch/游标/去重/零 LLM 是总线语义，**CMS 无此概念** |
| **C8** | **无 ORM，`Db` 接口直写 PG SQL**（08-28 新立） | standardize-node-postgres 决议 | Postgres adapter 走 **Drizzle（ORM）** → 直接冲突 |

> **C8 是本次复核新增的否决项**，比已失效的 C1/C2 更强：它约束的是数据访问方式本身，与运行时/存储选型无关。

---

## 五、成本账本

| 成本项 | 自研（方案 A/D） | Payload（B/C） |
|---|---|---|
| 开发 | 运营面板：受 `AS_ADMIN` 门禁的路由组 + 极简页面，**几十行** | 建模 + custom endpoints（覆盖 Agent 契约）+ 迁移 |
| 运维 | 现有 compose/备份/探针（已建） | 同左 **plus** Next.js 大版本升级跟随 |
| 演进 | 协议变更只改 `packages/protocol` | 双真源（zod ↔ collection config）同步 |
| **退出** | — | **数据迁出 + 契约面重写**（锁定风险） |

---

## 六、真实缺口的解法（D5 遗留动作）

D5 已判「运营后台缺口后续以轻量方案另立 ADR」，截至 2026-08-31 **该 ADR 尚未立项**，缺口仍开着。

**推荐方案 D（轻量后台）**，与 lean-stack 决议相容：

- **形态**：`apps/api` 内一组受 token 门禁的 admin 路由 + 一个极简页面（或复用现有 UI 的 admin 路由）。
- **数据访问**：复用 `Db` 接口直写 SQL，**不引 ORM**（守 C8）。
- **合规**：AdminJS / react-admin 均属**成品后台库**，触 C5，**不采用**；自研或 headless + copy-in。
- **范围**：先落 B1（打标）+ B2（审计只读），B3/B4 待 Phase 8/9 展开再评估。
- **预估**：0.5–1 人日。

---

## 七、复审触发条件（何时重开此决策）

结论不是一锤子打死。满足**任一**即重新评估：

1. Phase 9（Private Agent Bus）展开后，运营/编辑动作 **> 10 个**，或需多人协作 / 审批流 / 真正的人 RBAC；
2. Signal 的语义从 **append-only 事件**变为**可编辑内容**；
3. M4 Testnet 证明**人工内容运营是核心环节**而非辅助（当前判断：辅助）。

在此之前，本决策**关闭**。

---

## 八、方案空间（存档）

| 方案 | 内容 | 结论 |
|---|---|---|
| **A 维持自研** | 现有栈不动 | ✅ **采纳**（基线） |
| **B Payload 全量替换** | API + 存储 + Admin 全上 | ❌ 否决（C3/C4/C7/C8） |
| **C Payload 仅作运营后台** | Agent 契约面不经 Payload | ❌ 否决（C8 + C5 + 投入产出失衡） |
| **D 轻量后台** | 自研 admin 路由 + 现有 zod schema | ✅ **采纳为缺口解法**（见 §六） |

## 九、参考

- [Payload — Headless CMS use-case](https://payloadcms.com/use-cases/headless-cms)：代码化 buildConfig、鉴权+SSO、custom REST endpoints、Admin UI、版本/审计/多租户。
- [Payload — Database Overview](https://payloadcms.com/docs/database/overview)：官方 adapter 仅 MongoDB（Mongoose）/ Postgres（**Drizzle**）/ SQLite（Drizzle）→ 触 C8。
