# 任务拆分 — host-integration

> 状态：**Draft v1（2026-09-10 建档待批）**
> 依赖：**host-matrix-alignment Phase 1/2**（宿主矩阵 9 宿主 + skillsPath 能力位对齐后才进 Phase 1；在此之前不抢跑）
> 纪律：测试随行（node:test 单口径）· 账实同步（AGENTS.md §10）· 只碰 agentsignal 自己条目（规范 E-10）· 协议零变化 · 零触碰 apps/api · 不新增命令 / 工具
> 红线速查见 [proposal.md](proposal.md) §二

## Phase 0 · 协议先行与设计（约 0.5 人日）

- [ ] 0.1 decision 落盘：`2026-09-XX-host-skill-install.md`——「装载 ≠ 接线」的能力边界、symlink 优先与 copy 回退、准入模型（validation × 启用 × 上限）、归属与卸载对等语义
- [ ] 0.2 schema 扩展（`packages/protocol/src/skill-schema.ts`）：`HostBindingSchema` 增 `skills_installed`；`SyncStateSchema` 增 `install { enabled, hosts, min_validation, max_installed, mode }`——全部 optional + 安全默认（旧 config 零破坏）
- [ ] 0.3 `HostDef` 扩位设计：`skillsPath` / `skillLayout`（目录式），无把握宿主显式 `null`（不猜纪律）
- [ ] 0.4 [design.md](design.md) 落盘（**建档时已完成**）：分工边界 D1–D8 · schema 改动 · 各宿主落地规格 · 对账五态 · 测试计划 · 风险兜底

## Phase 1 · 装载器与卸载对等（约 1 人日，第一验证）

- [ ] 1.1 `wiring/installer.ts`：`mountToHost`——symlink 优先，跨卷/Windows 回退 copy；tmp+rename 原子写；只写 agentsignal 条目
- [ ] 1.2 `unmountFromHost`：只删 config 记账内条目
- [ ] 1.3 `uninstall` 联动：摘除全部落地条目，宿主目录零残留（外来条目绝不动）
- [ ] 1.4 测试：symlink/copy 双模式 · 归属标记 · **卸载不残留** · 外来条目不动 · 跨卷回退
- [ ] 1.5 端到端（夹具）：落库一条 → 装到宿主 → 宿主目录出现 `SKILL.md` → 卸载后消失

## Phase 2 · 准入控制（约 0.5 人日，依赖 Phase 1）

- [ ] 2.1 `config.sync.install.enabled` 默认 **false**（升级不污染宿主 context）
- [ ] 2.2 落地集合 = `min_validation` × 用户启用 × `max_installed` Top-K；超额只提示
- [ ] 2.3 测试：默认关闭断言（开启前宿主目录零写入）· 阈值过滤 · 上限截断 · 旧 config 默认值

## Phase 3 · 反向可见与状态治理（约 1 人日，依赖 Phase 1）

- [ ] 3.1 对账器：扫描宿主 `skillsPath`（含外来条目只读）→ 三方对账，标 `active / outdated / revoked / missing / foreign`
- [ ] 3.2 更新联动：`synced_at` 变更 → symlink 零动作 / copy 重写；`revoked` 源自动摘除 + 记录
- [ ] 3.3 `status` 增行：「宿主落地 N · 待更新 M · 已失联 K」（不自动修复）
- [ ] 3.4 测试：五态对账断言 · revoked 自动摘除 · copy 模式更新重写 · status 输出快照

## Phase 4 · 管理界面（约 1 人日，依赖 Phase 2/3）

- [ ] 4.1 B 视图新增「宿主落地」区：按宿主分组 · 勾选装载/卸载 · 一键对账 · 外来条目只读展示
- [ ] 4.2 准入设置区：启用开关 + validation 阈值 + 数量上限 + 模式（symlink/copy）
- [ ] 4.3 产物护栏：单文件 HTML 零外部请求不破 · 界面文案无 skills 字样（沿用既有断言）
- [ ] 4.4 vitest：装载/卸载/对账交互 + 空态/满额态

## Phase 5 · 文档与台账（随各 Phase 同步，不单独排期）

- [ ] 5.1 `docs/design/local-engine.md` §5 接线矩阵增「④ 装载」通道 + §10 非目标注记更新
- [ ] 5.2 `docs/design/user-manual.md` 管理界面新区说明（只写已上线能力）
- [ ] 5.3 `docs/design/admin-guide.md` config 记账位说明
- [ ] 5.4 `docs/design/glossary.md`：如引入「宿主装载」概念则登记 canonical 指针
- [ ] 5.5 `docs/README.md` 索引登记本提案
- [ ] 5.6 台账勾选（[implementation-tasks.md](../../../docs/design/implementation-tasks.md)）+ AGENTS.md「当前阶段/剩余」节刷新（§10 账实同步，同 PR 完成）
- [ ] 5.7 **G1–G4 复核**：CLI 命令面零变化 → participant SKILL 无需改（若确无命令面变更，记「lockstep 不适用」）

## 记录不排期（本提案不做，备查）

- 53 宿主矩阵自建 —— 复用 host-matrix-alignment + skills.sh 生态出口
- Git 式多设备备份 / Preset 分组 —— skills-manager 的团队文件管理范式，真源不同不适用
- 常驻同步守护 —— 红线 3
- 运行时语义 Router / embedding 层 —— 见 [semantic-router 评估](../../../docs/notes/2026-09-09-semantic-router-evaluation.md)，归 Experiment 004

## 验收（Phase 1–4 完成后）

- [ ] 端到端：订阅一条 solution → 准入通过 → 装进宿主技能目录 → 宿主可原生发现 → 源更新 → 内容跟随 → 源 revoked → 自动摘除
- [ ] 「卸载不残留」硬断言：`uninstall` 后宿主目录无 agentsignal 条目，外来条目原样保留
- [ ] 默认关闭断言：未显式开启前，宿主目录零写入
- [ ] 三方对账五态全绿；status 新增行口径正确
- [ ] 既有 5（后 9）宿主接线回归无回退（init-e2e 绿）
- [ ] 协议零变化、命令面零变化、工具面零变化（红绿证据）
- [ ] 台账与 AGENTS.md 已同步（§10）
