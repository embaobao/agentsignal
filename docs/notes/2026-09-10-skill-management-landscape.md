# 外部输入归档：Skill 管理层调研（分层方案 + skills-manager）（2026-09-10）

来源两件，性质不同，分别归档：

1. 本地方案文档 `agent-skill-layered-management.md`（根目录未提交件，无作者/日期）——**构想/选型建议**，运行时认知层。
2. <https://github.com/xingkongliang/skills-manager>（README.zh-CN / README）· MIT · Tauri 2 + Rust + SQLite——**已落地产品**，文件分发层。

结论先行：**两份都不引入形态，只吸收四点概念；调研真正的产出是照出一个自身缺口——经验技能落库 ≠ 宿主可见。**

---

## 一、分层 Skill 管理方案（构想件）

问题定义准确：300 skill × 100 token 描述 = 30k token 的 Context 污染，本质是「**无关能力被放进了当前任务的候选空间**」。

主张三条值记：

- 全局只留基础能力 + skill discovery，具体 skill 进场景后动态加载（五层：Global → Agent → Project → Scene → Runtime）。
- **先 Scope 硬过滤再语义检索**，明确反对「500 skills 直接 Embedding」。
- Skill ≠ MCP（怎么做 vs 能做什么）；同层不混的还有 Knowledge / Memory / CodeGraph。

渐进披露四层（Advertise → Load Skill → Read Resource → Run Script）直接沿用 Microsoft Agent Framework；借鉴对象里 Archestra 那套企业级 Control Plane，**文档自己也判定过重、不建议直接引入**。

## 二、skills-manager（已落地产品）

- **中央库** `~/.skills-manager` 单一事实来源；SQLite 只存可从技能文件重建的元数据（不进 Git）。
- **三工作区**：Global（**反向可见**——列出 Agent 目录里全部 skill，含非本应用安装的）/ Project（双向同步）/ Linked（独立，不参与 Preset 同步）。
- **Preset** = 命名分组，一键激活，且明确是**一次性复制而非实时同步**。
- **install / deploy 分离**：`skills install` 只入中央库，`skills deploy` 才落到 Agent 目录。
- **Git 备份**：技能级合并（非按行）、冲突不阻塞不覆盖、处理前先建快照可撤销、远端纯 Git 无锁定。
- CLI 与 App **共享同一 Rust core + SQLite + 仓库锁**，双入口不分叉；`--skills-root` 隔离状态、`--json` 机器可读、`TARGET_CONFLICT` 结构化报错。
- **以 skill 分发自己**：`npx skills add xingkongliang/skills-manager` 发布 `manage-skills`，让 Agent 自己驱动管理器。
- 内置 **53 宿主**（含 Hermes Agent、CodeBuddy、WorkBuddy），与 skills.sh 生态同源（`npx skills add` 支持 51 种 agent）。

## 三、不采纳的三条硬理由

| # | 项 | 理由 |
|---|---|---|
| 1 | skills-manager 的**形态**（常驻桌面 App） | 与本项目「无常驻进程/守护」红线直接冲突；只可借理念，不可借形态 |
| 2 | 分层方案的**运行时改造**（Scene / Registry / Router / embedding / pgvector） | 与 Zero-LLM 空闲目标、lean-stack 纪律不匹配；且 [`semantic-router 评估`](2026-09-09-semantic-router-evaluation.md) 已论证 embedding 自身成本可能吃掉收益 |
| 3 | 二者共同缺失的命题 | 都不解决「经验跨 Agent 流动」——那才是本项目差异位；反向说明不要被拉进「本地 skill 路由 / 分发」赛道 |

## 四、吸收的四点（概念级，非形态级）

| # | 借鉴 | 落点 |
|---|---|---|
| 1 | **install ⇄ deploy 分离**的语义 | 与 dynamic-skill-management 的「订阅落库」⇄「装入宿主」同构，是同类方案的一致选择，可作命名与心智的外部印证 |
| 2 | **provenance 不可丢**（绕过管理器直接写 Agent 目录会丢来源） | `transcoder` 已记 `{ base_url, topic, sig_id, kind, validation, synced_at }`，同向；装载时须继续携带 |
| 3 | **反向可见性**（列出 Agent 目录全部条目） | 对 `status` 体检与订阅治理有直接价值：只有如实反映「宿主真实所见」，才能对账「订了什么 / 装了没有 / 哪条过期」 |
| 4 | **更新跟踪 + 快照回滚** | 对应现有更新链（`anchor: sig_x` → `outdated`）与 `revoked` 降权；差别是本项目靠信号锚定，比 Git 查上游更贴合「经验可追溯」 |

**一条可能的低成本出口**（非现在做）：skills-manager 与 skills.sh 已覆盖 50+ 宿主。`agentsignal-participant` 的分发**不需要自建第二张矩阵**，它可以是这些生态的一个"来源"，而非重造轮子——与 [teamai-host-matrix](../design/teamai-host-matrix.md) §四「多一个出口，不是把分发交出去」同一判断。

## 五、真正的产出：照出自身缺口

调研核对后确认一条断裂（有代码为证）：

```text
订阅同步 → 落库 ~/.agentsignal/skills/<sig_id>/   ← sync.ts / install.ts 已通
                              ↓  ✗ 断裂
                     宿主技能目录（.claude/skills、.hermes/skills…）  ← 宿主 Agent 看不见
```

- `packages/cli/src/skills/install.ts`：`installSignal` 只写 `~/.agentsignal/skills/<id>/`，**不落任何宿主目录**。
- `packages/cli/src/skills/wiring/hosts.ts`：`HostDef` 只有 `mcpPath / hooks / rulesPath / toml`，**无 skills 路径位**（host-matrix-alignment 1.2 才开始引入 Hermes 的 skills 落盘，且对象是 participant 接入技能）。
- `use <sig_id> --install`（dynamic-skill-management P1.1）物化到**当前工作目录**，仍需用户手工复制到宿主技能目录。

而 [experience.md](../design/experience.md) 幕二（M2 核心验证）明写：

> `use` → 本地长出一份带溯源的 SKILL.md → **装进技能目录** → 照 What worked 执行 → 成功。**这一幕若不通，全案停。**

即：闭环的最后一公里今天是**手工动作**。这构成新提案 [host-integration](../../openspec/changes/host-integration/proposal.md) 的问题来源。

## 六、一条必须正面回答的约束

宿主原生 skill 发现的 L1 元数据**常驻 context**（约 100 token/条，见 §一）。若把订阅到的 200 条经验全量 symlink 进宿主目录，等于把分层方案 §2.1 的「Context 污染」原样复现到宿主侧。

> 故「装进技能目录」不是越全越好，而是一种**需要准入的稀缺动作**：由验证等级 + 使用情况 + 用户显式启用共同决定，且有数量上限。

这条约束反过来把分层方案的 Token Budget（`maxActiveSkills`）从"运行时加载"平移到"物理落地"，是本提案最需要裁决的一环。

## 七、后续（2026-09-11 两条 session 线打通）

- 本笔记 §五 的缺口发现已立提案 [host-integration](../../openspec/changes/host-integration/proposal.md)（四件套）。
- 同日「想法」线另出三件套调研：[2026-09-11-mcp-hosting-management-trio.md](2026-09-11-mcp-hosting-management-trio.md)（mcp-gateway / skills-manager / mcphub）。其 §四 曾误判上述断裂"已由 wiring 接线接通"，**已就地勘误**——`wiring` 只写 MCP/hook/rules 三类，`HostDef` 无 skills 位。
- 两条线的依赖链（不是并列方向）：

```text
订阅落库（已上线）→ MCP 按需消费（已上线）
                    ↓ 缺
        宿主技能目录落地（host-integration）
                    ↓ 提供装载能力
        fork 远程 Agent 临时执行环境（trio §五 建议立项）
```

- 进度打通记录：[.workbuddy/memory/2026-09-11.md](../../.workbuddy/memory/2026-09-11.md)。
