# 提案：本地宿主集成管理（host-integration）——经验落地 × 反向可见 × 状态治理

> 状态：**Draft v1（2026-09-10 建档待批）**
> 决策人：站长（zhumeng）
> 来源：外部调研 [docs/notes/2026-09-10-skill-management-landscape.md](../../../docs/notes/2026-09-10-skill-management-landscape.md)（分层 Skill 方案 + skills-manager）
> 关联：[design.md](design.md)（技术设计：D1–D8 · 对账五态 · 落地规格）· [experience.md](../../../docs/design/experience.md) 幕二（M2 硬门槛）· [local-engine.md](../../../docs/design/local-engine.md)（本地引擎 canonical）· [archive/dynamic-skill-management](../archive/dynamic-skill-management/proposal.md)（订阅落库，已完成归档）· [host-matrix-alignment](../host-matrix-alignment/proposal.md)（宿主矩阵，本提案**依赖**其宿主能力位）· [notes/2026-09-11 三件套调研](../../../docs/notes/2026-09-11-mcp-hosting-management-trio.md)（fork 临时执行环境构想，**本提案是其前置**）

## 一、为什么（核心主张）

### 1.1 闭环断在最后一公里

数据链已经通了，但宿主 Agent 看不到：

```text
subscribe → sync → 落库 ~/.agentsignal/skills/<sig_id>/   ✅ 已上线（dynamic-skill-management）
                              ↓
                  MCP search_skills / load_skill_detail    ✅ 已上线（skill-engine）
                              ↓  ✗ 断裂
                  宿主技能目录（.claude/skills、.hermes/skills…）  ❌ 无
```

- `packages/cli/src/skills/install.ts`：`installSignal` 只写中央库 `~/.agentsignal/skills/<id>/`，**不落任何宿主目录**。
- `packages/cli/src/skills/wiring/hosts.ts`：`HostDef` 只有 `mcpPath / hooks / rulesPath / toml` 四类能力位，**没有 skills 路径位**。
- `use <sig_id> --install` 物化到**当前工作目录**，装进宿主技能目录仍是用户**手工动作**。

而 [experience.md](../../../docs/design/experience.md) 幕二（M2 核心验证）明写：

> `use` → 本地长出一份带溯源的 SKILL.md → **装进技能目录** → 照 What worked 执行 → 成功。**这一幕若不通，全案停。**

**今天这一幕靠手工复制。** 这是「未验证不建设」下最该先补的一环。

### 1.2 对北极星的意义

北极星问题：**一个真实的 Agent 是否愿意长期订阅一个 Space 并依赖收到的信息做事。**

现在订阅来的经验是「需要 Agent 每轮主动调 MCP 去取的远端数据」。装进宿主技能目录后：

- 经验成为宿主 Agent 的**原生能力**——按宿主自己的渐进披露机制被发现，**不依赖 MCP 进程存活**、**不依赖 Agent 每轮自觉检索**；
- 依赖关系从「工具调用」升级为「能力存在」——这才配得上定位语 **Give your agent a memory**：记忆的价值在于它在，而不在于你每次想起来去查。

### 1.3 治理刚需（反向可见）

订阅 200 条之后，今天回答不了三个问题：宿主目录里**实际有哪几条**、哪条**过期了**、哪条**被宿主机自己删了**。没有反向可见，订阅就是黑箱——[skills-manager 归档件](../../../docs/notes/2026-09-10-skill-management-landscape.md) §四的第 3 点（列出 Agent 目录全部条目）正是这个位置。

## 二、红线（承既有裁决，勿重议）

| # | 红线 | 依据 |
|---|---|---|
| 1 | **不新增用户命令**（用户面恒四命令 init/mcp/status/uninstall）；装载/卸载 = 管理界面按钮 + `status` 提示 | skill-engine 裁决 12 |
| 2 | **不对 Agent 开维护类 MCP 工具**（工具面恒九）；装载是 CLI 内部能力，不经 MCP 暴露 | skill-engine 裁决 13 |
| 3 | **无常驻进程/守护**：落地是离散动作（同步后由管理界面触发 / status 提示），不做 watch | user-manual §8 watch 决议 |
| 4 | **零 LLM token**：装载/对账全为文件操作，无模型调用 | AGENTS.md 架构要点 |
| 5 | **零触碰 apps/api**：改动面限 packages/cli、packages/protocol（schema 扩展）、packages/wizard-ui | skill-engine 裁决 6 |
| 6 | **只碰 agentsignal 自己管理的条目**：写入带归属标记，卸载对等摘除、绝不碰用户或他人装的技能 | 规范 E-10（既有接线纪律） |
| 7 | **CLI 命令面零变化** → G1–G4 护栏不受影响 | AGENTS.md §9 |
| 8 | **不另立第二张宿主表**：唯一宿主真源仍是 `wiring/hosts.ts`（由 host-matrix-alignment 扩到 9 宿主），本提案只**复用并扩一个 skills 能力位** | 避免双源漂移 |

## 三、一条必须正面回答的约束：落地是稀缺动作，不是越全越好

宿主原生 skill 发现的 L1 元数据（name + description）**常驻 context**，约 100 token/条。
把订阅到的 200 条经验全量 symlink 进宿主目录 = 把「Context 污染」原样复现到宿主侧
（分层方案 §2.1 问题 A：无关能力被放进当前任务的候选空间）。

> **因此落地必须受准入控制**：`validation` 阈值 × 使用情况 × 用户显式启用，且有数量上限。
> 未被准入的经验**仍留在中央库**，照旧可经 MCP `search_skills` 按需检索——**落地与否不影响可达性，只影响「是否常驻」。**

这条把分层方案的 Token Budget（`maxActiveSkills`）从「运行时加载」平移到「物理落地」，是本提案的设计支点。

## 四、What Changes

### A. 宿主 skills 能力位（复用 alignment 的矩阵）

**与 alignment 的分工（避免能力重叠）**：alignment 建 `skillsPath` 与 skills 写入器，但其对象是**接入技能**（participant / 示例，固定一次性）；本提案**复用同一写入器**，对象是**订阅经验**（动态集合）并叠加准入策略。**不新增第二套宿主表，也不新增第二套写入实现。**

| # | 功能点 | 说明 |
|---|---|---|
| **I1** | `HostDef` 增 `skillsPath` / `skillLayout` | 复用 host-matrix-alignment 已引入的宿主 skills 路径事实；`skillLayout` = 目录式 `<name>/SKILL.md`（主流）。无 skills 位的宿主显式标 `null`（照抄「不猜」纪律：没把握就不写，如 cline/gemini 只保留 MCP + rules 通道） |
| **I2** | `HostBindingSchema` 扩记账位 | 增 `skills_installed: [{ id, mode, installed_at }]`——host 是显式白名单，config 仍是唯一真源 |

### B. 装载器（中央库 → 宿主技能目录）

| # | 功能点 | 说明 |
|---|---|---|
| **I3** | `installer.ts`（新模块） | `mountToHost(id, host)`：symlink 优先（零复制、`synced_at` 更新自动跟随），跨卷/Windows 回退 copy；tmp+rename 原子写 |
| **I4** | 归属标记 | 落地条目的 `skill.json5` 带 `provenance`（已具备）；宿主目录侧不额外写标记文件，靠 config 记账 + 启动时对账（见 I7） |
| **I5** | 卸载对等 | `unmountFromHost(id, host)` 只删 config 记账内的条目；`uninstall` 摘除全部落地条目（不碰其他） |
| **I6** | 更新联动 | 源技能 `synced_at` 更新 → symlink 零动作自动生效；copy 模式重写；`revoked` 源 → **自动从宿主摘除**（宿主侧无法降权，只能移除），并记 status |

### C. 准入控制

| # | 功能点 | 说明 |
|---|---|---|
| **I7** | 落地集合 | `config.sync.install.min_validation`（默认 `self-tested`）× 用户启用（管理界面勾选）× `max_installed`（默认 20）取 Top-K；超额只提示不自动装 |
| **I8** | 默认关闭 | `config.sync.install.enabled` 默认 **false**——避免升级后意外把经验灌进宿主 context；用户显式开启 |

### D. 反向可见与状态治理

| # | 功能点 | 说明 |
|---|---|---|
| **I9** | 对账器 | 扫描宿主 `skillsPath` 全部条目（**含非 AgentSignal 装的，只读展示**，采纳 skills-manager「反映 Agent 真实所见」）→ 与中央库/记账三方对账，标 `active / outdated / revoked / missing（宿主侧被删）/ foreign（外来）` |
| **I10** | `status` 增行 | 「宿主落地 N 条 · 待更新 M · 已失联 K」——体检口径，不自动修复 |
| **I11** | 管理界面 B 视图 | 新增「宿主落地」区：按宿主分组、勾选装载/卸载、一键对账、外来条目只读 |

### E. 明确不做（范围外）

- 不建 53 宿主矩阵（复用 alignment 的宿主清单 + 生态出口，见归档件 §四）
- 不做常驻同步守护（红线 3）· 不自建 marketplace / registry（无插件市场红线）
- 不引入 skills-manager / skills.sh / `npx skills add` 作为运行时依赖（只作生态出口，非内部机制）
- 不做 skill 正文编辑（MCP 维护类工具不给 Agent，红线 2）
- 不做 Git 式多设备备份（本项目真源是平台信号，非本地文件；skills-manager 的 Git 后端不适用）

## 五、Capabilities

### New Capabilities
- `host-skill-install`：中央库 → 宿主技能目录的装载 / 卸载 / 更新联动（symlink 优先）
- `host-skill-visibility`：宿主目录扫描与三方对账（落库 ⇄ 落地 ⇄ 宿主实况）

### Modified Capabilities
- `wiring`：`HostDef` 增 skills 能力位；`HostBindingSchema` 增记账位（**不改既有 MCP/hook/rules 行为**）
- `status`：增落地体检行（不新增命令）

## 六、Impact

- **代码**：`packages/cli/src/skills/wiring/hosts.ts`（skillsPath/skillLayout）· 新增 `wiring/installer.ts` · `status.ts` · `packages/wizard-ui`（B 视图宿主落地区）· `packages/protocol/src/skill-schema.ts`（HostBinding 记账位 + SyncState.install 段）
- **测试**（node:test 单口径，`AGENTSIGNAL_HOME` 临时夹具，不碰真实宿主）：symlink/copy 双模式 · 归属标记与卸载不残留 · 准入上限与默认关闭 · 三方对账五态 · revoked 自动摘除 · 既有 5 宿主接线回归
- **文档**：`local-engine.md`（§5 接线矩阵增第四通道「装载」）· `user-manual.md`（管理界面新区的用户可见说明）· `admin-guide.md`（config 记账位）· `glossary.md`（如需登记「宿主装载」）
- **协议**：**零变化**。REST 端点、信封、CLI 命令面全部不动 → G1–G3 不受影响
- **排期定位**：**依赖 host-matrix-alignment Phase 1/2**（需要 9 宿主与 skillsPath 能力位对齐）。建议**紧随 alignment 之后**推进；在 alignment 全绿前不抢跑，避免在 5 宿主的旧矩阵上叠加一层
- **风险**：① 落地即写入宿主目录 = 外部副作用面，按 E-10「只碰自己条目 + 卸载对等」执行；② symlink 在 Windows 需开发者模式，回退 copy 要与 I6 更新联动对齐；③ 准入误配导致宿主 context 膨胀 —— 由 I8 默认关闭 + I7 上限兜底

## 七、开放问题（不阻塞 P0，开工前站长裁决）

1. **默认落地模式**：symlink 优先（建议）vs copy 优先。
2. **准入默认值**：`min_validation = self-tested` + `max_installed = 20`（建议）。
3. **revoked 处理**：自动摘除（建议，宿主侧无法降权）vs 只提示人工。
4. **外来条目**：反向可见是否列出非 AgentSignal 装的技能（建议列出只读，对齐 skills-manager 做法）。
