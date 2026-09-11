# 提案：本地能力面（local-capability-plane）—— 能力代理 × 适配器 × 经验层

> 状态：**Accepted（2026-09-11 站长签发，进入实施）** · 决策人：站长（zhumeng）
> 来源：2026-09-11 全会话（① Cloudflare 迁移评估 → ② 本地承载与验证 grilling → ③ Microsoft APM 全量评估 → ④ Agent 平台方案评估）
> 关联归档：[microsoft-apm-evaluation](../../../docs/notes/2026-09-11-microsoft-apm-evaluation.md)（13 节全量）· [agent-platform-proposal-evaluation](../../../docs/notes/2026-09-11-agent-platform-proposal-evaluation.md) · [mcp-hosting-management-trio](../../../docs/notes/2026-09-11-mcp-hosting-management-trio.md) · [skill-management-landscape](../../../docs/notes/2026-09-10-skill-management-landscape.md) · [pi-research](../../../docs/notes/2026-08-28-pi-research.md) · [local-engine.md](../../../docs/design/local-engine.md)（canonical）
> 在册关联提案：`host-matrix-alignment`（宿主矩阵）· `host-integration`（宿主装载 + 对账）
> **本提案三件套**：[proposal.md](proposal.md)（为什么 + 范围）· **[design.md](design.md)（实施细节 · 降级纪律 · 验收闭环终态）** · **[tasks.md](tasks.md)（长期开发计划）**
>
> ⚠️ **前置硬门**：本提案含**定位级变更**（`AGENTS.md` 的定位 / 北极星 / 排除项需改）。按治理 §6「协议语义变更先落 decisions 再改正文」——**须先落一份定位决议，再动正文与代码**。

---

## 一、为什么（核心主张）

### 1.1 现状：能力到不了 Agent 手上

```
平台经验 ✅ ──订阅同步──▶ 本地技能库 ✅ ──MCP 按需查询──▶ ❓
                                        ✗ 断裂
                             宿主技能目录（.claude/skills …）❌
```

**"我能查到" ≠ "我会用上"。** 且我们只有 **5 个宿主**（`wiring/hosts.ts`），而外部生态已在 17 个（APM）/ 53 个（skills-manager）量级。

### 1.2 差距：外部的装载层已经很成熟

| 层 | 谁占了 | 我们的状态 |
|---|---|---|
| skill 格式 | **agentskills.io** 开放规范 | ⚠️ 我们的 `SKILL.md` **没有 frontmatter**，不符合规范 |
| 包清单 | **Microsoft APM `apm.yml`** | ❌ 无 |
| MCP 分发清单 | 官方 **`server.json`** | ❌ 无（只写自己那一条） |
| MCP 聚合 | mcphub · MetaMCP | 明确不做 |
| 运行时框架 | MAF · ADK · OpenAI Agents SDK · LangGraph | 明确不做 |
| UI 载体 | **MCP Apps**（官方扩展） | ❌ 未接 |
| **经验层（验证/回流/记忆）** | **无人占位** | ✅ **我们的差异位** |

### 1.3 主张

> **不重造装载层，也不被它绑住。我们做「能力代理 + 可插拔适配器」，把外部生态当适配器接入；自己的力气全押在经验层。**

一句话定位（拟）：
> **AgentSignal = 经验层 + 本地能力面。** 前者管"经验从哪来、有没有效、值不值得传下去"；后者管"能力怎么装到这台机器的各个 Agent 上"。

---

## 二、红线

### 2.1 保留（承既有裁决）

| # | 红线 | 依据 |
|---|---|---|
| 1 | 九工具面不变；维护类能力不开 MCP 工具、不设用户命令 | skill-engine 裁决 12/13 |
| 2 | **无常驻进程**（默认按需拉起；能力可显式声明常驻） | dynamic-skill-management 红线 3 + 本 session 共识 |
| 3 | 零触碰 `apps/api` | skill-engine 裁决 6 |
| 4 | **Zero-LLM**（空闲零 token；分析与同步不得引入模型调用） | AGENTS.md 架构要点 |
| 5 | **写只碰自己的条目**；读可全量（含外来，只读展示） | E-10 + host-integration 红线 6 |
| 6 | 不引入微服务 / K8s / 消息队列 | AGENTS.md 排除项 |
| 7 | CLI 命令面变更同 PR 同步 participant SKILL（G1–G4 必绿） | AGENTS.md §9 |

### 2.2 **反转**（对 APM 的拒绝契约）

| APM 原则 | 内容 | 我们的处置 |
|---|---|---|
| **P1 不发明私有 frontmatter；产物零工具可读** | 开放条款 | ✅ **保留**（我们的产物也必须零工具可读） |
| **P2 宿主需用户量门槛，不追长尾** | 门禁政策 | 🔴 **反转** —— 长尾宿主（pi / workbuddy / dsh / Hermes / OpenCode …）全收，且**宿主做成插件**、**对社区开放贡献** |

> 定位口径：**APM = 开放产物 + 封闭扩展；我们 = 开放产物 + 开放扩展。**

---

## 三、领域模型（实体不混）

> 借鉴外部方案评估的 B4：**实体各自独立，只靠关系连接**。

| 实体 | 职责 | 现状 |
|---|---|---|
| **经验（Experience）** | 平台可共享的、带验证的知识单元（= `kind=solution` 的信号正文） | ✅ 已有 |
| **技能（Skill · 内部形式）** | 本地管理/检索形态 `skill.json5` + `SKILL.md` | ✅ 已有 |
| **记忆（Memory）** | **私有**状态，Agent 自己攒的（与经验区分） | ❌ 空白位 |
| **包（Package）** | 可分发的声明单元（清单 + 内容） | ❌ 无 |
| **适配器（Adapter）** | 把能力装进宿主的执行后端 | ❌ 无 |
| **宿主（Host）** | 被装载的目标 Agent / 编辑器 | ✅ 5 个 |

**关系**：

```
经验 ──物化──▶ 技能 ──打包──▶ 包 ──装载──▶ 宿主
                              ▲
                              └──委托── 适配器（native / apm / pi / dsh / 社区）

记忆 ──（可选）打包──▶ 包
```

**纪律（借鉴 B1/B2）**：
- **声明与观测分离**：任何实体都分「我声明是什么」与「它现在实际怎么样」（`skill.json5` vs `lifecycle.metrics` / `sync_state` 已有雏形，收敛为通用纪律）
- **身份不绑易变物**：技能身份 = `sig_id`（ULID）；**禁止**用路径 / 进程 / 端点当身份

---

## 四、包模型

### 4.1 三类包 + 记忆

| 包类型 | 内容 | 说明 |
|---|---|---|
| **技能包** | `SKILL.md`（+ `references/` `assets/` `scripts/`） | 对齐 agentskills.io |
| **MCP 包** | MCP server 声明（transport / command / url / env） | 对齐官方 `server.json` |
| **Agent 包** | 技能包 + MCP 包 + 规则/人格 + 提示词注入段的组合 | 一个包 = 一套环境 |
| （记忆 · **本提案只预留**） | 私有条目集合 | 单向下发；要改就 fork。**本提案只在清单里留 optional 段**，形态与同步机制独立立项（P6）——避免"包模型定死了但记忆还没想清楚" |

### 4.2 清单两份

| 账本 | 内容 | 位置 |
|---|---|---|
| **包自带声明** | 声明这个包装什么、装到哪 | 包内清单（对齐 `apm.yml`） |
| **本地留痕账** | 我们**委托了哪个适配器**、参数、时间 | 本地（**只记委托，实际状态归适配器自报**） |

### 4.3 ⚠️ 关键设计：产物层 / 本地层分离（同时满足 P1 与我们的检索需求）

```
产物层（出得去）  = 标准 SKILL.md + frontmatter           ← 零工具可读，符合 P1
本地层（留得下）  = skill.json5（layers / triggers / domains）← 私有增强，不进产物
```

---

## 五、适配器架构（本提案核心）

### 5.1 结构

```
本地客户端
  ├─ 能力代理（Broker）   决定"这件事交给谁做"
  ├─ 归属账本              只记"委托记录"
  └─ 适配器（可扩展接口）
       ├─ native   我们自己的装载器（覆盖长尾宿主：pi / dsh / workbuddy / Hermes…）
       ├─ apm      spawn `apm`（17 宿主 + MCP 管理 + runtime 管理 + 审计）
       ├─ pi       pi extension 形式（待定，见开放问题）
       ├─ dsh      对齐其插件机制（`dsh plugin add` / `dsh.bundle`）
       └─ 社区     开源贡献（这是"开放扩展"的兑现）
```

### 5.2 接口定稿（两段合一）

```ts
// A 段：包从哪来（借鉴外部方案的 PackageProvider）
interface PackageSource {
  resolve(ref: PackageRef): Promise<PackageMetadata>;
  fetch(ref: PackageRef): Promise<Package>;
}

// B 段：装到哪、装得对不对（我们的既有草案）
interface CapabilityAdapter {
  id: string;                                  // "native" | "apm" | "pi" | "dsh" | ...
  probe(): Promise<Availability>;              // 能用吗：装了没 / 版本
  capabilities(): Set<Cap>;                    // skill | mcp | runtime | audit | update
  hosts(): HostId[];                           // 支持哪些宿主
  deploy(items: PackageItem[], host: HostId): Promise<DeployResult>;
  remove(items: PackageItem[], host: HostId): Promise<RemoveResult>;
  reconcile(): Promise<ReconcileReport>;       // 对账：实际装了什么（必须实现）
}
```

**接口的两条硬约束（review 补）**：

1. **能力必须门控**：`deploy` / `remove` 不能默认可用——**`capabilities()` 声明了才准调**。
   **反例（实测）**：APM **没有 `remove` 命令**（删依赖 = 手改 `apm.yml` + `apm prune`）→ **apm 适配器的 `capabilities()` 不得声明 `remove`**，否则接口承诺了它实现不了的语义。
2. **`reconcile()` 是硬要求**：见 §5.3 规则 1——归属记账采"只记委托"，适配器一旦不能自报实际状态，账本即失效。

### 5.3 三条已定规则

| # | 规则 | 定论 |
|---|---|---|
| 1 | **归属记账** | 我们只记**委托记录 + 委托快照**（当时装了哪些文件）；实际状态归适配器自报（**避免双账本**）。快照的目的是**适配器缺席/被卸载时账本不至于失效** |
| 2 | **适配器优先级** | **用户声明优先；未声明时原生优先** |
| 3 | **机器视角** | 用 APM 的 **`-g` 用户级模式**（`~/.apm/apm.yml`）对齐"这台机器" |

### 5.4 分层职责（明确边界）

| 层 | 谁负责 |
|---|---|
| 能力装到宿主 | **适配器** |
| 能力从哪来（订阅/下载/物化） | **平台 + 同步器** |
| **经验从哪来、有没有效、值不值得传下去** | **我们（经验层）** |

### 5.5 总纪律：尽量支持，不支持的全兼容

**任何能力 × 任何宿主**，落地分三档，逐级下探、**取不到任何一档才允许报错**：

| 档 | 条件 | 落地方式 |
|---|---|---|
| **L1 原生** | 宿主有该能力位 | 写进宿主原生位置 |
| **L2 按需** | 无能力位，但有 MCP | 经我方九工具按需可达 |
| **L3 兜底** | 两者皆无 | rules 一行提示 |

**硬约束**：降级必须**可见**（`status` 呈现落档 + 原因）· **不得改变语义**（不许让 Agent 以为"我没有这个能力"）· **不静默丢弃**（跳过宿主/丢弃字段一律告警）。

→ 完整降级矩阵（10 个维度）见 **[design.md §一](design.md)**

---

## 六、本地承载与验证（承接 `local-content-model`）

| 议题 | 定论 |
|---|---|
| 承载内容 | 技能 + 订阅游标 + metrics + Trace；**不承载原始信号流** |
| 引用方式 | **引用式（symlink 优先）** —— 但见开放问题（APM 是复制式） |
| 对账 | 项目级哈希对账已有（`apm audit` 很强）；**机器级全量对账需自建** |
| `verify_target` | **补实现**（现为空转死字段） |
| `provenance.origin` | **补写入**（现为空转死字段） |
| 记忆同步 | **单向**（收方只读）；要改就 fork / 分支 / 新包 |

---

## 七、与外部的对齐

| 对象 | 我们对齐什么 | 不对齐什么 |
|---|---|---|
| **agentskills.io** | `SKILL.md` + frontmatter（P0 最小动作） | 我们不发明私有 frontmatter 进产物 |
| **`apm.yml`** | **读写互操作**（可导入导出） | 不依赖 APM 作为运行时底座 |
| **官方 `server.json`** | MCP 包声明格式 | — |
| **MCP Apps** | 管理界面主载体（宿主对话内渲染） | 保留单文件 HTML 作降级 |
| **pi** | 宿主接入 + 作为**运行时**（我们调用它） | 不实现 pi 的 agent loop |
| **dsh** | 宿主接入 + 对齐其插件机制 | — |
| **A2A** | **第一版不引入** | — |

---

## 八、明确不做（防膨胀锚）

企业策略继承 · SBOM/SPDX 导出 · 变异测试 · **自有 registry / marketplace** · CI gating · 插件市场运营 · **Agent Control Plane** · **Gateway / Scheduler / Runtime Manager / Workflow Executor** · 六类 Registry 体系 · K8s 路径 · 微服务拆分 · 自建 Agent 定义标准（已有 `oracle/agent-spec`）· 自建 Prompt/Workflow 执行器

---

## 九、分期与验收

| 期 | 内容 | 验收硬口径 |
|---|---|---|
| **P0** | 产物规范化：`SKILL.md` 补 frontmatter（对齐 agentskills.io / P1） | **硬口径：把产物目录原样丢进一个「没装 AgentSignal」的环境，宿主能直接发现并使用**；旧技能零破坏 |
| **P1** | 适配器抽象 + **APM 适配器**（spawn） | `probe/deploy/remove/reconcile` 四方法真机跑通；APM 缺席时降级不报错 |
| **P2** | **native 适配器**（承接 `host-integration`：宿主技能目录 + symlink + 准入控制） | 摘除不残留；对账五态（含 `foreign` 只读） |
| **P3** | 长尾宿主：**pi / dsh / workbuddy**（反转 P2） | 每宿主三态断言（探测/写入/摘除） |
| **P4** | 互操作：`apm.yml` 导入导出 | 往返无损（标准部分）；私有元数据不进产物 |
| **P5** | 经验层收口：`verify_target` + `provenance.origin` 补齐 | 单测 + 快照；旧 `skill.json5` 零破坏 |
| **P6** | 记忆层立项（独立提案） | 待裁决 |

---

## 十、裁决记录（原开放问题 → 已定，2026-09-11）

| # | 原问题 | 裁决 |
|---|---|---|
| **O1** | `pi` 的接入形态 | ✅ **双轨**：适配（宿主写入器）+ **做成 pi extension**（进其扩展生态，并研究 `setActiveTools()` 作为我们的运行时动态加载） |
| **O2** | `dsh` 的接入形态 | ✅ **双轨**：适配 + **做成 dsh 插件**（`dsh plugin add` / `dsh.bundle`） |
| **O3** | 引用式 vs 复制式 | ✅ **按包记录，不强行统一**：native = symlink · apm = copy；**账本记 `mode`，对账按 mode 分支** |
| **O4** | 适配器冲突 | ✅ **加归属锁**：一宿主 + 一能力 = 一适配器 |
| **O5** | `native` 的取舍 | ✅ **只做 APM 不覆盖的部分**；native 宿主集 = 全集 − 当期 apm 覆盖集（**动态**，升级后重对账） |
| **O6** | 记忆的单位 | ⏸ **P6 独立立项**；本提案只预留 optional 段 |
| **O7** | 管理界面承载 | ✅ **MCP Apps 为主 + 网页兜底**；**支持名单不硬编码，运行时探测** |
| **O8** | 定位决议措辞 | ✅ **已落** → [决议 2026-09-11-local-capability-plane](../../../docs/decisions/2026-09-11-local-capability-plane.md)（待签发） |
| **O9** | 在册提案归并 | ✅ **归档** `local-content-model` / `mcp-service-exposure`；`host-matrix-alignment` / `host-integration` **保留** |
| **O10** | `capabilities()` 能力枚举表 | ✅ **P1 冻结**（不冻结则能力门控失效） |
| **O11** | 清单兼容时点 | ✅ **现在就对 `apm.yml`**；私有增强走**独立扩展 JSON**（开放段，给后续留口子），**不进标准产物** |

**唯一残留**：**MCP Apps 客户端支持名单待实测**（官方名单未能确证 Cursor / Gemini / Codex；设计已按"运行时探测"规避依赖）。除此之外**无未决项**。

---

## 十一、影响面

- **代码**：`packages/cli/src/capability/`（新，适配器 + Broker + 账本）· `packages/cli/src/skills/wiring/`（宿主注册表扩长尾）· `packages/protocol/src/skill-schema.ts`（清单扩展）· `packages/wizard-ui`（界面新区）
- **测试**：node:test 单口径；适配器契约测试（四方法 × 每适配器）；`AGENTSIGNAL_HOME` 夹具；**不碰真实宿主配置**
- **文档**：`local-engine.md`（canonical 升级）· `glossary.md`（新术语：适配器 / 包 / 归属账本 / 记忆）· `AGENTS.md`（定位/阶段）· 新决议一份
- **协议**：REST 端点与九工具面**零变化**；信封语义**零变化**
- **与 `apps/api` 的边界（review 补）**：本提案**全程零触碰** `apps/api`。但须显式点明——**经验层的完全形态（验证聚合 / 回流）天然要碰服务端端点**（`POST /signals/:id/verify` 等），**本提案不解决那部分**（归 `user-domain-completion` 与后续经验层提案）。此处划界，以免后续打架。
- **术语（review 自查）**：本提案引入两个新词——**「适配器」**（必要：外部方案与本仓语境均无替代）与**「能力面」**（**仅为工作名**，canonical 命名待 `glossary.md` 登记时定，候选：本地能力引擎 / 能力管理）。**不得在用户面文案出现未登记术语**（承「技能不进用户面」纪律）
- **风险**：① 引入外部工具（APM = Python）→ 必须**可选 + 降级** ② 适配器边界若不清会变"什么都管" ③ 长尾宿主质量参差 → 需按宿主逐个实测

---

## 十二、与其他在册提案的关系

| 提案 | 关系 |
|---|---|
| `host-matrix-alignment` | **保留**，并入本提案 P3（长尾宿主是其超集） |
| `host-integration` | **保留**，本提案 P2 即其落地（+ 适配器抽象） |
| `local-content-model` | **被吸收**（本提案 §六）→ 建议归档 |
| `mcp-service-exposure` | **被吸收**（本提案 §七 · 管理界面部分）→ 建议归档 |
| `skill-engine` / `user-domain-completion` / `ux-foundation` / `audit-restore` / `human-auth-providers` | **无冲突** |

---

## 十三、扩展能力增补（2026-09-11 站长批准方向，随本提案一并实施）

| 能力 | 定性 | 说明 |
|---|---|---|
| **模型接入（国内全模型）** | ✅ 新增包类型 | 供应商配置包（Anthropic 兼容端点 env 写入）；数据驱动注册表；**只做配置接入，不做模型循环** |
| **面板扩展** | ✅ 扩展既有 v1 | B 视图四新区块，承 management-ui-spec-v1 全部红线 |
| **运行时拉起** | ⚠️ 经适配器 | 按需 spawn；**"被远程调用"仍划出**（无常驻红线） |
| **依赖安装管理** | ⚠️ 显式+白名单 | 拉取默认；**安装绝不自动**（供应链安全） |
| **动态加载 / 分 Agent 管理** | ✅ 收口 | 四态加载已有；pi setActiveTools 待 G-C；热切换按宿主降级 |
| **多 Agent 开发** | ✅ 执行机制 | 开放任务 + 夜间四席流水线（见 tasks.md §〇） |
| **技术选型** | ✅ 采购纪律 | 成熟三方包优先；核心维持 TS 单口径，辅助/评估不限架构（bun/rust 可） |
