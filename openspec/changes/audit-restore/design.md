# 设计决策 — audit-restore

完整决策：`docs/design/audit-restore-proposal.md §四 ~ §九`。本文件列 MUST。

1. **账本永远追加（append-only）**：JSON Lines 按日滚动；链式 hash；hash 链坏 → 禁止一切还原操作。
2. **还原先 dry-run 再 apply**：CLI `restore` 默认 dry-run 输出 unified diff；必须加 `--apply` 才写，并且要求双签（单 admin 场景 env 豁免）。
3. **Snapshot 每实体 LRU 50 条**：Signal 写前先存快照；rev 单调 +1；还原=取 snapshot 覆盖，再追加一次 SignalRestored 事件（不得删旧 rev）。
4. **Verdict 状态机**：published/kept/amended/frozen/tombstoned 固定转移表；转移失败抛错（不静默）。
5. **Guardrail 默认 warn 不拦**：软约束精神——宁可格式脏一点，别拦真实经验。严格模式要管理员 `--strict` 单命令临时启。
6. **管理员 UI 不炫酷**：独立 `/admin/` 路径；HTTP Basic + Bearer ags_ admin flag 双保险；零框架，纯 HTML 表格。
7. **Token 不做还原**：Token 只存 sha256，无快照；还原=rotate 签发新的、老的一律作废（符合真实安全实践）。
