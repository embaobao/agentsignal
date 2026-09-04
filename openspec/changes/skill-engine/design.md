# 设计 — skill-engine（本地技能引擎：CLI + MCP）

> 状态：Draft v5（2026-09-02 终稿：裁决 1–15 全定档——设计规范 v1 为管理界面 UI 真源 + 三方组件栈（build 期）+ React Flow 路由图可视化配置；一条 `agentsignal init` 全链路；用户面四命令；「skills」内部形式；「网关」概念已删除）
> 来源：`agentsignal-v4.1-gateway-integration.md` 机制 + 站长裁决 1–15（proposal §二）+ [管理界面设计规范 v1](../../../agentsignal/AgentSignal-管理界面设计规范-v1.md)（UI 真源）+ RTK/CodeGraph 源仓库核实（walkthrough §〇）

## 一、概念与代码映射（唯一认知表，与 proposal §三一致）

**记忆口诀：用户记四个命令，模型记九个工具，其余全是内部实现。**

- **用户面（恰四个命令）**：`agentsignal init`（web 向导 + 全链路）· `mcp`（server 本体）· `status`（状态视图）· `uninstall`（全量摘除）。**不设 `skills` 命令树**。
- **模型面（MCP 9 工具）**：list_spaces / query_signals / use / publish / report（平台，run 逻辑不动）+ search_skills / load_skill_detail / verify_skill（技能消费唯一入口）+ open_setup（拉起本地 web 管理/向导界面，Agent 可替用户触发配置）。
- **内部形式（用户不可见）**：技能以 skill.json5 + SKILL.md 二元组管理（复用 skills 包形式），引擎做检索/分层/参数/验证——全部实现细节。
- **config 是产物不是入口**：`~/.agentsignal/config.json5` 由 web 向导问答生成；高级用户可手改，status 校验。
- **维护能力内置**：技能增删/索引重建/参数编辑/接线修复是 CLI 内部能力——不设用户命令、不开 MCP 维护工具，暴露面最小化。

## 二、依赖清单（全部 esbuild bundle 进包产物）

| 包 | 版本 | 用途 | 论证 |
|---|---|---|---|
| `@orama/orama` | ^3.x | 检索主引擎：BM25 + typo tolerance + facets（内建） | 纯 JS 零 native；schema 留 `vector[N]` 位，向量检索后续零迁移启用 |
| `@orama/tokenizers` | ^3.1.x | 中文分词：`createTokenizer({ language: 'mandarin' })`（Intl.Segmenter） | 中英混合同组件体系 |
| `@orama/stopwords` | ^3.1.x | 中文停用词 | 官方配套 |
| `@modelcontextprotocol/sdk` | latest | MCP 官方 SDK：stdio transport + McpServer | 唯一 server；协议跟进不自己背 |
| `json5` | ^2.2 | config.json5 / skill.json5 / params.json5 解析 | 官方实现 |
| `mustache` | ^4.2 | SKILL.md 参数模板渲染 | 官方实现 |

**明确不引入**：MiniSearch / Tantivy · `gpt-tokenizer`（bytes/4 启发式，status 输出声明口径）· 任何 LLM SDK。管理界面运行期零外部请求（无 CDN/外部字体/图片）——React / Base UI 等三方组件仅存在于 build 期（见下表），产物为单文件内联 HTML。

**复用**：`@agentssignal/protocol`（zod / ULID / 错误码 / skill-schema）。

**wizard-ui 构建期依赖（`packages/wizard-ui/` 专用，不进 CLI 运行时依赖）**：

| 包 | 版本 | 用途 | 论证 |
|---|---|---|---|
| `react` / `react-dom` | ^19 | UI 运行时（bundle 进内联 JS） | 与 apps/ui 同栈，组件可互通 |
| `@base-ui/react` | ^1.7 | headless 语义组件：Dialog（焦点陷阱/Esc/禁遮罩误关）、Checkbox | 项目 lean-stack 决议指定 Base UI；注意正式包名已从 `@base-ui-components/react`（beta/rc）改为 `@base-ui/react`（1.7.0 稳定） |
| `@xyflow/react` | ^12 | React Flow：B 视图路由图可视化配置（裁决 15） | 节点/边/交互全内置，样式可主题化 |
| `lucide-react` | latest | 图标（build 期 tree-shake 成内联 SVG） | 零运行时请求 |
| `tailwindcss` + `@tailwindcss/cli` | ^4 | 样式（tokens.css 变量 + utilities） | 与 apps/ui 同栈 |
| `esbuild` | ^0.24 | tsx bundle（CLI 同栈惯例） | 快、零配置 JSX |

## 三、代码结构（最终态，零新包）

```
packages/protocol/                 # 协议层（schema 唯一真源）
└── src/skill-schema.ts            # 新增：skill.json5 zod schema + SkillEnvelope 类型

packages/cli/                      # 本地引擎 + 四命令 + MCP server（一个包承载全部）
├── src/
│   ├── index.ts                   # 现有六命令入口（零改动）+ 新增 init/status/uninstall + mcp 子命令
│   ├── skills/
│   │   ├── config.ts              # ~/.agentsignal/config.json5 加载（zod fail-fast + AGENTSIGNAL_CONFIG）
│   │   ├── store.ts               # skills/ 扫描 + Orama 索引重建/增量
│   │   ├── retriever.ts           # Orama（mandarin）+ trigger_conditions 并联打分
│   │   ├── layers.ts              # Domain Filter + Layer Loader 四态 + Token 仲裁
│   │   ├── loader.ts              # 懒加载 + mustache + 依赖预检 + 参数四来源链
│   │   ├── verify.ts              # 本地 verdict → lifecycle.metrics
│   │   ├── context.ts             # 推通道内部输出（hook 友好，用户无感，Phase 2）
│   │   ├── status.ts              # status 命令：配置/索引/接线/双指标体检
│   │   ├── wizard/                # web 配置/管理 UI：向导页兼状态视图；CLI init 与 MCP open_setup 双入口（node:http，零依赖惯例）
│   │   │   ├── server.ts          # 起本地 http（127.0.0.1 随机端口）+ 开浏览器
│   │   │   └── form.ts            # 问答项渲染与提交解析
│   │   └── wiring/                # detect.ts（宿主探测）· snippets.ts（MCP/hook/rules 片段）· uninstall.ts
│   └── mcp/                       # 迁自 packages/mcp（随 Phase 1 的 1.6 落地）
│       ├── server.ts              # agentsignal mcp = server 本体（SDK McpServer + StdioServerTransport）
│       ├── tools.ts               # 9 工具（5 平台 + 3 技能 + open_setup，run 逻辑不动）
│       └── client.ts              # 迁自 packages/mcp，不动
└── test/

packages/wizard-ui/                 # 构建期专用包（裁决 14：产物=单文件 HTML；不发布、不进任何运行时依赖）
├── src/
│   ├── main.tsx                   # 顶层状态机：A 向导 / B 管理 / C 损坏 / 完成页 / 卸载完成页（?state= 支持）
│   ├── wizard.tsx                 # 状态 A：3 步向导 + FooterBar 默认直通 + SubmitOverlay + 完成页
│   ├── manage.tsx                 # 状态 B：配置摘要 + React Flow 路由图 + 本地库 + 双指标 + 危险区 + 卸载完成页
│   ├── corrupt.tsx                # 状态 C：错误摘要 + 自动修复 / 备份后重新初始化
│   ├── ui.tsx                     # 基础组件（Header/Button/Chip/CheckboxRow/Panel/Alert/StepIndicator/StatusRow/MetricCard…）
│   ├── copy.ts                    # 设计规范 §4 文案表常量（skills 禁词红线在此集中把关）
│   └── css/                       # tokens.css（规范 §5 原样）+ app.css（Tailwind v4 + 组件类）
├── build.mjs                      # ① logo-mark→96px base64 → src/generated/logo.ts ② esbuild bundle ③ @tailwindcss/cli ④ 组装 dist/index.html（零外部请求）
└── dist/index.html                # 产物：内联全部 JS/CSS/logo，构建时注入 packages/cli/src/skills/wizard/

packages/mcp/                      # （已移除 2026-09-03）未发版无存量用户 → 不设兼容壳；唯一 MCP server = packages/cli 内 `agentsignal mcp`
```

```
~/.agentsignal/                    # 本地配置根（裁决 4，一次定死进 admin-guide）
├── config.json5                   # 向导的输出（不是用户入口）
├── params.json5                   # 全局参数覆盖
├── skills/<id>/                   # skill.json5 + SKILL.md（内部形式）
├── sessions/<id>.json             # Trace（Phase 2）
└── index/                         # Orama 持久化（带版本号文件，schema 变更整库重建）
```

## 四、关键机制定档

### 4.1 UX 终态（裁决 12，本设计的第一约束）

1. **一条命令全链路**：`agentsignal init` = web 向导问答 → 生成 ~/.agentsignal → 示例技能落盘 → 探测已装宿主 → 写入 mcpServers/hook/rules → 完成报告。全程零手工配置。
2. **配置走 web 向导不走配置文件**：首次任意入口（init / mcp）检测无 config → 自动起本地 web 页面（node:http，127.0.0.1 随机端口，自动开浏览器）问答生成。问答项仅三类：业务域 / 栈规则启用 / 要接线的宿主多选。提交即写 config + 执行接线 + 返回完成页。
3. **CI fallback**：无浏览器/非 TTY 环境 `--yes` 缺省直通（全默认值 + 探测到的宿主全接），不阻塞流水线。
4. **skills 内部形式**：复用 skills 包做管理检索，但用户命令面、user-manual、向导文案 **skills 概念零出现**。

### 4.2 Orama 检索装配

```typescript
import { create, insert, search } from "@orama/orama";
import { createTokenizer } from "@orama/tokenizers";

const db = await create({
  schema: {
    id: "string", name: "string", description: "string",
    keywords: "string[]", domain: "string", layer: "string",
    // embedding: "vector[1536]",   // 留位：向量检索启用时解注释
  },
  components: {
    tokenizer: await createTokenizer({ language: "mandarin" }),  // Intl.Segmenter 中文
  },
});
```

混合召回**双路并联**：Orama 全文一路；trigger_conditions 规则打分一路（weighted 求和过 match_threshold，**主路径**，中文可控性靠它）；并集归一排序出 Top-K 简表。keywords 是 trigger 缺省时的 fallback 规则源。

### 4.3 加载流程（逐条可测）

```
createEngine(config)                       # 引擎无名字，createEngine 就是 CLI 内部工厂
  → DomainFilter: scope = skills ∩ (common ∪ domains.current)
  → LayerLoader（按 config.layers 数组索引序，双写 order 即 P0 配置错误 fail-fast）:
      auto_load=true         → 全文直注入（L1/L2 正文段）
      auto_load=detect_stack → stack_rules 全部命中才加载该组（MVP 只内置 Next.js+TS）
      auto_load=trigger_match → Top-K 简表进 catalog 段，全文等 load_skill_detail
      auto_load=false        → 跳过（session 层显式加载）
  → 每层 TokenArbitrator(layer.max_tokens)：超限 LRU（按得分降序）/ digest 压缩
  → 出口两个：context（推通道文本）/ catalog（人看视图）
```

### 4.4 交付三通道与接线（裁决 7/8）

| 通道 | 载体 | 覆盖场景 |
|---|---|---|
| ① 拉 | `agentsignal mcp`（9 工具） | 所有 MCP 宿主；工具结果进对话历史 |
| ② 推 | hook 输出（内部实现 `context.ts`，用户无感；init 写片段时指向 `agentsignal mcp` 内部同一引擎） | Claude Code UserPromptSubmit / Cursor / Gemini BeforeTool |
| ③ 兜底 | 宿主 rules 一行提示 | 无 hooks 宿主（Cline/Codex/Trae）：「开工前调 search_skills」 |

- **宿主覆盖矩阵（Phase 2 验收物）**：Claude Code = hooks+MCP 全量；Cursor/Gemini = hook+MCP；Cline/Codex/Trae = MCP+rules。
- **接线归 init 不归用户**：`init` 探测已装宿主（配置目录特征文件）→ 按能力生成片段写入 → `--agent <target>` 覆盖 → `uninstall` 全量摘除（数据保留）。参照 codegraph install + rtk init。**推通道对用户是接线产物，不是命令**。
- **工具描述 = 行为引导**：9 个工具 description 写清何时用/何时别用，不写功能罗列。
- **MCP 工具面**：5 平台（run 逻辑不动）+ 3 技能（search_skills/load_skill_detail/verify_skill，共享 CLI 引擎单例；verify_skill 只写本地 lifecycle.metrics）+ 1 管理（open_setup：拉起本地 web 管理/向导界面——无配置即向导、有配置即状态/管理视图；Agent 可替用户触发初始化与调整）。**维护类能力（技能增删/索引重建）不开 MCP 工具**。

### 4.5 参数四来源链与依赖预检

```
项目级 .agentsignal/params.json5 > ~/.agentsignal/params.json5 > 环境变量 > skill.parameters[].default
```

required 落空 → 显式报错列出参数名与已查层级；依赖预检独立（env 存在性 / bins 在 PATH / packages 声明），缺啥返回结构化清单。

### 4.6 指标口径（裁决 9）

status/统计输出分列「吞吐节省」（进上下文前省掉的）与「残留占用」（会话末仍占窗口的）；token 估算 bytes/4 并在输出声明；不承诺「任务完成滑出」。

### 4.7 测试口径

node:test。Orama 中文检索硬断言（「登录 认证」命中 auth 技能，双路径用例）；TokenArbitrator 属性测试（注入后总量 ≤ 预算）；wizard 提交解析 + config 产物快照断言；wiring 探测/摘除与 wizard server 用临时目录夹具 + 真实 http 请求（不碰真实宿主配置、不占固定端口）；MCP 用 SDK InMemoryTransport 集成测试；`--yes` 直通路径单测（无头环境断言全默认 config 生成）。

### 4.8 MCP 生命周期与调用管线（裁决 13 落地细节）

**状态机**：

```
BOOTING（宿主 spawn → SDK 起 Stdio 传输）
  ├─ config 存在 → INIT_ENGINE（引擎单例初始化）→ READY ⇄ CALLING → SHUTTING_DOWN
  └─ config 缺失 → WAITING_CONFIG（拉 Web 向导 / CI --yes 直通）→ INIT_ENGINE
旁路：DEGRADED（索引损坏/版本不符 → 整库重建 → 回 READY）
```

要点：

1. **无 config 不报错不退出**：进 WAITING_CONFIG 拉向导——这是「任意入口首次自动引导」的实现点；`--yes` 直通是 CI 硬要求。
2. **调用管线（每次 tool call）**：zod 参数校验（失败 = `isError` + `USAGE_INVALID` + 中文说明）→ 引擎单例处理（9 工具共享同 config/索引/metrics，无重复初始化）→ 业务失败 = protocol 统一错误码 + 结构化 JSON（模型可读可重试）→ Trace 落 `sessions/<id>.json`（Phase 2，只记录不审计）→ graceful shutdown（SIGTERM，Trace 刷盘后退）。
3. **并发与一致性**：stdio = 一宿主一实例；同机多宿主各自 spawn、共享 `~/.agentsignal`——索引 tmp+rename 原子写、启动只读加载、metrics 追加写。索引版本号文件不符 → 整库重建（<1000 条毫秒级），不阻塞 READY。
4. **向导与 server 生命周期解耦**：向导 http 只绑 127.0.0.1 随机端口、提交即关服，独立子流程，不占 server 主循环。

### 4.9 管理界面实现定档（裁决 14/15，设计规范 v1 为 UI 真源）

1. **真源关系**：`AgentSignal-管理界面设计规范-v1.md`（三态/组件/文案/tokens）是 UI 的唯一真源，本文不复制其内容，冲突以规范为准；Phase 1 的 1.1 把它归档进 `docs/design/`（文档治理）。
2. **三态**：A 初始化向导（3 步 + FooterBar 默认直通 = CI `--yes` 等价 + SubmitOverlay + 完成页）/ B 管理视图（配置摘要 + 路由图 + 本地库 + 双指标 + 危险区）/ C 配置损坏（自动修复 / 备份 `.bak-<时间戳>` 后重新初始化）。双入口共用：CLI `init` 与 MCP `open_setup`。
3. **路由图（裁决 15）**：`@xyflow/react` 渲染——节点 = 引擎 + 宿主（自定义节点带状态点），边 = 接线关系（绿 ✓ 已接线 / 琥珀 ⚠ 漂移 / 灰 ✗ 未接线）；**点击宿主节点切换接线**（再提交才落盘）；`config.json5` 仍是唯一真源，图 = 视图 + 编辑面。
4. **构建管线**：`logo-mark.png` sips 缩 96px → base64 写入 `src/generated/logo.ts` → esbuild（jsx automatic + minify）→ `@tailwindcss/cli`（tokens.css + utilities）→ build.mjs 组装 `dist/index.html`（style/script 全内联，零外部请求）→ 产物进 `packages/cli/src/skills/wizard/` 由 server.ts 直出。
5. **Base UI 承担可访问性**：DangerDialog 用 `Dialog.Root`（`disablePointerDismissal` 禁遮罩误关、Esc=取消、焦点陷阱）、勾选行用 `Checkbox.Root`——不手写焦点管理。
6. **提交原子性（规范 §7 E-6）**：UI 侧 loading/error/成功三态齐备；写盘原子 rename + 失败回滚由 `skills/wizard/server.ts` 承担，契约 = `POST /submit` 返回 `{ ok, written: [{host, path}] | { ok:false, reason(错误码枚举 E-01..E-05) } }`。

## 五、风险与开放问题

| 风险 | 缓解 |
|---|---|
| Orama mandarin 依赖 Intl.Segmenter | Node ≥22.18 全量内建；status 加运行时自检 |
| Orama 索引持久化跨版本 | index/ 版本号文件，schema 变更整库重建（<1000 技能毫秒级） |
| wizard 起 http 服务的安全/端口面 | 只绑 127.0.0.1 随机端口 + 单页 + 提交即关；无外部依赖面 |
| 无头环境（CI/ssh）拉不起浏览器 | `--yes` 缺省直通全默认；检测非 TTY 自动降级并向导跳过 |
| 五平台 + 三技能 + 管理工具面变宽 | tools.ts 按 platformTools / skillTools / manageTools 分组构建；decision 文档锁定 9 工具面 |
| `@modelcontextprotocol/sdk` 迭代快 | lockfile 锁定 + 迁移 PR 单独可回滚（run 逻辑不动） |
| CLI 包改动面变大（skills + mcp + wizard 都在里面） | 四命令入口清晰；现有六命令（register/publish/query/use/verify/validate）零改动 |
| Phase 3 发布机制接口预留 | store 落盘保留 `lifecycle.provenance`（sig_ id / digest / origin），接 watch 链路零迁移 |
