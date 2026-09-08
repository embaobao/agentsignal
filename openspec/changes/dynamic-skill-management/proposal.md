# 提案：动态技能管理——订阅落库 × 回流闭环（dynamic-skill-management）

> 状态：**Approved（2026-09-08 站长令：批准构建并排期自动化实施——每小时触发轮，仅 23:00–09:00 开发，白天零操作跳过）**
> 决策人：站长（zhumeng）
> 来源：[skill-engine 提案](../skill-engine/proposal.md) Phase 3 预留的「服务端发布机制」另立提案（其 tasks.md Phase 3 占位即本提案）
> 关联：[local-engine.md](../../../docs/design/local-engine.md) §10 非目标注记 · [skill-envelope 决议](../../../docs/decisions/2026-09-02-skill-envelope.md)（内部形式定义）

## 一、为什么（核心主张）

北极星问题是「一个真实的 Agent 是否愿意长期订阅一个 Space 并依赖收到的信息做事」。本地引擎 0.4.0 已把**消费侧**做动态了——检索（Orama 双路径）、分层加载、参数四来源链、verify metrics、管理界面点选即改——但**供给侧是零**：

- 技能**进不来**：本地库只有 init 自带的 2–3 条示例；`use <sig_id>` 只物化一个 md 文件到当前目录，不进本地库、无来源记录、宿主不可检索
- 技能**不更新**：平台信号不可变 + update 锚定链，但本地技能与源信号无任何关联，永远停在落盘那一刻
- 结果**回不去**：`verify_skill` 只写本地 metrics，与平台验证裁决（`verify` / MCP `report_outcome`）互不相通

即：订阅 → 注入 → 执行 → verify → 沉淀 publish 的闭环，本地引擎只通了中间三环。本提案补齐两端，让本地库成为平台经验的**活的下游**（订阅落库、跟随更新、回流裁决）——这正是北极星在个人工作机上的载体。

## 二、红线（承既有裁决，勿重议）

| # | 红线 | 依据 |
|---|---|---|
| 1 | **不新增用户命令**（用户面恒四命令 init/mcp/status/uninstall）；新能力 = `use` 参数扩展 + 管理界面 + status 提示 | skill-engine 裁决 12 |
| 2 | **不对 Agent 开维护类 MCP 工具**（工具面恒九） | skill-engine 裁决 13 |
| 3 | **无常驻进程/守护**：同步 = 按需 pull（管理界面按钮 / status 提示触发 / use 顺手），不做 watch 常驻 | user-manual §8 watch 决议 |
| 4 | **Zero-LLM**：同步与转换零 token；watch 类纪律全适用（游标持久化、at-least-once + sig_id 幂等、429 按 retry_after 退避、原子写 tmp+rename、结构化日志、graceful） | AGENTS.md 架构要点 |
| 5 | **零触碰 apps/api**：服务端端点已足（游标列表 + `include=experience` 详情 + `POST /signals/:id/verify` + PATCH/DELETE）；改动面限 packages/cli、packages/protocol（schema 扩展）、packages/wizard-ui | skill-engine 裁决 6 隔离纪律 |
| 6 | **CLI 命令面/参数变更同 PR 同步 participant SKILL**（G1–G4 护栏必绿；`use --install` 属参数级变更） | AGENTS.md §9 |
| 7 | 不做登录/token 鉴权新面：回流镜像复用既有 `~/.config/agentsignal/config.json` 的 register token；token 缺失时只提示不阻塞本地功能 | skill-engine 裁决 5（用户域暂缓） |

## 三、方案总览（新增模块全在 packages/cli/src/skills/）

```
transcoder.ts   信封(solution) → 技能内部形式 转换器（纯函数，零 IO）
                digest 三段式 → skill.json5 frontmatter；四节正文 → SKILL.md
                provenance 全录：{ base_url, topic, sig_id, kind, validation, synced_at }
sync.ts         订阅同步器（pull 式）：
                config.json5 新增 subscriptions: [{ topic, cursor, min_validation? }]
                按游标拉信封列表 → 过滤(kind=solution + validation 阈值) → 逐条拉全文
                → transcode → upsert 落库(skills/<sig_id>/) → 游标推进（sig id 即游标）
lifecycle.ts    治理：更新链（发现 update 锚定 anchor: sig_x → 源技能标 outdated
                + 更新层经 layers 注入）· 源失效（404/hidden → revoked 降权不物理删）
                · 容量上限 + LRU 清理候选（管理界面确认后执行）
```

入口落点（不破红线）：

- `use <sig_id> --install`：单条装载——物化到当前目录的同时 transcode 落库（检索即刻可命中）
- 管理界面 B 视图新增「订阅」区：订阅管理（增删 topic）、同步按钮（触发 sync.ts，进度回报）、本地库列表（来源/版本/状态/最近 verify，支持删除=物理删候选确认）
- `status` 增一行：「订阅 N 个 topic · 落后 M 条待同步」（体检口径，不自动同步）
- 回流：`verify_skill` 本地落 metrics 后，若源为平台信号且 config 有 token → 输出一行提示（含可直接回车的镜像命令）；`config.sync.mirror_verify: true` 时自动镜像平台 verify（默认 false，手动优先）

## 四、分期与验收（详见 [tasks.md](tasks.md)，每期红绿后才进下一期）

| 期 | 内容 | 验收硬口径 |
|---|---|---|
| P0 | 协议先行：decision 文档（信封→技能映射 + provenance + 更新链语义）· skill-schema 扩展（provenance/subscriptions，向后兼容安全默认）· transcoder TDD | 转换器快照用例含中文 + 三 validation 档；schema 旧 config 不破 |
| P1 | 单条装载 + 回流：`use --install` · verify 镜像提示/开关 | init-e2e 增段：use --install 后 search_skills 命中；mirror off 断言零网络 |
| P2 | 订阅同步器：subscriptions + sync.ts + 管理界面订阅区 + status 提示 | fake fetch 全覆盖（幂等重放同游标零重复落盘 · 429 退避 · 断点续传 · 零外部依赖） |
| P3 | 生命周期治理：更新链 outdated · revoked 降权 · 容量/LRU | 锚定链用例；隐藏信号同步后检索降权断言 |
| P4 | 文档随行 + 端到端 + 发版：user-manual §1.5 增量 · local-engine.md 升版 · SKILL lockstep · changeset | pnpm verify 全绿；G1–G4 绿；pack-verify 过 |

## 五、开放问题（不阻塞 P0–P1，P2 开工前站长裁决）

1. init 向导是否加「选 topic 订阅」一步（默认订阅 = 无，纯手动管理界面添加？）
2. `mirror_verify` 默认值（本提案建议 false，保守）
3. 容量默认上限（建议 200 条技能 / 50MB，超限只提示不自动删）
