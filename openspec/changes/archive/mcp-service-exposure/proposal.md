# 提案：本地 MCP 服务暴露 —— 从「宿主子进程」到「可选服务端点」（mcp-service-exposure）

> 状态：**Draft（待站长裁决）** · 决策人：站长（zhumeng）
> 来源：2026-09-11 会话评估链（① Cloudflare Workers 迁移可行性 → ② 「本地 MCP 能否承载服务暴露」）
> 关联：[mcp-sdk-consolidation 决议](../../../docs/decisions/2026-09-02-mcp-sdk-consolidation.md)（九工具面铁律）·
> [mcp-hosting-management-trio 笔记](../../../docs/notes/2026-09-11-mcp-hosting-management-trio.md) §四/§五（外挂兼容建议）·
> [dynamic-skill-management 提案](../archive/dynamic-skill-management/proposal.md)（无常驻红线先例）
>
> **范围声明**：本提案只解决「**供给面**」——本地能力能否被服务化暴露。
> **不解决零成本托管**：Cloudflare Workers 路线与本提案正交，定位对比见 §七。

## 一、事实基线（为什么现在提）

一句话结论：**消费面已完成，供给面为空，外挂兼容仅有建议未排期。**

| # | 命题 | 事实 | 证据 |
|---|---|---|---|
| **F1** | 本地 MCP 已承载**平台服务能力** | 九工具面 = 5 平台 + 3 技能 + 1 管理；5 平台工具 1:1 镜像 REST，出海口唯一 | `packages/cli/src/mcp/server.ts:123-140` · `packages/cli/src/mcp/client.ts:26`；测试硬断言 9：`packages/cli/test/mcp-tools.test.ts:84-99` |
| **F2** | 本地 MCP **不能作为服务端点暴露** | transport 硬编码 `StdioServerTransport`，无分支无配置；全仓 0 命中 `StreamableHTTPServerTransport` / `SSEServerTransport` / `/mcp` 路由；接线形态是宿主以子进程拉起 | `packages/cli/src/mcp/server.ts:13`、`:173-174` · `packages/cli/src/skills/wiring/snippets.ts:28-30` |
| **F3** | 唯一本地 HTTP server **不是 MCP 载体** | 向导/管理界面 server 只绑 `127.0.0.1` + 随机端口、提交即关服、无 MCP 协议路由——**不计入服务暴露** | `packages/cli/src/skills/wizard/server.ts:13`、`:367` |
| **F4** | 「外挂兼容」仅建议 | 笔记建议「HostDef 增 MCP 端点透传条目」，但标注**不排期，供站长裁决**；代码中 `HostDef` 只有 4 字段、`HostId` 仅 5 个原生宿主 | `docs/notes/2026-09-11-mcp-hosting-management-trio.md` §五-2 · `packages/cli/src/skills/wiring/hosts.ts:12-26` |
| **F5** | 存在两个真实缺口（P0 前置） | ① 环境变量名分裂，直接打断平台工具 ② 无统一服务抽象，本地/远端两条路径割裂 | 见 §三.0 |

**北极星检验**：F2 的缺失不致命——默认消费形态（宿主子进程 + pull 式）已满足「Agent 愿意长期订阅并依赖收到的信息做事」。
本提案针对的是**增量场景**：用户已跑第三方 MCP 网关（mcphub / mcp-gateway），希望把 AgentSignal 一并纳入统一端点。

## 二、红线（承既有裁决，勿重议）

| # | 红线 | 依据 | 本提案处置 |
|---|---|---|---|
| 1 | 工具面恒九（5 平台 + 3 技能 + 1 管理），平台五工具零语义新增 | mcp-sdk-consolidation 裁决 3/4 | 不动 |
| 2 | 不新增用户命令（用户面恒 init/mcp/status/uninstall） | skill-engine 裁决 12 | 路径 A/B 均只在既有命令内扩展 |
| 3 | **无常驻进程/守护** | skill-engine 裁决 12 · dynamic-skill-management 红线 3 | **路径 A 不破**；路径 B 直接冲突 → 需先落 ADR |
| 4 | 零触碰 `apps/api` | skill-engine 裁决 6 | 全程不碰服务端 |
| 5 | CLI 命令面/参数变更同 PR 同步 participant SKILL（G1–G4 必绿） | AGENTS.md §9 | 若加 `--http` 属参数级变更，须 lockstep |
| 6 | 协议/架构语义变更先落 decisions 再改正文 | AGENTS.md 文档治理 §6 | 路径 B 的 ADR 前置硬门 |

## 三、方案

### 三.0 P0 前置修复（无论走 A 还是 B 都必修）

**① 环境变量名分裂 —— 会直接打断平台工具**

- `packages/cli/src/mcp/client.ts:19` 读 **`AGENTSIGNAL_BASE_URL`**（`docker-compose.yml:30` 亦用此名）
- `packages/cli/src/index.ts:38`、`packages/cli/src/skills/mirror.ts:38` 读 **`AGENTSIGNAL_BASE`**
- 用户面文案却统一说 `AGENTSIGNAL_BASE`（`index.ts:108` USAGE、`skills/wizard/server.ts:335`、`skills/status.ts:156`）

**后果**：用户照文档设 `AGENTSIGNAL_BASE=https://agentsignal.vip` 后，`agentsignal mcp` 的 5 个平台工具**仍会打 `localhost:3000`**。
`wiring/snippets.ts` 写宿主配置时也不注入任何 env——MCP 侧只能靠环境变量，却与环境说明对不上。

**修法**：`RestClient` 兼容双名（`AGENTSIGNAL_BASE ?? AGENTSIGNAL_BASE_URL`）→ 统一文案与 compose → 加双名兼容用例。

**② 缺统一服务抽象**

`RestClient`（远端）与 `Engine`（本地）是两条完全独立的路径，无共享接口；凭证读取重复实现一份（`client.ts:22` vs `skills/mirror.ts:29-40`）。
**修法**：收敛凭证读取到单一模块（返回 `{ base, token }` 的结构化契约）；是否抽公共 client 接口留待 P1 决定。

### 三.1 路径 A（推荐先做）：外挂兼容

- **动点**：`skills/wiring/hosts.ts` 增一类 **endpoint 型 `HostDef`**——写 `url` + `transport` + `headers`，而非现在的 `command` / `args`；`snippets.ts` 增对应写入器与摘除器。
- **收益**：已跑 mcphub / mcp-gateway 的用户，`init` 可把其统一端点写进宿主配置（与笔记 §四「外挂兼容」一致）。
- **成本**：一个 `HostDef` 级改动，`host-matrix-alignment` 顺手可捎。
- **不破红线**：不改 MCP server、不新增命令、不新增常驻件、不碰 `apps/api`。
- **可被订阅的那条**：只写用户自己的网关端点，**不代管**第三方 MCP server 生命周期（那是网关的活）。

### 三.2 路径 B（需 ADR）：自建端点

- **动点**：`mcp/server.ts` 加 transport 分支（`--http` 参数或 config 项）+ 端口监听 + 会话管理（`Mcp-Session-Id`）+ 端点级鉴权。SDK 已在依赖（`@modelcontextprotocol/sdk ^1.30.0`），改动面限于 CLI。
- **三个必须先答的硬问题**：

| # | 问题 | 说明 | 风险等级 |
|---|---|---|---|
| B-1 | **鉴权边界** | 平台五工具用本机 env `AGENTSIGNAL_TOKEN`（`client.ts:22`）。端点一旦可被网络访问，**连接者即继承该 token 的全部权限**（可 publish / verify）。必须引入端点级独立密钥，否则是越权洞 | **P0 阻断** |
| B-2 | **状态与并发** | `~/.agentsignal` 是文件式存储，现在靠「一宿主一 stdio 实例 + 索引 tmp+rename 原子写」兜并发。变端点后多客户端并发打同一引擎，Orama 索引与 metrics 成竞争点 | 高 |
| B-3 | **常驻红线** | 自建常驻端点 = 新增常驻件，直接撞红线 3。按治理 §6 **先落 ADR 再动码** | 流程阻断 |

## 四、分期与验收

| 期 | 内容 | 验收硬口径 |
|---|---|---|
| **P0** | 前置修复：env 名统一（双名兼容）+ 凭证读取收敛 | 双名兼容用例；活文档区 grep 旧名零命中；文案/compose/SKILL 一致 |
| **P1** | 路径 A：endpoint 型 `HostDef` + 写入器 + **摘除不残留** | `AGENTSIGNAL_HOME` 夹具断言（探测/写入/摘除三态）；与 `host-matrix-alignment` 复用同一夹具 |
| **P2** | 路径 B（**ADR 先行**）：transport 分支 + 端点级 auth + 并发方案 | ADR 未通过前不开工；开工后验收另定 |
| **P3** | 文档随行：user-manual（用户面）· participant SKILL（lockstep）· local-engine 升版 | `pnpm verify` 全绿；G1–G4 绿 |

## 五、开放问题（供站长裁决）

1. **路径 B 是否立项？** 提案建议：先做 A；B 等出现真实多客户端需求再立项（否则是为假想场景引入常驻件）。
2. **端点级 auth 模型**（若走 B）：静态密钥 vs 复用平台 token 绑定 vs 仅限回环地址。建议默认**仅回环**，跨机须显式开启。
3. **无 TTY 环境下的 `open_setup`**（若走 B）：向导形态在端点/无头场景如何退化？
4. **是否给平台五工具增加 base/token 显式参数**（支撑多端点/多环境场景）？——属工具 schema 变更，须评估对九工具面"零新增语义"铁律的影响。

## 六、明确不做

- **不自建 MCP 网关 / hub / 控制平面**（任何形态）——成熟赛道且撞红线（笔记 §五-1）。
- **不让 `agentsignal mcp` 默认监听网络**——默认仍为 stdio；暴露只能是显式 opt-in。
- **不代管第三方 MCP server 生命周期**——属于用户网关的职责边界。
- 不在本提案内改九工具面语义、不碰 `apps/api`。

## 七、与 Cloudflare Workers 路线的关系（正交，勿混谈）

| 维度 | Cloudflare 迁移 | 本提案 |
|---|---|---|
| 解决的问题 | **服务端零成本托管** | **本地能力可被服务化暴露** |
| 改动面 | `apps/api` 全量重写（Fastify→Hono、`pg`→Hyperdrive/Neon serverless、`node:fs`→Assets、启动期迁移外移） | `packages/cli` 局部 |
| 决议冲突 | 撞 D3「否决 SQLite」+ container-deployment 单服务形态 | 撞红线 3（仅路径 B），路径 A 无冲突 |
| 额度顾虑 | 免费 10 万请求/天 ≈ 1.16 req/s，对总线过窄 | 无 |

**结论**：二者可并存，互不替代。若都要，建议顺序为 **本提案 P0/P1 → 再评估 Cloudflare**（先拿到低成本的用户价值，再决定是否付费重写服务端）。

## 八、影响面

- 代码：`packages/cli/src/mcp/client.ts`（env 双名）· `packages/cli/src/skills/wiring/hosts.ts` + `snippets.ts`（endpoint 型 HostDef）· `packages/cli/src/mcp/server.ts`（仅路径 B）
- 测试：`packages/cli/test/`（env 兼容用例；新宿主三态断言）
- 文档：`docs/design/user-manual.md`（若走 A/B）· `packages/skills/participant/SKILL.md`（lockstep）· `docs/design/local-engine.md`
- 协议：**REST 端点、信封、九工具面语义零变化**
- 排期定位：P1.5 量级，零触碰 `apps/api` 与 user-domain WIP，可与 P1 暂停期并行
