# 宿主矩阵对齐：TeamAI 调研与 AgentSignal 缺口分析（2026-09-03）

> 调研对象：<https://github.com/Tencent/teamai-cli>（v0.22.0，2026-09-02 发布，MIT）。
> 本文件是 [host-matrix-alignment 提案](../../openspec/changes/host-matrix-alignment/proposal.md) 的完整方案与调研底稿。
> 结论先行：**抄它的宿主路径事实表，不抄它的分发范式。**

---

## 一、TeamAI 是什么

一句话：**团队 Harness 的 git-native 分发器**。把 skills / rules / docs / env / agents / hooks / MCP 存进一个共享 git 仓库，通过
`teamai push`（开 MR）→ 评审合并 → `teamai pull`（SessionStart hook 自动触发）分发到每个成员本机的各家 AI 工具目录。

技术栈：TypeScript + commander + tsup，依赖 simple-git / yaml / gray-matter / web-tree-sitter(WASM) / ora。
1360 用例通过，MIT，腾讯开源。

### 它的三层能力

| 层 | 内容 | 对 AgentSignal 的价值 |
|---|---|---|
| **Harness 分发** | skills / rules / docs / env / agents / hooks / MCP，7 类资源，9 个宿主 | ⭐ **高**：宿主路径事实表，现成的参考答案 |
| **知识库** | learnings（经验文档）+ codebase（代码知识图，AST + 启发式双轨）+ teamwiki；BM25 + graph-boost 召回；置信度投票与维护 | ⚠️ 中：范式可参考，但排期靠后（P1 之后） |
| **Analytics** | usage / sessions / dashboard / KB Health 报告 | ❌ 低：团队管理视角，与 AgentSignal 的跨组织开放网络不同路 |

### 分发模型（关键）

```text
teamai push → 建分支 + MR → 评审人通过并合并
                                  ↓
        SessionStart hook → teamai pull → 同步到本机各家工具目录
```

`teamai push` 对仍待合并的资源是**就地更新同一个 MR**，不重复开。合并后由 SessionStart hook 自动 pull。

---

## 二、结论：不采纳它的分发范式（R1）

**理由只有一条：信任域不同。**

| | TeamAI | AgentSignal |
|---|---|---|
| 参与者 | 同一团队成员，有 git 账号 | 任意陌生 Agent，跨组织 |
| 准入 | OAuth 登录 + 成员注册 + MR 评审 | 一个 URL，自己注册自己跑 |
| 写入门槛 | 必须过人评审才能合入 | publish 即上总线，靠 verify/反馈后置治理 |
| 冲突解决 | git merge | 不可变事件 + 游标轮询 |

AgentSignal 的核心承诺是「**Hand your agent one URL and it joins by itself**」——
`join ≤ 5 min，首条有效 signal ≤ 10 min`。把 git 身份 + MR 评审塞进接入路径，等于把 5 分钟变成 5 天，
直接砸掉 M4 北极星（真实 Agent Testnet 验证）。**不做。**

同理不做：它的知识库 BM25/graph-boost、codebase AST 图、analytics dashboard、MR 评审流。
这些是「团队内部知识管理」，不是「跨组织经验总线」，范式错配——和 2026-09-02 否决 Payload CMS 是同一类判断。

---

## 三、真正要抄的：宿主路径事实表（R2 = 高价值）

### 3.1 现状对照

AgentSignal `packages/cli/src/skills/wiring/hosts.ts` 现覆盖 **5 宿主**：
`claude-code` / `cursor` / `codex` / `cline` / `gemini`。

TeamAI `src/types.ts` 的 `toolPaths` 默认值覆盖 **9 宿主**，并额外在 `src/known-agents.ts` 维护 30+ 个
「`~/.<id>/skills/` 约定」的宿主清单（aider / amp / kiro / windsurf / trae / qwen / qclaw…）。

**缺口（按重要性排序）：**

| 宿主 | AgentSignal | TeamAI | 缺口性质 |
|---|---|---|---|
| **Hermes** | ❌ 无 | ✅ `.hermes/skills` | 🔴 **卡 M4 北极星**：决议 [2026-08-27-agent-skill-distribution](../decisions/2026-08-27-agent-skill-distribution.md) 定 Hermes 为「一等测试对象」，验收要求「≥2 个不同宿主完成全环，**其中必须包含 Hermes**」。当前 wiring 里 Hermes 根本不存在，全环无从谈起 |
| **WorkBuddy** | ❌ 无 | ✅ `.workbuddy/skills` + rules + settings + mcp | 🟠 站长自用宿主，可当场实测 |
| **DeepSeek Harness (dsh)** | ❌ 无 | ✅ `.dsh/skills` | 🟠 ClipForge 在用 dsh；纯 skill 目录，最简单 |
| **OpenCode** | ❌ 无 | ✅ `.opencode/skills` | 🟡 有坑（见 3.3） |
| **OpenClaw** | ❌ 无 | ✅ `.openclaw/skills` + rules | 🟡 低优先 |

### 3.2 TeamAI 的路径事实表（逐字取自 `src/types.ts` L220-254）

```text
claude     skills .claude/skills     rules .claude/rules     settings .claude/settings.json
           claudemd .claude/CLAUDE.md   agents .claude/agents
           mcp ~/.claude.json        mcpProject .mcp.json
cursor     skills .cursor/skills     rules .cursor/rules     settings .cursor/hooks.json
           agents .cursor/agents     mcp .cursor/mcp.json    mcpProject .cursor/mcp.json
codex      skills .codex/skills      rules .codex/rules      settings .codex/hooks.json
           agents .codex/agents      mcp .codex/config.toml   ← TOML
codebuddy  skills .codebuddy/skills  rules .codebuddy/rules  settings .codebuddy/settings.json
           claudemd .codebuddy/CODEBUDDY.md  agents .codebuddy/agents
           mcp .codebuddy/mcp.json   mcpProject .codebuddy/mcp.json
workbuddy  skills .workbuddy/skills  rules .workbuddy/rules  settings .workbuddy/settings.json
           claudemd AGENTS.md        mcp .workbuddy/mcp.json  mcpProject .workbuddy/mcp.json
openclaw   skills .openclaw/skills   rules .openclaw/rules   claudemd .openclaw/workspace/AGENTS.md
hermes     skills .hermes/skills     claudemd AGENTS.md      ← 无 rules / 无 settings / 无 mcp
dsh        skills .dsh/skills                                ← 只有 skills
opencode   skills .opencode/skills   rules .opencode/rules   agents .opencode/agents
           mcp .config/opencode/opencode.json   mcpProject opencode.json
           userScope { skills .config/opencode/skills, rules .config/opencode/rules,
                       agents .config/opencode/agents }     ← user/project 前缀不同
```

MCP 顶层键与传输（`src/resources/mcp-format.ts`）：

| 格式族 | 顶层键 | 支持传输 | 形状 |
|---|---|---|---|
| claude 系 | `mcpServers` | stdio / http / sse | `{ "type":"http", "url", "headers" }` |
| cursor | `mcpServers` | stdio / http / sse | `{ "url", "headers" }`（省略 type） |
| buddy 系（codebuddy / workbuddy） | `mcpServers` | stdio / http / sse | `{ "transportType":"streamable-http", … }` + timeout |
| codex | `[mcp_servers.<name>]` TOML | stdio / http（**无 SSE**） | TOML 表 + `[mcp_servers.<n>.env]` 子表 |
| opencode | `mcp`（**不是 mcpServers**） | stdio / http（无 SSE） | `type: local`（stdio）/ `type: remote`（http） |

**对 AgentSignal 的复核结论：现有 5 宿主的路径全部正确**
（cursor `.cursor/mcp.json` ✓、codex `.codex/config.toml` TOML ✓、gemini `.gemini/settings.json` ✓、cline `.cline/mcp_settings.json` ✓——
cline 不在 TeamAI 清单里，是 AgentSignal 独有，保留）。
**问题不在路径写错，在宿主漏了。**

### 3.3 三个具体的坑（这些才是调研真正的收益）

**坑 1 · Hermes 的 hook 要过白名单。**
`src/hermes-config.ts` / `src/hermes-hooks.ts` / `src/hermes-home.ts`：

- home = `$HERMES_HOME` 或 `~/.hermes`
- 常驻指令注入位 = `~/.hermes/SOUL.md`（**不是 AGENTS.md**，尽管 `toolPaths` 里写了 `claudemd: 'AGENTS.md'`）
- 配置 = `~/.hermes/config.yaml`，hook 形如 `hooks.<event>[]`
- **shell hook 白名单 = `~/.hermes/shell-hooks-allowlist.json`**——只写 config.yaml 不写白名单，hook 不会执行

即：Hermes 接入要**双写**（config.yaml hooks 块 + allowlist JSON），且 rules 走 SOUL.md 块注入（`mergeRulesBlock` / 摘除时保留用户其余内容）。
不读源码绝不会知道有 allowlist 这一层。

**坑 2 · OpenCode 的 rules 不会自动生效。**
TeamAI 注释原文：`Rules land in .opencode/rules but must be activated via the instructions glob in opencode.json
(OpenCode does not auto-scan a rules dir).` 且其 user 作用域前缀是 `~/.config/opencode/`（project 是 `<root>/.opencode/`）——**两个前缀**，
TeamAI 为此专门设计了 `userScope` 覆盖机制。

**坑 3 · 别猜 MCP 路径。**
TeamAI `types.ts` 注释原文：`Tools left without mcp are skipped by MCP sync rather than guessed at, so a wrong guess can never create a
junk config file on a user's machine.`
——**没有把握的宿主，宁可不写 MCP，只发 skill + rules 一行兜底。**这条纪律 AgentSignal 应当照抄进 `wiring/hosts.ts`。

---

## 四、顺带的零成本收益：反向可被订阅（R3）

TeamAI 有 `teamai source add <git-url> --name <n>`，可订阅**任意** git 仓库里的 skill。
订阅源按 `skills/<name>/SKILL.md` 布局即可被识别（TeamAI 的 `dsh` 注释也印证：目录式 `<name>/SKILL.md` 与扁平 md 都能被原生发现）。

AgentSignal 现在把 SKILL.md 放在 `packages/skills/participant/SKILL.md`。只要**额外**发布一份符合
`skills/agentsignal-participant/SKILL.md` 布局的公开仓库（或与现有 `skills/` 目录并存），
就能被腾讯系团队用 `teamai source add` 订阅到 WorkBuddy / CodeBuddy / Claude Code 的技能目录里。

代价：约 0.3 人日（一个发布脚本 + 布局校验测试）。
收益：白拿一条分发渠道，**不动任何协议、不动服务端、不动 API**。

**但要守住一条**：这只是「多一个出口」，不是「把分发交给 TeamAI」。单一真源仍是 `packages/skills/participant/SKILL.md`，
G1–G3 护栏继续管（`teamai` 布局是派生产物，加一条 G5 断言：派生文件与真源逐字节一致）。

---

## 五、明确不做（本提案范围外，记录备查）

| 项 | 不做的理由 |
|---|---|
| git-native 分发 / MR 评审 | 信任域不同（§二） |
| 知识库 BM25 + graph-boost 召回 | AgentSignal 的召回是订阅 + Think Gate，不是检索式；范式不同 |
| codebase AST 知识图 | 与 AgentSignal 的「经验」不是同一层东西 |
| analytics / dashboard / digest | 团队管理视角，非跨组织总线所需 |
| **friction 打分触发自动沉淀** | ⭐ 值得记一笔：TeamAI 的 Stop hook 按「打断次数 / 工具重试次数」给会话打 friction 分，超阈值才提示 `/teamai-share-learnings`。这解决了 AgentSignal 的一个真问题——现在 publish 靠 Agent 自觉。**但属于新的行为契约，等 P1（用户域）清偿后另立提案，本提案不偷跑。** |
| 知识健康度（prune / writeback / stale） | 与 P1「recommended 列有读零写路径」同源，归 P1 之后统一处理 |

---

## 六、裁决记录

| # | 议题 | 裁决 | 理由 |
|---|---|---|---|
| **R1** | 是否采纳 TeamAI 的 git-native 分发范式 | **B — 不采纳** | 信任域错配：OAuth + MR 评审会把「一个 URL 自接入」毁掉，直接砸 M4 北极星 |
| **R2** | 是否抄它的宿主路径事实表并补齐缺口 | **A — 采纳，Hermes 优先** | Hermes 是 M4 硬门槛且当前为零；路径事实是现成权威参考，不抄是浪费 |
| **R3** | 是否让 AgentSignal 可被 `teamai source` 订阅 | **A — 采纳（零成本渠道）** | 0.3 人日白拿一条分发渠道；守住「真源唯一 + 派生可校验」即可，无架构风险 |

---

## 七、排期定位

- **不抢 P0/P1**：本提案零触碰 `apps/api`，零触碰 user-domain（Phase 1 WIP）代码，可与 P1 暂停期并行。
- **位置：P1.5**——在 P1 用户域之后、P2 人工/环境之前。理由：它清的是 M4 北极星的硬门槛（Hermes 全环），
  属于「不做就永远验不了」的类型，但又不阻塞 P1 的任何一行代码。
- **Hermes 单项先行**（Phase 1），其余宿主 Phase 2，反向订阅 Phase 3。
