# 设计：宿主矩阵对齐（host-matrix-alignment）

> 目标：**让 `agentsignal init` 接得上 Hermes。**其余三宿主顺带，反向订阅收尾。
> 依据：[docs/design/teamai-host-matrix.md](../../../docs/design/teamai-host-matrix.md)（调研与裁决 R1–R3）。
> 纪律：测试随行（node:test 单口径）· 只写 agentsignal 自己条目（规范 E-10）· 协议零变化 · 零触碰 apps/api。

## 一、现状（事实）

`packages/cli/src/skills/wiring/hosts.ts`（119 行）现结构：

```ts
export type HostId = "claude-code" | "cursor" | "codex" | "cline" | "gemini";

export interface HostDef {
  id: HostId;
  name: string;
  mcpPath: string;          // MCP 配置文件绝对路径（~ 已展开）
  hooks: boolean;           // 宿主是否支持 hooks（否则 rules 一行兜底）
  rulesPath: string | null; // rules 兜底文件
  toml: boolean;            // Codex 走 TOML 专用合并器
  detect(): boolean;
}
```

覆盖矩阵（文件头注释，裁决 7/8）：
`Claude Code = hooks + MCP 全量 · Cursor/Gemini = hook + MCP · Cline/Codex/Trae = MCP + rules`

注意：注释提到 Trae，但 `HostId` 联合类型里**没有 trae**——一处既存漂移，本提案顺手清偿（二选一：补上或删掉注释）。

## 二、设计决策

| # | 决策 | 选择 | 理由 |
|---|---|---|---|
| D1 | 新宿主的接入形态 | **按宿主能力分级，不追求全量对齐** | TeamAI 的纪律：没把握就不写。Hermes/dsh 只发 skill（+SOUL.md rules），不碰 MCP |
| D2 | Hermes rules 注入位 | **`~/.hermes/SOUL.md` 块注入**，不是 AGENTS.md | TeamAI `toolPaths` 写 `claudemd:'AGENTS.md'`，但实际注入实现在 `hermes-config.ts` 走 SOUL.md；以实现为准 |
| D3 | Hermes hooks | **双写** config.yaml + shell-hooks-allowlist.json | 只写 config.yaml 的 hook 不会执行（allowlist 是准入门槛） |
| D4 | OpenCode user/project 前缀 | 引入 `userScope` 覆盖字段 | user = `~/.config/opencode/`，project = `<root>/.opencode/`，两个前缀不同 |
| D5 | OpenCode rules 激活 | 写入 rules 文件**且**在 `opencode.json` 的 `instructions` glob 注册 | OpenCode 不自动扫描 rules 目录 |
| D6 | 摘除对称性 | 每个新宿主的写入副作用必须在 uninstall 里对等摘除 | 既有「摘除不残留」断言口径 |
| D7 | MCP 猜测 | 一律不猜；`mcpPath` 为 `null` 时跳过 MCP 同步 | 抄 TeamAI 原文纪律：宁可不写，也不在用户机器上留垃圾配置 |

## 三、数据结构改动

`HostDef` 扩展（保持向后兼容，新增字段可选）：

```ts
export type HostId =
  | "claude-code" | "cursor" | "codex" | "cline" | "gemini"
  | "hermes" | "workbuddy" | "dsh" | "opencode";

export interface HostDef {
  id: HostId;
  name: string;
  mcpPath: string | null;     // null = 不做 MCP 同步（D7）
  hooks: boolean;
  rulesPath: string | null;
  toml: boolean;
  detect(): boolean;
  // ── 新增（本提案）──
  /** Hermes：常驻指令块注入位（SOUL.md），非 rules 文件 */
  soulPath?: string | null;
  /** Hermes：hook 配置 YAML（hooks.<event>[]） */
  hooksYamlPath?: string | null;
  /** Hermes：shell hook 白名单 JSON（双写，缺则不执行） */
  hookAllowlistPath?: string | null;
  /** OpenCode：user 作用域前缀覆盖 */
  userScope?: { skills: string; rules: string; agents: string } | null;
  /** OpenCode：rules 需在 instructions glob 注册才生效 */
  instructionsManifest?: string | null;
}
```

## 四、各宿主落地规格

### Hermes（Phase 1，优先）

| 项 | 值 |
|---|---|
| home | `process.env.HERMES_HOME ?? homedir()/.hermes` |
| skills | `$home/skills/`（目录式 `<name>/SKILL.md`） |
| rules | `$home/SOUL.md` —— 块注入，标记段 `<!-- agentsignal:rules:start/end -->` |
| hooks | `$home/config.yaml` 的 `hooks.<event>[]` + `$home/shell-hooks-allowlist.json` 双写 |
| MCP | **不做**（D1/D7） |
| detect | `exists($home)` |

事件名：沿用 TeamAI 的 `SessionStart` / `Stop` 语义，映射到 AgentSignal 既有的推通道（见 `skills/context.ts` L1/L2/L3 三档）。

### WorkBuddy

| 项 | 值 |
|---|---|
| skills | `~/.workbuddy/skills` |
| rules | `~/.workbuddy/rules` |
| settings | `~/.workbuddy/settings.json` |
| MCP | `~/.workbuddy/mcp.json`，顶层键 `mcpServers`，形状 `{ "transportType":"streamable-http", … }` + timeout |
| detect | `exists(~/.workbuddy)` |

### DeepSeek Harness (dsh)

| 项 | 值 |
|---|---|
| skills | `~/.dsh/skills`（dsh 的 skill-filesystem provider 以 rank 400 扫描；`~/.agents/skills` 为共享根 rank 500） |
| 其余 | **全不做**（纯 skill 目录） |
| detect | `exists(~/.dsh)` |

### OpenCode

| 项 | 值 |
|---|---|
| skills | project `<root>/.opencode/skills` / user `~/.config/opencode/skills` |
| rules | 同上前缀 + **必须在 `opencode.json` 的 `instructions` glob 注册**（D5） |
| MCP | `~/.config/opencode/opencode.json`，顶层键 **`mcp`**（不是 mcpServers）；`type: local`(stdio) / `type: remote`(http)；无 SSE |
| detect | 两前缀任一存在 |

## 五、测试计划（node:test，扩展现有 `AGENTSIGNAL_HOME` 夹具）

每个新宿主一套三断言：

1. **探测**：夹具目录建出特征路径 → `detectHosts()` 命中该宿主
2. **写入**：wiring 执行后，预期文件（skills 目录 / rules 块 / hook 双写 / MCP 条目）存在且内容符合规格
3. **摘除不残留**：`agentsignal uninstall` 后，夹具目录回到写入前状态（Hermes 的 allowlist 条目必须一并清掉）

Hermes 专项用例：
- SOUL.md 块注入后，用户原有内容完好；重复注入不产生第二个块
- allowlist JSON 去重（同 `{event, command}` 不重复追加）
- 缺 allowlist 时 hook 不生效的行为由双写保证（断言两个文件都被写）

## 六、风险与兜底

| 风险 | 兜底 |
|---|---|
| Hermes 版本差异导致 config.yaml schema 不同 | 读取用 YAML Document 保留注释，写入只动 `hooks` 块；解析失败 → 跳过 hooks 只发 skill，不 fail 整个 init |
| SOUL.md 是用户私人文件 | 块注入带起止标记，摘除只删标记段；写入前若文件不存在则创建，存在则追加 |
| 外部配置写入失败 | 既有口径：best-effort + 静默降级（对齐 TeamAI 的「零静默失败」反过来——异常落 stderr，不中断主线） |
| 协议/命令面漂移 | 本提案不动 CLI 命令面，`agentsignal <cmd>` 集合不变 → G1–G3 护栏无需改动 |

## 七、验收

- [ ] `AGENTSIGNAL_HOME` 夹具下 4 个新宿主探测/写入/摘除三断言全绿（Hermes 专项 3 条）
- [ ] **Hermes 真机走查**：本机（或装 Hermes 的环境）跑 `agentsignal init` → Hermes 技能目录出现 SKILL.md → SOUL.md 块注入生效 → uninstall 后零残留
- [ ] 既存宿主（claude/cursor/codex/cline/gemini）回归全绿（init-e2e）
- [ ] `docs/design/onboarding.md` 宿主矩阵刷新；`user-manual.md` 已上线能力章节同步
- [ ] 台账勾选 + AGENTS.md「当前阶段/剩余」节刷新（§10 账实同步）
