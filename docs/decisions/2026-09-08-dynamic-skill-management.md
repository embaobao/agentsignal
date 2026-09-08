# 决议：动态技能管理——订阅落库 × 回流闭环（2026-09-08）

来源：[dynamic-skill-management 提案](../../openspec/changes/dynamic-skill-management/proposal.md)（Approved 2026-09-08 站长令）· 本文兑现 [skill-envelope 决议](2026-09-02-skill-envelope.md) 裁决 3 预留的「与线上信封映射（Phase 3）」与 [local-engine.md](../design/local-engine.md) §10 预留的「服务端发布机制」。

## 背景

本地引擎 0.4.0 的**消费侧**已动态（Orama 双路径检索 / 分层加载 / 参数四来源链 / verify metrics / 管理界面点选即改），**供给侧为零**：技能进不来（本地库仅 init 示例 2–3 条，`use` 只物化文件不进库）、不更新（与源信号 update 锚定链无关联）、回不去（`verify_skill` 只写本地 metrics 不回传平台）。北极星问题「Agent 是否愿意长期订阅并依赖收到的信息做事」在个人工作机上缺了「订阅」一环。

## 裁决

1. **订阅 = pull 按需，非 watch 常驻**（重申 [Watch / Pull 既有口径](../design/glossary.md)）：同步只由显式动作触发（管理界面按钮 / status 提示 / `use` 顺手），无常驻进程；watch 类纪律全适用（游标持久化、at-least-once + sig_id 幂等 upsert、429 按 retry_after 退避、原子写 tmp+rename、结构化日志）。
2. **信封(solution) → 技能内部形式映射**（转换器 = `packages/cli/src/skills/transcoder.ts` 纯函数）：

| 线上信封 v0.2 | 本地 skill.json5 + SKILL.md | 说明 |
|---|---|---|
| digest 三段式 | frontmatter（六字段必收 id/name/description/domains/layers/triggers）+ 扩展字段 | 主张→description；scope/validation→扩展字段与 triggers 候选 |
| experience.body 四节正文 | SKILL.md 全文 | `## What worked` 即 Runbook，分层加载的正文层 |
| `sig_<ulid>` / topic / validation / 发布时间 | `lifecycle.provenance` **扩展**：现 schema（sig_id/digest/origin/published_at）增 `base_url` · `topic` · `validation` · `synced_at`（全部 optional 安全默认，向后兼容） | [skill-envelope 裁决 4](2026-09-02-skill-envelope.md) 的「留位」此番开始**填充** |
| kind ≠ solution | **拒转**（结构化报错） | update/discussion 不落技能库，update 走更新链（裁决 3） |

3. **更新链语义**：update 信号 digest 锚定（`anchor: sig_x`）命中本地技能 → 该技能标 `outdated`，更新正文经 layers 作附加层注入（**不覆盖原 Runbook**，原文不可变纪律的本地对应）；同步发现源信号 404/hidden → 标 `revoked`（检索降权、列表置灰，**不物理删**）。
4. **回流镜像语义**：`verify_skill` 本地落 metrics 后，若技能带 provenance 且 `~/.config/agentsignal/config.json` 有 token → 缺省输出一行提示（`agentsignal verify <sig_id>` 可直接回传）；`config.json5` `sync.mirror_verify: true` 时自动镜像。**默认 false，手动优先**；token 缺失只提示、不阻塞本地功能（[skill-engine 裁决 5](../../openspec/changes/skill-engine/proposal.md) 用户域暂缓）。
5. **subscriptions 配置段**：`config.json5` 新增 `subscriptions: [{ topic, cursor, min_validation? }]`（cursor = sig id，即游标；`sync.max_skills` 默认 200，超限只告警不自动删）。
6. **红线重申（违者回滚）**：不新增用户命令（用户面恒四命令）、不对 Agent 开维护类 MCP 工具（工具面恒九）、无常驻进程、Zero-LLM、零触碰 apps/api（服务端端点已足）；`use --install` 属参数级变更，participant SKILL 同 PR lockstep（G1–G4）。

## 开放问题（P2 开工前站长裁决，不阻塞 P0–P1）

1. init 向导是否加「选 topic 订阅」一步（建议：不加，订阅纯管理界面手动添加）；
2. `mirror_verify` 默认值（本文建议 false）；
3. 容量默认上限（建议 200 条 / 50MB）。

## 影响

- `packages/protocol/src/skill-schema.ts`：SkillProvenanceSchema 四字段扩展 + SubscriptionsSchema（P0.2）；旧 config/旧技能零破坏。
- `packages/cli/src/skills/`：新增 transcoder / sync / lifecycle 模块；`use --install` 参数（P1）。
- `packages/wizard-ui`：管理界面 B 视图「订阅」区（P2）；`status` 增「落后 M 条待同步」体检行。
- 术语：glossary 注册「订阅（Subscription · 本地）」，与 Follow（声明性偏好）划界。
- 不修改线上信封 v0.2、api.md、message-envelope.md 任何语义。
