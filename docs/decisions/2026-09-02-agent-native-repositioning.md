# 决议：Agent 原生叙事升级 —— 从「共享经验层」到「Agent 自主学习基础设施」

- **日期**：2026-09-02
- **状态**：Approved（站长 2026-09-02 口头令「更新整体项目叙事」）
- **上位关系**：修订 [brand-voice-and-vision](2026-08-27-brand-voice-and-vision.md) 与 [pubsub-bus-repositioning](2026-08-27-pubsub-bus-repositioning.md) 的**品类叙事层**；不动 L1 技术定位（A pub/sub signal bus）、不动协议 v0.2、不动北极星问题
- **输入**：[v2 战略提案（notes 归档）](../notes/2026-09-02-v2-strategy-agent-native.md)

## D1 · 品类定位（本次唯一采纳项）

对外叙事在「共享经验层 / Give your agent a memory」之上叠加**品类层**：

> **AgentSignal 是 Agent 自主学习基础设施**（*The agent-native learning infrastructure*）——
> 现有全部竞品（skills.sh、Agensi、skillsync、Portkey、Smithery）假设「人类选 skill → 安装给 Agent」；
> AgentSignal 假设「**Agent 自己发现、学习、验证、沉淀**」。
> 一句话：别人做 App Store for humans，AgentSignal 做 Nervous System for Agents。

三机制框架（对外解释用，非新原语）：

| 机制 | 已有实体 |
|---|---|
| 记忆外化 | signals 信封 + topics 订阅 + /me 沉淀 |
| 能力路由 | watch（规划未建→P1 提级）+ kind 分层 + triggerConditions（信封 v0.3，另立决议） |
| 经验验证 | verify 三选 verdict + verify_logs 审计 + verify 聚合展示 |

## D2 · 边界（防止叙事漂移，呼应 product.md 危险信号自查）

1. **skill ≠ 新实体**：对外语境的「skill」= Signal(kind=solution) 的通俗称呼；公开 skill 注册表是 `GET /skills` 过滤视图，**不建第二张表**（同 Space 永不实体化同理）。
2. **`POST /skills/from-signal` 语义** = 私有 signal → 公开 visibility 的状态迁移，非转化生成。
3. 叙事升级**不改协议字段**：triggerConditions（信封 v0.3）属协议变更，另立决议后再动 envelope/protocol 包。

## D3 · 验证指标升级（Agent 行为指标）

在原人类指标外新增五项：Agent 自主查询率（MCP search_skills 调用）· 运行时加载率（use→执行）· 验证回传率（verify_logs 写入）· Skill 进化率（verdict 时间序列）· 订阅活跃度（watch 连接日志）。入 [validation.md](../design/validation.md) 度量口径。

## D4 · 传播义务链（本次当场完成）

ADR → AGENTS.md 定位块 → product.md（定位块/一句话定位/生态位）→ README×2 Hero → docs/README 索引行 → notes 归档状态更新。

## D5 · 明确不在本次范围（待站长逐条裁决，提案见 notes 归档附录）

- apps/docs（Docusaurus 3）放弃与否 · Scalar 迁移与否 —— 与 user-domain-completion 已批准裁决冲突，维持原裁决至另立 ADR
- human-auth-providers 冻结 —— 维持排队地位
- 视觉 v5.1 降级、T3–T5 延后 —— P2 项，随 Testnet 排期自然后移

## D6 · 路线图锚定

Creds 收官（本周）→ **M4 Testnet 验证（下周，封版只修 P0）** → Testnet 通过后按 notes 提案 P0 清单开发（MCP search_skills 优先）。
