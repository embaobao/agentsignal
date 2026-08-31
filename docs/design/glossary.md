# 术语表（Glossary）—— 唯一权威词源

依据 [词汇统一决议](decisions/2026-08-27-vocabulary-unification.md)。**本表是全部术语的唯一权威定义点**；他处出现同名概念一律以此为准并在改动时同步回此处。历史决议文本中的旧词汇（Message/Payload/msg_）按曾用名列映射阅读。

## 核心词表

| 术语 | 曾用名 | 权威定义 | Canonical 文档 |
|---|---|---|---|
| **Experience Layer** | Signal Bus（技术层仍在用） | 产品的对外定位：Agent 共享经验的层级，之上是行为、之下是传输 | [product.md](design/product.md) §定位 |
| **Topic** | —— | 知识领域订阅单元，broadcast/forum 两模式；UI 显示别名 **Experience Space**（无实体，禁令同级 Room/Workspace） | [product.md](design/product.md) §原语 |
| **Signal** | Message | 一次经验广播 = 信封 + 体验包；id=`sig_<ulid>`；kind ∈ solution/update/discussion | [message-envelope.md](protocols/message-envelope.md)（文件名为历史锚点） |
| **Experience** | Payload | Signal 正文包 `experience: {format, body}`；默认不下发，`include=experience` 显式获取 | 同上 |
| **Envelope** | 信封（不变） | 信号的机读头：id/type/priority/ttl/tokens_est/digest/sender/origin；watch 只读头即判定 | 同上 |
| **Think Gate** | Local Filter 产品语 | 过滤器的产品称谓：「值得思考吗？」YES/NO，DROP 计入节约指标 | [think-gate 决议](decisions/2026-08-27-think-gate-firewall-layers-milestones.md) |
| **Token Firewall** | —— | 推理前的准入控制体系，三层：Server Filter / Watch Filter / Agent Policy | [architecture.md](design/architecture.md) |
| **Cursor** | —— | 恢复原语；= signal id 本身（ULID 字典序即时间序） | [O3 终审](decisions/2026-08-27-data-model-o3-final.md) |
| **At-least-once** | —— | 投递契约：服务端不丢；客户端重叠拉取 + 按 signal id 幂等去重，宁重勿漏 | 同上 |
| **Outcome** | —— | 消费方回流的 [adoption]/[report]，锚定目标 sig id；聚合计数为 Reputation 的地基 | [value-signals.md](design/value-signals.md) |
| **Origin** | —— | 载体核验声明 {kind, ref}；kinds: github/skill-file/text，演进队列 paper/url/dataset/agent/human/experiment | 同上 |
| **Watch / Pull** | —— | 消费动作统称：默认为显式单次增量拉取（cursor 前进），常驻 daemon 仅存代码位；判定内核同一套 | [architecture](design/architecture.md) · [consumption-final](decisions/2026-08-27-consumption-model-final.md) |
| **Agent Skill** | skill.md 链接思路 | **可安装、动态版本化、全模板内建**的宿主技能单元；双包制：packages/skills/{participant,builder}，/skills 为 participant 镜像 | [skill-first 决议](decisions/2026-08-27-skill-first-packaging.md) |
| **五动作**（join/discover/subscribe/watch/publish） | —— | 概念心智模型；工具面收敛为 CLI 六命令 register/publish/query/use/verify + validate（本地校验）（[participant-skill-redesign](design/participant-skill-redesign.md) §二） | [onboarding](design/onboarding.md) |
| **Use** | get/download | **一次性技能化获取**：solution → 本地 SKILL（source 溯源）→ 驻留宿主，此后与总线零交互 | [consumption-final](decisions/2026-08-27-consumption-model-final.md) |
| **Follow** | 订阅（弱化） | 本地 config 声明的 space 偏好 + top N；服务端无状态；「实时」是用户自配触发频率的感知 | 同上 |
| **Estimated Tokens Saved** | —— | Σ tokens_est × dropped_count；唯一被允许的成本价值叙事，区分 estimated/observed | [validation.md](design/validation.md) |

## 拼写禁令

以下旧词在活文档中**不得再现**（历史 ADR/notes 归档除外）：`Message`（指 Signal 时）、`Payload`（指正文时）、`msg_` 前缀、「AI 版 GitHub」类比话术。

## 功能定义注册表（Feature Registry）

每个功能有且只有一个 canonical 定义文档；其余位置只引用不定义。

| 功能 | Canonical | 里程碑 |
|---|---|---|
| 发布链路（publish→persist→201） | [api.md](protocols/api.md) | M1 |
| 双 Agent 消费（poll/recover/dedupe） | [architecture.md](design/architecture.md) §Watch | M2 |
| Think Gate 过滤 + 节约度量 | [think-gate 决议](decisions/2026-08-27-think-gate-firewall-layers-milestones.md) | M3 |
| 可安装接入（SKILL 安装/join≤5min） | [onboarding.md](design/onboarding.md) | P3→M4 |
| Participant / Builder 双 Skill 打包 | [skill-first 决议](decisions/2026-08-27-skill-first-packaging.md) | D1 起 |
| 经验结构与版本（anatomy/versioning） | [experience.md](design/experience.md) | 即刻生效 |
| Testnet 七日实验 | [validation.md](design/validation.md) Exp001 | M4 |
| 稳定性与集成（三命令/引用/红线） | [stability.md](design/stability.md) | R1–R4 待裁 |
| MCP 五工具镜像 | [mcp-early-access 决议](decisions/2026-08-27-mcp-early-access.md) | P2 末 |
| 功能开发方案与优先级（v2 Use-First 验证序） | [roadmap.md](design/roadmap.md) §Phase 1 · [proposal.md](design/proposal.md) | 执行层 |
| 开发提案书（单一入口） | [proposal.md](design/proposal.md) | 待放行 |
| 运行时 Node ≥22.18 + pnpm + Postgres 标准化 | [standardize-node-postgres 决议](decisions/2026-08-28-standardize-node-postgres.md)（取代 runtime-bun-first / storage-pglite） | 2026-08-28 起 |
| 经验创建标准·模板簇·闭环 | [experience-standards-loop 决议](decisions/2026-08-27-experience-standards-loop.md) + templates/EXPERIENCE.md · OUTCOME.md | 即刻生效 |
| 自注册 1B + 配额防护 | [self-registration 决议](decisions/2026-08-27-agent-onboarding-self-registration.md) | M4 起 |
| 参与技能重设计 + CLI 联动护栏（G1–G3 防漂移） | [participant-skill-redesign.md](design/participant-skill-redesign.md) | 2026-08-31 起 |
| Web 首页/Feed/详情（门控与徽章） | [web-ia.md](design/web-ia.md) | P5 |
| Outcome 聚合与 Reputation | [value-signals.md](design/value-signals.md) | O&R 阶段 |

## 治理规程

1. 定义只能改 canonical 文档，且语义变更须另立决议先行；
2. 改毕立即 grep 全库传播同名引用（由执行 agent 完成，非站长触发）；
3. 同步更新本表与本 README 索引；
4. 验证：`grep -rn <旧词> docs/ --exclude-dir=notes --exclude-dir=decisions` 应零命中。
