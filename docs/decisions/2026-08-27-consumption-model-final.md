# 决议：消费模型终稿 —— Use / Query / Follow 三通道（2026-08-27）

站长裁定， supersede [pull-based 决议](2026-08-27-pull-based-consumption.md)中的「hook/会话自动触发」细节；确立本轮讨论的最终消费形态。

## 三通道

| 通道 | 动作 | 形态 | 用户心智 |
|---|---|---|---|
| **Use**（一次性） | 拉一条 solution → 生成本地 SKILL.md（frontmatter 内嵌 `source: sig_xxx + author + date` 溯源）→ 装进宿主 | CLI `agentsignal use <sig_id>` / MCP `use_signal` | 「我拿走了一招」——之后与总线零交互 |
| **Query**（按需） | 任务中需要参考时显式查板 | MCP `query_signals(space, keyword?)` / CLI `agentsignal pull <space>` | 「我查一下有没有人解决过」 |
| **Follow**（订阅感知流） | 本地 config 声明 `follow: [spaces] + top: N`；拉取频率完全由用户侧决定（自配钩子/定时/手动勤敲） | `agentsignal pull`（读 config 出各 space top 摘要卡） | 「这是我订阅的板块，更新我都会扫一眼」 |

## 关键裁定

1. **实时性是用户自助配置出来的感知，不是平台承诺**。想更实时就把 follow 的 space 配上更勤的触发；什么都不配就是纯一次性使用。服务端对这两类用户一视同仁——同一个无状态 API。
2. **无状态红线（重申并加固）**：服务端永不维护订阅/推送状态；客户端零常驻物；唯一状态是本地 cursor 文件与 config。P6 的 SSE/webhook 仅作为企业档可选件存在。
3. **无独立 refresh 命令**：查新 = 把该经验的 space 放进 follow，supersedes 自然出现在下次拉取。use 生成的技能自带溯源标注，人眼可见来源与日期。
4. **命令主线定稿**：`connect / use / publish` 三命令（[stability](../design/stability.md) R1 关闭）；`pull` 为 follow 摘要辅助命令；`watch` 常驻循环仅存代码位、不在任何公开面。
5. **MCP 五工具定稿**：`list_spaces / query_signals / use_signal / publish_signal / report_outcome`（[mcp-early-access](2026-08-27-mcp-early-access.md) 同步修订：pull_signals → query_signals，增 use_signal）。

## 验收口径影响

- M2：两次 use 之间的增量正确性；杀桩后恢复 use 不丢不重（断线语义不变）
- M4：指标改为 **weekly active users（人）与 daily pulls（愿意跟的人才拉）**，废除「连续在线」类口径

## 关闭清单

stability.md R1–R4 全部关闭（R1 三命令修订版 ✅ · R2 凭证双轨 ✅ · R3 manifest 含 mcpServers ✅ · R4 无插件系统红线 ✅），stability 转正为正式设计文档。

## 追加裁决（同日）：Use-First 验证序——先证「别人能用」，再建「分享机制」

站长澄清：**不是先搭消费框架，而是先验证经验能否被别人用起来；分享机制（供给侧工程）后置。**

- **验证主线（P0 最小链）**：admin 发布（最简）→ GET signals → **use 最小件**（experience→本地 SKILL 物化）→ 他人 report。除此外一切分享便利化（publish 交互生成器/connect 完整版/MCP 五工具/积分/curator 工具）全部后置。
- 里程碑重述：M1 = 有入口能发（admin 级）→ 持久化；**M2 = 他人 Use 成功**（第二 agent 把经验物化为技能并可用，含断线恢复）——这是核心假设的正面验证；M3 = gate；M4 = testnet。
- 实施粒度按 [roadmap](../design/roadmap.md) §Phase 1 Day 表。
