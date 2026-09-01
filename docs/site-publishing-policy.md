# 文档公开分级规范（Publishing Policy）

> 状态：**生效（2026-08-31）** · canonical 定义见 [reuse-boundary 决议](decisions/2026-08-31-reuse-boundary-and-public-docs-site.md) D4。
> 用途：约束 `apps/docs` 公开文档站的收录范围。**新增 md 入站必须先过本规范**；变更后 grep 验证义务同步覆盖本文件。

## 一、四级分类

| 级别 | 含义 | 收录进 apps/docs？ |
|---|---|---|
| **P0 公开契约** | 对外承诺的协议与接入面，消费者是 Agent 与外部开发者 | ✅ 必须 |
| **P1 工程叙述** | 解释「为什么这样设计」的架构与机制说明，帮外部贡献者建立心智模型 | ✅ 收录（仅能力与机制层） |
| **P2 运营手册** | 面向站长的运维资产：部署拓扑、启动清单、平台配置、DR 预案 | ❌ 不入站（防复制部署） |
| **P3 内部资产** | 规划、台账、实验、架构决策过程、评估 | ❌ 一律不出站 |

### P1 的判定标准（三条全过才收）

1. **读者是外部开发者/贡献者**，不是站长本人。
2. **内容描述已上线的能力与机制**，不含未落地排期、里程碑日期、任务优先级。
3. **公开不损害竞争位**：讲清「系统能做什么、为什么这样组织」即可；具体基础设施选型、进程编排细节、密钥与环境变量清单、备份窗口一律属于 P2。

## 二、名单（按路径逐文件裁定）

### P0 公开契约（入站）

- `docs/protocols/api.md` · `docs/protocols/message-envelope.md` —— 协议契约叙述文（OpenAPI 机器契约由站点渲染器吃 `openapi.json`，不重复维护）
- `packages/skills/participant/SKILL.md` —— 接入总入口活体
- CLI / SDK / MCP 各包 `CHANGELOG.md`（changesets 生成，自动进站，零人工维护）
- `docs/adr/0001-pgvector-first.md` 等 **MADR ADR** —— 架构决策记录是开源项目的公共品，格式即社区惯例；与内部 `docs/decisions/` 严格区分（后者含商业判断，见 P3）

### P1 工程叙述（入站）

- `docs/design/architecture.md` —— 整体架构：三层格式、传输/认知分层、Token Firewall 归属。**入站前须清理**部署编排细节（Docker/Caddy 拓扑段）
- `docs/design/backend-architecture.md` · `frontend-architecture.md` —— 前后端结构说明，给贡献者看
- `docs/design/stability.md` —— 稳定性机制（退避/幂等/游标），属能力承诺
- `docs/design/experience.md` —— 体验包形态说明，协议侧概念
- `docs/design/product.md` —— 产品定位与命题（对外叙事本就是公开的）
- `docs/design/vector-search.md` —— 检索接口与启用说明（消费者是外部开发者）
- `docs/design/glossary.md` · `onboarding.md` · `user-manual.md` · `admin-guide.md` —— 已从 P0 名单并入本级语义（术语/引导/手册均为面向使用者的公开文档）

### P2 运营手册（不入站：防复制部署）

- `docs/deployment.md` · `disaster-recovery-plan.md` · `m0-launch-checklist.md` · `netlify-functions-m3-checklist.md` —— 部署拓扑、平台配置、启动清单
- 根 `Dockerfile` · `Caddyfile` · `docker-compose*.yml` —— 同一理由，仓库内可见但站点不汇编呈现

### P3 内部资产（不入站）

- `docs/design/roadmap.md` · `implementation-tasks.md` · `validation.md` · `proposal.md` · `design-driven-proposal.md` · `audit-restore-proposal.md` · `participant-skill-redesign.md` · `payload-cms-evaluation.md` · `lean-stack-implementation-plan.md`
- `docs/design/roadmap.md` · `implementation-tasks.md` · `validation.md` · `proposal.md` · `design-driven-proposal.md` · `audit-restore-proposal.md` · `participant-skill-redesign.md` · `payload-cms-evaluation.md` · `lean-stack-implementation-plan.md` · `value-signals.md` · `web-ia.md` · `ui-blueprint-prompt.md`
- `docs/business/**` —— 商业模型与客户名单，永不公开
- `docs/decisions/**` —— **全部不公开**（含商业模型与竞品情报；开源≠摊出底牌，站长裁决 2026-08-31）
- `docs/ai-memory-industry-brief.md` · `github-jina-feedcoop-agent-memory-experience-report.md` · `vector-database-market-report.md` —— 竞品与市场情报
- `docs/notes/**` · `openspec/**` · `solutions/` · `discussions/` · `templates/` 的内部样本

## 三、例外与升格流程

1. 升格 = 把文件从下级名单移到上表并同 PR 在 apps/docs 侧边栏登记；P2/P3 → P0/P1 需站长批准。
2. 降级立即生效：任何 P0/P1 文件若后续掺入未落地规划或部署细节，先移出站再修文。
3. 争议时以本表为准；本表未覆盖的新路径，默认 P3（白名单制，非黑名单）。
4. **P1 入站清洗义务**：架构类文档进站点前必须删净进程编排、端口、环境变量名、云厂商与实例规格；只留能力与机制叙述。清洗由执行 agent 当场完成，不得带内部残留上线。

## 四、实时性护栏（与 G1–G3 同族纪律）

- CHANGELOG 由 changesets 生成 → CI 构建 docs 时直接读取包目录，禁止复制粘贴版本日志。
- CLI `--help` 输出注入 `apps/docs` 的手册页（脚本生成），CI 断言一致——CLI 命令面变更未同步即红灯（对齐 AGENTS.md 治理条款 9）。
- OpenAPI 参考页数据源固定为根 `openapi.json`（`pnpm openapi` 导出物）；docs 站构建前强制重跑该命令。
