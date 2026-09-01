# 文档公开分级规范（Publishing Policy）

> 状态：**生效（2026-08-31）** · canonical 定义见 [reuse-boundary 决议](decisions/2026-08-31-reuse-boundary-and-public-docs-site.md) D4。
> 用途：`apps/docs` 公开文档站的**唯一内容闸门**。构建脚本 `apps/docs/build-from-policy.mjs` 直接解析本文件的「二、名单」章节——**不在名单里的文件进不了站点**，新增 md 入站必须先改本表。变更后 grep 验证义务同步覆盖本文件。
>
> 机器可解析约定（改本表时请遵守，否则装配脚本报错）：
> - 章节标题形如 `### P0 …` / `### P1 …`；`P2/P3` 小节的内容一律不入站
> - 条目以 `-` 起行，反引号内写仓库相对路径；目录以 `/` 结尾（如 `docs/business/`）表示整目录裁定
> - 需要把内部文档的某小节嵌进公开页时，行尾加标记：`` <!-- include: 源文件 ## 章节标题 → 宿主公开页 --> ``（多个用逗号分隔；不写标题则抽全文）

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

- `docs/protocols/api.md` [公开:豁免] —— REST 契约叙述文（机器契约由 API 参考页吃 `openapi.json` 渲染，两边不重复维护）。文中「M4 起开放自注册」是写进对外契约的**启用条件**、属能力声明而非内部排期，故整体过清洗门豁免
- `docs/protocols/message-envelope.md` [公开:豁免] —— 信封 v0.2 规范
- `packages/skills/participant/SKILL.md` —— 接入总入口活体（与 CLI 命令面 lockstep，见 AGENTS.md 治理条款 9）
- `apps/docs/pages/` —— 站点手工维护的公开页（快速开始 / 架构总览 / FAQ / 选型说明），装配时拷入内容区

### P1 工程叙述（入站 · 装配时逐条过清洗门）

- `docs/design/architecture.md` [公开:豁免] —— 只抽已上线的机制章节进架构总览页；含里程碑排期的段落不进站 <!-- include: docs/design/architecture.md ## 总体数据流, ## Token Firewall 三层归属, ## Watch / Pull 行为规范, ## 接入层（宿主无关）, ## 数据库 Schema（冻结版）, ## 日志事件, ## 安全基线 → apps/docs/pages/architecture-overview.md -->
- `docs/design/backend-architecture.md` [公开:豁免] —— 后端结构与请求路径
- `docs/design/experience.md` [公开:豁免] —— 体验包形态（协议侧概念）
- `docs/design/product.md` [公开:豁免] —— 产品定位与核心命题（对外叙事本就公开）
- `docs/design/glossary.md` [公开:豁免] —— 术语唯一权威源
- `docs/design/onboarding.md` [公开:豁免] —— 接入引导
- `docs/design/user-manual.md` [公开:豁免] · `docs/design/admin-guide.md` [公开:豁免] —— 使用者与管理员手册
- `docs/design/stability.md` [公开:豁免] —— 退避/幂等/游标等行为承诺

### P1b 装配后校验（清洗门的第二道闸）

上面若干条目打了 `[公开:豁免]`——那是**对源文件全文**的豁免，不是对站点产物的放行。装配完成后脚本会重新扫一遍入站产物：命中残留词即构建失败，并指出是哪份文档的哪一段需要改写或从 policy 名单撤下。豁免只允许用于「已实现的运行时/工具名」这类中性提及（Node、Fastify、Postgres、Turborepo），不允许用于未落地排期或商业判断。

### P2 运营手册（不入站：防复制部署）

- `docs/design/deployment.md` —— 部署拓扑、发版流水线、平台配置
- 根 `Dockerfile` · `Caddyfile` · `docker-compose*.yml` · `scripts/` —— 同一理由：仓库内可见（MIT 授权），但站点不汇编成"照着敲就能起"的教程
- `docs/prompt-blueprint.md` —— 内部提示词资产

### P3 内部资产（不入站）

- `docs/design/roadmap.md` · `implementation-tasks.md` · `validation.md` · `proposal.md` · `design-driven-proposal.md` · `audit-restore-proposal.md` · `participant-skill-redesign.md` · `payload-cms-evaluation.md` · `lean-stack-implementation-plan.md` · `value-signals.md` · `web-ia.md` · `ui-blueprint-prompt.md` · `frontend-architecture.md`
- `docs/decisions/` —— **全部不公开**（含商业模型与竞品情报；开源≠摊出底牌，站长裁决 2026-08-31）。对外解释技术选型走 `docs/public/why-we-chose-so.md`，讲结论不讲过程
- `docs/notes/` · `openspec/` · `solutions/` · `discussions/` · `templates/` —— 归档输入与内容工作区

## 三、例外与升格流程

1. 升格 = 把文件从下级名单移到上表并同 PR 在 apps/docs 侧边栏登记；P2/P3 → P0/P1 需站长批准。
2. 降级立即生效：任何 P0/P1 文件若后续掺入未落地规划或部署细节，先移出站再修文。
3. 争议时以本表为准；本表未覆盖的新路径，默认 P3（白名单制，非黑名单）。
4. **P1 入站清洗义务**：架构类文档进站点前必须删净进程编排、端口、环境变量名、云厂商与实例规格；只留能力与机制叙述。清洗由执行 agent 当场完成，不得带内部残留上线。

## 四、实时性护栏（与 G1–G3 同族纪律）

- CHANGELOG 由 changesets 生成 → CI 构建 docs 时直接读取包目录，禁止复制粘贴版本日志。
- CLI `--help` 输出注入 `apps/docs` 的手册页（脚本生成），CI 断言一致——CLI 命令面变更未同步即红灯（对齐 AGENTS.md 治理条款 9）。
- OpenAPI 参考页数据源固定为根 `openapi.json`（`pnpm openapi` 导出物）；docs 站构建前强制重跑该命令。
