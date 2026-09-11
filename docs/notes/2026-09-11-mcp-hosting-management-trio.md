# 外部输入归档：MCP 托管/网关/管理 三件套调研（mcp-gateway · skills-manager · mcphub）（2026-09-11）

> 站长令：评估「引入 MCP 动态加载 + skill 动态加载 + Agent 整体安装管理（类 repo agent），未来 fork 一个远程 Agent 做临时方案执行」。
> 结论先行：**MCP 动态加载不自建网关（三个现成轮子都已做熟且形态与我们冲突），落法 =「外挂兼容」；skill 动态加载 0.5.0 已落地；真正值得自建的空白位 =「fork 远程 Agent」——把一组已验证经验一键物化成临时执行环境，三家都没做，这是我们的差异位。**

## 来源（引用保留）

| # | 项目 | 引用 | 访问日期 | License |
|---|---|---|---|---|
| 1 | microsoft/mcp-gateway | <https://github.com/microsoft/mcp-gateway> | 2026-09-11 | MIT |
| 2 | xingkongliang/skills-manager | <https://github.com/xingkongliang/skills-manager/blob/main/README.zh-CN.md>（官网 skillsmanager.dev） | 2026-09-11（前次部分覆盖于 [2026-09-10 笔记](2026-09-10-skill-management-landscape.md)） | MIT |
| 3 | samanhappy/mcphub | <https://github.com/samanhappy/mcphub/blob/main/README.zh.md> | 2026-09-11 | Apache-2.0 |

## 一、microsoft/mcp-gateway —— 企业级 MCP 托管网关（K8s 控制面）

官方定位："a reverse proxy and management layer for Model Context Protocol (MCP) servers"。

- **形态**：Kubernetes 常驻集群——数据平面（`POST /adapters/{name}/mcp` 直连 + `POST /mcp` Tool Gateway Router 动态路由）+ 控制平面（adapter/tool CRUD REST API）；MCP server 以容器 Pod 由网关动态部署，"Session-Aware Stateful Routing" 会话亲和；Entra ID 认证 + `mcp.admin/engineer` 角色；React 管理门户
- **技术栈**：C#/.NET 8、StatefulSet、Cosmos DB、AKS/Bicep
- **判断**：组织级 MCP 基础设施，服务「集中托管大量 MCP server」的平台团队。对单机个人场景**过重三个数量级**：我们要 K8s 吗不要；我们要 Entra ID 吗不要。**可吸收的概念**：① adapter 注册 → 路由两步分离（与 0.5.0「订阅落库 ⇄ 装入宿主」同构）；② 会话亲和的存在的理由（有状态 server）提醒我们：若未来 `agentsignal mcp` 扩工具面，无状态优先

## 二、xingkongliang/skills-manager —— 技能中央库 + 多宿主部署（桌面 App）

前次笔记已裁「形态不引入、吸收四点概念」（install⇄deploy 分离 / provenance 不可丢 / 反向可见性 / 更新跟踪+快照回滚）。本次补齐引用级细节：

- **中央库** `~/.skills-manager`：Git 仓库 / 本地目录 / .zip / skills.sh 市场四源安装；"远端始终是纯 Git 仓库——随时可以 git clone 走，没有锁定"
- **53 宿主**开箱支持（Claude Code/Codex/Cursor/Cline/Goose/TRAE…，可自定义）；`skills deploy react-best-practices --agent claude_code --agent codex` 显式推送；`adopt` 把宿主既有技能纳管；破坏性命令带 `--dry-run`/`--yes`/`--json`
- **以 skill 分发自己**：提供 `manage-skills` skill，让 Agent 替用户驱动管理器，且"走的是驱动 Skills Manager 而不是绕过它直接写 agent 目录"——保住 provenance/preset/更新追踪。发布方式 `npx skills add xingkongliang/skills-manager`
- **判断**：分发矩阵与自分发机制是同类最佳；但它「不解决经验跨 Agent 流动」（前次结论维持）。对我们的操作含义：participant 的分发**借这些生态做出口**（`npx skills add` 兼容布局已由 host-matrix Phase 3 承接），不自建第二张矩阵

## 三、samanhappy/mcphub —— 自托管 MCP 网关 + 控制平面（Node）

官方定位："MCP 网关与控制平面"，AI 客户端与 MCP 服务器之间的"统一控制点"。

- **形态**：Docker 常驻服务（`:3000`，可 `DISABLE_WEB=true` 只留 API）；聚合多本地/远程 MCP server；"热插拔配置——无需停机即可添加、移除或更新服务器"；SSE / Streamable HTTP / stdio 三传输
- **路由**：`/mcp`（全部）· `/mcp/{group}`（分组）· `/mcp/{server}`（单服）· `/mcp/$smart`（pgvector 语义工具发现）
- **治理**：Web 控制台 + CLI + 市场（`mcphub discover/install`）；OAuth 2.0/Bearer/per-user 凭据加密；日志与延迟监控
- **技术栈**：Node/Express/TS + React/Vite + 文件或 PG(pgvector)——**与我们的栈最亲**（Node/TS、文件式存储起步）
- **判断**：三件里唯一形态可兼容的——它可以是**用户本机的一个可选外挂服务**，而非我们内置的常驻件

## 四、三问对答（站长令逐条）

| 问 | 答 |
|---|---|
| **MCP 动态加载？** | **不自建网关**。三件证明这是成熟赛道（企业级/自托管/桌面三种形态俱全），自建 = 重造轮子 + 撞「无常驻」红线。**落法 = 外挂兼容**：`wiring/hosts.ts` 增加一类「MCP 端点透传」宿主条目——用户若已跑 mcphub/gateway，init 可把其统一端点写进宿主配置；AgentSignal 的 9 工具面不变（守裁决），外部 MCP 能力经用户自己的网关按需增删。技能面动态到达已由 0.5.0 订阅同步落地 |
| **skill 动态加载？** | **已落地**（0.5.0）：订阅同步 → transcoder 落库 → 检索即命中；`use --install` 单条装载。skill-management-landscape 笔记指出的「落库 ≠ 宿主可见」断裂已由 wiring 接线接通。三件套的 install⇄deploy/provenance/反向可见性四点与我们对齐，外部印证方向正确 |
| **Agent 整体安装管理 / fork 远程 Agent？** | **这是唯一值得自建的新命题，且是空白位**——三件都只管「工具/技能」这个物质层，没有一家管「经验流 → 临时执行环境」。我们的零件已齐：订阅（拉经验流）+ transcoder（溯源落库）+ use --install（装载）+ wiring（接线）+ 更新链（跟随上游）。缺的只是一层**编排**：`agentsignal fork <来源>` = 把某来源（远程 Agent 的公开 preset / 一组 topic / 一个 sig 集合）一键物化为本机临时环境（技能落库 + 订阅挂上 + 宿主接线），用完 `uninstall` 零残留。与 skills-manager 的 Preset 同构但多两样它没有的：**经验 provenance 链** 与 **回流通道** |

## 五、建议（不排期，供站长裁决）

1. **不做**：自建 MCP 网关/hub/控制平面（任何形态）——三个轮子+jam，撞红线
2. **小步（可排期）**：wiring「MCP 端点透传」条目（mcphub/gateway 用户的一等公民支持）——一个 HostDef 级改动，host-matrix-alignment 顺手可捎
3. **中步（建议立项，排队 D/E 后）**：`fork` 编排提案（agent-preset）：来源解析（远程 preset 清单格式）→ 订阅批量挂载 → 技能批量落库 → 宿主接线 → 临时标签 → uninstall 零残留；verdict/metrics 随环境走
4. **差异位宣示**：对外叙事钉死一句——「skills-manager 管技能文件，mcphub/mcp-gateway 管 MCP 通道，AgentSignal 管经验本身；fork 一个远程 Agent 的临时执行环境，只有经验层做得到」

## 关联

- [2026-09-10 skill-management-landscape](2026-09-10-skill-management-landscape.md)（断裂发现 + 四点吸收）
- [2026-09-09 semantic-router 评估](2026-09-09-semantic-router-evaluation.md)（embedding 成本论证）
- [teamai-host-matrix](../design/teamai-host-matrix.md) §四（多一个出口，不是交出分发）
