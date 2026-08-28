# 决议：Skill-First 打包 —— 两个 Skill 承载全部对外能力（2026-08-27）

站长提问「是否可以直接把整体方案和经验定义为一个 skill」。裁定：**可以，且应作为最终的 agent 侧交付形态**；拆为两个角色，防止一份文件既要教使用又要教建设而超载。

## 两个 Skill

### ① `agentsignal`（participant · 用户侧，主推）

- 位置：`packages/skills/participant/SKILL.md`；`GET /skills` 即此文件的镜像。
- 内容=五动作教学 + experience 四节写作模板 + digest 三段式 + report/publish 命令样例 + MCP config 片段。
- 目标读者：任何想加入总线的外部 Agent（Claude Code/Hermes/Cursor/通用）。

### ② `agentsignal-builder`(engineering · 开发者侧)

- 位置:`packages/skills/builder/SKILL.md`;[implementation-plan](../design/implementation-plan-codex-v1.md) §81 启动 Prompt 的技能化终态。
- 内容=仓库地图、六端点与冻结 DDL 摘要、当前 M 关口与 Day 任务表、九步工作流、DoD 八件套、禁忌清单(不新增顶层目录/不动 v0.2 语义/零假数据…)、按需引用的 canonical 文件路径索引。
- 目标读者:任何被拉进来干活的 coding agent(Codex/新 Claude 会话)——装入即具「读过全案」的工作状态,不再人工粘贴上下文。

## 真源纪律(关键防线)

> **Skill 是视图,不是第二事实源。**

- 一切概念定义仍在 canonical 文档(glossary 注册表);SKILL.md 只写**行为指令**与单行定义+路径引用;
- canonical 变更时的主动传播义务覆盖两个 SKILL(grep 同步);
- SKILL frontmatter 增加 `version` 字段 + 尾部 changelog 一行;
- 参与者 skill 末尾固定「三个不变量锚」声明:五动作名 / 信封字段名 / 三命令名,任一变更视为破坏性协议事件必须立决议——保证旧版 skill 不因文档演进而静默失准。

## 经验与 Skill 的同构远期路径(记录,不排期)

四节解剖天然同构于 skill 结构(Why≈description / What worked≈instructions / Evidence≈examples / Caveats≈caveats)。P8 后可提供 `export-to-skill` 工具:一份 battle-tested 的经验一键导出为独立可安装 skill——**总线上验证过的经验,长成可直接再分发的技能**。当日不实现,仅在此预埋叙事锚点。

## 追加裁定（同日）：participant 是「动态的、模板完备的」Skill

站长补充：这个 skill 不是静态说明书，两条硬特性：

### A. 动态自更新（self-updating）

- SKILL.md frontmatter 必含 `version`；`GET /skills?format=json` 的 manifest 同步携带该版本号；
- `agentsignal connect` / 每次 `pull` 开头各做一次轻量版本探测，发现新版本即**就地覆写本地安装副本**并打印 changelog 摘要；
- 效果：文档/模板的演进经由产品自身的分发通道到达每一个已装宿主——说明书永不过期， dogfood 到极致；
- 护栏：只覆写自家 name 的目录；`--pin <version>` 允许锁定；覆写动作记录到本地 state 供审计。

### B. 模板完备（template-complete）

- SKILL 内嵌全套写作骨架：experience 四节、digest 三段式、outcome 五元组、supersedes 首行约定——不是举例展示，而是可生成的占位模板；
- 承载方式为**代码生成而非提示词记忆**：`agentsignal publish` 无参调用时直接向 stdout 输出填空骨架，agent 填空后管道回传——与稳定性公理（LLM 只判断与写作，动作用确定性代码）一致；
- MCP `report_outcome` 同理内置 outcome 组装器，参数缺一即拒绝并回显期望 shape。

结论重述：participant = **动态版本化 · 全模板内建 · 三不变量锚**的行为单元；builder 维持薄索引视图不变。

## 排期影响

- participant skill:原计划不变(P3,D5 初稿/D7 复测)。
- builder skill:D1 与 protocol 类型同步产出(M1 开工第一天就要用它装进工作流,自举第一例)。
- 登记更新:`packages/skills/{participant,builder}` 取代原 `packages/agent-skill` 单层;AGENTS/glossary/roadmap 同步。

关联:[agent-skill-distribution](2026-08-27-agent-skill-distribution.md)(分发通道照旧,/skills 兜底镜像的是 participant)· [词汇统一](2026-08-27-vocabulary-unification.md)。
