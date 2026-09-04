# 提案：本地技能引擎——CLI + MCP（skill-engine）

> 状态：**Draft v5（2026-09-02 终稿待批：设计规范 v1 定档为管理界面 UI 真源 + 三方组件栈 + React Flow 路由图可视化配置；提案批准后开发）**
> 决策人：站长（zhumeng）
> 来源：`agentsignal-v4.1-gateway-integration.md`（机制保留，「网关」「skills 命令树」等概念均已废弃收敛）
> 关联：[user-domain-completion 提案](../user-domain-completion/proposal.md)（其 Phase 1 WIP 暂停中；本提案零触碰 apps/api）
> 预演与探索过程：[walkthrough.md](./walkthrough.md)

## 一、为什么（核心主张）

v4.1 的机制成立，但概念与流程体验都过度。收敛后的版本：

**用户心智只有一件事：跑一次 `agentsignal init`，完事。** 向导用本地 web 页面问答式完成配置（不让用户上来编辑配置文件），自动把 MCP 接进已装宿主，IDE 里的模型立即拥有 9 个工具。「skills」是我们的内部管理形式（复用 skills 包做管理检索），**不进入用户命令面、文档与心智**。

**内部形式**：技能以 skill.json5 + SKILL.md 二元组管理（复用 skills 包机制），引擎做检索/分层/参数/验证——这些全是实现细节，对用户不可见。

定位不变：北极星载体——「订阅 → 注入 → 执行 → verify → 沉淀 → publish」闭环的本地运行时。

## 二、已定档裁决（2026-09-02 站长，不再讨论）

| # | 裁决点 | 结果 |
|---|---|---|
| 1 | 检索引擎 | **Orama**：BM25 + typo tolerance；中文用 `@orama/tokenizers` mandarin 分词（Intl.Segmenter）+ `@orama/stopwords/chinese`。向量检索留 schema 位，MVP 不启用 |
| 2 | MCP 形态 | **官方 `@modelcontextprotocol/sdk`，唯一 MCP server = `agentsignal mcp`**；packages/mcp 五工具 run 逻辑迁入 `packages/cli/src/mcp/`，`@agentssignal/mcp` 兼容壳（**2026-09-03 站长令：未发版 → 不设兼容壳，packages/mcp 整体移除**） |
| 3 | 验证顺序 | **Phase 1 = `agentsignal init` 一条命令全链路**（向导 → 配置 → MCP 自动集成 → 宿主可用）→ Phase 2 = 体验收尾（推通道/卸载/指标/文档）→ Phase 3 = 服务端发布机制（另立提案） |
| 4 | 本地配置根 | **`~/.agentsignal/`**（config / skills / sessions / index 全覆盖） |
| 5 | 用户域 | **暂缓**：不做登录/token 鉴权；verify 先本地记录 |
| 6 | 隔离纪律 | **不影响现在项目**：零触碰 apps/api / 007_auth WIP / Netlify 部署面；改动面限 packages/cli（含唯一 MCP server）、packages/protocol（新增 schema）、packages/wizard-ui（构建期）；packages/mcp 已移除 |
| 7 | 交付层三通道 | **① 拉 = MCP · ② 推 = hook 输出（`skills context` 内部实现，用户无感）· ③ 兜底 = 宿主 rules 一行提示**。API payload 拼装器不做（自建 harness 另案） |
| 8 | 接线自动化 | **init 内置**：自动探测已装宿主 → 写入 mcpServers/hook/rules 片段 → 用户零手工配置；`agentsignal uninstall` 全量摘除 |
| 9 | 指标口径 | status/统计区分「吞吐节省」与「残留占用」双指标；token 估算声明 bytes/4；「任务完成滑出」不承诺（CodeGraph 残留 +80% 为据） |
| 10 | 内部定档 | 示例技能 init 自带 2–3 个 · 栈规则 MVP 只内置 Next.js+TS · 简表默认 JSON · 中文检索 trigger 规则为主、Orama 为辅 · verify 本地自报口径 |
| 11 | 概念收敛 | 无新包（引擎在 packages/cli 内）、无「网关」、无新架构名词 |
| 12 | **UX 定档** | **① 不设 `skills` 命令树**：用户面只有 `agentsignal init` / `mcp` / `status` / `uninstall` 四命令；**② 配置走 web 向导不走配置文件**：首次任意入口（init/mcp）无配置 → 起本地 web 页面问答生成 config；**③ skills 是内部形式**：复用 skills 包管理检索，用户文档与命令面零暴露 |
| 13 | **MCP 面定档** | **MCP 是 Agent 的完整入口**：Agent 使用/消费技能的全部场景经 MCP 工具暴露；**配置/管理 UI 也经 MCP 暴露**——新增 `open_setup` 工具（拉起本地 web 管理界面：向导页兼状态视图，无配置即初始化向导、有配置即管理/状态页），工具面 5+3+1=**9 工具**；**skill 整体维护逻辑（增删技能/重建索引/参数编辑）为 CLI 内置能力，尽量少暴露**——不对 Agent 开维护类工具，不对用户设维护命令 |
| 14 | **管理界面实现栈**（2026-09-02） | UI 真源 = `agentsignal/AgentSignal-管理界面设计规范-v1.md`（三态 A/B/C + 组件 + 文案 + tokens，Phase 1 归档 docs/design/）；**运行期仍是单文件内联 HTML、零外部请求**（规范 §8）；实现用成熟三方组件、全部 build 期 bundle：**React 19 + @base-ui/react ^1.7（Dialog/Checkbox headless 语义）+ Tailwind v4 + lucide-react（内联 SVG 图标）**，esbuild + @tailwindcss/cli 打包；logo 用 `apps/ui/public/logo-mark.png`（缩 96px base64 内联 Header） |
| 15 | **路由图可视化配置**（2026-09-02） | B 视图「接线状态」升级为 **React Flow（@xyflow/react）路由图**：引擎/宿主为节点、接线为边、状态着色（✓ 绿 / ⚠ 琥珀 / ✗ 灰）；**点击宿主节点切换接线 = 可视化改配置**；`config.json5` 仍是唯一真源，图是它的视图 + 编辑面 |

## 三、用户体验 × 内部形式 × 代码层映射（唯一认知表）

| 层 | 内容 | 说明 |
|---|---|---|
| **用户面（四个命令，全部）** | `agentsignal init` | 一次跑完：web 向导问答配置 → 生成 ~/.agentsignal → 探测宿主 → 写入 MCP/hook/rules → 完成。CI 无浏览器时 `--yes` 缺省直通 |
| | `agentsignal mcp` | MCP server 本体；由 init 写进宿主配置后自动被拉起，用户日常无感 |
| | `agentsignal status` | 状态视图：配置/索引/接线/双指标（吞吐/残留，bytes/4 声明） |
| | `agentsignal uninstall` | 全量摘除（宿主配置/hooks/rules/兼容壳），`~/.agentsignal` 数据保留 |
| **模型面（MCP 9 工具）** | 平台五工具（run 逻辑不动） | list_spaces / query_signals / use / publish / report |
| | 三技能工具 | search_skills / load_skill_detail / verify_skill（模型消费技能的唯一入口） |
| | 管理工具 | open_setup：拉起本地 web 管理界面（向导页兼状态视图），Agent 可替用户触发初始化/调整配置 |
| **内部形式（用户不可见）** | 技能管理/检索 | 复用 skills 包形式：skill.json5 + SKILL.md；引擎模块 retriever/layers/loader/verify |
| | 配置产物 | `~/.agentsignal/config.json5` 是**向导的输出**不是用户入口；高级用户可手改，status 校验 |
| | 维护能力（内置） | 技能增删/索引重建/参数编辑/接线修复为 CLI 内部能力，无用户命令、无 MCP 工具 |
| **代码层** | `packages/protocol/src/skill-schema.ts` | skill.json5 zod schema（真源） |
| | `packages/cli/src/skills/` | 引擎内部模块（retriever / layers / loader / verify / wizard / wiring） |
| | `packages/cli/src/mcp/` | MCP server + 9 工具（迁自 packages/mcp） |
| | `packages/wizard-ui/`（构建期包） | React + Base UI + Tailwind + React Flow 源码 → esbuild/@tailwindcss/cli 打成**单文件 HTML**，产物注入 `packages/cli/src/skills/wizard/`；运行期零依赖由构建管线保证 |
| | ~~`packages/mcp/`~~ | **已移除**（未发版无存量用户；唯一 MCP server = `agentsignal mcp`） |

**记忆口诀：用户记四个命令，模型记九个工具，其余全是内部实现。**

## 四、范围

### Phase 1 · `agentsignal init` 一条命令全链路（第一个验证，约 3 人日）

| # | 项 | 实现细节 |
|---|---|---|
| 1.1 | 协议先行 | decisions 两份：`2026-09-XX-skill-envelope.md`（内部技能信封，标注「内部形式，不进用户心智」）· `2026-09-XX-mcp-sdk-consolidation.md`（官方 SDK + 唯一 server 9 工具面 5+3+1，修订 mcp-early-access 边界）；glossary 注册「技能（Skill）」并标注内部形式 |
| 1.2 | skill.json5 schema | `packages/protocol/src/skill-schema.ts`：Frontmatter 六字段必收 + 扩展 optional 安全默认 |
| 1.3 | 引擎内部模块 | `packages/cli/src/skills/`：config 加载（zod fail-fast）· store（扫描 + Orama 索引）· retriever（Orama mandarin + trigger 主路径并联）· layers（四态 + max_tokens 仲裁）· loader（mustache + 依赖预检 + 参数四来源）· verify（本地 metrics）。全部 node:test 单测，中文双路径用例 |
| 1.4 | web 配置/管理 UI（设计规范 v1 全量实现） | 独立构建包 `packages/wizard-ui/`（裁决 14/15）：**三态全实现**——A 初始化向导（3 步 + FooterBar 默认直通 + SubmitOverlay + 完成页）/ B 管理视图（配置摘要 + **React Flow 路由图接线** + 本地库 + 双指标 + 危险区 DangerDialog + 卸载完成页）/ C 配置损坏（自动修复 / 备份后重新初始化）；**双入口共用同一 UI**：CLI `init` 拉起、MCP `open_setup` 工具拉起；构建管线：logo-mark 96px→base64 → esbuild bundle tsx → @tailwindcss/cli 编译 css → 组装**单文件 index.html（零外部请求）** → 产物进 `packages/cli/src/skills/wizard/` 由 server.ts 直出；CI fallback `--yes` 缺省直通；规范 §8 验收清单自查 |
| 1.5 | `agentsignal init` | 向导入口 + 示例技能 2–3 个落盘 + `wiring/`：探测已装宿主（Claude Code/Cursor/Codex/Cline/Gemini…）→ 写 mcpServers（`agentsignal mcp`）+ hook/rules 片段按能力选 → 完成报告 |
| 1.6 | `agentsignal mcp` | SDK `McpServer` + `StdioServerTransport`；9 工具（5 平台迁入 run 逻辑不动 + 3 技能共享引擎单例 + open_setup 拉起管理界面）；**状态机**（BOOTING/WAITING_CONFIG/READY/CALLING/DEGRADED/SHUTTING_DOWN，无 config 拉向导不退出）+ 调用管线（zod 校验→单例处理→统一错误码→Trace）+ 多宿主并发口径（索引 tmp+rename 原子写），详见 design §4.8；工具描述写成行为引导；`@agentssignal/mcp` 兼容壳（2026-09-03 起改为整体移除，不保留） |
| 1.7 | 端到端验证 | 全新目录跑 `agentsignal init` → web 向导完成 → Claude Code 配置已写入 → 连接 MCP tools list 9 工具（含 open_setup） → search_skills（「登录 认证」中文命中）→ load_skill_detail（缺 JWT_SECRET 返回结构化清单）→ 补 env 重试得渲染全文 → verify_skill 落 metrics |

### Phase 2 · 体验收尾（约 1.5 人日，依赖 Phase 1 全绿）

| # | 项 | 实现细节 |
|---|---|---|
| 2.1 | `agentsignal status` | 配置/索引/接线状态 + RTK/CodeGraph 共存检测 + 吞吐/残留双指标（bytes/4 声明） |
| 2.2 | 推通道 + 兜底 | hook 输出实现（L1/L2 正文 + L3 简表，预算内截断）随接线写入 Claude Code UserPromptSubmit 等片段；无 hooks 宿主 rules 一行；宿主覆盖矩阵验证 |
| 2.3 | Session + Trace | `sessions/<id>.json`（调用链/lazy/verify）· TTL 30min · graceful shutdown · tee 兜底；**只记录不审计** |
| 2.4 | `agentsignal uninstall` | 全量摘除：宿主 MCP 配置/hooks/rules；`~/.agentsignal` 数据保留（无兼容壳可摘） |
| 2.5 | 文档随行 | user-manual 只写四命令（**skills 概念零出现**）· admin-guide（~/.agentsignal 布局与 config 产物说明）· SKILL lockstep · 唯一 MCP server 说明（packages/mcp 已移除） |

### Phase 3 · 服务端发布机制（完整验证后另立提案）

- 订阅信号落本地技能（watch `kind=solution` → 落盘，provenance 留位）· solidified publish 回平台 · 平台 verify 回传（接用户域 creds）。本提案不排期。

## 五、不做（Non-goals）

- **不设 `skills` 用户命令树**（裁决 12）· **不让用户上来编辑配置文件**（web 向导优先）
- 管理界面运行期任何外部请求（CDN/字体/图片）——三方组件全部 build 期内联（裁决 14）
- 不新建 packages/gateway，无「网关」名词（裁决 11）
- 登录验证 / 用户域 / token 鉴权（裁决 5）
- MiniSearch / Tantivy；独立第二个 MCP server；API payload 拼装（裁决 7）
- LLM 沉淀审计（Trace 只记录）；向量检索启用（schema 留位）；Hermes 适配
- 触碰 apps/api / 部署面（裁决 6）

## 六、验收（Phase 1–2 完成后）

1. `pnpm verify` 全绿（引擎模块单测 + 中文双路径 + 向导/接线临时目录夹具 + mcp InMemoryTransport）
2. **一条命令全链路演示（第一验证场景）**：1.7 全步骤——init 到宿主可用零手工配置
3. 唯一 MCP server：tools list 恰好 9 工具（含 open_setup）；Cline 实测 load_skill_detail 渲染全文；hook 注入生效
4. `agentsignal uninstall` 摘除不残留；`agentsignal status` 双指标口径正确
5. user-manual 四命令、skills 概念零出现；SKILL lockstep G1–G3 全绿
6. **wizard-ui 产物 = 单文件 HTML**：零外部请求，三态 + React Flow 路由图交互完整，logo（logo-mark.png）内联呈现，设计规范 §8 清单全绿
7. 台账勾选 + AGENTS.md「当前阶段/剩余」节刷新（账实同步）
