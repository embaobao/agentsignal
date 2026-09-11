# 任务拆分 — skill-engine

> 状态：**Draft v5（2026-09-02 站长裁决 1–15 全定档：init 全链路 + web 向导（设计规范 v1 三态）+ 用户面四命令 + MCP 9 工具 + React Flow 路由图 + skills 内部形式）**
> 依赖关系：Phase 1（init 全链路，第一验证）→ Phase 2（体验收尾）→ Phase 3（服务端发布，另立提案）
> 纪律：测试随行（node:test 单口径）· 账实同步（AGENTS.md §10）· CLI 面变更同 PR 更新 participant SKILL（G1–G3）· 协议变更先落 decisions · 零触碰 apps/api

## Phase 1 · `agentsignal init` 一条命令全链路（第一个验证，约 3 人日）

- [x] 1.1 协议先行：`docs/decisions/2026-09-02-skill-envelope.md`（内部技能信封，标注「内部形式，不进用户心智」+ 与线上信封 v0.2 映射）· `docs/decisions/2026-09-02-mcp-sdk-consolidation.md`（官方 SDK 迁移 + 唯一 server 工具面 5+3+1，修订 mcp-early-access 边界）· glossary 注册「技能（Skill）」并标注内部形式 · 设计规范 v1 归档 docs/design/ — 2026-09-02 完成
- [x] 1.2 `packages/protocol/src/skill-schema.ts`：skill.json5 zod schema（Frontmatter 六字段必收 + AgentSignal 扩展 optional 安全默认） — 2026-09-02 完成（含 ConfigSchema 真源；order 双写 fail-fast 归引擎加载器）
- [x] 1.3 引擎内部模块 `packages/cli/src/skills/`：config 加载器（zod fail-fast、AGENTSIGNAL_CONFIG 覆盖）· store（扫描 + Orama 索引）· retriever（Orama mandarin + trigger 主路径并联 + keywords fallback）· layers（Domain Filter + 四态加载 + 逐层 max_tokens LRU/digest 仲裁）· loader（mustache + 依赖预检 + 参数四来源链）· verify（本地 metrics）· `~/.agentsignal/` 布局定档 —— 全部 node:test 单测，中文双路径用例 — 2026-09-02 完成（packages/cli/test/skills-engine.test.ts 20 用例全绿）
- [x] 1.4 web 配置/管理 UI（设计规范 v1 全量实现，裁决 14/15）：独立构建包 `packages/wizard-ui/`（已建、依赖已装）——src/main.tsx 顶层状态机 + wizard/manage/corrupt 三态 + ui.tsx 基础组件 + copy.ts 文案常量（skills 禁词把关）；**A** 初始化向导（3 步 + FooterBar 默认直通 + SubmitOverlay + 完成页）/ **B** 管理视图（配置摘要 + **@xyflow/react 路由图**：点击宿主节点切换接线 + 本地库 + 双指标 + @base-ui/react DangerDialog + 卸载完成页）/ **C** 配置损坏（自动修复 / 备份后重新初始化）；build.mjs 管线（logo-mark 96px→base64 → esbuild → @tailwindcss/cli → 组装单文件 index.html 零外部请求）；产物注入 `packages/cli/src/skills/wizard/html.ts`；非 TTY/CI `--yes` 直通；规范 §8 验收清单自查 — 2026-09-03 完成（单文件 693KB · 零外部请求断言 · 无 skills 文案断言；wizard.test.ts 7 用例全绿）
- [x] 1.5 `agentsignal init`：向导入口 + 示例技能 2–3 个落盘 + `wiring/`（探测已装宿主 Claude Code/Cursor/Codex/Cline/Gemini… → 写 mcpServers(`agentsignal mcp`) + hook/rules 片段按能力选 → `--agent <target>` 覆盖 → 完成报告）+ 首次无 config 自动拉向导 + 探测/摘除临时目录夹具单测 — 2026-09-03 完成（init-e2e.test.ts 全链路绿）
- [x] 1.6 `agentsignal mcp`：packages/mcp 五工具 run 逻辑与 client.ts 迁入 `packages/cli/src/mcp/`；SDK `McpServer` + `StdioServerTransport` 替换手写 JSON-RPC；三技能工具 + open_setup 管理界面拉起工具混入（共享 CLI 引擎单例，工具面 5+3+1=9）；工具描述写成行为引导；**状态机**（BOOTING/WAITING_CONFIG/READY/CALLING/DEGRADED/SHUTTING_DOWN，无 config 拉向导不退出）+ 调用管线（zod 校验→单例处理→统一错误码→Trace）+ 多宿主并发口径（索引 tmp+rename 原子写、metrics 追加写）；`@agentssignal/mcp` 兼容壳（README deprecated）；单测改 SDK InMemoryTransport — 2026-09-03 完成（InMemoryTransport 7 用例 · platform-mirror 迁入；**同日站长令：未发版 → 兼容壳不保留，packages/mcp 整体移除，仓库唯一 MCP server = `agentsignal mcp`**）
- [x] 1.7 端到端验证：全新目录 `agentsignal init` → web 向导完成 → Claude Code 配置已写入 → 连接 MCP tools list 恰好 9 工具（含 open_setup）→ search_skills「登录 认证」中文命中（Orama 与 trigger 双路径用例）→ load_skill_detail 缺 JWT_SECRET 返回结构化清单 → 补 env 重试得 mustache 渲染全文 → verify_skill 落 metrics — 2026-09-03 完成（init-e2e.test.ts + mcp-tools.test.ts 共同覆盖；web 向导路径见 wizard.test.ts）

## Phase 2 · 体验收尾（约 1.5 人日，依赖 Phase 1 全绿）

- [x] 2.1 `agentsignal status`：配置/索引/接线状态 + RTK/CodeGraph 共存检测 + **吞吐/残留双指标输出（bytes/4 声明）** + Intl.Segmenter 运行时自检 — 2026-09-03 完成（init-e2e 断言口径）
- [x] 2.2 推通道 + 兜底：hook 输出内部实现（context.ts：L1/L2 正文 + L3 简表，预算内截断，异常静默）+ Claude Code UserPromptSubmit hook 片段 + 其余宿主 rules 一行兜底（随 init 接线写入）；**宿主覆盖矩阵收窄声明**：Cursor/Gemini/Cline/Codex 的 hook 位待宿主 hooks API 稳定后开放，Phase 2 一律 MCP+rules 一行（wiring/hosts.ts hooks 标志位已留） — 2026-09-03 完成
- [x] 2.3 `skills/session.ts`：`~/.agentsignal/sessions/<id>.json` Trace 持久化（调用链/lazy 加载/verify）· TTL 30min · 50 轮 · graceful shutdown · tee 兜底（异常全量落盘附路径）；**只记录不审计** — 2026-09-03 完成（session.test.ts 4 用例）
- [x] 2.4 `agentsignal uninstall`：全量摘除宿主 MCP 配置/hooks/rules（`~/.agentsignal` 数据保留）+ 摘除不残留断言 — 2026-09-03 完成（init-e2e「摘除不残留」断言绿；兼容壳条目随包移除不再涉及）
- [x] 2.5 文档随行：user-manual **只写四命令（init/mcp/status/uninstall），skills 概念零出现** · admin-guide（~/.agentsignal 布局与 config 产物说明）· SKILL lockstep（G1–G3）· @agentssignal/mcp 弃用说明 · 指标口径说明 — 2026-09-03 完成（canonical [local-engine.md](../../../docs/design/local-engine.md) · user-manual §1.5 四命令 skills 零出现 · admin-guide §6 · deployment 发布顺序 · maintenance-cheatsheet 配方 E / 目录定位 · SKILL lockstep G1–G4 · 唯一 MCP server 说明）

## Phase 3 · 服务端发布机制（已另立提案，本 change 不实施）

- [x] （占位，不实施）订阅信号落本地技能（watch `kind=solution` → 落盘，provenance 留位）· solidified publish 回平台 · 平台 verify 回传 + 用户域 creds 接入 —— **已兑现 → [dynamic-skill-management](../archive/dynamic-skill-management/proposal.md)（2026-09-08 Approved · 2026-09-10 全量完成并随 0.5.0 发布；订阅落库/verify 回传/更新链/失效/容量全落地，publish 回平台复用既有平台命令，用户域 creds 仍归 user-domain-completion）——本占位闭环，skill-engine 全清单至此勾清**

## 验收（Phase 1–2 完成后）

- [x] 引擎模块测试全绿：config 校验/加载序 · Orama 中文检索（双路径）· 参数四来源链 · TokenArbitrator 属性 · wizard 与接线夹具 · init `--yes` 直通 · mcp SDK InMemoryTransport —— 2026-09-03 cli/mcp 58 用例全绿（`pnpm verify` 的 api/e2e 段依赖 Postgres 与既有 apps/api WIP 修复，非本提案范围）
- [x] **一条命令全链路演示（第一验证场景）**：init 到宿主可用零手工配置 —— init-e2e.test.ts 子进程夹具绿
- [x] 唯一 MCP server：tools list 恰好 9 工具（含 open_setup）；load_skill_detail 结构化清单/渲染全文；hook 注入生效 —— mcp-tools + init-e2e 绿（Cline 实测留人工）
- [x] `agentsignal uninstall` 摘除不残留；`agentsignal status` 双指标口径正确 —— init-e2e 断言绿
- [x] **wizard-ui 产物 = 单文件 HTML**：零外部请求；三态 + 路由图交互完整；logo 内联 —— wizard.test.ts 产物断言 + build.mjs 外链自检绿（交互完整留浏览器人工走查）
- [x] user-manual 四命令、skills 概念零出现；SKILL lockstep G1–G4 全绿
- [x] 台账勾选 + AGENTS.md「当前阶段/剩余」节刷新 —— 本文件 + implementation-tasks.md 账实记录 + AGENTS.md 当前阶段
