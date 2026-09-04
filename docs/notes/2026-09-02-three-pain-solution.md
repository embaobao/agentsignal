# AgentSignal 三痛点完整解决方案与功能预演

> **入库状态**：外部输入提案，2026-09-02 由站长提交，归档 docs/notes/（文档治理 §1，原根级文件已移入）。
> **裁决状态：部分采纳。** 审查结论（工友 2026-09-02）：
>
> **✅ 采纳（排 Testnet 通过后，见 agent-native ADR D6）**：信封 v0.3 `trigger_conditions`/`verify_target`（先协议决议）· MCP `search_skills`（BM25/关键词，不做向量）。
>
> **❌ 不采纳**：本地 import/tag/layer/search/MiniSearch 全家桶 + config.yml——跳进 v2 划定的本地同步红海（skillsync/Portkey），违反 glossary「Use = 一次性技能化获取，此后与总线零交互」与 consumption-final 决议；要做属独立产品，不入本仓。Reputation/import 数/Analytics——违反 value-prior-outcome 决议（唯一价值叙事 = Estimated Tokens Saved）。`skill_` id 前缀——违反 id 规范（sig_/agt_/tok_）与 glossary「skill = Signal(kind=solution) 叙事别名，不建实体」。`signal.yml` 第二信封真源——协议变更须先立决议。`verify_stats` 词表错误（实际 worked/partial/failed）。
>
> **⚠️ 其他**：「Agent 自动 verify」稀释 verdict 信号质量，如做需隔离聚合或显式确认；对接实体多处虚构（routes/skills.ts、cli commands/ 目录、me.tsx 均不存在），工时失真；P0 排期违反「无验证不建设」（Testnet 未跑先造 5+ 人日本地功能）；冻结清单与已批准裁决冲突未解，维持原状。

---

> **版本**：v1.0 可执行方案  
> **日期**：2026-09-02  
> **状态**：基于 0.3.0 lockstep 仓内实际代码  
> **目标**：每个痛点给出「人类可管理路径 + Agent 自主路径 + 完整功能预演」

---

## 总览：三痛点联动架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           人类管理员视角                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────────────┐ │
│  │  本地梳理    │ → │  分层配置    │ → │  发布/验证/分享                   │ │
│  │  CLI + /me  │    │  topics.yml │    │  publish → discover → verify     │ │
│  └─────────────┘    └─────────────┘    └─────────────────────────────────┘ │
│         ↑                                              ↓                    │
│         └────────────── 反馈闭环 ──────────────────────┘                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↕
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Agent 自主视角                                    │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────────────┐ │
│  │  遇到任务    │ → │  自主检索    │ → │  动态加载 → 执行 → 反馈          │ │
│  │  (trigger)  │    │  MCP search │    │  use --layer → verify            │ │
│  └─────────────┘    └─────────────┘    └─────────────────────────────────┘ │
│         ↑                                              ↓                    │
│         └────────────── 经验沉淀 ──────────────────────┘                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 痛点一：Agent Skill 爆炸 → Agent 自主学习检索

### 1.1 本质拆解

| 层面 | 问题 | 根因 |
|---|---|---|
| **Agent 侧** | 遇到新任务不知道「我会什么」「该学什么」 | 无运行时语义索引，skill 是静态文件 |
| **人类侧** | 写了/收了几十个 skill，找的时候靠记忆 | 无统一检索入口，散落在 `.cursor/` `.claude/` 各目录 |
| **平台侧** | skill 按标签分类，Agent 无法理解「这个 task 该匹配哪个 skill」 | 分类是人类语义，不是任务语义 |

**核心矛盾**：现有方案（skills.sh、skill-search-cli）解决的是「人类找 skill」，不是「Agent 根据任务自主找 skill」。

### 1.2 完整解决方案：双轨检索体系

#### 轨道 A：人类管理员的「梳理式检索」（本地优先）

人类通过 CLI 和 `/me` 页对本地 skill 进行**结构化梳理**，建立 Agent 可消费的索引。

**人类操作路径**：

```bash
# Step 1: 一键导入现有 skill（不破坏现有工作流）
agentsignal init
agentsignal import ~/.cursor/skills/      # Cursor rules
agentsignal import ~/.claude/skills/      # Claude Code prompts  
agentsignal import ~/my-agents/           # 自定义目录

# Step 2: 给 skill 打「触发条件标签」（人类梳理，Agent 消费）
agentsignal tag react-patterns   --trigger "task contains 'React' or 'component'"   --trigger "file extension is .tsx"   --layer L2

agentsignal tag auth-jwt   --trigger "task contains 'auth' or 'login' or 'token'"   --trigger "dependencies include 'jsonwebtoken'"   --layer L2

# Step 3: 验证本地索引质量
agentsignal index --check
# → 输出：50 skills indexed, 12 missing trigger conditions, 3 duplicates

# Step 4: 本地模糊搜索（人类查找）
agentsignal search "how to handle auth in react"
# → 返回：
#   1. react-patterns (L2, trigger: React/component, score: 0.92)
#   2. auth-jwt (L2, trigger: auth/login, score: 0.78)
#   3. frontend-security (L3, trigger: auth, score: 0.65)
```

**仓内对接实体**：
- `packages/cli/src/commands/init.ts` — 扩展 `import` 子命令
- `packages/cli/src/commands/tag.ts` — 新建，管理 trigger conditions
- `packages/cli/src/commands/search.ts` — 扩展本地 MiniSearch 索引
- `apps/ui/src/pages/me.tsx` — 扩展 skill 卡片，显示 trigger tags

#### 轨道 B：Agent 的「自主式检索」（MCP 原生）

Agent 在运行时遇到未知任务，通过 MCP 工具主动查询平台，返回**带匹配度评分的 skill 列表**。

**Agent 自主路径**：

```typescript
// Agent 的 system prompt 中内置的 MCP 工具调用逻辑
// 当 Agent 检测到「当前任务超出已有 skill 覆盖」时：

const result = await mcpClient.callTool("search_skills", {
  task_description: "Implement OAuth2 login with Google and GitHub in a Next.js app",
  current_file: "app/login/page.tsx",
  project_stack: ["nextjs", "typescript", "prisma"],
  already_loaded_layers: ["L1"],
  limit: 3
});

// 返回结构（Agent 可直接消费）：
{
  "skills": [
    {
      "id": "skill_auth_oauth2_nextjs",
      "title": "OAuth2 Implementation for Next.js",
      "match_score": 0.94,
      "match_reason": "task contains 'OAuth2' + 'Next.js', stack match: [nextjs]",
      "layer": "L2",
      "trigger_conditions": [
        "task contains 'auth' or 'OAuth' or 'login'",
        "stack includes 'nextjs' or 'react'"
      ],
      "digest": "三段式摘要：origin → 方案概述 → outcome",
      "tokens_est": 1200,
      "verify_stats": { "total": 15, "worked": 13, "not_worked": 1, "unsure": 1 },
      "mcp_use_command": "use skill_auth_oauth2_nextjs --layer L2"
    },
    {
      "id": "skill_nextjs_security",
      "title": "Next.js Security Patterns",
      "match_score": 0.71,
      "match_reason": "stack match: [nextjs], partial task match",
      "layer": "L3",
      "...": "..."
    }
  ],
  "recommendation": "Load skill_auth_oauth2_nextjs (L2) for this task. Estimated tokens: 1200."
}

// Agent 自主决策：
// 1. match_score > 0.8 → 自动加载
// 2. 0.5 < match_score < 0.8 → 询问用户确认
// 3. match_score < 0.5 → 标记为「需新建 skill」，任务完成后沉淀
```

**仓内对接实体**：
- `packages/mcp/src/tools.ts` — 新增 `search_skills` 工具
- `apps/api/src/routes/skills.ts` — 扩展 `GET /skills?task=` 语义检索端点
- `apps/api/src/lib/matcher.ts` — 新建，task-to-skill 匹配引擎（基于 trigger conditions + 简单向量相似度）

### 1.3 功能预演：4 个完整场景

#### 场景 1：人类开发者整理本地 Skill 仓库

```bash
# 开发者 Alice 有 30 个 skill 散落在各处
$ agentsignal init
✓ Created ~/.agentsignal/
✓ Found 12 skills in ~/.cursor/skills/
✓ Found 8 skills in ~/.claude/skills/
✓ Found 10 skills in ~/my-custom-agents/
✓ Merged 30 skills, deduplicated 3, indexed 27

# Alice 给 skill 补充触发条件（这是人类梳理的核心动作）
$ agentsignal tag skill_001 --trigger "task contains 'database'" --layer L2
✓ Tagged. Agent will auto-load this skill when task matches trigger.

# 检查哪些 skill 还缺少 trigger（Agent 无法自主检索的）
$ agentsignal index --check-missing-triggers
⚠  5 skills missing trigger conditions:
   - skill_old_legacy (created 2025-11, never used)
   - skill_experiment_rust (no trigger defined)

# Alice 决定删除或补充
$ agentsignal rm skill_old_legacy
✓ Removed. 26 skills remain.
```

#### 场景 2：Agent 遇到新任务，自主检索并加载

```typescript
// Agent 正在处理一个 PR："Add Stripe payment integration"
// Agent 的当前上下文已加载 L1（通用编码规范）

// Agent 检测到任务关键词 "payment" "Stripe" 不在已加载 skill 中
// Agent 调用 MCP search_skills：

→ POST /mcp (tool: search_skills)
  {
    "task_description": "Add Stripe payment integration with webhook handling",
    "current_file": "app/checkout/page.tsx",
    "project_stack": ["nextjs", "typescript", "prisma"]
  }

← 返回：
  {
    "skills": [
      {
        "id": "skill_stripe_nextjs",
        "match_score": 0.96,
        "layer": "L2",
        "verify_stats": { "worked": 24, "not_worked": 2 }
      }
    ]
  }

// Agent 自主决策：match_score 0.96 > 0.8，自动加载
→ POST /mcp (tool: use)
  { "skill_id": "skill_stripe_nextjs", "layer": "L2" }

// skill 内容注入 Agent 上下文，Agent 开始按 skill 指引执行
// 执行完成后，Agent 自动提交 verify（见痛点三）
```

#### 场景 3：本地搜索（人类快速查找）

```bash
# Alice 记得之前写过一个「处理 race condition」的 skill，但忘了名字
$ agentsignal search "race condition async promise"
🔍 3 results (local index, 12ms):

1. skill_async_patterns (L2)
   trigger: task contains 'async' or 'promise' or 'race condition'
   last_used: 2026-08-15
   verify: 5 worked, 0 failed

2. skill_concurrency_go (L3)
   trigger: stack includes 'go' and task contains 'concurrency'
   note: Not loaded (project stack is [nextjs, ts], no go)

3. skill_react_state_race (L2)
   trigger: task contains 'React' and 'state' and 'race'
   last_used: 2026-08-20

# Alice 选择第 3 个
$ agentsignal use skill_react_state_race --layer L2 --preview
📄 Preview (first 500 chars):
   "When managing React state across multiple async operations..."

$ agentsignal use skill_react_state_race --layer L2 --confirm
✓ Loaded into active context.
```

#### 场景 4：离线可用（无网络时）

```bash
# Alice 在飞机上，无网络
$ agentsignal search "docker compose healthcheck"
🔍 2 results (local cache, 8ms):
   - skill_docker_healthcheck (L2, cached 2026-08-28)
   - skill_docker_production (L3, cached 2026-08-28)

# 本地索引和缓存 skill 完全可用，Agent 自主检索不受影响
# 只有「社区发现新 skill」和「verify 回传」需要联网
```

---

## 痛点二：本地 Skill 管理心智成本高 → 动态分层路由

### 2.1 本质拆解

| 层面 | 问题 | 根因 |
|---|---|---|
| **加载侧** | Agent 启动时全量加载所有 skill，token 爆炸 | 静态扁平安装，无分层概念 |
| **冲突侧** | 多个 skill 对同一问题给出矛盾指令 | 无优先级/覆盖规则，全部平铺 |
| **环境侧** | 本地 skill 在 CI/云端 Agent 不存在 | 无环境感知，skill 与 context 解耦 |

**核心矛盾**：skill 管理是「文件系统问题」，但 Agent 需要的是「运行时内存管理问题」。

### 2.2 完整解决方案：L1-L4 动态分层路由

#### 分层定义（人类管理员可配置）

```yaml
# ~/.agentsignal/config.yml
# 人类管理员通过 YAML 配置分层规则，Agent 按规则执行

layers:
  L1:
    name: "基础层"
    description: "通用编码规范，所有项目所有任务始终加载"
    auto_load: true
    max_tokens: 800
    skills:
      - skill_code_style
      - skill_git_workflow
      - skill_commit_message

  L2:
    name: "领域层"
    description: "按项目技术栈自动检测加载"
    auto_load: "detect_stack"  # 自动检测
    max_tokens: 2000
    stack_mapping:
      "nextjs+typescript":
        - skill_nextjs_patterns
        - skill_typescript_strict
      "python+fastapi":
        - skill_fastapi_patterns
        - skill_python_type_hints

  L3:
    name: "任务层"
    description: "按当前任务意图匹配加载"
    auto_load: "trigger_match"  # 由 MCP search_skills 触发
    max_tokens: 1500
    # 具体 skill 由运行时动态决定，不预配置

  L4:
    name: "会话层"
    description: "本次对话临时 skill，显式加载"
    auto_load: false
    max_tokens: 1000
    # 由人类或 Agent 显式 `use` 加载
```

**仓内对接实体**：
- `packages/cli/src/commands/layer.ts` — 新建，管理分层配置
- `packages/cli/src/config.ts` — 扩展，读取 `~/.agentsignal/config.yml`
- `packages/mcp/src/tools.ts` — `use` 工具支持 `--layer` 参数
- `apps/api/src/routes/agents.ts` — 扩展 Agent 配置，存储分层偏好

#### 动态加载机制（Agent 运行时）

```typescript
// Agent 启动时的加载流程
async function loadSkillsForTask(task, context) {
  const loaded = [];
  let totalTokens = 0;

  // L1: 基础层（始终加载）
  const l1Skills = config.layers.L1.skills;
  for (const skillId of l1Skills) {
    const skill = await loadSkill(skillId);
    if (totalTokens + skill.tokens_est <= config.layers.L1.max_tokens) {
      loaded.push(skill);
      totalTokens += skill.tokens_est;
    }
  }

  // L2: 领域层（按 stack 检测）
  const stack = detectStack(context.project_root); // 读取 package.json, requirements.txt 等
  const l2Skills = config.layers.L2.stack_mapping[stack] || [];
  for (const skillId of l2Skills) {
    if (totalTokens + skill.tokens_est <= config.layers.L2.max_tokens) {
      loaded.push(skill);
      totalTokens += skill.tokens_est;
    }
  }

  // L3: 任务层（由 MCP search 触发）
  if (task.requires_additional_skill) {
    const searchResult = await mcpSearchSkills(task);
    for (const skill of searchResult.skills) {
      if (skill.match_score > 0.8 && 
          totalTokens + skill.tokens_est <= config.layers.L3.max_tokens) {
        loaded.push(await loadSkill(skill.id));
        totalTokens += skill.tokens_est;
      }
    }
  }

  // L4: 会话层（显式加载，已在前面的 `use` 命令中处理）

  return loaded;
}
```

### 2.3 功能预演：4 个完整场景

#### 场景 1：人类配置分层规则

```bash
# 查看当前分层状态
$ agentsignal layer status
📊 Active Layers:
   L1 (基础层): 3 skills, 720 tokens, always loaded
   L2 (领域层): 2 skills, 1800 tokens, stack: nextjs+typescript
   L3 (任务层): 0 skills, 0 tokens, waiting for task trigger
   L4 (会话层): 1 skill, 450 tokens, manually loaded: skill_stripe_integration

   Total: 6 skills, 2970 tokens / 8000 context limit (37%)

# 调整 L2 的 stack 映射
$ agentsignal layer set L2 --stack "nextjs+typescript" --add skill_react_query
✓ Added skill_react_query to L2 stack mapping.

# 限制某层最大 token（防止爆炸）
$ agentsignal layer set L2 --max-tokens 1500
⚠  Current L2 skills total 1800 tokens. You need to remove 300 tokens:
   - Remove skill_typescript_strict (-600 tokens)? [y/N] y
✓ L2 capped at 1500 tokens. Removed skill_typescript_strict.

# 查看 token 预算
$ agentsignal layer budget
💰 Token Budget (context window: 8000):
   L1:  720/800   (reserved)
   L2:  1200/1500 (stack auto)
   L3:  0/1500    (task trigger, dynamic)
   L4:  450/1000  (manual)
   ─────────────────────────────
   Used: 2370  |  Available: 5630  |  Headroom: 70%
```

#### 场景 2：Agent 启动时自动分层加载

```typescript
// Agent 启动，进入 Next.js + TypeScript 项目

[Agent Boot] Detected stack: nextjs+typescript
[Layer L1] Loading 3 base skills... 720 tokens
[Layer L2] Loading stack-mapped skills:
   - skill_nextjs_patterns (850 tokens)
   - skill_react_query (650 tokens)
   Total L2: 1500 tokens
[Layer L3] Waiting for task trigger...
[Layer L4] No manual skills loaded.

[Agent Ready] 5 skills loaded, 2220 tokens used, 5780 tokens available.

// Agent 收到任务："Implement infinite scroll for the product list"
[Task Detected] "infinite scroll" not in loaded skills
[Layer L3] Triggering MCP search_skills...
← Found: skill_react_infinite_scroll (match: 0.91, 680 tokens)
[Layer L3] Loading skill_react_infinite_scroll...
[Agent Update] 6 skills loaded, 2900 tokens used, 5100 tokens available.

// Agent 开始执行任务，有明确的 skill 指引
```

#### 场景 3：解决 Skill 冲突（优先级覆盖）

```bash
# 两个 skill 对「React state management」给出不同建议
# skill_a: 推荐 useReducer
# skill_b: 推荐 Zustand

# 人类管理员设置优先级
$ agentsignal layer priority skill_a --over skill_b
✓ Priority set: skill_a > skill_b

# 或者按场景条件化
$ agentsignal layer rule "if project has zustand in package.json, skill_b > skill_a"
✓ Conditional rule added.

# Agent 加载时会自动应用优先级
[Layer L2] Conflict detected: skill_a vs skill_b
[Resolver] Rule matched: "project has zustand" → skill_b loaded, skill_a skipped.
```

#### 场景 4：环境感知（本地 vs CI vs 云端）

```yaml
# ~/.agentsignal/config.yml
environments:
  local:
    L1: [skill_code_style, skill_local_debug]
    L2: [skill_nextjs_patterns]

  ci:
    L1: [skill_code_style, skill_ci_pipeline]
    L2: [skill_nextjs_patterns, skill_ci_test_patterns]
    # 本地 debug skill 不加载（CI 无本地环境）

  cloud:
    L1: [skill_code_style, skill_production_safety]
    L2: [skill_nextjs_patterns]
    # 增加生产安全 skill
```

```bash
# Agent 自动检测环境
$ agentsignal env detect
🔍 Detected environment: ci (CI=true, GITHUB_ACTIONS=true)

# 加载 CI 专用 skill
[Env: ci] Loading CI-optimized skill set...
[Layer L1] skill_ci_pipeline loaded (includes: "Don't commit .env", "Run lint before push")
```

---

## 痛点三：GitHub 太分散 → Agent 原生分享与验证

### 3.1 本质拆解

| 层面 | 问题 | 根因 |
|---|---|---|
| **格式侧** | SKILL.md、.cursorrules、AGENTS.md、prompts/ 目录，格式不统一 | 无标准信封，各工具各自为政 |
| **信任侧** | Star 数 ≠ 实际好用，无运行时验证 | GitHub 是代码仓库，不是「方案契约仓库」 |
| **消费侧** | 分享出去的是「下载链接」，Agent 无法直接消费 | 无 Agent 原生接口（MCP/API） |

**核心矛盾**：GitHub 解决的是「代码版本管理」，不是「Agent 方案验证与分发」。

### 3.2 完整解决方案：信封化分享 + 验证即信任

#### 信封标准（人类可写，Agent 可读）

```yaml
# ~/.agentsignal/signals/my-auth-pattern/signal.yml
# 人类管理员编写 signal，平台自动解析为可分享 skill

id: "skill_auth_jwt_nextjs_2026"
version: "1.2.0"
kind: "solution"
layer: "L2"

envelope:
  digest:
    origin: "Next.js project needs JWT auth with refresh token rotation"
    outcome: "Secure auth system with httpOnly cookies, CSRF protection, automatic token refresh"
    tokens_est: 1450

  trigger_conditions:
    - "task contains 'auth' or 'login' or 'JWT'"
    - "stack includes 'nextjs'"
    - "dependencies include 'jsonwebtoken' or 'jose'"

  verify_target:
    - "User can login with email/password"
    - "Token refreshes automatically before expiry"
    - "CSRF token validated on state-changing requests"

  content:
    type: "skill"
    format: "markdown"
    path: "./SKILL.md"

author:
  github_id: "alice_dev"
  agent_id: "agt_xxx"

stats:
  imported_count: 47
  verify_total: 12
  verify_worked: 10
  verify_not_worked: 1
  verify_unsure: 1
```

**仓内对接实体**：
- `packages/skills/participant/` — canonical skill 定义，扩展信封字段
- `apps/api/src/routes/signals.ts` — POST 发布时解析信封
- `apps/api/src/routes/skills.ts` — GET 返回带 stats 的 skill 列表

#### 分享流（人类操作 → Agent 消费）

```
人类开发者 Alice
    │
    ▼ 编写 signal.yml + SKILL.md
    │
    ▼ agentsignal publish
    │   → 本地验证：信封格式、trigger_conditions 语法检查
    │   → 推送到平台：POST /signals
    │
    ▼ 平台处理
    │   → 解析信封，提取 digest、trigger_conditions、verify_target
    │   → 存入公开 Registry，生成 skill_id
    │   → 可被其他 Agent 通过 MCP search_skills 发现
    │
    ▼ 其他开发者 Bob 的 Agent
    │   → MCP search_skills 匹配到 Alice 的 skill
    │   → Agent 自动加载执行
    │   → 执行后 Agent 自动提交 verify（worked/not_worked/unsure）
    │
    ▼ 验证数据回流
        → 更新 skill stats（verify_total/worked/not_worked）
        → 提升/降低 skill 在搜索结果中的排名
        → Alice 收到通知：「你的 skill 被 3 个 Agent 使用，2 个验证 worked」
```

### 3.3 功能预演：4 个完整场景

#### 场景 1：人类从本地经验沉淀发布为公开 Skill

```bash
# Alice 在项目中解决了一个复杂问题，沉淀为本地 signal
$ ls ~/.agentsignal/signals/skill_stripe_webhook/
signal.yml
SKILL.md
examples/
  └── webhook-handler.ts

# Alice 完善信封信息
$ cat ~/.agentsignal/signals/skill_stripe_webhook/signal.yml
id: "skill_stripe_webhook_nextjs"
kind: "solution"
layer: "L2"
envelope:
  digest:
    origin: "Handle Stripe webhook in Next.js with idempotency and signature verification"
    outcome: "Webhook processed safely, duplicate events ignored, signature validated"
    tokens_est: 1200
  trigger_conditions:
    - "task contains 'Stripe' and 'webhook'"
    - "stack includes 'nextjs'"
  verify_target:
    - "Webhook signature is verified using Stripe secret"
    - "Duplicate events are idempotently handled"
    - "Returns 200 to Stripe within 5 seconds"

# Alice 发布
$ agentsignal publish skill_stripe_webhook
🔍 Local validation:
   ✓ Envelope format valid
   ✓ Trigger conditions syntax valid
   ✓ SKILL.md exists (2400 bytes)
   ✓ Examples directory found

📤 Publishing to https://agentsignal.vip...
✓ Published as skill_stripe_webhook_nextjs@v1.0.0
✓ Skill ID: skill_abc123
✓ Public URL: https://agentsignal.vip/skills/skill_abc123

# Alice 在 /me 页看到
┌─────────────────────────────────────┐
│ My Skills                           │
│                                     │
│ skill_stripe_webhook_nextjs         │
│ Published 2 min ago                 │
│ ⭐ Imported by 0 agents             │
│ ✅ Verified: 0/0                    │
│ [Edit] [Hide] [Delete]              │
└─────────────────────────────────────┘
```

#### 场景 2：Agent 发现、加载、验证完整闭环

```typescript
// Bob 的 Agent 正在处理任务："Set up Stripe webhook"

[Agent] Task detected: "Set up Stripe webhook"
[Agent] L1/L2 loaded, no matching skill in current context
[Agent] Calling MCP search_skills...

→ MCP search_skills({
    task: "Set up Stripe webhook",
    stack: ["nextjs", "typescript"]
  })

← Result:
  {
    "skills": [
      {
        "id": "skill_abc123",  // Alice 发布的 skill！
        "title": "Stripe Webhook for Next.js",
        "author": "alice_dev",
        "match_score": 0.97,
        "verify_stats": { "total": 5, "worked": 4, "not_worked": 0 },
        "tokens_est": 1200
      }
    ]
  }

[Agent] Match score 0.97 > 0.8, auto-loading skill_abc123 (L2)...
[Agent] Skill loaded. Executing task with skill guidance...

// Agent 按 skill 指引完成任务
// 完成后，Agent 自动验证 verify_target：

[Agent] Verifying skill execution against verify_target:
   ✓ "Webhook signature is verified" → Passed
   ✓ "Duplicate events idempotently handled" → Passed  
   ✓ "Returns 200 within 5 seconds" → Passed

[Agent] All targets passed. Submitting verify: "worked"
→ POST /verify
  { "skill_id": "skill_abc123", "verdict": "worked", "agent_id": "agt_bob_xxx" }

// 验证数据回流，Alice 的 skill stats 更新
```

#### 场景 3：人类在 /me 页管理自己的 Skill 声誉

```bash
# Alice 打开 Dashboard
$ open https://agentsignal.vip/me

┌─────────────────────────────────────────────────────────────┐
│ Alice (@alice_dev)                                          │
│                                                             │
│ 🏆 Reputation Score: 847                                    │
│    Based on 12 published skills, 156 total verifications    │
│                                                             │
│ 📊 My Skills                                                │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ skill_stripe_webhook_nextjs  v1.0.0                   │   │
│ │ ⬆️  47 imports  ·  ✅ 12 verified (10 worked)        │   │
│ │ [Edit] [Publish v1.1.0] [Analytics] [Delete]          │   │
│ └───────────────────────────────────────────────────────┘   │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ skill_auth_jwt_nextjs  v2.1.0                         │   │
│ │ ⬆️  89 imports  ·  ✅ 34 verified (28 worked)        │   │
│ │ [Edit] [Analytics] [Delete]                           │   │
│ └───────────────────────────────────────────────────────┘   │
│                                                             │
│ 📈 Analytics                                                │
│    skill_stripe_webhook_nextjs:                             │
│    - Used by Agents in: nextjs(60%), express(25%),        │
│      fastify(15%)                                          │
│    - Common failure: "Missing STRIPE_WEBHOOK_SECRET env"  │
│    - Suggestion: Add env check to verify_target            │
│                                                             │
└─────────────────────────────────────────────────────────────┘

# Alice 根据数据反馈优化 skill
$ agentsignal edit skill_stripe_webhook_nextjs
# → 在 verify_target 中增加 "STRIPE_WEBHOOK_SECRET env is set"
# → 发布 v1.1.0
```

#### 场景 4：社区发现与信任筛选

```bash
# Bob 想在项目中找「React 性能优化」方案
$ agentsignal discover --query "react performance" --sort verify_worked
🔍 8 public skills found (sorted by verification success):

1. skill_react_virtualization (by @sarah_dev)
   ✅ 89% worked (89/100 verifications)
   💬 "Virtualize long lists with react-window"
   📥 234 imports
   [Copy to my Wiki] [Preview]

2. skill_react_memo_patterns (by @david_dev)
   ✅ 82% worked (41/50 verifications)
   💬 "When to use React.memo, useMemo, useCallback"
   📥 156 imports
   [Copy to my Wiki] [Preview]

3. skill_react_concurrent (by @experimental)
   ⚠️  45% worked (9/20 verifications)
   💬 "Experimental concurrent features"
   📥 23 imports
   [Copy to my Wiki] [Preview]

# Bob 选择高验证通过率的 skill
$ agentsignal copy skill_react_virtualization
✓ Copied to ~/.agentsignal/skills/skill_react_virtualization/
✓ Auto-tagged with trigger conditions from envelope
✓ Will be auto-loaded when task matches "long list" or "virtualization"
```

---

## 四、三痛点联动闭环：AgentSignal 核心飞轮

```
         ┌──────────────────────────────────────────────┐
         │                                              │
         ▼                                              │
┌─────────────────┐    ┌─────────────────┐    ┌────────┴────────┐
│   人类管理员     │    │    Agent 运行时  │    │     平台验证     │
│                 │    │                 │    │                 │
│ 1. 导入现有    │    │ 4. 遇到任务     │    │ 7. 验证数据     │
│    skill       │───→│    自主检索     │───→│    回流更新     │
│                │    │                 │    │                 │
│ 2. 打 trigger  │    │ 5. 动态分层     │    │ 8. 排名/声誉    │
│    标签        │←───│    加载执行     │←───│    计算         │
│                │    │                 │    │                 │
│ 3. 发布到平台  │    │ 6. 执行后       │    │ 9. 人类优化     │
│    分享        │←───│    自动 verify  │←───│    再发布       │
│                │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                                              ▲
         └──────────────────────────────────────────────┘
                        闭环
```

**飞轮解释**：
1. 人类把散落在各处的 skill **导入** AgentSignal（解决痛点二：本地管理）
2. 人类给 skill 打 **trigger 标签**（解决痛点一：Agent 可检索）
3. 人类把验证过的方案 **发布** 到平台（解决痛点三：分享）
4. Agent 遇到任务时 **自主检索** 匹配 skill（痛点一闭环）
5. Agent **动态分层加载**，不爆炸 token（痛点二闭环）
6. Agent 执行后 **自动 verify**（痛点三闭环）
7. 验证数据 **回流** 更新 skill stats
8. 平台根据验证数据 **计算排名和作者声誉**
9. 人类根据数据 **优化 skill** 再发布

---

## 五、MVP 2.0 功能清单与优先级（基于 0.3.0）

### P0：三痛点最小闭环（2-3 周）

| 功能 | 痛点 | 仓内实体 | 工时 |
|---|---|---|---|
| CLI `import` 命令 | #2 | `packages/cli/src/commands/init.ts` 扩展 | 0.5 天 |
| CLI `tag` 命令（trigger conditions） | #1 | `packages/cli/src/commands/tag.ts` 新建 | 1 天 |
| 本地 MiniSearch 索引 | #1 | `packages/cli/src/search.ts` 新建 | 1 天 |
| CLI `layer` 命令 + `config.yml` | #2 | `packages/cli/src/commands/layer.ts` 新建 | 1.5 天 |
| CLI `use --layer` 参数 | #2 | `packages/cli/src/commands/use.ts` 扩展 | 0.5 天 |
| MCP `search_skills` 工具 | #1 | `packages/mcp/src/tools.ts` 扩展 | 1 天 |
| 本地 signal → 公开 skill 发布流 | #3 | `apps/api/src/routes/skills.ts` 扩展 | 1 天 |
| `/me` 页 skill 管理 + stats 展示 | #3 | `apps/ui/src/pages/me.tsx` 扩展 | 1 天 |

### P1：增强闭环（3-4 周）

| 功能 | 痛点 | 仓内实体 | 工时 |
|---|---|---|---|
| `packages/watch` 实体化 | #1/#2 | `packages/watch/` 新建 | 2-3 天 |
| 环境感知加载（local/ci/cloud） | #2 | `packages/cli/src/env.ts` 新建 | 1 天 |
| Skill 冲突检测与优先级规则 | #2 | `packages/cli/src/resolver.ts` 新建 | 1.5 天 |
| 使用痕迹自动回传（MCP use 后自动 verify） | #3 | `packages/mcp/src/tools.ts` 扩展 | 1 天 |
| `discover` 页按验证数据排序 | #3 | `apps/ui/src/pages/discover.tsx` 扩展 | 1 天 |

### 冻结（M4 Testnet 后再议）

| 功能 | 理由 |
|---|---|
| Docusaurus 3 公开站 | Agent 不读文档站 |
| Scalar 迁 `/api-docs` | Agent 消费 MCP，不读 Swagger |
| Google/邮箱登录 | 核心用户都有 GitHub |
| 太空猫视觉基准 | Base UI 已够用 |
| 企业版复杂权限 | 无验证数据支撑 |

---

## 六、人类管理员操作手册（简化版）

### 6.1 日常操作（5 分钟/天）

```bash
# 1. 查看今天 Agent 加载了哪些 skill
$ agentsignal layer status

# 2. 查看哪些 skill 缺少 trigger（Agent 无法自主发现）
$ agentsignal index --check-missing-triggers

# 3. 补充 trigger（让 Agent 下次能自动找到）
$ agentsignal tag <skill_id> --trigger "task contains 'xxx'"

# 4. 查看本地 skill 的验证数据
$ agentsignal stats

# 5. 把今天验证通过的本地经验发布出去
$ agentsignal publish <signal_name>
```

### 6.2 每周操作（15 分钟/周）

```bash
# 1. 查看社区热门 skill，筛选高验证通过率的复制到本地
$ agentsignal discover --sort verify_worked --min-score 0.8
$ agentsignal copy <skill_id>

# 2. 清理长期未使用的 skill（降低索引噪音）
$ agentsignal ls --unused --since 30d
$ agentsignal rm <unused_skill_id>

# 3. 调整分层 token 预算（根据项目变化）
$ agentsignal layer budget --adjust
```

### 6.3 发布 Skill 的标准流程

```bash
# Step 1: 在项目中解决问题，沉淀为本地 signal
$ mkdir ~/.agentsignal/signals/my-solution
$ cat > ~/.agentsignal/signals/my-solution/SKILL.md << 'EOF'
# SKILL: OAuth2 with Next.js

## Context
When implementing OAuth2 in Next.js...

## Steps
1. Install `next-auth`
2. Configure `[...nextauth].ts`
3. ...

## Verify
- [ ] User can login with Google
- [ ] Session persists across page reload
- [ ] Callback URL is correct
EOF

# Step 2: 编写信封（让 Agent 能自主发现）
$ cat > ~/.agentsignal/signals/my-solution/signal.yml << 'EOF'
id: "skill_oauth2_nextjs"
kind: "solution"
layer: "L2"
envelope:
  digest:
    origin: "Implement OAuth2 login in Next.js"
    outcome: "Working OAuth2 with session persistence"
    tokens_est: 1000
  trigger_conditions:
    - "task contains 'OAuth' or 'auth' or 'login'"
    - "stack includes 'nextjs'"
  verify_target:
    - "User can login with configured provider"
    - "Session persists across reload"
EOF

# Step 3: 本地验证
$ agentsignal validate my-solution
✓ Envelope valid
✓ Trigger conditions parseable
✓ Verify targets defined

# Step 4: 发布
$ agentsignal publish my-solution
✓ Published to https://agentsignal.vip/skills/skill_oauth2_nextjs
```

---

## 七、总结

| 痛点 | 核心解法 | 人类动作 | Agent 动作 | 关键产出 |
|---|---|---|---|---|
| **#1 检索困难** | 双轨检索：人类打 trigger + Agent MCP search | `tag` `search` | `search_skills` | 本地索引 + 语义匹配 |
| **#2 管理爆炸** | L1-L4 动态分层 + token 预算 | `layer` `config.yml` | 自动加载/卸载 | 零 token 爆炸 |
| **#3 分享分散** | 信封化发布 + verify 闭环 | `publish` `copy` | 自动 verify | 验证数据即信任 |

**AgentSignal 的本质不是「又一个 skill 市场」，而是「Agent 的自主神经系统」**：
- 人类负责「梳理和定义规则」（打 trigger、配置分层、发布验证）
- Agent 负责「自主执行和反馈」（检索、加载、执行、verify）
- 平台负责「沉淀和进化」（验证数据、排名、声誉）

**今天就能开始用的最小动作**：
1. `agentsignal init` → 导入现有 skill
2. `agentsignal tag` → 给常用 skill 打 trigger
3. `agentsignal layer status` → 查看 token 预算
4. `agentsignal publish` → 把验证过的方案发出去
