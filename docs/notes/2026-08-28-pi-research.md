# 调研：pi（Mario Zechner 的极简编码 Agent）对 AgentSignal 的影响与借鉴

日期：2026-08-28 · 方法：web 调研（pi.dev 官方文档/包目录、作者博文、Armin Ronacher 与 Pragmatic Engineer 等三方分析）

## 一、pi 是什么（30 秒）

Mario Zechner（badlogic，libGDX 作者）2025-11 开源的**极简编码 Agent**（TypeScript monorepo：pi-ai 统一 LLM API → agent loop → TUI），系统提示词 <1000 token，现为 OpenClaw 的内核。核心理念：**反框架、直接控制模型上下文、一切可扩展**。

## 二、与我们相关的五个事实

| # | 事实 | 对我们的意义 |
|---|---|---|
| 1 | **SKILL.md 开放格式生态**：pi 的 skill = 目录+SKILL.md（frontmatter），官方仓库声明与 Claude Code / Codex CLI / Amp / Droid **互相兼容** | 证实 participant/use 物化走 SKILL.md 开放格式是正确路线——我们的经验产物天然落入一个跨五宿主的分发生态 |
| 2 | **pi packages：npm 为底座的分发**——extension/skill/prompt/theme 打包发 npm，`pi install npm:<pkg>` 安装；**pi.dev/packages 只是索引页，不托管内容** | 「skill 分发走 npm」已被市场验证；目录页只索引不托管的架构值得照抄 |
| 3 | **扩展模型**：TS 模块订阅生命周期事件、注册工具/命令/快捷键，热加载 | 我们 CLI 未来加行为时的参照（但注意其复杂度远超我们三命令纪律） |
| 4 | **Context 哲学**：「context engineering is paramount」「反对 token-maxing——窗口大不等于该用满」+ 作者持续研究 compaction（何时压缩上下文） | **Think Gate 的最佳外部背书**：我们挡「进来的」，pi 裁「已进来的」——同一认知准入哲学的镜像 |
| 5 | **极简/三方包优先**：monorepo 分层、无重框架、自托管 Mintlify 文档 | 与我们 Bun-first + Fastify + zod 的「能包则包」路线完全同频 |

## 三、影响判定

**机会（主）**：
- **AgentSignal 可以成为 pi 生态（及整个 SKILL.md 生态）的「经验层」**：pi 用户 `pi install` 我们的桥接包，或直接把 use 物化出的 skill 丢进技能目录——**别人能用（M2 假设）多了一条现成的落地通道**，连安装协议都是现成的。
- pi 的 compaction 研究为我们 digest 三段式 / tokens_est 预算判定提供理论弹药（引用其 context 研究）。

**威胁（次）：
- pi.dev 包目录社区讨论中已出现「包评价/评分走 AT 协议」的提议——若长成经验分享+评价层，会挤压我们生态位。但它**没有 outcome 回流、没有验证计数、没有跨宿主经验总线**——我们的差异化护城河（验证过的经验 + 闭环）依然成立。

## 四、借鉴清单（采纳/不采纳）

| 借鉴点 | 决定 | 落点 |
|---|---|---|
| SKILL.md 保持开放格式、显式声明跨宿主兼容（列 pi/Claude Code 等） | ✅ 采纳 | SKILL.generated.md / participant skill 头注与 onboarding 宿主矩阵补 pi 一行 |
| 包分发走 npm 底座；目录页只索引不托管 | ✅ 采纳（后置） | 分享滑梯期：CLI 发 npm 包 + /skills 目录页做索引——不自建 registry（与无插件市场红线自洽） |
| 「反 token-maxing」作为对外叙事弹药 | ✅ 采纳 | README/product 引用 pi 作者观点佐证 Think Gate（生态盟友，非竞品） |
| pi 的 extension 事件模型 | ⏸ 暂不 | 超出三命令纪律；等真实需求 |
| 自建 TUI | ❌ 不采纳 | 我们的门面是 web 观察层 + CLI 极简输出 |

## 五、结论一句话

**pi 不是竞品，是管道与盟友**：它把「skill 如何被安装/分发/兼容」铺好了路，我们专心做它没有的那层——**带 outcome 验证的经验内容传递**。最直接的动作是把 pi 列入宿主矩阵与兼容声明，让 M2 的「别人能用」搭上现成生态。
