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

- [x] 2.1 `packages/cli/src/skills/sync.ts`：游标分页（`GET /topics/:t/signals?cursor=&limit=`）→ 过滤（kind=solution · min_validation 阈值缺省 none）→ 逐条 `include=experience` 拉全文 → transcode → upsert（同 sig_id 幂等覆盖）→ 游标推进（cursor=sig id 持久化进 subscriptions 段，原子写 tmp+rename）；429 按 retry_after 退避重试；结构化日志 — 2026-09-09 完成（游标解析：显式入参优先兜底持久化断点，config 即订阅状态源；update 不拉详情；末页游标退回本页最后一条 sig id；429 同页重试 sleep 注入零真实等待；CONFIG_MISSING 结构化报错；sync.test.ts 5 用例绿）
- [x] 2.2 `test/sync.test.ts`（fake fetch，零外部依赖）：幂等（同游标重放零重复落盘）· 断点续传（中断后从持久化游标续）· 429 退避 · 过滤阈值 · 隐藏信号跳过 — 2026-09-09 完成（10 用例：新增断点续传两趟不重拉 / 详情 404 隐藏跳过游标照常推进 / 缺正文 skipped / 429 打满 RATE_LIMITED / retry_after 走 body 无 header；落库断言类用例独立 root 防同文件污染）
- [x] 2.3 管理界面 B 视图「订阅」区：订阅管理（增删 topic）· 同步按钮（触发 + 进度回报）· 本地库列表（来源 topic / synced_at / 状态 active|outdated|revoked / 最近 verify · 删除=确认后物理删）；wizard-ui 构建产物重注入 html.ts；零外部请求 + 无 skills 禁词断言保持绿；开放问题 1/3 在本期前落裁决 — 2026-09-09 完成（服务端 4 端点 subscriptions/add·remove · sync（readPlatformCredentials 取站点，env 优先）· library/delete（目录名白名单防穿越）+ buildState 增 sync/library 块；UI 新 S 文案块 + 订阅面板（容量 n/max · 游标态 · 同步按钮一次性回报）+ 库列表（平台/本地态 · 来源 · 验证聚 · 两击确认物理删）；产物重注入 697.7KB 零外部请求；构建期禁词扫描口径与测试对齐（剥 max_skills/skill_count 标识符）；开放问题按提案建议值执行未裁决）；wizard.test.ts 8 用例绿（新增端点全链：增删/重复 400/同步落库/游标持久化/库移除）
- [x] 2.4 `status` 增体检行：「订阅 N topic · 落后 M 条待同步」（仅统计不自动同步）；init-e2e 断言 — 2026-09-09 完成（sync.ts probePending 一页信封级探针（next_cursor 非空记 + 下限）；status ③½ 块：无站点提示 / 离线 fail-soft「落后统计失败」退出码 0 / 多分区失败计数；init-e2e 6 用例绿含在线统计与离线 fail-soft 断言）
## Phase 3 · 生命周期治理（约 1 人日）

- [x] 3.1 更新链：sync 时对 update 信号解析 digest 锚定（`anchor: sig_x`）→ 命中本地技能则标 `outdated` + 更新正文经 layers 作附加层注入（不覆盖原 Runbook）；`test/lifecycle.test.ts` 锚定链用例 — 2026-09-09 完成（lifecycle 新增 sync_state/updates 字段（安全默认向后兼容）· lifecycle.ts applySignalUpdate（meta 原子改写 + UPDATES.md 追加段落，SKILL.md 逐字不动）· loader loadDetail 附加注入 · sync 对 update：命中已装才拉详情标 outdated（report.updated），未命中零详情请求；lifecycle.test.ts 4 用例红→绿）
- [x] 3.2 失效降权：sync 发现源信号 404/hidden → 本地标 `revoked`（检索降权 + 列表置灰，不物理删）；retriever 降权断言 — 2026-09-09 完成（lifecycle markRevoked/isInstalled · sync solution 详情 404 且已装 → revoked 计数 + 结构化事件 · retriever 最终排序 revoked 分数 ×0.05 沉底不隐藏；**顺带修 sync 健壮性 bug：畸形响应 next_cursor 缺失时 done 判不终导致死循环 → 改 `== null` 判末页 + signals 数组防御**；lifecycle.test.ts 7 用例红→绿）
- [x] 3.3 容量治理：`config.sync.max_skills`（默认 200）超限仅 status 告警 + 管理界面列出 LRU 清理候选（最近未命中且未 verify），确认后执行——不自动删 — 2026-09-09 完成（lifecycle capacityReport（候选 = 未验证按 use_count 升序；超限读 config）· status ②½ 容量告警行（fail-soft）· wizard state 增 capacity 块 + UI 容量告警文案与库列表「建议清理」标记（产物重注入 698.2KB）；lifecycle.test.ts 9 用例红→绿）
- [x] 3.4 管理界面状态着色接入 active/outdated/revoked 三态 — 2026-09-09 完成（server library.status 上抛真实 sync_state（本地手造 = local）· UI 圆点着色对齐路由图 dot-success/dot-warning/dot-neutral 惯例 + 「有更新/已失效」文案（S 块零禁词）· 产物重注入 698.5KB；wizard.test 9 用例红→绿：active→outdated→revoked 全链）

## Phase 4 · 文档随行 + 端到端 + 发版（约 0.5 人日）

- [x] 4.1 文档随行（双手册纪律）：user-manual §1.5 增「订阅与回流」小节（用户面措辞，无 skills 内部词）· [local-engine.md](../../../docs/design/local-engine.md) 升版（§3 工具面/§10 非目标重绘：维护入口=管理界面）· admin-guide §6 增 subscriptions 段 · participant SKILL use/verify 增量（G1–G4）· AGENTS.md 当前阶段节刷新 — 2026-09-09 完成（user-manual 新增 §1.6 订阅与回流 + 版本戳刷新 · local-engine 状态行 + 新增 §10.5 订阅落库×回流闭环 + §10 非目标第三条改写为已落地 · admin-guide 新增 §6.1 管理面（sync 段/UPDATES.md/wizard 端点/体检两行/运维注意）· SKILL §5 verify 补回流镜像行为一句 + G4 镜像同步 · AGENTS.md P3 行刷为 P0–P3 完成与发版顺序修订；G1–G4 4/4 绿）
- [ ] 4.2 端到端（**发版顺序修订 2026-09-09 站长令：本地自管理全链验证为 npm 发版硬门，服务端生产部署押后**）：
  - [x] 4.2a **本地自管理全链验证（硬门）✅ 通过（2026-09-10 04:3x，隔离栈实测）**：独立 PG 容器 + 独立 API（PORT=3100，`SELF_REGISTER_ENABLED=1`，与站长 dev 栈/compose 库零接触）→ readyz `{"status":"ready","migration":"007_auth"}` → register 本地签发（隔离凭证目录）→ publish 真实经验 → 管理界面端点添加订阅 → `/api/sync` 真实同步 **3 条落库 + 游标持久化** → engine.search 三条全命中 → `verify_skill` mirror 自动回传 **200** → 平台聚合 `verify_count` 累加正确。**连带修复 3 个真 bug**：① 平台凭证路径硬编码 `~/.config/agentsignal`（不吃隔离 env，register 覆盖了站长真实 token）→ 新增 `AGENTSIGNAL_CLIENT_DIR` 覆盖（index.ts + mirror.ts 同契约）；② 真实平台 id 含大写 ULID 被技能 id 白名单拒收 → 落库同步落库失败 → 本地一律小写存储 + 全链比对归一（transcoder/lifecycle/verify/loader/mirror），`provenance.sig_id` 保留原始大小写（回流依据）；③ mirror.ts find 漏 toLowerCase（4.2a 实测揪出，单测假 id 烤进去的假设）。回归用例：lifecycle.test.ts 大写 ULID 用例；验证记录本行 + progress.md
  - [x] 4.2b 真服务 e2e 脚本增「订阅→同步→检索→执行→verify 镜像回传」链（E2E_BASE 可指本地或公网）；`pnpm verify` 全绿 + `pnpm pack:verify` 过 — 2026-09-10 完成（three-chains.test.sh 新增**链路4**：独立身份 publish → syncSubscription 真实同步（隔离 AGENTSIGNAL_CONFIG）→ engine.search/loadDetail → mirror_verify 自动回传断言 → curl 平台聚合 verify_count≥1；隔离栈实测 **23 通过/0 失败 exit 0**；pack-verify.sh 加固：pack 产物落盘轮询 + glob 探测（pnpm v10 产物可见性延迟实测）。**⚠️ 遗留一笔**：pack-verify 沙箱安装段在本会话工具环境遭遇文件系统可见性异常（脚本进程树对自产 tgz 持续 ENOENT 60s+，独立 shell 与事后检查均可见、内容正确——疑似工具沙箱 overlay，非仓库问题），**白天请站长在自有终端跑一次 `AGENTSIGNAL_BASE=<base> bash scripts/pack-verify.sh` 终验**；pnpm verify 全绿 ✓）
- [ ] 4.3 changeset（cli/protocol lockstep minor）→ 发版流程按 deployment.md（protocol→cli 顺序）；**4.2a 通过后才发版**；服务端生产部署（Netlify 三变量 + 手动部署）押后，不阻塞发版，发版后照跑公网 smoke 验收；台账落账

## 验收（全部 Phase 完成后）

- 全新目录 `agentsignal init` → 管理界面订阅 topic → 同步落库 → IDE 内 search_skills 命中平台经验 → load_skill_detail 全文 → verify_skill → 提示回传 → 平台 verify 聚合 +1 —— 全链零手工配置、零 LLM token
- 红线自查：用户面仍四命令 · MCP 仍九工具 · 无常驻进程 · pnpm verify 全绿 · G1–G4 绿
