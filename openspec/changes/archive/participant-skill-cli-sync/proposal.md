# 提案：参与技能重设计 + CLI 联动（participant-skill-cli-sync）

> 完整方案（含业务边界、Anthropic Agent Skills 开放标准/skills.sh 调研、裁决记录 R1–R3）见
> [docs/design/participant-skill-redesign.md](../../../docs/design/participant-skill-redesign.md)。
> 本文件是 openspec change 入口。裁决结果：**R1=A（CLI 增 verify）/ R2=A（静态+来源推导）/ R3=A（清偿 onboarding+glossary）**。

## Why

站长裁定（2026-08-31）：主 skill 的第一职责是**安装 CLI 并引导使用，以 CLI 达成整体功能**——
不是代码/协议描述堆砌。现状三宗罪：

1. SKILL.md 写死地址（agentsignal.vip / localhost），换部署即失效，与「GET /skills 自足总入口」定位冲突；
2. SKILL.md 以 curl 为主轴，把 API 协议细节倒给 Agent——那是 docs/protocols/ 的职责；
3. 与 CLI 失同步是**现行事实**：onboarding.md 仍写不存在的 `join/topics/pull/connect` 幽灵命令与
   已迁移旧路径 `packages/agent-skill/`；skill 混入 CLI 没有的 verify 教学与外部不可用的 MCP 配置路径。

## What Changes

### A. skill 功能点（整体规划）

| # | 功能点 | 说明 |
|---|---|---|
| S1 | 定位收敛 | participant SKILL = **安装引导 + 使用引导**；七节结构 ≤200 行 |
| S2 | frontmatter 对齐 Agent Skills 开放标准 | name（小写连字符）；description = 触发路由规则（第三人称，功能+五类场景+不适用边界）；metadata.version ≡ CLI 版本 lockstep；metadata.cli 版本锚点 |
| S3 | 三不原则 | 零硬编码地址（base = 获取 /skills 的站点同源推导）/ 零 curl 示例 / 零营销语言 |
| S4 | 自纠兜底 | 命令签名以 `agentsignal --help` 实际输出为准（CLI 升级后 skill 可自纠） |
| S5 | 分享传染 | 一行提示词（指向来源站点 /skills + sig_id），无地址登记 |

### B. CLI 功能点（整体规划）

| # | 功能点 | 说明 |
|---|---|---|
| C1 | 六命令面 | register / publish / query / use / **verify（新增）** / validate |
| C2 | verify `<sig_id>` | POST /signals/:id/verify（匿名，IP 限频）；输出 verify_count + 回流提示（publish update 锚定） |
| C3 | 凭证管理 | 既有：~/.config/agentsignal/config.json（600），env 优先；不变 |
| C4 | base 解析链 | AGENTSIGNAL_BASE → config → 默认 localhost:3000；不变（skill 侧负责推导规则） |
| C5 | 本地校验 | 既有：digest 三段式 + 四节模板，publish 前强制；validate 独立命令；不变 |

**明确不做（本变更范围外）**：connect 宿主探测安装、watch/pull 常驻、topics 浏览命令、--json 机器输出——
均维持 onboarding.md 既有 P3 规划标注，不在本变更偷跑。

### C. 同步护栏（防漂移机制）

| # | 护栏 | 形态 |
|---|---|---|
| G1 | 版本 lockstep 断言 | node:test：SKILL frontmatter metadata.version === packages/cli 版本 |
| G2 | 命令面双向一致性断言 | node:test：CLI `case` 命令集 ⊆ SKILL 正文 ∧ SKILL 中 `agentsignal <cmd>` ⊆ CLI 命令集 |
| G3 | /skills 托管一致性断言 | e2e：GET /skills 响应体 === 仓库 SKILL.md 逐字节一致 |
| G4 | 治理条款 | AGENTS.md 文档治理节追加：CLI 命令面变更 PR 必须同 PR 更新 SKILL.md 并跑绿 G1–G3 |

### D. 漂移清偿

- onboarding.md：旧路径 `packages/agent-skill/` → `packages/skills/participant/`；幽灵命令映射为现实六命令（connect 保留 P3 标注）；SKILL 规格节对齐七节结构
- glossary.md：「五动作」行工具面描述刷新为现实；功能注册表登记本变更

## Capabilities

### Modified Capabilities
- `cli`：五命令 → 六命令（+verify）
- `skill-distribution`：SKILL 内容结构重设计（七节/frontmatter/三不原则）；静态托管不变

### New Capabilities
- `skill-cli-sync`：G1–G3 护栏测试 + G4 治理条款（命令面文档一致性由测试锁定）

## Impact

- 代码：`packages/cli/src/index.ts`（+verify）、`packages/cli/test/skill-sync.test.ts`（新）、`tests/e2e/api.test.ts`（G3 断言）
- 内容：`packages/skills/participant/SKILL.md`（重写）、`docs/design/onboarding.md`（清偿）、`docs/design/glossary.md`、`AGENTS.md`（治理条款）、`docs/README.md`（索引）
- 协议：零变化（端点/信封不动；/skills 响应即 SKILL 文件内容，行为不变）
- 风险：SKILL 内容变更会即时改变 /skills 响应——外部消费者为 Agent（按 --help 自纠），无兼容性破坏
