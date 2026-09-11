# docs/ — 项目文档索引

规范见根目录 `AGENTS.md`。进度（2026-09-11 口径）：**三链路公网全通 agentsignal.netlify.app（npm @agentssignal/* 0.5.0 lockstep）· 定位扩展「经验层 + 本地能力面」（[决议](decisions/2026-09-11-local-capability-plane.md)）· 当前主线 = local-capability-plane P0 产物规范化（夜间七席流水线）· 在册 changes：local-capability-plane · audit-restore 1B-2 · host-matrix-alignment · host-integration · ux-foundation · user-domain-completion（WIP 冻结）· human-auth-providers（冻结）· skill-engine（20/20 全勾，待完成验证闭环后归档）**。明细只看 [台账](design/implementation-tasks.md)与 AGENTS.md「当前阶段」，本行不重复维护细节。
定位：产品「The shared experience layer」· 品类「**Agent 自主学习基础设施**」（2026-09-02 起，[决议](decisions/2026-09-02-agent-native-repositioning.md)）· **扩展「经验层 + 本地能力面」**（2026-09-11 起，[决议](decisions/2026-09-11-local-capability-plane.md) D1/D2）· CTA「Give your agent a memory.」· 技术 L1「A pub/sub signal bus」。
**术语与功能定义唯一权威源：[glossary.md](design/glossary.md)**。

## 文档地图（按你要干什么找）

| 你要干什么 | 读这些 |
|---|---|
| **把项目跑起来 / 发经验 / 查经验 / 回流** | ★[design/user-manual.md](design/user-manual.md)（四通道操作手册） |
| **管理端点 / 审计账本 / 数据备份** | [design/admin-guide.md](design/admin-guide.md) · [design/deployment.md](design/deployment.md) |
| **部署 / 三环境 / 升级回滚 / 发版** | ★[design/deployment.md](design/deployment.md)（§2 操作 · §3 环境变量 · §10 发布与升级） |
| **后端/前端开发** | [AGENTS.md](../AGENTS.md)（权威入口）· [design/architecture.md](design/architecture.md) · [design/backend-architecture.md](design/backend-architecture.md) · [design/frontend-architecture.md](design/frontend-architecture.md) |
| **新 Agent 接手 / 怎么开发、改哪里、避什么坑** | ★[design/agent-dev-paradigm.md](design/agent-dev-paradigm.md)（开发闭环 · DoD 四本账+两手册）· ★[design/maintenance-cheatsheet.md](design/maintenance-cheatsheet.md)（30 秒定位 · 变更配方 · 坑速查） |
| **对协议 / 字段语义** | [protocols/api.md](protocols/api.md) · [protocols/message-envelope.md](protocols/message-envelope.md) · [design/glossary.md](design/glossary.md) |
| **本地引擎（四命令 / MCP 九工具 / 管理界面）** | ★[design/local-engine.md](design/local-engine.md)（功能 canonical）· [UI 真源](design/management-ui-spec-v1.md) |
| **查进度 / 提案 / 验证** | [design/implementation-tasks.md](design/implementation-tasks.md) · `../openspec/changes/`（**在册 8 个活跃**：user-domain-completion · host-matrix-alignment · skill-engine · audit-restore · human-auth-providers · ux-foundation · **host-integration（2026-09-10 新，依赖 host-matrix-alignment）** · **local-capability-plane（2026-09-11 新，全量提案：能力代理 × 适配器 × 经验层；归并 local-content-model / mcp-service-exposure）**；participant-skill-cli-sync / dynamic-skill-management / **local-content-model / mcp-service-exposure（2026-09-11 被 local-capability-plane 吸收归档）** 已归档）· [design/validation.md](design/validation.md) |
| **查决策为什么这么做** | [decisions/](decisions/)（一事一文，最新：standardize-node-postgres） |

## 设计（活文档）

| 文件 | 说明 |
|---|---|
| `design/glossary.md` | ★术语表 + 功能注册表 + 治理规程 |
| `design/product.md` | 定位四件套、北极星问句、GitHub 教义、排除项（含插件市场红线） |
| `design/architecture.md` | 数据流、Token Firewall 三层、消费层（pull-on-demand）、工程框架、冻结 DDL |
| `design/experience.md` | ★经验唯一权威源：四节解剖、不可变+取代链、一生流程、服务端义务 |
| `design/stability.md` | 稳定性：三命令主线、凭证双轨、引用机制、无插件红线、失败矩阵、catch-up |
| `design/onboarding.md` | ⓪/skills 总入口、动态自更新、模板内建、宿主矩阵、时间预算 |
| `design/participant-skill-redesign.md` | ★参与技能重设计 + CLI 联动架构（方案，2026-08-31 待裁决 R1–R3）：业务边界、Agent Skills 开放标准调研、SKILL 七节结构、防漂移护栏 G1–G3 |
| `design/validation.md` | Experiment 000b/001（宿主覆盖、五问、pass bar）、Experiment 002b/002/003 预留、**Experiment 004 语义层是否值得做（2026-09-09 预登记 · 未排期 · 前置门槛 = 002 基线）** |
| `design/value-signals.md` | 四层信号、outcome 五元组（artifact 必填）、Signal Graph |
| `design/web-ia.md` | 七屏首页、Signal 卡、Experience Record、Use=动作即命令 |
| `design/proposal.md` | ★开发提案书：范围/技术栈/里程碑/脚手架/风险（开工单一入口） |
| `design/roadmap.md` | v2.1 双轨 M×P、Day1–7、DoD、卫生纪律 |
| `design/ui-blueprint-prompt.md` | ★视觉真源 v5：单色极简 token/组件口径（ollama 式） |
| `design/frontend-architecture.md` · `design/backend-architecture.md` | 前后端架构（P3/P5）；选型条款待按瘦栈决议修订 |
| `design/lean-stack-implementation-plan.md` | ★瘦栈实施方案：三方件选型（Tailwind v4 + shadcn/Base UI + `Db` 接口直写 PG SQL/无 ORM）、依赖清单、token 映射、M0–M4 细化任务、工时对照（14.5→9.8 人日）。**注**：文中早期临时选型话术已被 [standardize-node-postgres 决议](decisions/2026-08-28-standardize-node-postgres.md) 取代 |
| `design/payload-cms-evaluation.md` | 调研（**已结案 2026-08-28：全量接入否决**，见决议 D5）：Payload CMS 适配性评估——业务诉求复核、硬约束清单、A/B/C/D 方案空间与判定矩阵、复审触发条件 |
| `design/deployment.md` | ★容器化部署与运维：服务划分、镜像依赖、端口/卷/环境变量、三环境（dev/test/prod）构建启动日志回滚、健康检查、日志采集、数据持久化与备份 |
| `design/admin-guide.md` | 管理员指南：admin 三端点 / 审计账本模型 / CLI / 数据备份还原 |
| `design/user-manual.md` | ★用户使用手册：启动/四通道姿势/发布/检索/use/回流/管理员（只写已上线功能） |
| `design/implementation-tasks.md` | ★开发实施任务清单：阶段零~四共 44 项（目标/模块/验收/人日/优先级/依赖/并行批次），含 S0 前置修红与关键路径图 |
| `design/agent-dev-paradigm.md` | ★Agent 开发范式：五阶段闭环、动码四硬规、手册随行矩阵、双读者写作标准、PR 自查清单、多 Agent 并行约定 |
| `design/management-ui-spec-v1.md` | ★本地 Web 管理界面设计规范 v1（UI 真源：三态 A/B/C + 组件 + 文案表 + tokens + 验收清单） |
| `design/local-engine.md` | ★本地技能引擎 canonical：四命令 / MCP 九工具 / 引擎模块 / 交付三通道与接线矩阵 / 参数链 / 双指标 / 目录布局 / 测试与验收 |
| `design/maintenance-cheatsheet.md` | ★维护速查表：30 秒目录定位、五张变更配方（端点/迁移/CLI/UI/admin）、硬不变量、坑速查（症状→原因→修法）、外部触点 |
| `design/teamai-host-matrix.md` | ★TeamAI CLI（v0.22.0）调研 + 宿主矩阵对齐方案：三层能力拆解 · 9 宿主逐字路径事实表 · MCP 五格式族 · 三个坑（Hermes allowlist 双写 / OpenCode instructions glob / 不猜 MCP）· R1–R3 裁决（不采纳分发范式 · 抄宿主矩阵 Hermes 优先 · 反向可被订阅）· 提案 [host-matrix-alignment](../openspec/changes/host-matrix-alignment/proposal.md) |

### 图表 design/diagrams/
`architecture-panorama.html` · `minimal-loop-review.html` · **`runtime-architecture.html`（运行时架构 · 四通道同权）** · **`release-pipeline.html`（发布部署流水线 · lockstep 发版）** · `mockups/`（UI 设计稿 PNG ×54，已归档：2026-08-28 视觉推翻后不再是比对真源，仅作历史参考）

## 协议 v0.2（文件名为历史锚点）

`protocols/message-envelope.md`（信封 schema/kind/digest 三段式/origin/never 清单）· `protocols/api.md`（六端点含 GET /skills、signals 族、include=experience、注册两阶段、限频、watch 五条）

## 决议（一事一文）

| 主题 | 文件 |
|---|---|
| 定位与词汇 | pubsub-bus-repositioning · experience-layer-repositioning · brand-voice-and-vision · vocabulary-unification · open-source-strategy |
| 范围与模型 | mvp-scope · data-model-o3-final · think-gate-firewall-layers-milestones · value-prior-outcome |
| 接入与消费 | agent-access-host-agnostic · agent-onboarding-self-registration · agent-skill-distribution · skill-first-packaging · pull-based-consumption · **consumption-model-final（Use/Query/Follow 终稿）** · mcp-early-access · experience-anatomy-versioning |
| 形态与商业 | overseas-deployment · web-ia-gates-badges · commercial-model-minimal（反馈积分/企业调用/私有部署） |
| 工程与选型 | **2026-08-28-standardize-node-postgres（★现行运行时基线：Node ≥22.18 LTS + pnpm 10 + Postgres/node-postgres·无 ORM·`Db` 接口直写 SQL）** · **2026-08-28-lean-stack-adoption（瘦栈：禁成品库·许 headless+copy-in；Tailwind v4 + shadcn/Base UI）** · **2026-08-28-container-deployment（单服务起步·多阶段构建·三环境一套 compose·生产形态=单机 Docker Compose）** |
| 本地技能引擎 | **2026-09-02-skill-envelope（技能内部形式定档 + 与线上信封 v0.2 映射）** · **2026-09-02-mcp-sdk-consolidation（官方 SDK + 唯一 server 九工具面 5+3+1，修订 mcp-early-access）** |
| 本地能力面 | **2026-09-11-local-capability-plane（★定位扩展：**经验层 + 本地能力面**；外部生态作**可插拔适配器**；开放产物 + 开放扩展；不 Fork/不复刻 APM。✅ 已签发，**开发中**——执行计划见 [local-capability-plane/tasks.md](../openspec/changes/local-capability-plane/tasks.md)，由夜间四席定时流水线推进）** |

## 笔记与归档
`notes/red-team-v0.2.md`（五案结案）· `notes/2026-08-28-pi-research.md`（pi 调研：盟友判定+借鉴清单）· `notes/2026-08-27-minimal-validation-path.md`（72 节输入源）· `notes/2026-08-28-implementation-plan-codex-v1.md`（历史 Codex 方案归档）· **`notes/2026-09-09-semantic-router-evaluation.md`（外部输入：aurelio-labs/semantic-router 评估——结论不引入，但照出 Think Gate「判声明不判内容」缺口，已预登记 Experiment 004）** · **`notes/2026-09-10-skill-management-landscape.md`（外部输入：分层 Skill 管理构想件 + xingkongliang/skills-manager 调研——结论不引入形态，吸收 install⇄deploy 分离 / provenance / 反向可见 / 更新跟踪四点；**照出缺口：经验落库 ≠ 宿主可见**，立提案 [host-integration](../openspec/changes/host-integration/proposal.md)）** · **`notes/2026-09-11-mcp-hosting-management-trio.md`（外部输入：mcp-gateway / skills-manager / mcphub 三件套——不自建网关·落法 = 外挂兼容；差异位 = fork 远程 Agent 临时执行环境；**已勘误「断裂已接通」的误判**，与 host-integration 串成依赖链，打通记录见 `.workbuddy/memory/2026-09-11.md`）** · **`notes/2026-09-11-agent-skill-layered-management.md`（外部输入：Agent 分层 Skill 管理 + 按场景动态加载方案构想稿——2026-09-11 由根级按治理 §1 归档至此并纳入跟踪；逐条对齐现状见 [local-content-model](../openspec/changes/local-content-model/proposal.md) §八：**分层与渐进加载内核已基本落地，不采纳 MCP Gateway / pgvector**，需补 = 验证目标闭环 + 资源/脚本两级加载）** · **`notes/2026-09-11-microsoft-apm-evaluation.md`（外部输入：Microsoft APM（Agent Package Manager）评估——**结论：包清单与多宿主装载层已有主，且比我们设想完整**（`apm.yml` + `apm.lock.yaml` 含内容哈希/SBOM · **16 宿主矩阵** · `apm-policy` 策略继承 · fail-closed 安全默认）→ **不自造 `agents.json`**；真空白位 = **记忆下发同步 + 经验来源回流**）** · **`notes/2026-09-11-agent-platform-proposal-evaluation.md`（外部输入：《Agent 管理与开发平台（MVP→平台化）》方案评估——**顶层判断"APM 只作 Adapter、不 Fork"与我们的结论完全一致（强背书）**；可借鉴 5 条模型级设计（spec/status 分离 · 身份不绑易变物 · PackageProvider 签名 · 实体不混 · Workflow 只描述不执行）；**不适用 4 条**（Runtime Plane / Marketplace+六类 Registry / 无经验层 / 中心化平台假设）——照做会进「又一个 Agent 平台」红海）**

## 其他
`prompt-blueprint.md`（英文蓝本，词表同步）

规则：文档只进 docs/（根级豁免 README×2/LICENSE/CLAUDE.md）；过时内容删除或重写，不留旧话术；ADR 不回写按勘误注；定义变更按 glossary 治理规程**主动传播**；协议变更先立决议再改正文。
