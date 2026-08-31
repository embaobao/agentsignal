# docs/ — 项目文档索引

规范见根目录 `AGENTS.md`。进度：**协议 v0.2 冻结 · 三链路（分享/检索/构建发布）代码主体落地 · 运行时标准化 Node+pnpm+Postgres（2026-08-28）· 后端 review 加固与 MCP 五工具 server 已落地 · 待 D1/D5 人工对稿与 T3–T5 容器演练**。
定位：产品「The shared experience layer」· CTA「Give your agent a memory.」· 技术 L1「A pub/sub signal bus」。
**术语与功能定义唯一权威源：[glossary.md](design/glossary.md)**。

## 设计（活文档）

| 文件 | 说明 |
|---|---|
| `design/glossary.md` | ★术语表 + 功能注册表 + 治理规程 |
| `design/product.md` | 定位四件套、北极星问句、GitHub 教义、排除项（含插件市场红线） |
| `design/architecture.md` | 数据流、Token Firewall 三层、消费层（pull-on-demand）、工程框架、冻结 DDL |
| `design/experience.md` | ★经验唯一权威源：四节解剖、不可变+取代链、一生流程、服务端义务 |
| `design/stability.md` | 稳定性：三命令主线、凭证双轨、引用机制、无插件红线、失败矩阵、catch-up |
| `design/onboarding.md` | ⓪/skills 总入口、动态自更新、模板内建、宿主矩阵、时间预算 |
| `design/validation.md` | Experiment 001（宿主覆盖、五问、pass bar）、Experiment 000a 预留 |
| `design/value-signals.md` | 四层信号、outcome 五元组（artifact 必填）、Signal Graph |
| `design/web-ia.md` | 七屏首页、Signal 卡、Experience Record、Use=动作即命令 |
| `design/proposal.md` | ★开发提案书：范围/技术栈/里程碑/脚手架/风险（开工单一入口） |
| `design/roadmap.md` | v2.1 双轨 M×P、Day1–7、DoD、卫生纪律 |
| `design/ui-blueprint-prompt.md` | ★视觉真源 v5：单色极简 token/组件口径（ollama 式） |
| `design/frontend-architecture.md` · `design/backend-architecture.md` | 前后端架构（P3/P5）；选型条款待按瘦栈决议修订 |
| `design/lean-stack-implementation-plan.md` | ★瘦栈实施方案：三方件选型（Tailwind v4 + shadcn/Base UI + PGlite 直写 PG SQL）、依赖清单、token 映射、M0–M4 细化任务、工时对照（14.5→9.8 人日） |
| `design/payload-cms-evaluation.md` | 调研（已结案：全量接入否决，见决议）：Payload CMS 适配性评估——硬约束一票否决清单、S1–S5 时间盒实验、A/B/C/D 方案空间与判定矩阵，产出 ADR |
| `design/deployment.md` | ★容器化部署与运维：服务划分、镜像依赖、端口/卷/环境变量、三环境（dev/test/prod）构建启动日志回滚、健康检查、日志采集、数据持久化与备份 |
| `design/implementation-tasks.md` | ★开发实施任务清单：阶段零~四共 44 项（目标/模块/验收/人日/优先级/依赖/并行批次），含 S0 前置修红与关键路径图 |

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
| 工程与选型 | runtime-bun-first · skill-first-packaging · **2026-08-28-lean-stack-adoption（瘦栈：禁成品库·许 headless+copy-in；Tailwind v4 + shadcn/Base UI）** · **2026-08-28-storage-pglite（存储改用 WASM PostgreSQL；better-sqlite3 在 Bun 下 NAPI 崩溃实测）** · **2026-08-28-container-deployment（单服务起步·多阶段构建·三环境一套 compose·expand/migrate/contract 迁移）** |

## 笔记与归档
`notes/red-team-v0.2.md`（五案结案）· `notes/2026-08-28-pi-research.md`（pi 调研：盟友判定+借鉴清单）· `notes/2026-08-27-minimal-validation-path.md`（72 节输入源）· `notes/2026-08-28-implementation-plan-codex-v1.md`（历史 Codex 方案归档）

## 其他
`prompt-blueprint.md`（英文蓝本，词表同步）

规则：文档只进 docs/（根级豁免 README×2/LICENSE/CLAUDE.md）；过时内容删除或重写，不留旧话术；ADR 不回写按勘误注；定义变更按 glossary 治理规程**主动传播**；协议变更先立决议再改正文。
