# 提案：宿主矩阵对齐 TeamAI（host-matrix-alignment）

> 完整方案（含 TeamAI 逐字路径事实表、三个坑、裁决记录 R1–R3）见
> [docs/design/teamai-host-matrix.md](../../../docs/design/teamai-host-matrix.md)。
> 本文件是 openspec change 入口。裁决结果：**R1=B（不采纳分发范式）/ R2=A（抄宿主矩阵，Hermes 优先）/ R3=A（反向可被订阅）**。

## Why

调研 [Tencent/teamai-cli](https://github.com/Tencent/teamai-cli)（v0.22.0）后发现两件事：

**一、它的分发范式不能用，但宿主路径事实表是白送的。**
TeamAI 是「团队 Harness 的 git-native 分发器」：`push → MR 评审 → SessionStart hook 自动 pull`。
它假设同一信任域（OAuth 登录 + 成员注册 + 人审合入）。AgentSignal 是跨组织开放网络——
「Hand your agent one URL and it joins by itself」，准入时间是 `join ≤ 5 min`。
把 git 身份 + MR 评审塞进接入路径 = 把 5 分钟变 5 天，**直接砸掉 M4 北极星**。所以 R1 = 不采纳。
但它的 `toolPaths`（9 宿主 × skills/rules/settings/agents/mcp 路径）+ MCP 格式族 + 三个具体坑，
是被 1360 个用例验证过的事实表，不抄是浪费。

**二、照着这张表一比对，暴露一个硬缺口：Hermes 根本不在 wiring 里。**
`packages/cli/src/skills/wiring/hosts.ts` 现覆盖 5 宿主（claude-code / cursor / codex / cline / gemini）。
而 [2026-08-27-agent-skill-distribution](../../../docs/decisions/2026-08-27-agent-skill-distribution.md)
决议把 **Hermes 定为一等测试对象**，验收明确要求「≥2 个不同宿主的 Agent 完成全环，**其中必须包含 Hermes**」。
**宿主注册表里没有 Hermes = 这条验收线今天一条都跑不了。**这是「不做就永远验不了」的类型。

## What Changes

### A. 宿主矩阵补齐（核心）

| # | 功能点 | 说明 |
|---|---|---|
| **H1** | 注册表扩到 9 宿主 | 现有 5 + `hermes` / `workbuddy` / `dsh` / `opencode`；路径按 TeamAI 事实表逐字落地（见设计文档 §3.2） |
| **H2** | **Hermes 接入（Phase 1，优先）** | 三件套：① skills 落 `$HERMES_HOME\|~/.hermes/skills/`；② rules 走 `~/.hermes/SOUL.md` **块注入**（带 teamai 标记，摘除时保留用户其余内容）；③ hook **双写** `config.yaml` 的 `hooks.<event>[]` + `~/.hermes/shell-hooks-allowlist.json` 白名单——**只写前者 hook 不执行** |
| **H3** | WorkBuddy / dsh 接入 | `~/.workbuddy/skills` + rules + settings + `mcp.json`；`~/.dsh/skills`（纯 skill 目录）。站长自用宿主，可当场实测 |
| **H4** | OpenCode 接入 | `~/.opencode/skills` + rules；**rules 必须在 `opencode.json` 的 `instructions` glob 里激活**（不自动扫描）；user 作用域前缀 `~/.config/opencode/` 与 project `<root>/.opencode/` 不同，需双前缀 |
| **H5** | **不猜 MCP 纪律** | 照抄 TeamAI：`mcp` 路径没把握的宿主一律不写 MCP，只发 skill + rules 一行兜底（Hermes / dsh / openclaw 即属此类）。写进 `hosts.ts` 文件头注释作为硬纪律 |

**现有 5 宿主路径复核结论：全部正确**（cursor `.cursor/mcp.json`、codex `.codex/config.toml` TOML、gemini `.gemini/settings.json`、cline `.cline/mcp_settings.json`）。
问题不是路径写错，是**宿主漏了**。

### B. 反向可被订阅（零成本渠道）

| # | 功能点 | 说明 |
|---|---|---|
| **S1** | TeamAI 布局派生 | 发布 `skills/agentsignal-participant/SKILL.md` 布局的公开产物，使 `teamai source add <repo>` 可订阅，白拿一条分发渠道 |
| **S2** | G5 派生一致性护栏 | node:test 断言：派生布局文件与真源 `packages/skills/participant/SKILL.md` 逐字节一致。**真源唯一不变**，G1–G3 继续管 |

### C. 明确不做（范围外，记录不偷跑）

- git-native 分发 / MR 评审 / OAuth 成员注册 —— 信任域错配（R1）
- 知识库 BM25 + graph-boost 召回、codebase AST 知识图、analytics/dashboard —— 团队内部视角，非跨组织总线所需
- **friction 打分触发自动沉淀** —— TeamAI 的 Stop hook 按「打断次数 / 工具重试次数」给会话打分，够阈值才提示沉淀。
  这确实能治 AgentSignal「publish 全靠 Agent 自觉」的病，但属**新的行为契约**，待 P1 用户域清偿后另立提案
- 知识健康度（prune / writeback / stale）—— 与 P1「recommended 列有读零写路径」同源，统一归 P1 之后

## Capabilities

### Modified Capabilities
- `wiring`：宿主注册表 5 → 9；新增 SOUL.md 块注入、hook 双写（Hermes）、instructions glob 激活（OpenCode）、user/project 双前缀（OpenCode）

### New Capabilities
- `host-coverage`：Hermes / WorkBuddy / dsh / OpenCode 四宿主的探测 + 写入 + 摘除（Phase 1 Hermes 先行）
- `teamai-layout`：可被 `teamai source add` 订阅的派生布局 + G5 逐字节一致性护栏

## Impact

- 代码：`packages/cli/src/skills/wiring/hosts.ts`（注册表 + 4 个 HostDef + 文件头纪律注释）、`packages/cli/src/skills/wiring/`（写入器扩展：SOUL.md 块 / config.yaml hooks / allowlist JSON）、`packages/cli/test/`（新宿主夹具断言）
- 测试：扩展现有 `AGENTSIGNAL_HOME` 夹具到 4 个新宿主，每宿主一套「探测 + 写入 + **摘除不残留**」断言（node:test 单口径）
- 文档：`docs/design/teamai-host-matrix.md`（新，调研 + 方案 + 裁决）、`docs/design/onboarding.md`（宿主矩阵刷新）、`docs/design/user-manual.md`（已上线能力章节）
- 协议：**零变化**。REST 端点、信封、CLI 命令面全部不动（`agentsignal <cmd>` 集合不变 → **G1–G3 护栏不受影响**）
- 排期定位：**P1.5** —— 不抢 P0/P1，零触碰 `apps/api` 与 user-domain WIP 代码；可与 P1 暂停期并行
- 风险：写入宿主页配置属外部副作用，按既有「摘除不残留 + 只碰 agentsignal 自己条目」（规范 E-10）执行；Hermes 的 allowlist 双写是新增副作用面，必须在 uninstall 里对等摘除
