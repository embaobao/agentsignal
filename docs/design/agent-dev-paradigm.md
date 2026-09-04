# Agent 开发范式（Agent Dev Paradigm）

> 版本：2026-09-02 · 上位：[AGENTS.md](../../AGENTS.md)（规则 8/9/10/11 的操作细化）
> 读者：**人与 Agent 同权重**。任何在本仓库开发的人或 Agent，走同一套闭环；新接手的 Agent 从本文 + [维护速查表](maintenance-cheatsheet.md)冷启动，不问人、不重盘。
> 为什么有本文：docs 会进公开站（[分级规范](../site-publishing-policy.md)），也会被下一个冷启动的 Agent 逐字读——写清楚一次，所有人都省一次。

## 一、开发闭环：五阶段，每次必须入账

```
定题 → 立账 → 动码 → 验收 → 入账传播
```

| 阶段 | 做什么 | 产物 / 检查点 |
|---|---|---|
| **1 定题** | 查速查表定位 → 查台账/openspec 是否有人在做 → 判断是「执行在册任务」还是「新范围」 | 撞车检查：他人「开发中」标记**只读不覆盖** |
| **2 立账** | 新功能/新范围 → 先立 openspec 提案（proposal + tasks），**站长批准才动码**（站长令 2026-09-02）；在册任务 → 直接进 Phase | openspec/changes/&lt;name&gt;/ |
| **3 动码** | 按速查表「变更配方」抓药；测试随行（先测后合）；协议变更先 decision | `pnpm verify` 绿 |
| **4 验收** | 过 §四 DoD：四本账 + 两手册 + 护栏测试 | 自查清单（§六）全勾 |
| **5 入账传播** | 台账/tasks.md/当前阶段/README 进度行当场回写；手册按矩阵同步；定义变更 grep 全库 | **同一 PR 内完成，禁止攒账** |

> **入账是开发的一部分，不是开发之后的行政**。代码合了账没记 = 任务没完成（P0 流程缺陷，AGENTS.md 治理 §10）。

## 二、动码纪律（四条硬规则）

1. **测试随行**（治理 §8）：无测试的代码视为未完成。后端 node:test 单口径（`apps/api/test/`，注入式测试库），UI 用 vitest；e2e 打真实服务。
2. **协议先行**（治理 §6）：信封/API 语义变更**先立 decision 再改代码**，改完 grep 旧词在活文档区零命中。
3. **CLI↔SKILL lockstep**（治理 §9）：CLI 命令面变更同 PR 更新 participant SKILL.md（版本 lockstep）+ 复制根 `skills/` 分发镜像（G4），跑绿 G1–G4。
4. **最小解**：不做任务范围外的重构/美化；发现的缺口**记进台账**，不顺手改（多 Agent 并行，顺手改=撞车）。

## 三、手册随行矩阵（治理 §11 的操作表）

手册是**对外 docs 资产的源头**：写手册时读者是「公开站上的外部用户/Agent」，不是自己。

| 改动影响面 | 必须更新 | 口径 |
|---|---|---|
| 用户可感知功能（UI 新页面/交互、REST 行为变化） | [design/user-manual.md](user-manual.md)（功能手册） | 只写**今天真实可用**的；未上线进「边界」节 |
| Agent 接入/命令面/流程（CLI 参数、SKILL 步骤、MCP 工具） | `packages/skills/participant/SKILL.md`（Agent 手册）+ 根 `skills/` 镜像 | 版本 lockstep；G1–G4 护栏跑绿 |
| 管理面（admin 端点、审计、备份） | [design/admin-guide.md](admin-guide.md) | 同 user-manual 口径 |
| 部署/环境变量/托管形态 | [design/deployment.md](deployment.md) 对应表 | 逐项与 `.env.example`/netlify.toml 一致 |
| 协议语义 | `docs/protocols/*.md`（decision 先行） | grep 旧词零命中 |
| 术语/功能定义 | [design/glossary.md](glossary.md)（唯一权威源） | 其余位置只引用不定义 |

## 四、DoD：四本账 + 两手册

每次交付（PR/commit）落地时逐项过：

- [ ] **账 1**：[implementation-tasks.md](implementation-tasks.md) 勾选完成项 + 新缺口当场登记
- [ ] **账 2**：对应 openspec change 的 tasks.md 勾选（只勾自己完成的）
- [ ] **账 3**：里程碑级变化 → [AGENTS.md](../../AGENTS.md)「当前阶段/剩余」节刷新
- [ ] **账 4**：[docs/README.md](../README.md) 顶部进度行刷新（一行以内，不写细节）
- [ ] **手册**：§三矩阵过一遍，命中的手册已同 PR 更新
- [ ] **护栏**：`pnpm verify` 全绿；CLI 变更 → G1–G4；公网路由变更 → e2e 回归

## 五、双读者写作标准（所有 docs/openspec/手册适用）

1. **每段只说一个事实**；表格优先于长句。
2. **命令可复制执行**：写全路径、全参数，不写「类似 xxx 的命令」。
3. **不用只有当前会话懂的代号**：缩写首次出现给全称（Exception: [glossary](glossary.md) 已注册术语直接用）。
4. **人读得顺，Agent 解析得准**：结构化（标题/表格/代码块），避免「如上所述」「参见前文」式指代——Agent 可能只读单文件。
5. **时态即状态**：写「已上线/未开工/已否决」，不写「正在考虑」。过期描述当场删或重写（治理 §5），禁止历史备注体。

## 六、PR 自查清单（复制即用）

```markdown
- [ ] pnpm verify 全绿（check + lint + test + test:ui）
- [ ] 测试随行：新行为有测试；修 bug 先复现测试
- [ ] 四本账已回写（台账 / openspec tasks / 当前阶段 / README 进度行）
- [ ] 手册矩阵过完：命中的手册已同 PR 更新
- [ ] CLI 变更 → SKILL lockstep + 根镜像复制 + G1–G4 绿
- [ ] 协议/术语变更 → decision 先行 + grep 零命中
- [ ] 新增文档 → site-publishing-policy.md 归级 + docs/README 登记
- [ ] 未动他人「开发中」的文件
```

## 七、多 Agent 并行约定

- 开工前 `git status` 看在途改动；**工作区未提交的文件 = 他人在开发，勿动勿重做**。
- 各自只勾自己完成的台账/tasks 项；遇到他人「开发中」标记只读不覆盖。
- dev server 归站长自己跑；助手验证后必须收掉自己起的后台实例（勿 broad kill）。
- 完成一个 Phase/任务 → 当场入账（§四），不攒到会话结尾。
