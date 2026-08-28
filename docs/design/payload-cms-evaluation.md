# 调研方案：Payload CMS（Headless）适配性评估 —— 自研维持 vs 全量采用 vs 混合

> 状态：**已结案（2026-08-28）——全量接入否决，结论并入 [standardize-node-postgres 决议](../decisions/2026-08-28-standardize-node-postgres.md) D4/D5；运营后台缺口另立轻量方案** · 立项日期：2026-08-28 · 时间盒：**3 人日，超支即止**
> 触发问句（站长）：「我们是否很合适直接用 [Payload headless CMS](https://payloadcms.com/use-cases/headless-cms)，不用自己开发还得管理？」
> 上位约束：[runtime-bun-first](../decisions/2026-08-27-runtime-bun-first.md) · [storage-pglite](../decisions/2026-08-28-storage-pglite.md) · [lean-stack-adoption](../decisions/2026-08-28-lean-stack-adoption.md) · [container-deployment](../decisions/2026-08-28-container-deployment.md)
> 产出物：一份 ADR（`docs/decisions/YYYY-MM-DD-payload-cms-adopt-or-reject.md`），**负结果同样入档**。

## 一、背景与动机

- **现状**：`apps/api` 自研（Fastify + zod + PGlite 直写 SQL，无 ORM），三链路（分享/检索/构建发布）代码主体已落地、e2e 覆盖。自研的持续成本是真实存在的：协议端点、存储迁移、限频、安全全要自己养。
- **真实缺口**：运营后台缺位——`signals.recommended / stats_tag` 有列无写路径（站长推荐/打标无入口），audit-restore（Phase 1B）预留 `AS_ADMIN_*` 未启用。
- **诱因**：Payload 提供「代码化建模 + Admin UI + REST 自动 API + 鉴权 + 版本/审计」，直觉上可省掉自研与自管。
- **本方案立场**：这不是偏好问题，是「总成本 × 硬约束」问题。 Payload 降低的是**开发**成本，不降低**运维**成本（仍需自托管、升级、备份、安全响应），并新增**框架演进跟随**成本（Next.js 大版本节奏）——三个成本项都要入账。

## 二、核心调研问句

> **用 Payload 承载 AgentSignal 后端，能否在满足全部硬约束的前提下，让「交付北极星验证所需能力」的总成本（开发+运维+演进）低于维持自研？**

子问题：

| # | 子问题 | 对应实验 |
|---|---|---|
| Q1 | 契约：信封 v0.2（默认剥正文、`digest_valid`∈`_ui_ext`、include 语义）、六端点、`GET /skills` 总入口、zod 单一真源全栈同构，能否 1:1 承载？ | S3 |
| Q2 | 运行时与存储：Bun-first 双跑下 Payload（Next.js-native，官方未声明 Bun 支持）能否运行？PGlite 能否作存储（官方 adapter 仅 MongoDB/Postgres/SQLite）？ | S1、S2 |
| Q3 | 身份与防火墙：`ags_<ULID>` token（sha256(tolower) 口径）、per-agent 写限频 10/min、Token Firewall 三层，映射成本多大？ | S4 |
| Q4 | 需求错位：我们缺的到底是「内容管理框架」还是只缺一个「运营后台」？后者能否用更小方案满足？ | S3–S5 + 判定 |

## 三、硬约束清单（任一不过 → 一票否决）

| # | 约束 | 来源 | Payload 风险初判 |
|---|---|---|---|
| C1 | Bun-first（Node-safe 双跑），better-sqlite3 的 NAPI 崩溃教训在前 | AGENTS.md · storage-pglite 决议 | Payload 3 = Next.js-native，官方文档未见 Bun 声明 → **S1 验证** |
| C2 | PGlite 零基础设施、`Db` 接口直写 PG SQL、Phase 2 只换 driver | storage-pglite 决议 | 官方 adapter 无 PGlite（Postgres adapter 走 Drizzle + node-postgres）→ **S2 验证** |
| C3 | 协议单一真源：`packages/protocol` zod schema 被 api/cli/ui 三方共用，禁止复制字段定义 | AGENTS.md · lean-stack 决议 | Payload 的 collection 配置自成 schema 真源 → 双真源漂移风险 |
| C4 | 信封语义：默认剥正文、扩展字段 include 才下发、错误体形状稳定 | protocols/message-envelope.md · api.md | CMS 默认返回全字段，语义相反；需 custom endpoints 全量覆盖 → Q1 |
| C5 | 禁成品 UI 库（允许 headless + copy-in）；前端 React 19/Vite/Tailwind v4/Base UI | lean-stack 决议 | Admin UI 是成品 React 应用；若走「Payload 当后台」路线，需按 lean-stack 条款专项裁决其合规性 |
| C6 | 单服务 + Docker Compose 海外部署；现有 Dockerfile/Caddyfile/compose 已定 | container-deployment 决议 | Next.js 单体可容器化，但镜像形态/构建链与现部署件不同 → S5 |
| C7 | 北极星：真实 Agent 长期订阅并依赖收到的信号做事 | AGENTS.md | watch/cursor 游标、at-least-once 去重、零 LLM watch 是总线语义，CMS 无此概念 → 定性评估 |

## 四、方案空间（不做二选一）

| 方案 | 内容 | 先验判断（预登记，待证伪） |
|---|---|---|
| **A 维持自研** | 现有栈不动，补最小运营后台（如 D） | 保守基线 |
| **B Payload 全量替换** | API + 存储 + Admin 全上 Payload | 大概率被 C1/C2/C4 否决 |
| **C Payload 仅作运营后台** | Agent 契约面（六端点/CLI/Skill）不经 Payload；Payload 只服务站长编辑动作（推荐/打标/审计），读同一 PG 库 | **真实用例候选**，但 C2 仍在 |
| **D 轻量后台** | AdminJS / react-admin 挂现有 Fastify + 现有 zod schema；或受控 SQL 工具 | 成本最小，先验倾向最高 |

## 五、时间盒实验（S1–S5，实施时在 validation.md 预登记，Result 必答五问）

| # | 实验 | 步骤 | 通过线 / 一票否决点 | 预算 |
|---|---|---|---|---|
| S1 | 运行时探针 | Bun 1.x 起 create-payload-app 最小应用；`bun dev` / `bun run build` / REST smoke | Admin 与 REST 在 Bun 下可用且无原生模块崩溃 → 通过；需回退 Node-only → 触发 C1 一票否决（B/C 同灭） | 0.5d |
| S2 | 存储探针 | `@payloadcms/db-postgres` 指向 PGlite（pg 兼容层）；不行则评估 sqlite/postgres 容器替代 | PGlite 直连可用 → 通过；需引入 postgres 容器或换 sqlite → 记「违反 C2」缺陷，进入判定矩阵 | 0.5d |
| S3 | 契约映射 | collections 建模 signals/topics/agents（含 digest/origin/experience jsonb）+ custom endpoints 实现 publish/query/use + include 语义 | 现有 `tests/e2e/api.test.ts` 用例 **原样通过率 ≥90%** 且 openapi→前端类型链路不断裂 → 通过；custom endpoints 覆盖 >60% 端点 → 记 H2 成立 | 1d |
| S4 | 防火墙映射 | agent token 签发/校验（ags_+ULID、sha256(tolower)）、per-agent 10/min 写限频、bearerOf 大小写口径 | 在 Payload auth 之外不再养第二套用户即通过；两套身份并存 → 缺陷 | 0.5d |
| S5 | 部署与运维对比 | 镜像构建/体积/内存/冷启动对照现有 Dockerfile；Payload minor 升级节奏与 breaking 概率抽查 | 出具量化对照表（无 pass/fail） | 0.5d |

## 六、判定矩阵

- **任一票否决触发**（S1 或 S2 失败）→ B/C 出局，转 A/D，出 reject ADR。
- **B 采纳线**（全替换）：S3 通过率 100%（协议零妥协）∧ C3 双真源有工程解 ∧ S5 对照总成本 < 自研基线的 50%。三者是合取，缺一即否。
- **C 采纳线**（仅后台）：S2 通过 ∧ 站长编辑动作（推荐/打标/审计）经 Payload 落到同一 PG 库不引入双向同步 ∧ lean-stack 条款裁决 Admin UI 合规。否则落到 D。
- **D 采纳线**：AdminJS/react-admin 能以现有 zod schema 生成后台且增量依赖 < 3 个运行时包。
- 每条结论必须引用 S1–S5 的 Result 五问答案，禁止「感觉合适」式表述。

## 七、成本对比框架（ADR 必填账本）

| 成本项 | 自研（A/D） | Payload（B/C） |
|---|---|---|
| 开发 | 端点/后台工时（基线：implementation-tasks.md） | 建模 + custom endpoints + 迁移工时 |
| 运维 | 现有 compose/备份/探针（已建） | 同左 ** plus **框架升级跟随（Next.js 大版本）** |
| 演进 | 协议变更只改 protocol 包 | 双真源（zod ↔ collection config）同步成本 |
| 退出 | — | 数据迁出 + 契约面重写（锁死评估） |

## 八、预登记假设（可证伪）

- **H1** Bun 运行 Payload 存在原生兼容问题 → 触发一票否决。（依据：better-sqlite3 NAPI 前科）
- **H2** 信封语义迫使 custom endpoints 覆盖多数端点 → Payload「自动 API」增益趋零。
- **H3** 真实缺口是运营后台（recommended/stats_tag 无写路径、audit-restore 预留），不是内容管理框架。
- **H4** 全替换破坏 CLI/Skill/UI 四通道同权契约（AGENTS.md 接入纪律）。
- **H5** 「不用自己开发还得管理」的账本：开发成本 ↓，运维成本 ≈ 不变，演进成本 ↑。

## 九、时间线

D+1 上午 S1 → D+1 下午 S2 →（任一否决即刻终止、出 reject ADR）→ D+2 S3 → D+3 S4+S5+ADR。

## 十、参考资料（2026-08-28 抓取）

- [Payload — Headless CMS use-case](https://payloadcms.com/use-cases/headless-cms)：代码化 buildConfig、鉴权+SSO、custom REST endpoints、Admin UI 可注入自研 React 组件、版本/审计/多租户。
- [Payload — Database Overview](https://payloadcms.com/docs/database/overview)：官方 adapter 仅 MongoDB（Mongoose）/ Postgres（Drizzle）/ SQLite（Drizzle）；adapter 为外部依赖；SQLite 仅 Point 字段未支持。
- 运行时要求（Node 版本 / Bun 兼容）官方页未声明 → 由 S1 实测定案，不做书面推断。
