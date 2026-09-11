# 任务拆分 — host-matrix-alignment

> 状态：**Draft v1（2026-09-03 站长委托调研 TeamAI 后立；裁决 R1=B / R2=A / R3=A）**
> 依赖关系：Phase 1（Hermes）→ Phase 2（其余三宿主）→ Phase 3（反向订阅，可独立先行）
> 纪律：测试随行（node:test 单口径）· 账实同步（AGENTS.md §10）· 只碰 agentsignal 自己条目（规范 E-10）· 协议零变化 · 零触碰 apps/api
> 排期定位：**P1.5** —— 不抢 P0/P1，可与 user-domain Phase 1 暂停期并行

## Phase 0 · 调研与提案（0.5 人日）

- [x] 0.1 调研 [Tencent/teamai-cli](https://github.com/Tencent/teamai-cli) v0.22.0：README + usage-guide + `src/types.ts` toolPaths + `src/resources/mcp-format.ts` + `src/known-agents.ts` + `hermes-*.ts` 源码 — 2026-09-03 完成
- [x] 0.2 落盘 [docs/design/teamai-host-matrix.md](../../../docs/design/teamai-host-matrix.md)：三层能力拆解 · 9 宿主逐字路径事实表 · MCP 五格式族 · 三个坑（Hermes allowlist 双写 / OpenCode instructions glob / 不猜 MCP）· R1–R3 裁决 — 2026-09-03 完成
- [x] 0.3 复核既有 5 宿主路径：cursor `.cursor/mcp.json` · codex `.codex/config.toml`(TOML) · gemini `.gemini/settings.json` · cline `.cline/mcp_settings.json` —— **结论：全部正确，缺口在「宿主漏了」不在「路径错了」** — 2026-09-03 完成
- [x] 0.4 openspec 三件套落盘：proposal / design / tasks / .openspec.yaml — 2026-09-03 完成

## Phase 1 · Hermes 接入（第一验证，约 1 人日）

> 硬门槛：决议 [2026-08-27-agent-skill-distribution](../../../docs/decisions/2026-08-27-agent-skill-distribution.md) 要求 Testnet 验收「≥2 宿主全环，必须含 Hermes」。Hermes 不在注册表 = 这条线今天一条都跑不了。

- [x] 1.1 `wiring/hosts.ts`：`HostId` 联合类型加 `"hermes"`；`HostDef` 加三个可选字段（`soulPath` / `hooksYamlPath` / `hookAllowlistPath`）；新增 hermes HostDef — home = `HERMES_HOME ?? ~/.hermes`，detect = `exists(home)`（同笔：protocol `HostBindingSchema.host` 枚举加 hermes——config 唯一真源闭环，协调点打底）
- [ ] 1.2 skills 落盘：`$hermesHome/skills/<name>/SKILL.md`（目录式），复用既有 skill 写入器
- [ ] 1.3 **SOUL.md 块注入**：标记段 `<!-- agentsignal:rules:start/end -->`；文件不存在则创建，存在则追加；重复注入不产生第二块；摘除只删标记段 —— 单测覆盖「用户原有内容完好」
- [ ] 1.4 **hook 双写**：`$hermesHome/config.yaml` 的 `hooks.<event>[]` **且** `$hermesHome/shell-hooks-allowlist.json`（同 `{event,command}` 去重）—— **只写前者 hook 不执行**，单测断言两文件都被写
- [x] 1.5 Hermes 不写 MCP（D1/D7）：`mcpPath = null`，wiring 跳过 MCP 同步，不产生垃圾配置文件
- [ ] 1.6 事件映射：TeamAI 的 `SessionStart` / `Stop` 语义 → AgentSignal 既有推通道（`skills/context.ts` L1/L2/L3 三档）
- [ ] 1.7 兜底：config.yaml 解析失败 → 跳过 hooks 只发 skill，不 fail 整个 init（异常落 stderr）
- [ ] 1.8 测试：`packages/cli/test/` 扩展 `AGENTSIGNAL_HOME` 夹具 —— Hermes 探测 / 写入（含 SOUL.md 块 + 双写 + 无 MCP 文件）/ 摘除不残留 三断言 + 专项 3 条（见 design.md §五）
- [ ] 1.9 **真机走查**：`agentsignal init` → Hermes 技能目录出现 SKILL.md → SOUL.md 块生效 → uninstall 零残留（需 Hermes 环境，无则留人工）

## Phase 2 · 其余三宿主（约 1 人日，依赖 Phase 1 全绿）

- [ ] 2.1 **WorkBuddy**：`~/.workbuddy/skills` + rules + settings；MCP `~/.workbuddy/mcp.json`，顶层键 `mcpServers`，形状 `{ "transportType":"streamable-http", … }` + timeout
- [ ] 2.2 **dsh（DeepSeek Harness）**：**只发 skill** 到 `~/.dsh/skills`；rules/settings/MCP 全不做（纯 skill 目录）
- [ ] 2.3 **OpenCode**：`userScope` 字段落地（user `~/.config/opencode/` vs project `<root>/.opencode/` 双前缀）；rules 写入**且**在 `opencode.json` 的 `instructions` glob 注册（不注册不生效）；MCP 顶层键是 **`mcp`** 不是 `mcpServers`，无 SSE
- [ ] 2.4 清偿既存漂移：`hosts.ts` 文件头注释提到 Trae 但 `HostId` 无 trae —— 二选一（补 trae 或删注释）**【需站长裁决 · 阻塞项：夜间轮自动选「删注释」保守执行并留档，站长可翻案】**
- [ ] 2.5 文件头注释写入 **D7 不猜 MCP 纪律**（抄 TeamAI 原文口径：没把握的宿主一律不写 MCP，只发 skill + rules 一行兜底）
- [ ] 2.6 测试：三宿主各一套探测/写入/摘除断言；既存 5 宿主回归全绿（init-e2e 不回退）

## Phase 3 · 反向可被订阅（约 0.3 人日，可独立先行）

- [ ] 3.1 派生布局：发布脚本产出 `skills/agentsignal-participant/SKILL.md` 布局产物，使 `teamai source add <repo> --name agentsignal` 可订阅
- [ ] 3.2 **G5 派生一致性护栏**：node:test 断言派生文件与真源 `packages/skills/participant/SKILL.md` **逐字节一致**（真源唯一，G1–G3 继续管，本提案不动 CLI 命令面故不受影响）
- [ ] 3.3 文档标注：明写「这是多一个**出口**，不是把分发交给 TeamAI」，单一真源不变

## Phase 4 · 文档与台账（随各 Phase 同步，不单独排期）

- [ ] 4.1 `docs/design/onboarding.md` 宿主矩阵刷新（5 → 9，含新宿主的接入形态与不做的项）
- [ ] 4.2 `docs/design/user-manual.md` 已上线能力章节同步（只写已上线）
- [ ] 4.3 `docs/README.md` 索引登记 `teamai-host-matrix.md`
- [ ] 4.4 台账勾选（[implementation-tasks.md](../../../docs/design/implementation-tasks.md)）+ AGENTS.md「当前阶段/剩余」节刷新（§10 账实同步，同 PR 完成）

## 记录不排期（本提案不做，备查）

- friction 打分触发自动沉淀（TeamAI Stop hook 按打断/重试次数评分，够阈值才提示沉淀）—— 能治「publish 全靠 Agent 自觉」，但属新的行为契约，**待 P1 用户域清偿后另立提案**
- 知识健康度（prune / writeback / stale）—— 与 P1「recommended 列有读零写路径」同源，统一归 P1 之后
- git-native 分发 / MR 评审 / 知识库 BM25 + graph-boost / codebase AST 图 / analytics dashboard —— R1 裁决不采纳，不再讨论

## 验收（Phase 1–3 完成后）

- [ ] 4 个新宿主探测/写入/摘除三断言全绿；Hermes 专项 3 条全绿
- [ ] **Hermes 真机全环**（无 Hermes 环境则转人工，标红不等同于通过）
- [ ] 既存 5 宿主回归无回退（init-e2e 绿）
- [ ] G5 派生一致性绿；真源唯一性未被破坏
- [ ] 台账与 AGENTS.md 已同步（§10）
