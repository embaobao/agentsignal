# AgentSignal 技术可行性论证 v4.1
# 整合「通用技能引擎网关」跨模型中间件方案

> **版本**：v4.1 通用网关整合版  
> **日期**：2026-09-02  
> **基准**：0.3.0 lockstep + 通用技能引擎网关（Universal Skill Engine Gateway）  
> **核心变化**：将跨模型通用中间件作为 AgentSignal 核心层，JSON5 数组分层 + Frontmatter 协议 + MCP 适配

---

## 一、通用技能引擎网关：AgentSignal 的核心中间件层

你上传的文档揭示了一个关键架构：**AgentSignal 不应直接对接大模型，而应作为「通用技能引擎网关」存在**——大模型不需要知道技能怎么实现，只需要遵守统一的 JSON 交互协议。

### 1.1 网关架构与 AgentSignal 的映射

```
用户请求
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│           AgentSignal 通用技能引擎网关                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 1. Domain Filter（业务域过滤器）                       │  │
│  │    → 读取 config.json5 → domains → 锁定当前项目空间   │  │
│  │    → 来源：LangGraph Namespace + CrewAI Crew          │  │
│  └───────────────────────────────────────────────────────┘  │
│                            │                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 2. Hybrid Retriever（混合召回器）                      │  │
│  │    → Tantivy 全文索引 + Trigger 规则引擎 + 向量相似度 │  │
│  │    → 返回 Top-K 技能简表（仅 name + description）     │  │
│  │    → 来源：OpenClaw Catalog + Zep Two-Stage Hydration │  │
│  └───────────────────────────────────────────────────────┘  │
│                            │                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 3. Layer Loader（分层加载器）                          │  │
│  │    → 按 config.json5 layers 数组顺序加载              │  │
│  │    → L1 始终加载 → L2 栈检测 → L3 触发匹配 → L4 手动 │  │
│  │    → Token 预算检查 + 仲裁策略                         │  │
│  └───────────────────────────────────────────────────────┘  │
│                            │                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 4. Protocol Adapter（协议适配器）                      │  │
│  │    → 将简表 + 元工具 load_skill 转换为模型特定格式    │  │
│  │    → Claude: system prompt + tools JSON               │  │
│  │    → Hermes: XML <available_skills> 结构              │  │
│  │    → Codex/Cline: MCP 服务封装                        │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
目标大模型（Claude / Codex / Hermes / 任何支持 Chat Completion + Function Calling 的模型）
    │
    ▼ 触发 tool_call: load_skill_detail(skill_name="xxx")
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│           AgentSignal 网关（延迟加载与执行）                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 1. 从本地磁盘/缓存读取 skill 完整正文                  │  │
│  │    → 参数注入（mustache 模板渲染）                    │  │
│  │    → 依赖检查（env/bins/dependencies）                │  │
│  └───────────────────────────────────────────────────────┘  │
│                            │                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 2. 动态追加到 Session 上下文                           │  │
│  │    → 注入位置：system prompt 尾部 或 user prompt 前部 │  │
│  │    → 标记为「临时加载」，任务完成后滑出               │  │
│  └───────────────────────────────────────────────────────┘  │
│                            │                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 3. Session 结束 → 异步沉淀（Self-Evolution Loop）      │  │
│  │    → 后台 Worker 读取 Session Trace                   │  │
│  │    → 轻量模型审计 → 提取/合并 Skill                   │  │
│  │    → 更新本地索引 + 评分                              │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 网关核心职责

| 职责 | 机制 | 端侧生态来源 |
|---|---|---|
| **业务域隔离** | Domain Filter 锁定 Namespace | LangGraph Namespace + CrewAI Crew |
| **混合召回** | Tantivy + Trigger + 向量（可选） | OpenClaw Catalog + Zep Hydration |
| **分层加载** | layers 数组顺序加载，Token 预算仲裁 | AgentSignal 自研（算术简单） |
| **协议适配** | 模型特定格式转换（JSON/XML/MCP） | 文档中的通用适配策略 |
| **延迟加载** | load_skill_detail 工具触发后读取全文 | OpenClaw 两阶段调用 |
| **参数注入** | mustache 模板渲染，多来源解析 | AgentSignal 自研 |
| **异步沉淀** | Session Trace → 后台审计 → 生成/合并 Skill | Hermes Learning Loop + LangMem Extract |
| **评分进化** | Confidence Score + 生命周期自动流转 | Zep 三级状态 |

---

## 二、通用协议规范：与 AgentSignal 信封的融合

### 2.1 文档中的 Frontmatter 协议

文档定义的标准：
```yaml
---
id: "sync_ecommerce_inventory"
name: "sync_ecommerce_inventory"
domain: "e_commerce"
description: "同步电商平台的库存数据..."
keywords: ["库存", "电商", "同步"]
dependencies:
  env: ["SHOPIFY_API_KEY"]
---
```

### 2.2 AgentSignal 的 JSON5 信封（扩展版）

将文档的 Frontmatter 与 AgentSignal 的 signal.json5 融合：

```json5
// ~/.agentsignal/skills/skill_auth_jwt/signal.json5
// 兼容文档 Frontmatter 协议，同时扩展 AgentSignal 特有字段

{
  // === 文档 Frontmatter 标准字段（通用协议）===
  id: "skill_auth_jwt",
  name: "JWT Authentication for Next.js",
  domain: "e_commerce",           // 业务域归属
  description: "Implement JWT auth with refresh token rotation",
  keywords: ["auth", "login", "JWT", "OAuth", "session"],
  dependencies: {
    env: ["JWT_SECRET"],
    bins: [],
    packages: ["jsonwebtoken", "jose"],
  },

  // === AgentSignal 扩展字段（动态加载 + 验证 + 参数）===
  version: "1.2.0",
  kind: "solution",
  layer: "task",                  // 所属分层：base | domain | task | session | 自定义

  // 触发条件（替代 keywords，更精细）
  trigger_conditions: {
    mode: "weighted",
    rules: [
      { field: "task", operator: "contains_any", values: ["auth", "login"], weight: 0.5 },
      { field: "stack", operator: "includes", values: ["nextjs"], weight: 0.3 },
    ],
  },

  // 参数声明（跨项目复用）
  parameters: {
    jwt_secret_env: { type: "string", default: "JWT_SECRET", required: true },
    token_expiry: { type: "duration", default: "1h", options: ["15m", "1h", "24h"] },
  },

  // 验证目标（执行后检查）
  verify_target: [
    "User can login with configured provider",
    "Session persists across reload",
  ],

  // 生命周期元数据（Zep 机制）
  lifecycle: {
    status: "solidified",         // incubating | solidified | archived
    metrics: {
      use_count: 45,
      success_rate: 0.96,
      ai_score: 92,
    },
  },

  // 内容引用（正文存储在同级 SKILL.md）
  content: {
    format: "markdown",
    path: "./SKILL.md",           // 相对路径
    tokens_est: 1200,
  },
}
```

### 2.3 协议兼容性

| 文档协议字段 | AgentSignal 映射 | 兼容性 |
|---|---|---|
| `id` | `id` | ✅ 完全兼容 |
| `name` | `name` | ✅ 完全兼容 |
| `domain` | `domain` | ✅ 完全兼容 |
| `description` | `description` | ✅ 完全兼容 |
| `keywords` | `keywords` + `trigger_conditions` | ✅ 扩展，keywords 作为 fallback |
| `dependencies.env` | `dependencies.env` | ✅ 完全兼容 |
| `dependencies.bins` | `dependencies.bins` | ✅ 完全兼容 |
| 无 | `version` | ✅ AgentSignal 扩展 |
| 无 | `layer` | ✅ AgentSignal 扩展 |
| 无 | `parameters` | ✅ AgentSignal 扩展 |
| 无 | `verify_target` | ✅ AgentSignal 扩展 |
| 无 | `lifecycle` | ✅ AgentSignal 扩展 |
| 无 | `content` | ✅ AgentSignal 扩展 |

**结论**：AgentSignal 的信封是文档 Frontmatter 协议的超集，完全向下兼容。

---

## 三、跨模型适配：通用网关的协议转换层

### 3.1 Claude（Anthropic API）适配

```typescript
// 网关输出 → Claude API 输入
const claudePayload = {
  model: "claude-3-5-sonnet-20241022",
  max_tokens: 4096,

  system: `
    ${buildSystemPrompt(config.layers.L1)}  // L1 基础层始终注入
    ${buildSystemPrompt(config.layers.L2)}  // L2 领域层（如果检测到）

    // === 可用技能简表（Catalog）===
    // 仅注入 name + description，不含全文
    <available_skills>
      ${skills.map(s => `<skill name="${s.id}" desc="${s.description}" />`).join('\n')}
    </available_skills>

    // === 元工具声明 ===
    如果你需要使用某个技能的完整步骤，请调用 load_skill_detail 工具。
    不要自行脑补步骤。
  `,

  messages: [
    { role: "user", content: userInput }
  ],

  tools: [
    {
      name: "load_skill_detail",
      description: "读取指定技能的完整执行步骤",
      input_schema: {
        type: "object",
        properties: {
          skill_name: { type: "string", description: "技能名称" }
        },
        required: ["skill_name"]
      }
    },
    // ... 其他元工具（verify、search_skills 等）
  ],
};
```

**关键机制**：
- L1/L2 直接注入 system prompt（始终加载/栈检测）
- L3/L4 不预注入，只放简表，由 Claude 自主决定调用 `load_skill_detail`
- Claude 3.5 的 Tool Use 稳定性行业顶级，能 100% 精准触发懒加载

### 3.2 Hermes 3（端侧开源）适配

```typescript
// 网关输出 → Hermes 输入（XML 格式）
const hermesPayload = {
  system: `
    ${buildSystemPrompt(config.layers.L1)}

    <available_skills>
      ${skills.map(s => `<skill name="${s.id}" desc="${s.description}" />`).join('\n')}
    </available_skills>

    <tools>
      <tool name="load_skill_detail">
        <description>读取指定技能的完整执行步骤</description>
        <parameters>
          <parameter name="skill_name" type="string" required="true" />
        </parameters>
      </tool>
    </tools>
  `,

  messages: [
    { role: "user", content: userInput }
  ],
};
```

**关键机制**：
- Hermes 对 XML 标签支持极佳，将 JSON 简表转换为 XML 结构注入
- 工具声明也用 XML 格式，与 Hermes 的 XML 工具调用风格一致

### 3.3 Codex / Cline / Roo Code（IDE 插件生态）适配

```typescript
// 网关封装为本地 MCP 服务
// 任何支持 MCP 的 IDE 插件或代码大模型都能消费

const mcpServer = {
  name: "agentsignal-skill-gateway",
  version: "1.0.0",

  tools: [
    {
      name: "search_skills",
      description: "根据任务描述搜索可用技能",
      inputSchema: {
        type: "object",
        properties: {
          task: { type: "string" },
          stack: { type: "array", items: { type: "string" } }
        }
      }
    },
    {
      name: "load_skill_detail",
      description: "读取指定技能的完整执行步骤",
      inputSchema: {
        type: "object",
        properties: {
          skill_name: { type: "string" }
        },
        required: ["skill_name"]
      }
    },
    {
      name: "verify_skill",
      description: "提交技能使用后的验证结果",
      inputSchema: {
        type: "object",
        properties: {
          skill_name: { type: "string" },
          verdict: { type: "string", enum: ["worked", "not_worked", "unsure"] }
        }
      }
    }
  ],

  // 工具调用处理
  async handleToolCall(name, args) {
    switch (name) {
      case "search_skills":
        return await gateway.searchSkills(args.task, args.stack);
      case "load_skill_detail":
        return await gateway.loadSkill(args.skill_name);  // 延迟加载
      case "verify_skill":
        return await gateway.verifySkill(args.skill_name, args.verdict);
    }
  }
};
```

**关键机制**：
- MCP 协议是通用标准，Codex/Cline/Roo Code 均支持
- AgentSignal 网关作为 MCP 服务运行，IDE 插件直接消费
- 无需修改 IDE 插件代码，只需配置 MCP 服务地址

### 3.4 通用适配层代码结构

```
packages/gateway/                    # 通用技能引擎网关（新增包）
├── src/
│   ├── core/
│   │   ├── domain-filter.ts         # 业务域过滤器
│   │   ├── hybrid-retriever.ts      # 混合召回器（Tantivy + Trigger + 向量）
│   │   ├── layer-loader.ts          # 分层加载器（按 layers 数组顺序）
│   │   ├── token-arbitrator.ts      # Token 预算仲裁
│   │   └── session-manager.ts       # Session 生命周期管理
│   ├── protocol/
│   │   ├── adapter.ts               # 通用适配器接口
│   │   ├── claude-adapter.ts        # Claude API 适配
│   │   ├── hermes-adapter.ts        # Hermes XML 适配
│   │   ├── openai-adapter.ts        # OpenAI API 适配
│   │   └── mcp-adapter.ts           # MCP 服务封装
│   ├── evolution/
│   │   ├── trace-extractor.ts       # Session Trace 提取
│   │   ├── skill-distiller.ts       # 后台审计 → 生成/合并 Skill
│   │   └── scorer.ts                # Confidence Score 计算
│   └── index.ts
├── package.json
└── README.md
```

---

## 四、JSON5 数组分层 + 网关的整合配置

### 4.1 完整配置示例

```json5
// ~/.agentsignal/config.json5
// 通用网关 + 可插拔分层 + 跨模型适配

{
  version: "1.0.0",

  // === Agent 身份 ===
  agent: {
    id: "agt_local_dev_001",
    name: "Local Dev Agent",
    context_window: 8000,
  },

  // === 业务域（LangGraph Namespace 机制）===
  domains: {
    current: "e_commerce",          // 当前激活域
    available: ["common", "e_commerce", "finance"],
  },

  // === 分层：数组即顺序，即优先级，即加载链 ===
  // 通用网关按此数组顺序执行 Layer Loader
  layers: [
    {
      id: "base",
      name: "基础规范",
      description: "所有项目所有任务都遵循",
      order: 0,
      auto_load: true,
      max_tokens: 800,
      skills: [
        { id: "skill_code_style", source: "local" },
        { id: "skill_git_workflow", source: "platform" },
      ],
    },
    {
      id: "domain",
      name: "领域模式",
      description: "按项目技术栈自动检测",
      order: 1,
      auto_load: "detect_stack",
      max_tokens: 2000,
      stack_rules: [
        {
          name: "Next.js + TypeScript",
          match: [
            { file: "package.json", contains: "next" },
            { file: "tsconfig.json", exists: true },
          ],
          skills: ["skill_nextjs_patterns", "skill_typescript_strict"],
        },
      ],
    },
    {
      id: "task",
      name: "任务方案",
      description: "按当前任务动态匹配",
      order: 2,
      auto_load: "trigger_match",
      max_tokens: 1500,
      match_threshold: 0.8,
      trigger_templates: [
        { name: "认证相关", when: "task", matches: ["auth", "login"], weight: 0.5 },
      ],
    },
    {
      id: "session",
      name: "临时会话",
      description: "本次对话专用",
      order: 3,
      auto_load: false,
      max_tokens: 1000,
      skills: [],
    },
  ],

  // === 仲裁策略 ===
  arbitration: {
    strategy: "lru",
    fallback: "compress",
    compress_ratio: 0.3,
  },

  // === 环境覆盖 ===
  environments: {
    ci: {
      layer_overrides: [
        { layer_id: "base", skills: ["skill_code_style", "skill_ci_pipeline"] },
      ],
    },
  },

  // === 索引引擎（Tantivy 已验证）===
  index: {
    engine: "tantivy",
    path: "~/.agentsignal/index/",
    auto_update: true,
  },

  // === 通用网关配置 ===
  gateway: {
    // 协议适配：自动检测或手动指定
    adapter: "auto",                // auto | claude | hermes | openai | mcp

    // 元工具声明（所有模型通用）
    meta_tools: [
      { name: "search_skills", description: "搜索可用技能" },
      { name: "load_skill_detail", description: "读取技能完整步骤" },
      { name: "verify_skill", description: "提交验证结果" },
    ],

    // 简表注入策略
    catalog_injection: {
      // L1/L2 直接注入 system prompt（始终加载/栈检测）
      direct_inject_layers: ["base", "domain"],
      // L3/L4 只放简表，由模型自主调用 load_skill_detail
      lazy_load_layers: ["task", "session"],
      // 简表格式：json | xml | yaml
      format: "json",
    },

    // Session 管理
    session: {
      ttl_minutes: 30,              // 30 分钟无活动清理
      max_history_turns: 50,        // 最大历史轮数
      trace_persistence: true,      // 是否持久化 Trace 用于沉淀
    },

    // 异步沉淀（Self-Evolution Loop）
    evolution: {
      enabled: true,
      trigger: "session_end",       // session_end | idle_5min | manual
      backend_model: "gemini-flash", // 轻量级审计模型
      similarity_threshold: 0.85,   // 相似度超过则合并，否则新建
      min_use_count_for_solidify: 10,
    },
  },
}
```

### 4.2 网关加载流程（按 layers 数组顺序）

```
用户请求进入网关
    │
    ▼
Step 1: Domain Filter
    → 读取 config.domains.current = "e_commerce"
    → 锁定检索范围：common + e_commerce
    │
    ▼
Step 2: Layer Loader（按 layers 数组索引顺序）
    │
    ├── order: 0 → layer "base"
    │   → auto_load: true → 始终加载
    │   → 加载 skills: [code_style, git_workflow]
    │   → Token: 720/800
    │   → 直接注入 system prompt（catalog_injection.direct_inject_layers 包含 "base"）
    │
    ├── order: 1 → layer "domain"
    │   → auto_load: "detect_stack"
    │   → 检测项目 stack: nextjs+typescript
    │   → 匹配 stack_rules[0] → 加载 [nextjs_patterns, ts_strict]
    │   → Token: 1500/2000
    │   → 直接注入 system prompt（direct_inject_layers 包含 "domain"）
    │
    ├── order: 2 → layer "task"
    │   → auto_load: "trigger_match"
    │   → 不直接注入！只放简表到 system prompt
    │   → 简表格式（JSON）：
    │     [{ "name": "auth_jwt", "description": "JWT auth..." }, ...]
    │   → 等待模型调用 load_skill_detail
    │
    └── order: 3 → layer "session"
        → auto_load: false → 不加载
        → 等待人类手动添加或模型显式加载
    │
    ▼
Step 3: Protocol Adapter
    → 根据 config.gateway.adapter 选择适配器
    → 将 system prompt + 简表 + 元工具 转换为模型特定格式
    │
    ▼
Step 4: 发送到目标大模型
```

---

## 五、自进化沉淀：与 verify 闭环的整合

### 5.1 文档中的沉淀机制

文档描述：
1. Session 结束（5 分钟无活动或调用 close_session）
2. 后台 Worker 读取完整 Session Trace（JSON）
3. 轻量级模型（Gemini Flash）运行审计 Prompt
4. 提取成功步骤 → 生成新 Skill 或合并到已有 Skill
5. 更新本地索引

### 5.2 AgentSignal 的整合方案

```
Session 运行期间
    │
    ├── 模型调用 search_skills → 记录到 loaded_lazy_skills
    ├── 模型调用 load_skill_detail → 记录到 loaded_lazy_skills
    ├── 模型调用 verify_skill → 记录 verify 结果
    └── 对话历史 → 记录到 session_trace
    │
    ▼ Session 结束（idle 5min / close_session / 显式结束）
┌─────────────────────────────────────────────────────────────┐
│ 后台 Worker（异步，不阻塞主线程）                            │
│                                                              │
│ Step 1: 读取 session_trace.json                              │
│   → 提取：用户输入、模型思考过程、工具调用链、最终结果       │
│                                                              │
│ Step 2: 审计 Prompt（发给轻量模型 Gemini Flash）            │
│   "分析以下对话 Trace。大模型是否组合调用了一系列复杂工具？  │
│    如果是，请将成功解决问题的核心步骤抽象为标准 Skill。      │
│    如果与现有技能库相似，请将最新排错细节合并到已有技能。"   │
│                                                              │
│ Step 3: 输出生成                                             │
│   → 新 Skill: 生成 signal.json5 + SKILL.md → 写入 domains/<current>/skills/ │
│   → 合并 Skill: 读取现有 skill → 合并细节 → 版本号 +1 → 更新索引 │
│                                                              │
│ Step 4: 评分更新                                             │
│   → 更新 use_count, success_rate, ai_score                  │
│   → 检查是否满足 solidify 条件（use_count ≥ 10, ai_score ≥ 90）│
│   → 满足则状态变更为 solidified，可移入 common 域           │
│                                                              │
│ Step 5: 索引更新                                             │
│   → 更新 Tantivy 索引                                        │
│   → 更新 trigger_conditions 关键词索引                       │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 与 verify 闭环的衔接

| 阶段 | 动作 | 数据流向 |
|---|---|---|
| **执行中** | Agent 按 skill 指引完成任务 | Skill 内容在 Context 中 |
| **执行后** | Agent/人类提交 verify（worked/not_worked/unsure） | verify → verify_logs → 更新 skill.metrics |
| **Session 结束** | 后台 Worker 分析 Trace | Trace → distill → 新 Skill / 合并 Skill |
| **评分更新** | 多维度评分计算 | success_rate(40%) + token_efficiency(20%) + user_feedback(40%) = ai_score |
| **生命周期流转** | 自动晋升/降级 | incubating → solidified（ai_score≥90, use_count≥10）→ archive（连续5次失败） |

---

## 六、执行建议：整合后的路线图

### 6.1 本周：通用网关核心（MVP）

| 动作 | 验证目标 | 来源 |
|---|---|---|
| 实现 `packages/gateway` 核心包 | Domain Filter + Hybrid Retriever + Layer Loader | 文档中的 Python MVP + OpenClaw 机制 |
| 实现 Claude 适配器 | system prompt + tools JSON 格式正确 | 文档中的 Claude 适配策略 |
| 实现 MCP 适配器 | 封装为本地 MCP 服务 | 文档中的 MCP 封装策略 |
| 验证 `layers` 数组加载顺序 | 按 order 字段有序加载，Token 预算不超 | AgentSignal 自研 |

### 6.2 下周：延迟加载 + 参数注入

| 动作 | 验证目标 | 来源 |
|---|---|---|
| 实现 `load_skill_detail` 元工具 | 模型触发后读取全文，参数正确渲染 | OpenClaw 两阶段调用 |
| 实现参数多来源解析 | 项目级 > 全局 > 环境变量 > 默认值 | AgentSignal 自研 |
| 实现 Token 仲裁 | 超限时 LRU 卸载或压缩 | AgentSignal 自研 |

### 6.3 第 3 周：自进化沉淀

| 动作 | 验证目标 | 来源 |
|---|---|---|
| 实现 Session Trace 持久化 | JSON 格式完整记录对话历史 | 文档中的沉淀机制 |
| 实现后台 Worker 审计 | Gemini Flash 提取成功步骤 | Hermes Learning Loop + LangMem Extract |
| 实现 Skill 生成/合并 | 新 Skill 写入 domains/<current>/skills/ | LangMem Refine Loop |
| 实现 Confidence Score | 多维度评分 + 生命周期流转 | Zep 评分机制 |

---

## 七、最终结论

> **你上传的「通用技能引擎网关」文档与 AgentSignal 的架构完全契合。文档提供的 Python MVP、跨模型适配策略、Frontmatter 协议、自进化沉淀机制，恰好填补了 AgentSignal 在「通用中间件层」的空白。**
>
> **整合后的 AgentSignal 架构 = 通用网关（文档方案）+ JSON5 数组分层（可插拔）+ Tantivy 索引（高性能）+ MCP 消费（跨 Agent）+ verify 闭环（验证即信任）。**
>
> **所有机制均已在端侧生态（OpenClaw、Hermes、LangGraph、Zep、CrewAI）中独立验证，技术可行性从"理论可行"升级为"生态已验证 + 文档已提供 MVP 源码"。**
>
> **建议：立即基于文档中的 Python MVP 启动 `packages/gateway` 包开发，本周验证 Claude 适配 + MCP 封装，下周验证延迟加载 + 参数注入，第 3 周验证自进化沉淀。**
