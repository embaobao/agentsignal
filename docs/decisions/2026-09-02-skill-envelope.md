# 决议：本地技能信封 —— 内部形式定档（2026-09-02）

来源：[skill-engine 提案](../../openspec/changes/skill-engine/proposal.md)（裁决 2/12/13）· 本文与 [mcp-sdk-consolidation 决议](2026-09-02-mcp-sdk-consolidation.md) 同批落地。

## 背景

本地技能引擎（CLI + MCP）需要一个可管理的技能单元形式。团队已有两套「skill」心智：

1. **Agent Skill**（宿主侧）：可安装、动态版本化的宿主技能（[skill-first 决议](2026-08-27-skill-first-packaging.md)）；
2. **Skill（叙事语境）**：对外叙事中 skill = Signal(kind=solution) 的通俗称呼（[agent-native 叙事决议](2026-09-02-agent-native-repositioning.md)），不是新实体。

本地引擎需要第三种：**引擎内部的管理形式**。

## 裁决

**本地技能以「skill.json5 + SKILL.md」二元组管理（复用 skills 包形式），schema 真源 = `packages/protocol/src/skill-schema.ts`。**

1. **内部形式，不进用户心智**：该二元组只存在于 `~/.agentsignal/skills/<id>/`，用户命令面（init/mcp/status/uninstall 四命令）、user-manual、向导 UI 文案 **skills 概念零出现**（设计规范 §0 红线 5）。对用户只说「能力 / 指引 / 经验」。
2. **Frontmatter 六字段必收**：`id` · `name` · `description` · `domains` · `layers` · `triggers`（详见 skill-schema.ts zod 定义）；AgentSignal 扩展字段（keywords / auto_load / max_tokens / parameters / depends / stack_rules / lifecycle）全部 optional 安全默认。
3. **与线上信封 v0.2 的映射（Phase 3 预留，本提案不实现）**：

| 本地 skill.json5 | 线上信封 v0.2 | 方向 |
|---|---|---|
| `lifecycle.provenance`（sig_id / digest / origin） | `sig_<ulid>` 信封头 | 订阅 `kind=solution` 落盘时写入，溯源不丢 |
| SKILL.md 正文 | `experience.body`（四节模板） | 订阅落盘 = use 的持久化形态 |
| `verify_skill` 本地 verdict | `POST /signals/:id/verify` | Phase 3 回传平台聚合 |

4. **provenance 留位纪律**：store 落盘保留 `lifecycle.provenance` 字段位（不填充），接 watch 链路零迁移。
5. **命名约束**：本地引擎语境不引入新架构名词（无「网关」），概念收敛为「技能（Skill）· 内部形式」一词，登记 [glossary](../design/glossary.md)。

## 影响

- `packages/protocol/src/skill-schema.ts` 为唯一 schema 真源（thin-stack 全栈同构条款）。
- user-manual / admin-guide 文档随行时执行 skills 零出现检查（user-manual）；admin-guide 可写 `~/.agentsignal` 布局（管理面可见）。
- 不修改线上信封 v0.2、api.md、message-envelope.md 的任何语义。
