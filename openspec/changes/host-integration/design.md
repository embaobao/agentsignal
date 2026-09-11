# 设计：本地宿主集成管理（host-integration）

> 目标：**让订阅来的经验，在宿主里真正存在。**
> 依据：[notes/2026-09-10-skill-management-landscape.md](../../../docs/notes/2026-09-10-skill-management-landscape.md)（缺口论证）· [experience.md](../../../docs/design/experience.md) 幕二（M2 硬门槛）。
> 纪律：测试随行（node:test 单口径）· 只写 agentsignal 自己条目（规范 E-10）· 协议/命令面/工具面零变化 · 零触碰 apps/api。

## 一、现状（事实）

```text
packages/cli/src/skills/
  install.ts    installSignal() → 只写 ~/.agentsignal/skills/<sig_id>/，不落宿主目录
  sync.ts       订阅同步 → 中央库（游标/更新链/revoked 已就绪）
  wiring/hosts.ts  HostDef 只有 mcpPath / hooks / rulesPath / toml，无 skills 路径位
```

- `use <sig_id> --install` 物化到**当前工作目录**——装进宿主技能目录仍是用户手工动作。
- host-matrix-alignment 将引入宿主 `skillsPath` 与 skills 写入器（design.md §四），但其对象是**接入技能/示例技能**（固定、一次性）。

**分工边界（本提案的核心立论）**：

| | host-matrix-alignment | 本提案 host-integration |
|---|---|---|
| 对象 | 接入技能（participant）· 示例技能 | **订阅来的经验技能**（动态集合） |
| 策略 | 固定写入 | **准入控制**（validation × 启用 × 上限） |
| 写入器 | 引入 `skillsPath` + 写入器 | **复用同一写入器**，不另实现 |

## 二、设计决策

| # | 决策 | 选择 | 理由 |
|---|---|---|---|
| D1 | 装载对象 | 订阅落库的经验技能 | 与 alignment 的接入技能区分，避免能力重叠 |
| D2 | 默认模式 | **symlink 优先**，跨卷/Windows 回退 copy | symlink 零复制且源 `synced_at` 更新自动跟随；Windows 需开发者模式，回退 copy |
| D3 | 默认开关 | `sync.install.enabled = false` | 不因升级把经验灌进宿主 context |
| D4 | 准入 | `min_validation` × 用户启用 × `max_installed` Top-K | Token 预算（见 proposal §三） |
| D5 | revoked 处理 | **自动从宿主摘除** | 宿主侧只能"有/无"，无法降权；留在宿主等于失效经验继续被消费 |
| D6 | 归属记账 | config `skills_installed` + 技能自带 `provenance` | 不额外写标记文件，宿主目录保持干净 |
| D7 | 外来条目 | 反向可见**只读列出** | 对齐 skills-manager「反映 Agent 真实所见」 |
| D8 | 写入器 | 复用 alignment 的 skills 写入器 | 单一实现，防双源漂移 |

## 三、数据结构改动（`packages/protocol/src/skill-schema.ts`）

```ts
/** 宿主接线声明 —— 增装载记账位（可选，旧 config 零破坏） */
export const HostBindingSchema = z.object({
  host: z.enum([...]),            // 由 host-matrix-alignment 扩至 9
  wired: z.boolean().default(false),
  config_path: z.string().optional(),
  // ── 新增 ──
  skills_installed: z.array(z.object({
    id: z.string(),               // 技能 id（= 中央库目录名）
    mode: z.enum(["symlink", "copy"]).default("symlink"),
    installed_at: z.string(),     // ISO 8601
  })).default([]),
});

/** sync 段 —— 增 install 子段（可选，安全默认） */
export const InstallPolicySchema = z.object({
  enabled: z.boolean().default(false),
  hosts: z.array(z.string()).default([]),        // 空 = 所有已接线且支持 skills 的宿主
  min_validation: z.enum(validationLevels).default("self-tested"),
  max_installed: z.number().int().min(1).default(20),
  mode: z.enum(["symlink", "copy"]).default("symlink"),
});
```

## 四、各宿主 skills 落地规格

| 宿主 | skillsPath | 说明 |
|---|---|---|
| claude-code | `~/.claude/skills/<id>/SKILL.md` | 目录式 |
| cursor | `~/.cursor/skills/<id>/SKILL.md` | 目录式 |
| codex | `~/.codex/skills/<id>/SKILL.md` | 目录式 |
| hermes | `$HERMES_HOME\|~/.hermes/skills/<id>/SKILL.md` | alignment Phase 1 已定 |
| workbuddy | `~/.workbuddy/skills/<id>/SKILL.md` | directory |
| dsh | `~/.dsh/skills/<id>/SKILL.md` | 纯 skill 目录 |
| opencode | user `~/.config/opencode/skills/` · project `<root>/.opencode/skills/` | 双前缀（alignment D4） |
| **cline / gemini** | **`null`（不装载）** | 照抄「不猜」纪律（D7）：路径没把握就不写，只保留 MCP + rules 通道 |

> 无 skills 位的宿主，`status` 与界面显式标「该宿主不支持装载」，**不静默跳过**。

## 五、对账状态机（`host-skill-visibility`）

对每个「已接线宿主 × 中央库技能」三方比对（落库 ⇄ 记账 ⇄ 宿主目录实况）：

| 态 | 判据 | 界面/status |
|---|---|---|
| `active` | 记账有 · 宿主存在 · 源 `sync_state=active` | 正常 |
| `outdated` | 源 `sync_state=outdated` | 提示待更新（symlink 模式内容已随源更新） |
| `revoked` | 源 `sync_state=revoked` | **自动摘除**后从记账移除，status 记一条 |
| `missing` | 记账有 · 宿主目录已不存在（被宿主/用户删） | 提示「宿主侧失联」，可一键重装 |
| `foreign` | 宿主目录有 · 中央库无 · 记账无 | **只读展示**，绝不动 |

## 六、测试计划（node:test，`AGENTSIGNAL_HOME` 临时夹具，不碰真实宿主）

1. **装载**：symlink 模式宿主目录出现链接且指向中央库；copy 模式为实体副本；跨卷回退 copy
2. **卸载不残留**：`unmount` 后条目消失；**外来条目原样保留**
3. **默认关闭**：未开启 `install.enabled` 时宿主目录零写入
4. **准入**：validation 阈值过滤 · 上限截断 · 超额只提示
5. **对账五态**：五种判据各一用例
6. **revoked 自动摘除**：源置 revoked → 落地条目被摘 + 记账清理
7. **更新联动**：symlink 模式源更新后宿主侧读到新内容；copy 模式需重写（断言行为差异）
8. **回归**：既有接线（MCP/hook/rules）不受影响，init-e2e 绿

## 七、风险与兜底

| 风险 | 兜底 |
|---|---|
| 宿主 context 膨胀 | `enabled` 默认 false + `max_installed` 上限 + `min_validation` 阈值三道闸 |
| symlink 在 Windows 不可用 | 检测失败自动回退 copy，并在 status 标注当前模式 |
| 误删用户/他人技能 | 只操作 config 记账内的条目；外来条目只读（D7） |
| 宿主目录被用户手工改动 | 对账器以宿主实况为准，`missing` 态提示而非静默重建 |
| 与 alignment 的写入器分叉 | 复用同一 `skillsPath` 与写入器（D8），本提案不新增第二实现 |

## 八、验收

- [ ] 端到端：订阅 → 准入 → 装载 → 宿主原生可见 → 源更新跟随 → 源 revoked 自动摘除
- [ ] 「卸载不残留」硬断言通过（外来条目保留）
- [ ] 默认关闭断言通过（未开启前零写入）
- [ ] 对账五态全绿；status 新增行口径正确
- [ ] 协议/命令面/工具面零变化（红绿证据）；既有宿主接线回归无回退
- [ ] 台账与 AGENTS.md 已同步（§10）
