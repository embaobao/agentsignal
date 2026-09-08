# 任务拆分 — dynamic-skill-management

> 状态：**Approved（2026-09-08 站长令，自动化夜间实施：每小时触发轮，仅 23:00–09:00 开发）**
> 依赖：无（服务端端点已足；零触碰 apps/api / 007_auth WIP / Netlify）
> 纪律：测试随行（node:test 单口径，fake fetch 证明零外部依赖）· 账实同步（AGENTS.md §10，同 PR 勾选本文件 + [implementation-tasks.md](../../../docs/design/implementation-tasks.md)）· CLI 参数面变更同 PR 更新 participant SKILL（G1–G4）· 协议变更先落 decisions · 红线见 [proposal.md](proposal.md) §二
> 进度日志：只记本目录 [progress.md](progress.md)（**禁止写根目录**）

## Phase 0 · 协议先行（先测后合，约 0.5 人日）

- [x] 0.1 decision 文档 `docs/decisions/2026-09-08-dynamic-skill-management.md`：信封(solution)→技能内部形式映射表（digest 三段式↔frontmatter 六字段 · 四节正文↔SKILL.md）· provenance 字段语义 · 更新链/失效语义 · 「订阅=pull 按需非 watch 常驻」重申 · 开放问题三项登记；glossary 增「订阅（subscription · 本地）」行 + canonical 指针 — 2026-09-08 完成（provenance 现位 sig_id/digest/origin/published_at 上扩 base_url/topic/validation/synced_at；glossary 与 Follow 划界）
- [x] 0.2 `packages/protocol/src/skill-schema.ts` 扩展：`provenance`（base_url/topic/sig_id/kind/validation/synced_at，optional 安全默认）+ `SubscriptionsSchema`（topic/cursor/min_validation?，config.json5 新段）；旧 config/旧技能零破坏断言（向后兼容用例） — 2026-09-08 完成（validationLevels 复用 schemas.ts 真源显式再导出消歧；新增 SyncStateSchema（subscriptions/mirror_verify=false/max_skills=200）挂 ConfigSchema.sync 安全默认；schema-subscription.test.ts 7 用例红→绿，含经 config 加载器的 dist 全链回环）
- [x] 0.3 `packages/cli/src/skills/transcoder.ts` TDD：纯函数信封→技能二元组；用例覆盖中文 digest/正文 · validation 三档 · kind≠solution 拒转 · update（非 solution）锚定提取；快照测试落 `test/transcoder.test.ts` — 2026-09-09 完成（8 用例红→绿：中文 golden 全量快照 · 缺段回退 common/none · scope 多域切分 · update 锚定提取 extractAnchorSigId · 转出物过 schema；tokens_est bytes÷4 口径）

## Phase 1 · 单条装载 + 回流（最小闭环，零新命令，约 1 人日）

- [x] 1.1 `use --install`：`src/index.ts` use 分支加参数——物化当前目录照旧 + transcode 落库 `~/.agentsignal/skills/<sig_id>/`（AGENTSIGNAL_CONFIG 尊重）+ 触发索引增量更新；USAGE 与 participant SKILL 同 PR 更新（§4 use 段），G1–G4 绿 — 2026-09-09 完成（新模块 skills/install.ts：原子写两件套 + scan/build/save 索引刷新；use-install.test.ts 4 用例含 save/load 检索命中与幂等；**顺手修存量 bug**：`--out` 缺省时 `rest[-1+1]` 误取 sig id 当路径——即「use 物化出 sig_* 文件」怪象根因，现缺省正确为 as-<sig_id>.md；SKILL §4 + G4 镜像同步）
- [x] 1.2 回流镜像：`verify_skill`（mcp/skillTools）落本地 metrics 后——provenance 存在且 config 有 token 时输出提示行（含 `agentsignal verify <sig_id>` 回车即回传）；`config.json5 sync.mirror_verify: true` 时自动镜像（默认 false）；`test/mirror.test.ts`：off 断言零网络请求（fake fetch 零调用）· on 断言调用一次带 verdict — 2026-09-09 完成（skills/mirror.ts：readPlatformCredentials（env 优先复用平台凭证，不新增登录面）· mirrorContextForSkill（provenance→sigId/baseUrl/开关）· mirrorPlatformVerify（off 零网络 / on 一次调用 / 5xx 与网络异常 fail-soft 不影响本地裁决）；verify_skill 返回增 mirror 字段 + 工具 description 更新；5 用例绿）
- [x] 1.3 init-e2e 增段：`use --install` 后 `search_skills` 命中该技能 → verify_skill 后 status 双指标变化 → uninstall 后本地库保留断言 — 2026-09-09 完成（回环 http 服务扮演平台零外部依赖；子进程 use --install → 引擎路径检索命中 → search_skills 吞吐节省非零断言 → verify mirror off 只提示零网络 → uninstall 保留断言含装入库技能 + as-<sig_id>.md 物化回归断言；init-e2e 5 用例绿）

## Phase 2 · 订阅同步器（pull 式，无常驻，约 1.5 人日）

- [ ] 2.1 `packages/cli/src/skills/sync.ts`：游标分页（`GET /topics/:t/signals?cursor=&limit=`）→ 过滤（kind=solution · min_validation 阈值缺省 none）→ 逐条 `include=experience` 拉全文 → transcode → upsert（同 sig_id 幂等覆盖）→ 游标推进（cursor=sig id 持久化进 subscriptions 段，原子写 tmp+rename）；429 按 retry_after 退避重试；结构化日志
- [ ] 2.2 `test/sync.test.ts`（fake fetch，零外部依赖）：幂等（同游标重放零重复落盘）· 断点续传（中断后从持久化游标续）· 429 退避 · 过滤阈值 · 隐藏信号跳过
- [ ] 2.3 管理界面 B 视图「订阅」区：订阅管理（增删 topic）· 同步按钮（触发 + 进度回报）· 本地库列表（来源 topic / synced_at / 状态 active|outdated|revoked / 最近 verify · 删除=确认后物理删）；wizard-ui 构建产物重注入 html.ts；零外部请求 + 无 skills 禁词断言保持绿；开放问题 1/3 在本期前落裁决
- [ ] 2.4 `status` 增体检行：「订阅 N topic · 落后 M 条待同步」（仅统计不自动同步）；init-e2e 断言

## Phase 3 · 生命周期治理（约 1 人日）

- [ ] 3.1 更新链：sync 时对 update 信号解析 digest 锚定（`anchor: sig_x`）→ 命中本地技能则标 `outdated` + 更新正文经 layers 作附加层注入（不覆盖原 Runbook）；`test/lifecycle.test.ts` 锚定链用例
- [ ] 3.2 失效降权：同步发现源信号 404/hidden → 本地标 `revoked`（检索降权 + 列表置灰，不物理删）；retriever 降权断言
- [ ] 3.3 容量治理：`config.sync.max_skills`（默认 200）超限仅 status 告警 + 管理界面列出 LRU 清理候选（最近未命中且未 verify），确认后执行——不自动删
- [ ] 3.4 管理界面状态着色接入 active/outdated/revoked 三态

## Phase 4 · 文档随行 + 端到端 + 发版（约 0.5 人日）

- [ ] 4.1 文档随行（双手册纪律）：user-manual §1.5 增「订阅与回流」小节（用户面措辞，无 skills 内部词）· [local-engine.md](../../../docs/design/local-engine.md) 升版（§3 工具面/§10 非目标重绘：维护入口=管理界面）· admin-guide §6 增 subscriptions 段 · participant SKILL use/verify 增量（G1–G4）· AGENTS.md 当前阶段节刷新
- [ ] 4.2 端到端：真服务 e2e 脚本增「订阅→同步→检索→执行→verify 镜像回传」全链（E2E_BASE 可指环境）；`pnpm verify` 全绿 + `pnpm pack:verify` 过
- [ ] 4.3 changeset（cli/protocol lockstep minor）→ 发版流程按 deployment.md（protocol→cli 顺序）；台账落账

## 验收（全部 Phase 完成后）

- 全新目录 `agentsignal init` → 管理界面订阅 topic → 同步落库 → IDE 内 search_skills 命中平台经验 → load_skill_detail 全文 → verify_skill → 提示回传 → 平台 verify 聚合 +1 —— 全链零手工配置、零 LLM token
- 红线自查：用户面仍四命令 · MCP 仍九工具 · 无常驻进程 · pnpm verify 全绿 · G1–G4 绿
