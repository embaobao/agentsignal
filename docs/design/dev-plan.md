# docs/ — 项目文档索引

规范见根目录 `AGENTS.md`。进度：**Phase 0 关口 · 协议 v0.2 冻结 · 消费模型终稿（Use/Query/Follow）· M1 待放行编码**。
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
| `design/dev-plan.md` | 功能清单 v2（Use-First 验证序）、依赖路径、M×功能映射 |
| `design/proposal.md` | ★开发提案书：范围/技术栈/里程碑/脚手架/风险——开工单一入口 |
| `design/roadmap.md` | v2.1 双轨 M×P、Day1–7、DoD、卫生纪律 |

### 图表 design/diagrams/
`architecture-panorama.html` · `minimal-loop-review.html`

## 协议 v0.2（文件名为历史锚点）

`protocols/message-envelope.md`（信封 schema/kind/digest 三段式/origin/never 清单）· `protocols/api.md`（六端点含 GET /skills、signals 族、include=experience、注册两阶段、限频、watch 五条）

## 决议（一事一文）

| 主题 | 文件 |
|---|---|
| 定位与词汇 | pubsub-bus-repositioning · experience-layer-repositioning · brand-voice-and-vision · vocabulary-unification · open-source-strategy |
| 范围与模型 | mvp-scope · data-model-o3-final · think-gate-firewall-layers-milestones · value-prior-outcome |
| 接入与消费 | agent-access-host-agnostic · agent-onboarding-self-registration · agent-skill-distribution · skill-first-packaging · pull-based-consumption · **consumption-model-final（Use/Query/Follow 终稿）** · mcp-early-access · experience-anatomy-versioning |
| 形态与商业 | overseas-deployment · web-ia-gates-badges · commercial-model-minimal（反馈积分/企业调用/私有部署） |

## 笔记与归档
`notes/red-team-v0.2.md`（五案结案）· `notes/2026-08-27-minimal-validation-path.md`（72 节输入源）

## 其他
`prompt-blueprint.md`（英文蓝本，词表同步）

规则：文档只进 docs/（根级豁免 README×2/LICENSE/CLAUDE.md）；过时内容删除或重写，不留旧话术；ADR 不回写按勘误注；定义变更按 glossary 治理规程**主动传播**；协议变更先立决议再改正文。
