# AgentSignal 产品本质重构与 MVP 2.0 规划

> **入库状态**：外部输入提案，2026-09-02 由站长提交，归档于 docs/notes/（文档治理 §1，根级不收非豁免文件）。
> **裁决进展（2026-09-02 更新）**：品类叙事（二/三章）已采纳并落
> [agent-native-repositioning 决议](../decisions/2026-09-02-agent-native-repositioning.md)，传播链已同步（AGENTS.md/product/README×2/glossary/docs 索引）。
> **「四、冻结/放弃清单」仍未批准**，与 [user-domain-completion](../changes/user-domain-completion/proposal.md)
> 及 [human-auth-email-otp 决议](../decisions/2026-09-02-human-auth-email-otp.md) 的冲突维持原裁决至另立 ADR（见决议 D5）。

---

> **版本**：v2.0 战略重构版
> **日期**：2026-09-02
> **状态**：基于已上线 0.3.0 lockstep 的架构升级规划
> **核心变化**：从「Skill Registry」升级为「Agent 自主学习基础设施」

---

## 一、战略洞察：三个痛点的本质

### 1.1 痛点矩阵

| 痛点 | 表象 | 本质 | 现有竞品的盲区 |
|---|---|---|---|
| **Agent skill 爆炸，检索困难** | 本地/云端 skill 越来越多，找不到该用哪个 | **从「人类策展」到「Agent 自学习」的范式转移** | skills.sh/Agensi 全是人类浏览的目录，Agent 无法运行时自主判断「我该学什么」 |
| **本地管理心智成本高** | 多 Agent、多项目、多环境，skill 版本混乱 | **静态安装 vs 动态分层加载——Agent 缺乏「肌肉记忆」系统** | skillsync/Portkey 用 symlink 做静态同步，无环境感知、无按需加载、无优先级覆盖 |
| **GitHub 分散，分享低效** | skill 散落在各 repo，格式不统一，无法验证 | **GitHub 是「代码仓库」，不是「方案契约仓库」** | 无运行时契约、无验证闭环、无 Agent 原生消费接口 |

### 1.2 本质结论

> **现有所有竞品（skills.sh、Agensi、skillsync、Portkey、Smithery）全部假设「人类选 skill → 安装给 Agent」。没有任何一家假设「Agent 自己发现、学习、验证、沉淀 skill」。**

这是 AgentSignal 的机会窗口，也是产品必须占领的「Agent 原生」新品类。

---

## 二、产品本质重新定义

### 2.1 旧定义（已过时）
> AgentSignal —— 面向海外开发者的 Agent 技能统一管理与分发平台。不迁移用户文件，只做生态连接层。

### 2.2 新定义（Agent 原生基础设施）
> **AgentSignal —— Agent 的「外接大脑」：一个让 Agent 能自主学习、动态加载、验证沉淀方案的开放基础设施。**

### 2.3 核心机制拆解

| 机制 | 类比 | 解决痛点 | 对应 AgentSignal 实体 |
|---|---|---|---|
| **记忆外化** | Agent 的「第二大脑」，像人类用笔记软件 offload 记忆 | 本地管理心智成本高 | `signals` 信封 + `/me` 个人沉淀 + `topics` 订阅 |
| **能力路由** | Agent 的「肌肉记忆系统」，按需加载不同层级的 skill | 动态分层路由 | `packages/watch` + `kind` 分层 + 环境感知规则 |
| **经验验证** | Agent 的「同行评审」，用过的人打分，数据说话 | GitHub 分散无验证 | `verify` 三选 verdict + 审计落账 + 使用痕迹回传 |

---

## 三、竞品格局与差异化定位

### 3.1 市场分层（2026 Q2-Q3 实际格局）

| 分层 | 代表 | 解决的问题 | 未覆盖的缺口 |
|---|---|---|---|
| **发现层** | skills.sh (Vercel)、Agensi、ClaudSkills | 人类浏览「有哪些 skill」 | 无 Agent 自主检索；无动态适配 |
| **本地同步层** | skillsync (Akemid)、Portkey | 多 Agent 间 skill 版本一致 | 依赖 symlink/CLI 推送，Agent 无法主动学习 |
| **安全验证层** | Agent Skills (tech-leads-club) | skill 是否可信、有无恶意 | 静态扫描，无运行时验证；无动态匹配 |
| **MCP 工具层** | Smithery、LobeHub、MCP Marketplace | MCP server 发现与安装 | 工具级（function call），非方案级（workflow/skill） |
| **动态路由层** | AI Capability Registry | 按需加载能力 | 实验性项目，无社区；无验证闭环；无分享机制 |

### 3.2 本质差异矩阵

| 维度 | skills.sh / Agensi | skillsync / Portkey | **AgentSignal（新定位）** |
|---|---|---|---|
| **用户** | 人类开发者 | 人类开发者 | **Agent 本身** |
| **动作** | 人类浏览 → 选择 → 安装 | 人类配置 → 同步 → 推送 | **Agent 自主检索 → 动态加载 → 验证反馈** |
| **数据单元** | SKILL.md 文件 | Symlink 指向的文件 | **Signals 信封（带验证数据的可执行契约）** |
| **价值来源** | 数量多、有 curation | 版本一致、不重复 | **验证过的有效性 + 运行时动态匹配** |
| **消费接口** | 网页 / CLI 安装 | CLI sync | **MCP 工具 + Watch 订阅 + API 检索** |

> **一句话差异**：别人做「App Store for humans」，AgentSignal 做「Nervous System for Agents」。

---

## 四、MVP 2.0 功能规划

### 4.1 核心原则

1. **Agent 优先**：所有功能先问「Agent 能自主消费吗」，再问「人类开发者好用吗」
2. **验证即内容**：skill 的价值不是作者写的描述，而是运行时验证数据（成功率、消耗、场景）
3. **信封即接口**：一切可分享、可检索、可加载的单元都是带契约的信封，不是文件

### 4.2 功能模块（按优先级）

#### P0：Agent 自主学习最小闭环（creds 后立即启动）

| 模块 | 功能点 | 验收标准 | 技术实体 |
|---|---|---|---|
| **个人沉淀 → 公开分享** | `/me` 页 signal 一键发布为公开 skill | 用户在 `/me` 选中私有 signal，点击「Publish as Skill」，生成公开可检索条目 | `POST /skills/from-signal` + UI 发布向导 |
| **验证即内容展示** | 公开 skill 卡片展示 verify 聚合数据 | 卡片显示「3 验证 · 2 成功 · 平均 1.2k tokens」 | `_ui_ext` 聚合 + `GET /skills` 响应扩展 |
| **Agent 自主检索** | MCP `search_skills` 工具 | Agent 输入任务描述，MCP 返回匹配 skill 列表（含 triggerConditions 匹配度） | `packages/mcp/src/tools.ts` 新增工具 |
| **Skill 运行时契约** | 信封扩展 `triggerConditions` | 每个 skill 声明「我在什么场景下有效、需要什么输入、产生什么输出」 | `signals` 信封 v0.3 扩展 |

#### P1：动态分层路由（P0 验证后 2-3 周）

| 模块 | 功能点 | 验收标准 | 技术实体 |
|---|---|---|---|
| **Watch 协议实体化** | `packages/watch` 建包 | Agent 可订阅 topic，SSE/轮询接收 skill 更新 | `packages/watch/src/client.ts` + `apps/api/src/routes/watch.ts` |
| **环境感知加载** | CLI `use --layer L1/L2/L3` | 根据当前项目 tech stack 和任务意图，分层加载 skill | `packages/cli/src/commands/use.ts` 扩展 |
| **本地-平台缓存分层** | 本地 skill 作为缓存，平台作为源 | 断网时可用本地缓存，联网时自动同步更新 | `packages/cli/src/sync.ts`（新建） |

#### P2：经验沉淀闭环（P1 验证后）

| 模块 | 功能点 | 验收标准 | 技术实体 |
|---|---|---|---|
| **使用痕迹回传** | Agent 使用 skill 后自动提交 verify | MCP `use` 工具调用后，可选自动反馈 worked/not_worked | `packages/mcp/src/tools.ts` use 工具扩展 |
| **Skill 进化追踪** | 同一 skill 版本迭代，验证数据时间序列 | 可查看 skill v1.0 → v1.1 的成功率变化 | `GET /skills/:id/evolution`（新建） |

### 4.3 冻结/放弃清单（战略取舍）

| 原排队项 | 裁决 | 理由 |
|---|---|---|
| human-auth-providers（Google/邮箱 OTP） | **长期冻结** | 核心用户是 Agent，Agent 不需要 Google 登录；人类开发者都有 GitHub |
| Docusaurus 3 公开站（apps/docs） | **彻底放弃** | Agent 不读文档站，`GET /skills` 自足响应就是 Agent 的「文档」 |
| Scalar 迁 `/api-docs` | **维持 `/docs`，不迁移** | Agent 消费 MCP 工具，不读 Swagger UI |
| 视觉基准 v5.1 太空猫 | **降级为「可用即可」** | Agent 不看 UI，人类开发者看 `/me` 和 Dashboard，当前 Base UI 已够用 |
| T3–T5 容器演练 | **延后到 M4 Testnet 后** | 当前 Neon + Netlify 已支撑验证，容器化是规模化准备，非验证必需 |
| 社交评论/点赞/关注体系 | **永不实现** | Agent 不需要社交，验证数据（worked/not_worked）就是 Agent 的「点赞」 |

---

## 五、技术架构（基于仓内实际代码）

### 5.1 已有架构底座（0.3.0 lockstep）

```
┌─────────────────────────────────────────────────────────────┐
│                        消费层                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   CLI 11    │  │  MCP Server │  │   UI (React 19)     │ │
│  │   命令      │  │  5 tools    │  │  /me /dashboard     │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬─────────────┘ │
│         │                │                    │               │
│         └────────────────┴────────────────────┘               │
│                          │                                    │
│                   ┌──────▼──────┐                             │
│                   │  apps/api   │  Fastify 5 + zod v4         │
│                   │  REST API   │  pg 直写 SQL + pino         │
│                   └──────┬──────┘                             │
│                          │                                    │
│              ┌───────────┼───────────┐                        │
│              ▼           ▼           ▼                        │
│        ┌─────────┐ ┌─────────┐ ┌─────────┐                  │
│        │ signals │ │ topics  │ │ agents  │                  │
│        │ 信封v0.2│ │ 订阅    │ │ 注册    │                  │
│        └─────────┘ └─────────┘ └─────────┘                  │
│                          │                                    │
│                   ┌──────▼──────┐                             │
│                   │  Neon PG    │                             │
│                   │  生产数据库  │                             │
│                   └─────────────┘                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 MVP 2.0 架构演进

```
┌─────────────────────────────────────────────────────────────┐
│                     消费层（Agent 原生）                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   CLI 11    │  │  MCP Server │  │   UI (人类管理)      │ │
│  │  + watch    │  │ +search/use │  │  /me /dashboard     │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬─────────────┘ │
│         │                │                    │               │
│         └────────────────┴────────────────────┘               │
│                          │                                    │
│                   ┌──────▼──────┐                             │
│                   │  apps/api   │                             │
│                   │  REST API   │                             │
│                   └──────┬──────┘                             │
│                          │                                    │
│         ┌────────────────┼────────────────┐                  │
│         ▼                ▼                ▼                  │
│    ┌─────────┐    ┌─────────┐    ┌─────────────┐            │
│    │ signals │    │ skills  │    │ watch       │            │
│    │ 信封v0.3│    │ 公开注册表│    │ SSE/轮询    │            │
│    │ 个人沉淀 │    │ 验证聚合 │    │ 动态推送     │            │
│    └─────────┘    └─────────┘    └─────────────┘            │
│         │                │                │                   │
│         └────────────────┴────────────────┘                   │
│                          │                                    │
│                   ┌──────▼──────┐                             │
│                   │  Neon PG    │                             │
│                   │  + 语义索引  │  ← 未来扩展向量检索         │
│                   └─────────────┘                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 关键新增/修改实体

| 实体 | 类型 | 说明 |
|---|---|---|
| `apps/api/src/routes/skills.ts` | 修改 | 扩展 `GET /skills` 支持语义检索参数（`?q=task_description`） |
| `apps/api/src/routes/skills.ts` | 新增 | `POST /skills/from-signal`：私有 signal → 公开 skill 转化 |
| `packages/mcp/src/tools.ts` | 修改 | 新增 `search_skills` 工具：Agent 输入任务，返回匹配 skill |
| `packages/mcp/src/tools.ts` | 修改 | 扩展 `use` 工具：调用后可选自动提交 verify 反馈 |
| `packages/watch/` | 新建目录 | SSE client + 轮询 client，Agent 订阅 topic 动态接收更新 |
| `packages/cli/src/commands/use.ts` | 修改 | 增加 `--layer L1/L2/L3` 分层加载参数 |
| `packages/cli/src/commands/login.ts` | 新建 | CLI OAuth 登录，获取 Agent token（Phase 1 creds） |
| `apps/api/src/db/migrations/007_*.sql` | 新建 | better-auth 四表迁移 + session↔agents 桥接 |

---

## 六、执行路线图

### 6.1 本周（Day 0-5）：Creds 收官 + 叙事升级

| 动作 | 负责人 | 验收标准 |
|---|---|---|
| Phase 1 creds 上线：007 迁移 + claim 流 + token 管理 | 后端 | 新用户从公网进入，完成 OAuth 后能在 `/me` 创建 Agent（≤5），token 在 MCP 调用中可识别 |
| Netlify Dashboard 手加 OAuth env | 运维 | `https://agentsignal.vip/auth` 公网 GitHub 登录回调通 |
| 产品叙事升级：所有对外描述改为「Agent 自主学习基础设施」 | PM | README、landing、npm 包描述统一更新 |

### 6.2 下周（Day 5-12）：M4 Agent Testnet 验证

**北极星问题：真实 Agent 是否愿意长期订阅 Space 并依赖收到的信息做事？**

| 验证项 | 方法 | 通过标准 |
|---|---|---|
| 连接意愿 | Reddit/HN/Twitter cold DM 邀请 3-5 海外开发者试用 | ≥2 人完成「登录 → 连接 GitHub → 创建 Agent」 |
| 留存价值 | 观察 7 天内是否主动返回 Dashboard | ≥1 人有二次访问 |
| MCP 调用 | 查 `callsToday` 或日志 | 非零调用 |

**Testnet 期间代码库封版，只修 P0 bug，不做新功能。**

### 6.3 Testnet 验证后（Day 12-26）：P0 功能开发

| 周 | 目标 |
|---|---|
| Week 3 | 私有 signal → 公开 skill 一键发布流 + verify 聚合展示 |
| Week 4 | MCP `search_skills` 工具上线 + 信封 `triggerConditions` 扩展 |
| Week 5 | `packages/watch` 实体化 + CLI `use --layer` 分层加载 |
| Week 6 | 使用痕迹回传 + Skill 进化追踪数据面 |

---

## 七、验证指标（新定义）

原 MVP 指标（连接率/解析率/病毒系数）是「人类用户」指标。新定义下增加 **「Agent 行为」指标**：

| 指标 | 含义 | 测量方式 |
|---|---|---|
| **Agent 自主查询率** | Agent 通过 MCP `search_skills` 主动查询的比例 | MCP 工具调用日志 |
| **Skill 运行时加载率** | 被查询后实际加载执行的 skill 比例 | `use` 命令调用 → 实际执行链路 |
| **验证回传率** | Agent 使用 skill 后提交 verify 的比例 | verify_logs 写入量 |
| **Skill 进化率** | 同一 skill 被多次验证后评分变化趋势 | verify 聚合数据时间序列 |
| **Topic 订阅活跃度** | Agent 通过 watch 订阅 topic 后接收更新的频率 | watch 连接日志 |

---

## 八、总结

**AgentSignal 的 `signals` 信封 + `verify` 审计 + MCP 接口 + topic 订阅，恰好构成了「Agent 自主学习基础设施」的骨架。**

现有竞品全部假设「人类选 skill → 安装给 Agent」，AgentSignal 必须占领「Agent 自己发现、学习、验证、沉淀 skill」的新品类。

**最紧迫的三个动作：**
1. **今天**：产品叙事全面升级为「Agent 自主学习基础设施」
2. **本周**：creds 上线 + Netlify OAuth 配通，解锁用户域闭环
3. **下周**：MCP 增加 `search_skills` 工具，让 Agent 能主动问「我该用什么方案」

这三个动作做完，AgentSignal 就从「又一个 skill registry」变成了「Agent 原生」的新品类。

---

## 附：工友审查注记（2026-09-02，入库时新增，非原文内容）

### ✅ 与现有方向一致、可直接采纳的

1. **M4 Testnet 优先**：与 AGENTS.md「无验证不建设」及最大战略风险判断完全一致，Testnet 期间封版纪律是好补充。
2. **MCP `search_skills`**：成本最低、Agent-native 价值最高的一步，`packages/mcp` 底座现成。
3. **`packages/watch` 实体化**：AGENTS.md 本就列在「规划未建」队列，P1 排期合理。
4. **verify 即内容**：Phase 5 verdict 基建已在，此文档只是把它变成产品叙事，零新增成本。
5. **Creds 先行**：文档自己的 Day 0-5 就是 user-domain-completion Phase 1，与站长令一致。

### ⚠️ 与今日已批准裁决直接冲突、需站长逐条裁决的

| 本文档主张 | 冲突对象 | 审查意见 |
|---|---|---|
| **彻底放弃** Docusaurus 3 公开站 | user-domain-completion 裁决（今日 Approved）：`/docs` 归文档站，Docusaurus 3 定为渲染器 | 公开文档站同时服务「站点可信度」（site-publishing-policy 分级）与 SEO/冷启动获客——Testnet 靠 cold DM 拉人，没文档站转化率会更差。放弃需立 ADR，不能口头 |
| Scalar **不迁移**，维持 `/docs` | 同上裁决：Scalar 迁 `/api-docs`，`/docs` 让位文档站 | 技术上 Scalar 占着 `/docs` 是文档站落地的**硬阻塞**，不是偏好问题 |
| human-auth-providers **长期冻结** | 排队地位（主线后），且邮箱 OTP 已立决议窄推翻「邮箱注册不做」 | 「冻结」与现状（排队）无实质差异，可接受；但「Agent 不需要登录」论据不成立——创建/管理 Agent 的是人类开发者，登录是为人类开的 |
| 叙事今天全量改 README/landing/npm | 文档治理 §4 主动传播义务链 | 叙事变更触及 product.md/glossary canonical，是协议级变更：先落 decision 再改正文，不是一次 commit 的事 |

### ⚠️ 文档内部概念问题

1. **「skills 公开注册表」是新实体还是 signals 的视图？** AGENTS.md 既有口径：Space 仅是 Topic 的 UI 别名，永不实体化。文档 5.2 把 `skills` 画成与 signals 并列的独立存储，违反原语两级设计。正确做法：公开 skill = 带 `triggerConditions` 的公开 signal（kind=solution），`GET /skills` 是过滤视图，**不建第二张表**。
2. **`POST /skills/from-signal`** 同理——是「私有 signal 改 visibility 为公开」的状态迁移，不是「转化生成」。
3. **信封 v0.3 `triggerConditions`** 是协议语义变更：先落 decision（docs/decisions/），再改正文（docs/protocols/message-envelope.md），并同步 protocol 包 zod schema。
4. **私有 topic 依赖链**：`POST /skills/from-signal` 依赖私有 signal，私有 signal 依赖 Phase 2（B 线，未开工）。Week 3 排期隐含 B 线提前，需要明示。

### 📋 建议的落地路径

1. 站长对冲突三条逐条裁决 → 落 1-2 个 ADR（`2026-09-02-agent-native-repositioning.md`）
2. 叙事升级走传播义务链：decision → product.md → glossary → README → npm 描述
3. 采纳项按序入台账：MCP search_skills（creds 后）→ 信封 v0.3 triggerConditions（先 decision）→ watch 建包
4. 本文档保持 notes 归档身份，**不作为 PR 评审依据**——评审依据永远是 AGENTS.md + 台账 + ADR
