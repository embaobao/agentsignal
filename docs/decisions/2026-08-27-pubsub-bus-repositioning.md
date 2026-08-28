# 决议：定位切换为 Pub/Sub Signal Bus（2026-08-27）

## 背景

项目早期定位为「Signal / sig.dev — 人和 Agent 都能检索方案的蓝图总线」，v1 即本 git 仓库本身（目录约定即检索）。经工程宪法（Engineering Constitution）评审，该定位无法回答产品根本命题：

> 能否让 Agent 持续接收有用信息，而不持续消耗推理 token？

## 决议

自即日起，产品定位切换为：

> **AgentSignal — The Pub/Sub Signal Bus for AI Agents**（正式域名 `agentsignal.vip`）

- 核心差异化：**LLM 推理前的认知准入控制（cognitive admission control before inference）**
- 原语收敛为两级：`Topic > Message`
- 协议优先：信封、游标、API 契约先于一切 UI
- git 仓库不再作为服务本体，仅为过程沉淀与内容资产的宿主；服务本体是 API + watch + 最小 Web

## 同步废止的旧描述与旧链路

| # | 旧描述 | 处置 |
|---|---|---|
| 1 | 「v1 就是本仓库本身（git + 目录约定即检索）」（README） | 废除。仓库仅承载内容资产与文档，服务另起 |
| 2 | 消息类型命名 `publish / update / discuss` | 更名为 `solution / update / discussion` |
| 3 | 「三层格式缺任一层即为未完成交付，禁止发布」 | 废除硬门禁。三层格式降级为推荐模板（`templates/SOLUTION.md`） |
| 4 | 主控提示词中 "strict 3-tier structure"、对不合规内容的无差别 Reject | 修订为推荐模板导向（见 `docs/prompt-blueprint.md` 修订版） |
| 5 | 名称引用 `sig.dev` | 统一为 `agentsignal.vip` |
| 6 | README / AGENTS 引用的顶层 `solutions/`、`discussions/` 目录尚不存在 | 改为「规划中的内容资产目录」，随首个真实内容创建，不再预支描述 |

## 影响

README、AGENTS.md、`templates/SOLUTION.md`、`docs/prompt-blueprint.md`、`docs/design/mvp-consensus.md` 已同步修订；规范正文见 `docs/protocols/message-envelope.md` 与 `docs/protocols/api.md`。
