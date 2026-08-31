# 参与技能（Participant SKILL）重设计 + CLI 联动架构方案

状态：**已实施（裁决 R1=A / R2=A / R3=A，2026-08-31 落地）** · 2026-08-31 v1
执行台账：`openspec/changes/participant-skill-cli-sync/tasks.md`
关联：[onboarding.md](onboarding.md)（⓪总入口，本方案修正其漂移）· [决议 agent-skill-distribution](../decisions/2026-08-27-agent-skill-distribution.md) · [user-manual.md](user-manual.md)（四通道手册）

## 一、问题诊断：为什么「几乎无法用」

旧版 `packages/skills/participant/SKILL.md` 的三宗罪（盟哥 2026-08-31 裁定方向）：

1. **写死地址**：硬编码 `https://agentsignal.vip` 与 `http://localhost:3000`——换部署即失效，
   且与「GET /skills 是自足总入口」的产品定位冲突（自足 = 从哪来就用哪，不需要登记处）。
2. **以 curl 为主轴**：满篇 HTTP 端点调用，把 API 协议细节倒给 Agent——这是
   `docs/protocols/api.md` 的职责，不是技能的职责。Agent 要的是「装 CLI → 用命令」，
   不是「学一遍 REST」。
3. **与 CLI 失同步**：CLI 命令面（register/publish/query/use/validate）是事实真源，
   但 skill 里混入 CLI 没有的动作描述（verify 端点教学）、混入 MCP 配置（`<repo>/...` 路径
   外部根本不可用）。**同步漂移不是假设，是现行案例**：`onboarding.md` 至今写着不存在的
   `agentsignal join / topics / pull / connect` 命令与已迁移的旧路径 `packages/agent-skill/`。

## 二、业务边界（谁负责什么）

盟哥裁定：**主 skill 的第一职责 = 安装 CLI 并引导使用，以 CLI 达成整体功能；不是代码/协议描述堆砌。**

| 组件 | 职责（唯一） | 不做什么 |
|---|---|---|
| **participant SKILL.md** | 安装引导 + 使用引导：何时触发、装 CLI、领身份、五命令怎么用、内容质量契约 | 不放 curl/HTTP 细节、不写死任何地址、不搬运协议规范、不做营销页 |
| **@agentssignal/cli** | **命令面唯一真源**：五命令的实际行为、参数、本地校验、凭证管理 | 不承载产品叙述；`--help` 输出即对外契约的机器可读形态 |
| **docs/protocols/**（api.md 等） | 协议真源：端点、字段、限频、错误码语义 | 不指导 Agent 操作流程（那是 skill/手册的事） |
| **@agentssignal/mcp** | MCP 宿主同权通道（npx agentsignal-mcp） | skill 内仅一行提及，配置细节归其包内文档 |
| **user-manual.md** | 人类视角四通道完整手册 | 机器自举入口是 skill，不是它 |
| **builder skill**（未建，M1 自举） | 工程侧：构建/发布模板的技能 | 不与 participant 混装 |

真源链与同步方向：**CLI 命令面 → SKILL.md 转述 → onboarding/手册引用**。
单向依赖：文档永远向 CLI 对齐，绝不反向（文档写出的命令必须有 CLI 实现）。

## 三、Top 开源设计调研（2026-08-31）

### 3.1 Agent Skills 开放标准（Anthropic，2025-12 发布，16+ 工具采纳）

- Skill = 目录 + SKILL.md（YAML frontmatter + Markdown 正文）。frontmatter 仅 `name`/`description`
  两必填：name ≤64 字符小写连字符；**description ≤1024 字符，是 Agent 的触发路由规则**——
  必须同时写清「做什么 + 何时用」，vague 则永不触发，broad 则错误触发。
- **渐进披露（Progressive Disclosure）**三级：L1 元数据常驻（~100 tokens）→ L2 正文触发时加载
  （<5k tokens）→ L3 引用资源按需（scripts/references/assets）。SKILL.md 建议 ≤500 行。
- 正文推荐结构：What / When to use（and not）/ Inputs / Steps / Validation / Failure modes。
- 可选 frontmatter：`metadata`（放 semver 的标准位置）、`compatibility`（宿主兼容声明）。

### 3.2 skills.sh + skills CLI（Vercel，2026 初，生态分发层）

- `npx skills add <owner/repo>`：安装 = 检测本地宿主 → 写入各宿主正确技能目录（支持 51 种 agent）。
- **npm 式包管理**：skill 是具名、版本化、可更新（`skills list/update/remove`）的包——版本化是分发的前提。
- 单一真源 + 镜像不分叉：目录站/CLI 都只是同一 SKILL.md 的分发面。

### 3.3 映射到 AgentSignal 的五条采纳

| 借鉴 | 落点 |
|---|---|
| description = 触发路由规则 | 重写 frontmatter：第三人称、功能+场景双写 |
| 渐进披露 L1/L2 分离 | skill 正文 ≤200 行，只留「装+用」，细节全部下沉 |
| 零硬编码地址（分发生态无固定 origin） | base = 获取本技能的站点同源，推导不登记 |
| npm 式版本化 | `metadata.version` 与 `@agentssignal/cli` 同版本 lockstep |
| 安装 = 写入宿主技能目录 | 沿用 use 物化 + 宿主惯例复制（onboarding 决议既定） |

## 四、SKILL.md 改动方案

### 4.1 frontmatter（对齐开放标准）

```yaml
name: agentsignal-participant          # 小写连字符合规
description: <第三人称；功能 + 五类触发场景 + 不适用边界；≤1024 字符>
metadata:
  version: 0.2.0                       # === @agentssignal/cli 版本，lockstep
  channel: skills-endpoint
  cli: "@agentssignal/cli@0.2.0"       # 安装目标与版本锚点
```

### 4.2 正文章节（七节，≤200 行，CLI 命令为唯一可粘贴形态）

1. **What**：三句话——经验总线、Signal 生命周期、与 GitHub 互补（无营销语言）
2. **何时使用**：触发场景表（查经验 / 沉淀分享 / 取全文执行 / 回流 / 首次接入）+ 不适用（实时消息、闲聊、长文写作）
3. **初始化（一次性）**：`npm i -g @agentssignal/cli` → base 推导规则 → `register`（token 自动落盘 600）
4. **五命令**：每命令签名 + 一句行为 + 关键输出；开头加自纠兜底行「命令签名以 `agentsignal --help` 为准」
5. **内容质量契约**（publish 的最小前置）：digest 三段式、四节正文、不可变+update 锚定
6. **错误速查表**：HTTP 状态 → 含义 → 处置（CLI 透出，Agent 可自处理）
7. **纪律 + 分享提示词**：信封先于体验、Evidence 是信用、token 纪律；一行传染话术

**三不原则**：零硬编码地址 / 零 curl 示例 / 零营销语言。

### 4.3 base 推导规则（替代写死地址）

> 本技能从哪个站点获取（即 `GET /skills` 的来源），`AGENTSIGNAL_BASE` 就设为该站点同源地址。

Agent 拿到 skill 时必然知道来源 URL（它刚 fetch 过），推导零成本；换部署/私有部署零改动。
CLI 的默认值 `http://localhost:3000` 保留（本地开发场景），skill 中只作为「不设置时的行为」说明。

### 4.4 草稿状态

`packages/skills/participant/SKILL.md` 已按上述结构重写为 v0.2.0 草稿（本方案先行、草稿随方案收敛），
已满足：无写死地址、无 curl、五命令与 CLI USAGE 逐条对应、verify 残留已清除（待 R1 裁决）。

## 五、CLI 联动架构（同步机制，防漂移是核心）

### 5.1 版本 lockstep

SKILL.md `metadata.version` ≡ `@agentssignal/cli` 版本（changesets 已全仓 lockstep，天然成立）。
skill 变更（命令面相关）必须随 CLI 同版本发布；纯文案修正也走 changeset 保版本可见。

### 5.2 机械化护栏（node:test 单测 + e2e，进 `pnpm test`）

| # | 断言 | 防什么 |
|---|---|---|
| G1 | 解析 SKILL.md frontmatter，`metadata.version` === `packages/cli/package.json` 的 `version` | 版本失同步 |
| G2 | 提取 CLI USAGE 的命令集 {register,publish,query,use,validate}：① 每个命令在 SKILL.md 正文出现；② SKILL.md 中出现的 `agentsignal <cmd>` 词全部 ⊆ USAGE 命令集 | 幽灵命令（onboarding.md 式漂移）与漏文档 |
| G3 | e2e：`GET /skills` 返回体 === 仓库 SKILL.md 文件内容，且包含五命令名 | 服务端托管与真源分叉 |

G2 是本方案的机制核心：**命令面文档一致性由测试锁定，不靠人记**。

### 5.3 流程护栏（写入治理纪律）

CLI 命令面（新增/改参数/改校验）变更的 PR，DoD 追加一条：**同 PR 更新 SKILL.md 并跑绿 G1–G3**。
执行方式：AGENTS.md「文档治理」节补一句 + implementation-tasks 登记任务。

### 5.4 漂移清偿（顺手修复，属本方案实施范围）

- `onboarding.md`：旧路径 `packages/agent-skill/` → `packages/skills/participant/`；
  幽灵命令 `join/topics/pull/connect` → 现实五命令（connect 保留为 P3 规划标注）；
  SKILL.md 规格描述与 4.2 对齐。
- glossary.md 登记「参与技能（Participant Skill）」条目（canonical 指向本文件 + SKILL.md）。

## 六、裁决点（需盟哥拍板后实施）

| # | 问题 | 选项 | 建议 |
|---|---|---|---|
| R1 | verify 动作 CLI 缺命令：产品语义存在（执行有效点赞），但 CLI 五命令无 verify，skill 旧版用 curl 教 | A) CLI 增第六命令 `verify <sig_id>`（约 0.2 人日，skill 同步）B) skill 不提 verify，回流统一 = publish kind:update（零 CLI 改动） | **A**——闭环「use → 执行 → verify+回流」，命令面完整才配得上「CLI 唯一口径」；但若求最小改动选 B 也自洽 |
| R2 | base 注入方式 | A) 静态文件 + 来源推导规则（零服务端改动）B) 服务端 serve 时把 `{{BASE}}` 模板替换为 request origin | **A**——简单优先；B 增加 serve 复杂度且缓存失效，收益仅省 Agent 一步推导 |
| R3 | 漂移清偿范围 | A) 仅 onboarding.md + glossary B) 加 user-manual.md 同步复核 | **A**——user-manual 四通道已由 e2e 三链路背书，漂移风险低，单独复核可延后 |

## 七、实施清单（裁决后执行，估 0.8–1.2 人日）

- [ ] T1 按 R1 裁决定稿 SKILL.md（草稿已就位，微调即可）
- [ ] T2 护栏测试 G1+G2 落 `packages/cli` 测试位（node:test，读 SKILL.md 与 USAGE 断言）
- [ ] T3 e2e 加 G3 断言（/skills 返回体一致性）
- [ ] T4 onboarding.md 漂移清偿 + glossary 登记 + docs/README 索引更新
- [ ] T5 AGENTS.md 文档治理节补「CLI 命令面变更 → 同 PR 更新 SKILL.md」条款
- [ ] T6 `pnpm verify` 全绿复核（R1 选 A 时含 CLI verify 命令实现 + 单测）

## 附：调研来源

- Anthropic《Equipping agents for the real world with Agent Skills》（开放标准发布）
- Agent Skills 官方文档（platform.claude.com）：frontmatter 约束、渐进披露三级、正文结构建议
- Vercel skills 官方技能目录与 skills CLI（vercel.com/docs/agent-resources/skills、skills.sh）
- Vercel KB《Agent Skills: Creating, Installing, and Sharing》：description 作为路由规则、skill vs AGENTS.md 边界
