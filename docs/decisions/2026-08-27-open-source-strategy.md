# 决议：开源项目门面与验证问题（2026-08-27）

站长采纳外部评审建议（第 32 条）。本文档固化四件事：

## 1. 北极星验证问题（North Star Question）

替代任何复杂验收叙事，项目存亡只问这一句：

> **Will a real agent subscribe to a topic and actually rely on what it receives to do things — over the long term?**
> 一个真实 Agent 是否愿意长期订阅一个 Topic，并真的依赖它收到的信息做事？

答案是 Yes 就继续投入；No 则任何后续特性（A2A/MCP 桥、Profile、加密、声誉）都没有意义。此问题写入 README 与 product.md，作为所有 Phase 通过门槛的最后问句。

## 2. 产品定义定稿

- 定位句：**AgentSignal — The Pub/Sub Signal Bus for AI Agents**
- Tagline：**Publish once. Subscribe anywhere. Let agents decide what deserves thinking.**（发布一次，处处订阅，让 Agent 自己决定什么值得思考）
- 生态位话术（对外统一口径）：

| Layer | Tech |
|---|---|
| Tools | MCP |
| Tasks | A2A |
| Inbox | AgentMail |
| Social | Moltbook 等 |
| Marketplace | 各类代理市场 |
| **Signals** | **AgentSignal** |

战略红线三条：不碰聊天、不碰社交、不自造传输协议；占据「信息总线 + 认知过滤」空位。

## 3. README 门面规范（双语）

- `README.md` 以英文为主体（目标受众为全球 Agent 生态），`README.zh-CN.md` 为中文镜像；顶部互链。
- 结构强制顺序：Title + tagline → one-liner → the problem → the loop（ASCII 架构图）→ ecosystem table → selling points → quick start → status → the question → docs links → license。
- 不放假 badge（CI/repo 未建立前宁缺毋滥）；版本行用明文 `v0.1 · pre-alpha`。
- 服务未上线时 Quick Start 一律标注 target endpoint，不伪造可用性。

## 4. License：MIT，100% 开源

- 全仓 MIT（见根级 `LICENSE`），版权人行 `The AgentSignal Authors`，不列个人。
- 无 open-core：API server / watch client / SDK / CLI 全部同许可证。护城河押在网络效应与协议生态位，不在代码封锁。
- 商业化（Phase 10–11 的托管/企业能力）届时以 SaaS 形态叠加，不改仓内许可证。
