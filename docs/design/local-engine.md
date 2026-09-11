# 本地技能引擎（Local Engine）——功能定义唯一真源

> 状态：**已上线**（2026-09-03，[skill-engine 提案](../../openspec/changes/skill-engine/proposal.md) Phase 1 + Phase 2 主体；
> 2026-09-09 增订阅落库 × 回流闭环——[dynamic-skill-management 提案](../../openspec/changes/archive/dynamic-skill-management/proposal.md) P0–P3 +
> [决议 2026-09-08](../decisions/2026-09-08-dynamic-skill-management.md)，发版顺序修订：4.2a 本地自管理全链验证硬门通过后 **0.5.0 已发布**（2026-09-10），服务端生产部署押后）
> 相关决议：[skill-envelope](../decisions/2026-09-02-skill-envelope.md)（技能内部形式）·[mcp-sdk-consolidation](../decisions/2026-09-02-mcp-sdk-consolidation.md)（唯一 MCP server）
> UI 真源：[management-ui-spec-v1.md](management-ui-spec-v1.md)（本地 Web 管理/向导界面）
> 用户手册：[user-manual.md](user-manual.md) §1.5–1.6 · 管理面：[admin-guide.md](admin-guide.md) §6

## 1. 定位与一句话口径

**用户记四个命令，模型记九个工具，其余全是内部实现。**

- 用户面（**恰好四个命令**）：`init` / `mcp` / `status` / `uninstall`
- 模型面（**恰好九个 MCP 工具**）：平台五 + 本地三 + open_setup
- 内部形式：**技能（skill.json5 + SKILL.md）**只做管理与检索，**不进用户命令面、文档与界面文案**
  （术语定义见 [glossary](glossary.md)「技能（Skill · 内部形式）」）
- 北极星服务方式：`agentsignal init` 一次跑完 → IDE 宿主可用，零手工配置

## 2. 用户面四命令

| 命令 | 行为 | 备注 |
|---|---|---|
| `agentsignal init` | 首次：拉起本地 Web 向导（127.0.0.1 随机端口）→ 问答生成 config → 示例经验落盘 → 探测宿主 → 写入 MCP/推接线段落 → 完成报告 | 已初始化后重跑 = 打开管理/状态视图；`--yes` = 无浏览器/CI 直通；`--agent <host>` 覆盖探测；`--no-open` 只打印 URL |
| `agentsignal mcp` | MCP stdio server 本体（由宿主拉起，日常无感） | **仓库唯一** MCP server；无 config 时进 WAITING_CONFIG 拉向导，不报错不退出 |
| `agentsignal status` | 体检：配置 / 索引 / 宿主接线 / 效率双指标 + Intl.Segmenter 自检 + RTK/CodeGraph 共存提示 | 双指标按 bytes÷4 估算并显式声明 |
| `agentsignal uninstall` | 从所有宿主摘除 MCP 配置 / hook / rules（本地库保留） | 摘除不残留是硬断言 |

平台五命令（register/publish/query/use/verify/validate/me/ls/edit/rm）不变，不依赖本地引擎。

## 3. 模型面九工具（`agentsignal mcp`）

| 组 | 工具 | 说明 |
|---|---|---|
| 平台五 | list_spaces / query_signals / use_signal / publish_signal / report_outcome | 1:1 镜像 REST，不新增语义（run 逻辑迁入 CLI 时逐字未动） |
| 本地三 | search_skills / load_skill_detail / verify_skill | 消费本地经验的唯一入口，共享 CLI 引擎单例；verify 只写本地 lifecycle.metrics |
| 管理一 | open_setup | 拉起本地 Web 管理/向导界面，Agent 可替用户触发初始化与调整 |

约束：工具 description 写成**行为引导**（何时用 / 何时别用）；维护类能力（增删技能、重建索引、参数编辑）**不开 MCP 工具、不设用户命令**，只在 CLI 内部。

## 4. 代码结构

```
packages/protocol/src/skill-schema.ts   skill.json5 + config.json5 的 zod 真源（v4，不用 transform/pipe）
packages/cli/src/skills/
  config.ts     config 加载（zod fail-fast；layers 双写 order = P0 错误）+ 原子写
  store.ts      skills/ 扫描 + Orama 索引（mandarin 分词，dump+version，版本不符整库重建）
  retriever.ts  双路并联：Orama 全文 + trigger 规则打分（主路径），keywords 兜底
  layers.ts     Domain Filter + 四态加载 + 逐层 max_tokens 仲裁（LRU → digest 压缩）
  loader.ts     mustache 渲染 + 依赖预检 + 参数四来源链
  verify.ts     本地 verdict → lifecycle.metrics
  metrics.ts    吞吐/残留双指标累计（bytes÷4）
  session.ts    Trace 持久化（只记录不审计；TTL 30min · 50 轮 · graceful shutdown）
  context.ts    推通道内部实现（hook 调用，用户无感；异常静默）
  samples.ts    示例经验落盘（init 自带 2–3 条）
  status.ts     status 命令输出
  wizard/       Web 管理/向导服务 + 单文件 HTML 产物（html.ts 由 wizard-ui 构建注入）
  wiring/       hosts.ts（宿主注册表/探测）· snippets.ts（接线写入/摘除）· uninstall.ts
packages/cli/src/mcp/   唯一 MCP server（server 状态机 + platformTools + skillTools + client）
packages/wizard-ui/      构建期包：React 19 + Base UI + React Flow + Tailwind v4 → 单文件 HTML
```

## 5. 交付三通道与接线矩阵

| 通道 | 载体 | 覆盖 |
|---|---|---|
| ① 拉 | `agentsignal mcp`（9 工具） | 所有 MCP 宿主 |
| ② 推 | hook 输出（内部 `context`，随 init 接线写入） | Claude Code `UserPromptSubmit` |
| ③ 兜底 | 宿主 rules 一行（提示先查本地经验） | 无 hook 位宿主 |

**当前矩阵（Phase 2 收窄声明）**：Claude Code = hook + MCP；Cursor / Gemini / Cline / Codex = MCP + rules 一行。
hooks 能力位已在 `wiring/hosts.ts` 的标志位保留，待宿主 hooks API 稳定后开放。

宿主配置写入只碰 `agentsignal` 自己的条目（`{"command":"agentsignal","args":["mcp"]}`），
Codex 走 TOML 段落合并；任何写入失败返回结构化原因（E-01…E-05），不静默覆盖用户已有配置。

## 6. 参数四来源链

```
项目级 .agentsignal/params.json5 > ~/.agentsignal/params.json5 > 环境变量 > skill.parameters[].default
```

required 落空 → 返回结构化清单（参数名 + 已查层级），模型补齐后可重试；依赖预检（env 存在性 / bins 在 PATH / packages 声明）与参数解析独立进行。

## 7. 指标口径（裁决 9）

- **吞吐节省**：进上下文之前被省掉的（简表代替全文、未注入）
- **残留占用**：本轮会话末仍占用窗口的部分（实际注入）
- token 估算统一 **bytes ÷ 4**，输出处显式声明「仅为量级参考，不代表账单金额」；不承诺「任务完成自动滑出」

## 8. 目录布局（`~/.agentsignal`，`AGENTSIGNAL_CONFIG` 可整体改指）

```
config.json5     向导输出（非用户入口；status 会校验）
params.json5     全局参数覆盖
skills/<id>/     skill.json5 + SKILL.md
sessions/<id>.json  调用轨迹（只记录不审计，自动清理）
index/           dump.json + version（版本不符整库重建）
metrics.json     双指标累计
```

## 9. 测试与验收

- 单口径 node:test；夹具用 `AGENTSIGNAL_CONFIG` + `AGENTSIGNAL_HOME` 临时目录，**不碰真实宿主配置**
- 覆盖：config fail-fast（order 双写）· Orama 中文双路径（「登录 认证」）· keywords 兜底 · 四态装配 ·
  TokenArbitrator 属性测试 · 参数四来源链 · verify 落 metrics · 向导三态 A/B/C（真实 http）·
  init 全链路子进程 e2e（接线 → status → uninstall 不残留）· MCP 九工具（SDK InMemoryTransport）
- 产物护栏：单文件 HTML 零外部请求 + 界面文案无 skills 字样 + SKILL lockstep G1–G4

## 10. 非目标（勿重议）

- 不设 `skills` 用户命令树；不让用户直接编辑配置文件（向导优先）
- 不开MCP 维护类工具；不做登录/token 鉴权（用户域暂缓；回流镜像复用平台 CLI 凭证，不新增登录面）
- ~~服务端发布机制另立提案（Phase 3，不排期）~~ **已落地**：[dynamic-skill-management](../../openspec/changes/archive/dynamic-skill-management/proposal.md)
  （订阅落库 pull 式按需同步、更新链 outdated、源失效 revoked 降权、verify 回流镜像默认手动；
  publish 回平台复用既有平台命令；用户域 creds 仍归 user-domain-completion）

## 10.5 订阅落库 × 回流闭环（dynamic-skill-management，2026-09-09）

- **订阅同步器**（`skills/sync.ts`）：config.json5 `sync.subscriptions`（topic + cursor + min_validation）
  为订阅状态源；pull 式按需同步（管理界面「同步」按钮触发，无常驻进程、零 LLM）；
  游标 = sig id 持久化断点续传；429 按 retry_after 退避；solution 过滤 + validation 阈值；
  update 信号解析 `anchor: sig_x` 命中已装技能才拉详情。
- **更新链**：命中 → `lifecycle.sync_state = outdated` + 更新正文追加 `UPDATES.md` 附加层
  （原 SKILL.md 逐字不动，loadDetail 附于正文之后）。
- **失效降权**：源信号 404/hidden → `revoked`（检索分数 ×0.05 沉底 + 界面置灰，不物理删）。
- **容量治理**：`sync.max_skills`（默认 200）超限仅 status 告警 + 界面标「建议清理」
  （未验证低使用 LRU），确认后手动物理删——不自动删。
- **回流镜像**：`verify_skill` 落本地 metrics 后，带 provenance 的技能默认附手动回传提示；
  `sync.mirror_verify: true` 才自动回传平台聚合（凭证复用 `~/.config/agentsignal/config.json`，env 优先）。
- **管理界面**：B 视图「订阅」区（增删分区 / 同步按钮 / 库列表三态着色 + 候选标记）；
  服务端端点 `/api/subscriptions/*` `/api/sync` `/api/library/delete`。

## 11. 已知收窄与后续

- Cursor/Gemini/Cline/Codex 的 hook 位待宿主稳定后开放（当前走 rules 一行）
- 浏览器人工走查项：路由图交互、360px/1024px 破版检查
- 真实宿主（Cline 等）实测 `load_skill_detail` 渲染全文，待真机补验
