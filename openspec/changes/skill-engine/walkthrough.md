# 预演与思路稿 — skill-engine（探索模式产物，已定稿并同步 proposal/design/tasks）

> 性质：整体链路 + 工具规划 + 流程痛点 + 完整预演。**通过后再回头细化 design.md，不先写代码。**
> 依据：2026-09-02 站长六条裁决（proposal §二）+ 本稿新增待裁决点（§五）+ **UX 终裁 12 条（§八，2026-09-02）**
> ⚠️ 本文历史章节（§三/§五）保留探索期的 `skills xxx` 六命令命名——**已被 §八 UX 终裁取代**：用户面收敛为 init/mcp/status/uninstall 四命令，原 skills 命令树全部内化（catalog→status 视图、search/load→MCP 工具、verify→MCP 工具、init→agentsignal init、doctor→status 体检）。读本文以 §八为准。

## 〇、源仓库核实（2026-09-02，rtk-ai/rtk + colbymchenry/codegraph README/提交记录原文）

1. **RTK 不用 MCP（修正早前口径）**：三类集成 = hook 重写（Claude Code 原生 hook / Cursor / Gemini）+ 插件 API（OpenCode TS、Hermes Python）+ rules 文件（Codex AGENTS.md、Cline .clinerules），覆盖 16+ 宿主。行业真实图景：CodeGraph 走 MCP 路、RTK 走 hook 路，**两条路都有效**；我们「MCP 为主 + hook 推 + rules 兜底」成立但非唯一范式。
2. **「一个强工具」原文坐实**：CodeGraph 提交 2026-06-19 "pare default tool surface to codegraph_explore alone"——默认 MCP 仅暴露 1 工具，路由/影响面/跨语言桥藏于同一图。我们 3 工具可留，描述须写成行为引导。
3. **接线自动化标杆**：`codegraph install` 自动探测 9 家 agent 写 MCP 配置；install（接线）与 init（建图）分离；uninstall 全量摘除不残留。
4. **子代理 CLI 通道有数据**：对照实验 26/28 次经 Bash 走 CLI；官方指引「主 agent 直接查、别委派探索」。CLI 是子代理唯一可达通道，升为一等集成面。
5. **残留占用官方数字**：CodeGraph 自曝吞吐 token -62% / 工具调用 -88%，但会话末残留上下文 **+80%**（VS Code：67k vs 18k）。吞吐与占用是两个独立指标，「滑出」在第三方宿主不可能（§五 Step 6 口径已改）。
6. **可抄兜底**：RTK tee——失败时全量输出落盘、路径附回；CodeGraph 连接时 catch-up + 陈旧 `⚠️` banner（Phase 3 watch 落盘同步直接套用）。

**对引擎集成层的定调**：接线 = 自动探测宿主 + `--agent` 显式覆盖 + uninstall 全量摘除，MCP/hook/rules 片段按宿主能力自动选；指标 = doctor 区分「吞吐节省」与「残留占用」，token 估算声明 bytes/4；子代理 = CLI 一等通道 + SKILL/rules 写明「直接查、别委派」。

## 一、一句话思路

本地一个 `~/.agentsignal` 配置根 + 一个 CLI 入口（`agentsignal`，MCP 是它的子命令），把「技能怎么被找到、怎么被注入、做完怎么记录」三件事从模型脑内搬到引擎里：**检索交给 Orama，注入交给分层加载，反馈交给本地 verify**。本地闭环跑通后，Phase 3 再把订阅（watch 落盘）和发布（publish 回平台）两头接上，形成全链路。

## 二、整体链路（对应全景图）

```
本地闭环（Phase 1 实线）
  ~/.agentsignal（config/skills/index/sessions）
      → 本地引擎（Domain Filter → Layer Loader → Orama 检索 → Token 仲裁）
      → 注入与执行（L1·L2 正文直注入 / L3 简表懒加载 / load_skill_detail / mustache 参数）
      → verify 闭环（verify_skill 本地记录 → lifecycle.metrics → Trace）

平台闭环（Phase 3 虚线，本提案不排期）
  watch 订阅的 kind=solution 信号 → 落盘为本地技能（回到链路起点）
  solidified 技能 → publish 回平台 → 平台 verify 聚合 / 登录 token 接入
```

## 三、工具规划（全部收敛到一个 CLI 入口）

### CLI 子命令（Phase 1 验证载体）

| 命令 | 作用 | 验证什么 |
|---|---|---|
| `agentsignal skills init` | 生成 ~/.agentsignal 骨架 + 示例技能 | 目录布局定档 |
| `agentsignal skills doctor` | 配置/索引/依赖/运行时体检 | 配置 fail-fast、Intl.Segmenter 自检 |
| `agentsignal skills catalog` | 打印当前项目各层加载结果 + token 消耗 | 分层加载、detect_stack、仲裁 |
| `agentsignal skills search <query>` | 直验 Orama 检索 | 中文分词、混合召回 |
| `agentsignal skills load <skill>` | CLI 面复现懒加载（全文+参数+依赖清单） | 参数四来源链、依赖预检 |
| `agentsignal skills verify <skill> --verdict` | 本地记录 verdict | metrics 闭环 |
| `agentsignal mcp` | **MCP server 本体（Phase 2）** | 唯一 server，8 工具（5 平台 + 3 技能） |

### MCP 工具面（Phase 2，`"command": "agentsignal", "args": ["mcp"]`）

| 工具 | 面向 | 说明 |
|---|---|---|
| list_spaces / query_signals / use / publish / report | 平台业务承载（run 逻辑不动，迁自 packages/mcp） | 1:1 镜像 REST |
| search_skills / load_skill_detail / verify_skill | 本地引擎 | 与 CLI 六命令共享同一引擎单例、同一份 ~/.agentsignal |

## 四、流程痛点逐环节描述

| # | 环节 | 现状痛点 | 引擎解法 | 残余痛点（本提案不解） |
|---|---|---|---|---|
| 1 | 技能发现 | 技能散落各处，模型凭记忆或靠人肉喂 SKILL.md | Orama 中英混合检索 + trigger 规则打分，Top-K 简表 | 检索质量依赖关键词/description 写得好 |
| 2 | token 成本 | 要么全文塞爆上下文，要么模型脑补步骤 | 分层：base/domain 直注入，task/session 简表+懒加载；逐层 max_tokens 仲裁（LRU/digest） | 简表只有 name+description，模型选错技能无兜底 |
| 3 | 项目差异 | 所有项目一套配置，跨项目复用靠复制粘贴 | 域隔离（common+current）+ detect_stack 按项目特征自动挂载 | 栈规则库要人工攒（MVP 只内置 Next.js 一条） |
| 4 | 参数与依赖 | env/key 硬编码在技能正文里，换项目就断 | mustache 参数化 + 四来源解析链（项目>全局>env>默认）+ 依赖预检结构化报错 | 密钥轮换无提醒机制 |
| 5 | 反馈闭环 | 用完即弃，worked/failed 无处记，技能无法进化 | 本地 verify_skill → lifecycle.metrics（use_count/成功率） | 本地自报无客观校验；平台聚合在 Phase 3 |
| 6 | 多入口割裂 | CLI 一套、IDE 插件要另一套，状态不同步 | 唯一 `agentsignal mcp`，CLI/MCP/未来适配器共享单例 | — |
| 7 | 平台断链 | 订阅到的 solution 信号收到后落不了地 | （Phase 3）watch 落盘为本地技能，publish 回传 | 本提案不接，接口留 provenance |

## 五、完整预演（一天工作场景 dry-run）

场景：给一个 Next.js 项目加 JWT 登录。Agent 是配了 `agentsignal mcp` 的 Codex/Cline。

```
Step 0  一次性初始化
$ agentsignal skills init
✓ ~/.agentsignal/config.json5        三层骨架
✓ skills/skill_code_style/           示例技能（base 层）
✓ skills/skill_auth_jwt/             示例技能（task 层，中文 keywords：登录/认证/JWT）
✓ index/ 已建（Orama，mandarin 分词）

Step 1  编辑 config.json5（三层）
  layers: [ base(auto_load:true) → domain(detect_stack) → task(trigger_match) → session(false) ]

Step 2  体检
$ agentsignal skills doctor
✓ config 校验通过      ✓ 索引 2 技能     ✓ 栈规则 1 条（Next.js）
✓ Intl.Segmenter 可用  ⚠ JWT_SECRET 未设置（auth 技能依赖）

Step 3  进入 Next.js 项目看加载结果
$ agentsignal skills catalog
L1 base     直注入  skill_code_style          720/800 tok
L2 domain   检测命中 nextjs+typescript        skill_nextjs_patterns  1500/2000 tok
L3 task     简表    [auth_jwt: JWT 认证…, …]  预算 1500（懒加载）
L4 session  空
结论：L3 不占正文预算，等模型点名。

Step 4  模型检索（中文用例）
> search_skills({ task: "给项目加登录" })
→ "登录" 分词命中 skill_auth_jwt（keywords：登录/认证）→ 简表返回

Step 5  懒加载 + 依赖预检（第一次）
> load_skill_detail("skill_auth_jwt")
→ 依赖缺失：env JWT_SECRET 未设置 / 参数 token_expiry 缺省=1h
→ 返回结构化清单，模型先向用户要配置——不静默脑补

Step 6  配好 env 再 load
> load_skill_detail("skill_auth_jwt")
→ mustache 渲染全文注入（<jwt_secret_env> 已替换）
⚠ 口径如实：第三方宿主中注入内容无法驱逐（无「滑出」）；懒加载省的是
  「进不进」的成本，不是「退不退」——残留占用是独立指标（见 §〇.5）

Step 7  按技能步骤实现完成
$ agentsignal skills verify skill_auth_jwt --verdict worked
→ metrics: use_count 45→46, success_rate 0.96；Trace 记录本次调用链

Step 8  换入口，同一状态
Cline 配 "command": "agentsignal", "args": ["mcp"] → tools list 8 个
→ search/load/verify 与 CLI 共享同一索引、同一份 metrics，无需二次安装

（Phase 3 后）该技能 solidified → publish 回平台 → 其他 Agent 订阅即得
```

## 六、待裁决点（A–G 已于 2026-09-02 按推荐全部采纳，同步 proposal/design/tasks 完成）

| # | 待定 | 选项与推荐 |
|---|---|---|
| A | 示例技能谁出 | 推荐 `skills init` 自带 2–3 个（code_style/auth_jwt/nextjs_patterns），预演与验收都有东西可演 |
| B | detect_stack 栈规则 MVP 范围 | 推荐只内置 Next.js + TypeScript 一条（预演足够），规则库扩充另议 |
| C | L3 简表格式 | 推荐默认 JSON，config 留 format 项（json/xml），Claude/OpenAI 都吃 JSON |
| D | 中文检索主路径 | 推荐 trigger_conditions 规则打分为主（可控），Orama 分词为辅；预演两条路径都出用例 |
| E | verify 本地自报口径 | 预演阶段接受自报；客观校验（测试命令绑定 verify_target）留 Phase 3 讨论 |
| F | 接线自动化形态 | 推荐 `skills init` 自动探测已装宿主 + `--agent <target>` 显式覆盖 + `skills uninstall` 全量摘除；MCP/hook/rules 片段按宿主能力自动选（codegraph install + rtk init 合体） |
| G | 指标口径 | 推荐 doctor/统计输出区分「吞吐节省」与「残留占用」两个独立指标；token 估算声明 bytes/4，不吹账单折扣（对齐 RTK/CodeGraph 自曝口径） |

## 七、预演通过后的动作

1. 按裁决更新 proposal/design/tasks（含 §六 五个待裁决点的结论）
2. 落两份 decision（skill-envelope / mcp-sdk-consolidation）+ glossary
3. Phase 1 开工：packages/protocol schema → packages/cli/src/skills 引擎骨架 → init/mcp → 端到端

## 八、UX 终裁预演（2026-09-02 站长裁决 12：一条命令 + web 向导 + skills 内部形式）

> 本节取代 §三/§五 的命令命名，为最终口径。原则：**用户记四个命令，模型记九个工具，其余全是内部实现。**

### 8.1 命令面收敛对照（旧 → 新）

| 旧（探索期） | 新（终裁） | 去向 |
|---|---|---|
| `skills init` | `agentsignal init` | 全链路：向导→配置→接线→完成 |
| `skills doctor` | `agentsignal status` | 体检并入状态视图 |
| `skills catalog` | `agentsignal status` | 各层加载结果成为 status 的视图段 |
| `skills search/load/verify` | MCP 三工具 | 用户/子代理经宿主调工具；CLI 不再单设 |
| `skills context`（推通道） | init 接线产物 | hook 片段内部调用，用户无感 |
| `skills uninstall` | `agentsignal uninstall` | 全量摘除 |

### 8.2 用户旅程预演（终态）

```
Step 0  一次初始化（唯一需要记住的动作）
$ agentsignal init
→ 检测无 ~/.agentsignal/config.json5
→ 自动起本地 web 向导（127.0.0.1 随机端口，浏览器已打开）
   问：你的业务域？（多选/自定义）
   问：栈规则？（Next.js+TS 默认勾选）
   问：接哪些宿主？（探测到的 Claude Code ✓ / Cursor / Cline…）
→ 提交：
✓ ~/.agentsignal/config.json5        向导产物（用户没碰过配置文件）
✓ skills/  示例技能 2–3 个            （内部形式，用户不感知「skills」名词）
✓ index/   Orama 索引已建（mandarin）
✓ Claude Code 已接线：mcpServers + UserPromptSubmit hook
完成页：去 IDE 里问模型「给项目加登录」试试。

CI/无头环境：$ agentsignal init --yes    # 全默认 + 探测到的宿主全接，不阻塞

Step 1  日常使用（用户无感）
IDE 里模型直接有 8 个工具；hook 每次提示词前注入 L1/L2 正文 + L3 简表。

Step 2  模型侧工作流（与 §五 Step 4–7 相同，入口全部是 MCP 工具）
search_skills("登录 认证") → load_skill_detail → 补 env → 渲染全文 → verify_skill

Step 3  状态自查（可选）
$ agentsignal status
✓ config 校验通过    ✓ 索引 3 技能    ✓ 接线 1 宿主（Claude Code）
✓ 吞吐节省 ~4.2k tok/次（bytes/4 估算）  ⚠ 残留占用如实展示（不承诺滑出）

Step 4  退出
$ agentsignal uninstall        # 宿主配置/hooks/rules/兼容壳全摘；~/.agentsignal 数据保留
```

### 8.3 UX 红线（实现与文档共同遵守）

1. 不设 `skills` 命令树；user-manual / 向导文案 / 完成页 **skills 概念零出现**。
2. 用户不编辑配置文件起步——config.json5 是向导产物；高级用户手改后 status 校验兜底。
3. 任意入口（init / mcp open_setup）首次无 config → 自动拉向导，不报错不装死；有 config → 管理/状态视图。
4. CI `--yes` 直通是硬要求，向导失败不能阻塞自动化环境。
5. 维护能力内置（裁决 13）：技能增删/索引重建/参数编辑不设用户命令、不开 MCP 工具；Agent 侧唯一管理入口是 open_setup 拉起 web 界面。
