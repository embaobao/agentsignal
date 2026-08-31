> **结案（2026-08-31）**：三链路后端 + P3/P5 UI 七屏已全部落地并入 main（e2e 21/21）；
> 视觉前提（v4 设计稿 54 张）已被 08-28 `minimal-redesign-ollama`（v5 中性色板）推翻，UI 已按 v5 落地。
> 剩余事项移交：GitHub OAuth（C9）另立小提案；D1/D5 人工对稿在任务台账跟进。本 change 归档。

# 提案：设计驱动 UI + 三链路最小闭环

> 配套 openspec change 元数据：`.openspec.yaml`
> 详细提案书（含里程碑/技术栈/风险）：`docs/design/design-driven-proposal.md`

## 一句话提案

用 v4 设计稿（/design/ 54 张）为唯一视觉真源，按 P3（5 屏，第一眼过关）→ P5（8 屏，全链路可走通）两阶段交付前端 SPA，同时对齐后端「分享 → 检索 → 构建发布」三链路端点，确保设计稿 → 代码的 1:1 可追溯。

## 问题描述

- 当前 `apps/api/ui.html` 是 80 行的极简原型，没有三栏、没有主题、没有设计稿签名，与真实视觉方案差 ≥ 90%。
- 既有 publish-query-build change 是协议级变更，**没涉及设计驱动的 UI 交付**。
- 设计稿/信息架构/提示词文档已经定稿，但没有一份「设计 → 代码」强绑定的实施提案。

## 影响

- **新增 apps/ui/**：Vite + TS strict SPA（50+ 组件，8 页）。
- **改造 apps/api/**：端点从单文件骨架扩展为 10+ 端点（三链路 + 鉴权 + 身份）。
- **追加 packages/protocol**：UI 扩展字段 + `ags_` token 前缀。
- **文档对齐**：所有 hero 文案/设计语言引用 `ui-blueprint-prompt.md` 单一真源（已在本提案前完成 4 份文档同步）。

## 范围（P3 与 P5 的交付边界）

### P3 — 5 屏 / 2 周（第一眼过关）
01 首页 · 02 分区列表 · 03 详情 · 07 空态/骨架 · 08 加载态
### P5 — 8 屏 / 再 2 周（全链路闭环）
+ 04 发布向导三步 · 05 GitHub OAuth 登录+身份 · 06 ⌘K 全局命令 · 07 404/401 插画页

完整里程碑/裁决点：`docs/design/design-driven-proposal.md §三`

## 不做（P5 之前不碰）

- watch/SSE 实时推送
- 声誉系统 / outcome 聚合
- 数据库 PostgreSQL（P3/P5 文件存储，见 backend-architecture §三）
- 审计还原（独立模块 openspec/changes/audit-restore，P5 之后 Phase 1B）
