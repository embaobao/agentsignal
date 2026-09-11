# 决议：本地能力面 —— 定位扩展与架构基线（local-capability-plane）

日期：2026-09-11 · 状态：**Accepted（2026-09-11 站长签发；P0 即刻开工，P5 与 P1 并行）** · 决策人：站长（zhumeng）
关联：[local-capability-plane 提案](../../openspec/changes/local-capability-plane/proposal.md) · [APM 全量评估](../notes/2026-09-11-microsoft-apm-evaluation.md) · [Agent 平台方案评估](../notes/2026-09-11-agent-platform-proposal-evaluation.md) · [local-engine.md](../design/local-engine.md)（canonical）
取代/归并：`local-content-model` · `mcp-service-exposure`（内容并入本线）

> **前置硬门**：本决议签发前**不动码**（承治理 §6「协议语义变更先落 decisions 再改正文」）。

## 背景与动机

1. **能力到不了 Agent**：平台经验能同步到本地库、能经 MCP 按需查，但**装不进宿主技能目录**——"我能查到" ≠ "我会用上"。且我们只有 **5 个宿主**（`wiring/hosts.ts`），外部生态已在 17（APM）/ 53（skills-manager）量级。
2. **装载层已有主**：`agentskills.io`（skill 格式）· `apm.yml`（包清单）· 官方 `server.json`（MCP 分发）· `MCP Apps`（UI 载体）。**skill / MCP / prompt / agent 定义**这一整层都有人做了。
3. **差异位唯一未占**：2026-09-11 调研遍及 APM · MAF · agent-spec · OASF · A2A · skills-manager · cc-switch · MetaMCP · mcphub · DSH · pi · ToolHive —— **没有一家有「经验层」（validation / verify / 回流 / 记忆）**。
4. **外部两次独立背书**：Microsoft APM 的评估与《Agent 管理与开发平台》方案**独立得出同一结论**——APM 只应作 Adapter，不应作底座。

## 裁决

### D1 定位扩展：经验层 + 本地能力面

从「Agent 自主学习基础设施（经验总线）」扩为：

> **AgentSignal = 经验层 + 本地能力面。**
> 经验层管「经验从哪来、有没有效、用得怎么样、值不值得传下去」（**差异位**）；
> 本地能力面管「能力怎么装到这台机器的各个 Agent 上」（**借用与整合**）。

**北极星不变**（一个真实的 Agent 是否愿意长期订阅一个 Space 并依赖收到的信息做事）——本扩展是补齐其最后一公里。

### D2 不重造装载层；外部生态作可插拔适配器

- **不 Fork APM、不复刻 APM**（实测：169k 行 · 1000+ 测试 · 242KB 规范 · 每周一小版含 BREAKING）
- **不自建第二个包管理器**
- **APM 作为适配器存在**；适配器集合：`native` · `apm` · `pi` · `dsh` · `社区贡献`

### D3 开放产物 + 开放扩展

| APM 原则 | 处置 |
|---|---|
| P1 不发明私有 frontmatter；产物零工具可读 | ✅ **保留** |
| P2 宿主需用户量门槛，不追长尾 | 🔴 **反转** —— 长尾宿主全收 · **宿主可插件化** · **对社区开放贡献** |

### D4 包模型与清单

- **三类包**：技能包 · MCP 包 · Agent 包（前两者的组合 + 规则/人格 + 提示词注入段）；**记忆仅预留 optional 段**（独立立项）
- **清单两份**：包自带声明（**对齐 `apm.yml`**）+ 本地留痕账（**只记"委托记录 + 委托快照"**，实际状态归适配器自报）
- **扩展用一个独立的兼容 JSON 文件**（不污染标准清单；**开放段设计，给后续扩展留口子**）

### D5 适配器接口与三条规则

- **接口两段**：`PackageSource`（`resolve` / `fetch`）+ `CapabilityAdapter`（`probe` / `capabilities` / `hosts` / `deploy` / `remove` / `reconcile`）
- **规则一 能力门控**：`capabilities()` 未声明的操作**不得调用**（实测反例：APM **没有 `remove`**，删依赖 = 手改 `apm.yml` + `apm prune`）
- **规则二 归属锁**：一个宿主 + 一个能力，**同一时间只允许一个适配器管**
- **规则三 归属记账**：只记委托 + 快照；**`reconcile()` 是硬要求**（否则账本失效）
- **优先级**：用户声明 > 原生适配器

### D6 引用方式：按包记录，不强行统一

- **native 用 symlink**（更新自动跟随）· **apm 用 copy**（APM 把宿主目录定义为构建产物，且实测为真实文件副本）
- **账本必须记 `mode: link|copy`**；**对账按 mode 分别解释**（避免两套口径打架）

### D7 接入形态与界面载体

- **pi / dsh 双轨**：既做适配（宿主写入器），**也做成其插件**（pi extension / `dsh plugin add`）——后者白拿两条分发通道
- **pi 的 `setActiveTools()`** 作为运行时动态加载的参照（我们缺的能力）
- **管理界面**：MCP Apps 为主 + **网页版兜底**；**支持名单不硬编码，运行时探测**（官方名单未能确证 Cursor / Gemini / Codex）

### D8 明确不做（防膨胀锚，定位级）

企业策略继承 · SBOM/SPDX 导出 · 变异测试 · **自有 registry / marketplace** · CI gating · 插件市场运营 · **Agent Control Plane** · **Gateway / Scheduler / Runtime Manager / Workflow Executor** · 六类 Registry 体系 · K8s 路径 · 微服务拆分 · **自建 Agent 定义标准**（已有 `oracle/agent-spec`）· 自建 Prompt / Workflow 执行器

### D9 归并与前置

- `local-content-model`（内容模型）与 `mcp-service-exposure`（MCP 暴露）**归档**，内容并入 `local-capability-plane`
- 在册 `host-matrix-alignment` · `host-integration` **保留**（成为本线的 P2/P3 落地）

### D10 总纪律：尽量支持，不支持的全兼容（三档降级阶梯）

**任何能力 × 任何宿主**，落地分三档：

| 档 | 条件 | 落地方式 |
|---|---|---|
| **L1 原生** | 宿主有该能力位 | 写进宿主原生位置（技能目录 / rules / hooks / MCP） |
| **L2 按需** | 无能力位，但有 MCP | 经我方九工具按需可达（`search_skills` / `load_skill_detail`） |
| **L3 兜底** | 两者皆无 | rules 写一行提示 |

**四条硬约束**：
1. **降到底仍有档** —— L1→L2→L3 逐级下探，**取不到任何一档才允许报错**
2. **降级必须可见** —— `status` 呈现「某能力在某宿主落在第 N 档 + 原因」
3. **降级不得改变语义** —— 不许让 Agent 以为"我没有这个能力"
4. **不静默丢弃** —— 跳过宿主 / 丢弃字段一律告警（沿用 APM 实测的 `Skipped ... / keys were dropped` 做法）

→ 完整降级矩阵见 [design.md §一](../../openspec/changes/local-capability-plane/design.md)

## 影响

- **文档**：`AGENTS.md`（定位 / 当前阶段）· `docs/design/local-engine.md`（canonical 升级）· `docs/design/glossary.md`（新术语登记：适配器 / 包 / 归属账本 / 记忆 · 并确定「能力面」的 canonical 名）· `docs/README.md` 索引
- **代码**：`packages/cli/src/capability/`（新）· `wiring/`（宿主注册表扩长尾）· `packages/protocol`（清单扩展）· `packages/wizard-ui`（界面）
- **协议**：REST 端点 · 九工具面 · 信封语义 **零变化**
- **`apps/api`**：本决议**全程零触碰**（经验层的验证聚合/回流归既有 `user-domain-completion` 与后续提案）
- **排期**：见 [tasks.md](../../openspec/changes/local-capability-plane/tasks.md)

## 未采纳（记录不偷跑）

- Fork / 复刻 APM（领域不匹配 · 跟不动上游）
- APM 作为底层核心（被 package model 限制）
- Agent Control Plane / 六类 Registry / Marketplace（`product.md` 无插件市场红线 + 进红海）
- 引入 A2A（第一版）
- bun / rust 混合栈（撞 [standardize-node-postgres](2026-08-28-standardize-node-postgres.md) D1）
