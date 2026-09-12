# 进度台账：local-capability-plane（追加式，只增不改）

> 配套 [tasks.md](tasks.md) §〇 执行体系。**每席每次会话收尾前必须追加一条**；审查席负责对账（台账 ↔ git log 双向核）。
> 条目**只追加不重写**；纠错 = 追加新条目说明。

## 记录格式

| 日期 | 席 | 任务 | 结果 | 提交 |
|---|---|---|---|---|
| 2026-09-11 | 人工会话 | 提案五件套定稿（proposal/design/tasks/templates/progress）· 决议签发 · 夜间四席流水线定档 · S1–S16 场景矩阵 | ✅ | （本条即首条提交） |

## 追加规则

1. **可记录**：台账条目 = 会话工作的唯一凭证；**无条目 = 该席当夜未工作**，审查席报告
2. **可追溯**：每条必含 commit sha；git log 中每个任务编号提交都能反查到台账条目
3. **可更新**：任务状态变化（`[x]`→审查驳回→修复→`[x]`）逐次追加新条目，不删旧条目
| 2026-09-12 | 席1·主轨开发（轨道A） | 0.1 AGENTS.md 定位更新（D1/D2 三节：定位扩展行+当前阶段刷 P0+剩余列当前主线）· docs/README.md 进度行/定位行同步（0.3.0→0.5.0 · 主线刷 local-capability-plane P0） | ✅ 待审查 | `cd3dc12`
| 2026-09-12 | 席1·主轨开发（轨道A） | 0.2 产物 frontmatter——protocol 新增 ArtifactFrontmatterSchema（name/description 必填）+ parseArtifactFrontmatter（目录名一致性）+ 类型导出；私有层字段零泄漏断言；CLI 5 新用例（红→绿，104/104）· protocol build · check/lint 绿 | ✅ 待审查 | `b0d9bb0`
| 2026-09-12 | 席1·主轨开发（轨道A） | 0.3 落库生成/校验——transcoder 新增 renderArtifactSkillMd（首部产物 frontmatter+正文逐字·JSON 值序列化 YAML 安全·写前过 parseArtifactFrontmatter）+ stripArtifactFrontmatter（注入侧剥离·旧技能/水平线正文零破坏）；install.ts 落库接产物首部；loader.ts loadDetail 剥离注入（Token Firewall）；3 处既有文件级断言升级新语义；CLI 111/111 · lint/check 绿 | ✅ 待审查 | `7e83c1d`
| 2026-09-12 | 席2·副轨开发（轨道B） | 5.1 verify_target 补实现——protocol 新增 SkillVerifyTargetSchema({statement,checks[]})+frontmatter 字段收宽 union(新对象/旧null/旧数组，零破坏)·verify.ts 新增 normalizeVerifyTarget 引擎层归一(旧数组→statement=首条·空→null)+VerifyResult 带 verify_target；SkillRecord 类型透传；dist 重建；新测试 verify-target.test.ts 7 用例，CLI 123/123 · check/lint 绿 | ✅ 待审查 | `f76f666`
| 2026-09-12 | 席2·副轨开发（轨道B） | 5.2 provenance.origin 补写入——TranscodeInput 增 origin 声明·transcodeSignal 缺省 {kind:"platform",ref:sig_id}（新落库必有 origin）·包导入/手动显式透传（P4 接线位）；golden 快照随新语义更新；旧记录无 origin optional 兼容断言；CLI 126/126 · check/lint 绿 | ✅ 待审查 | `2653873`
| 2026-09-12 | 席3·基建轨（轨道C） | C1 场景测试骨架——test/scenarios/ 16 壳（S1–S16 逐条：前置/通过标准/验证层/填充注记，test.todo 待填充）+ fixtures.ts（makeScenarioRoot/seedHostHome/seedHostSkillsDir/seedForeignSkill/seedTwoHosts/cleanup）；S8 fakeAdapter 构造器标注待 P1 types；CLI 132/132 不受壳影响 · check/lint 绿 | ✅ 待审查 | `b31187d`
| 2026-09-12 | 席3·基建轨（轨道C） | C3 台账一致性脚本 scripts/check-ledger.mjs——tasks↔git log(spec 尾注)↔progress 三方对账四类报告（任务号主键·sha 失效 warning）；顺手修正 LCP/host-matrix 两份台账 9 个 amend 废弃 sha；首跑暴露 host-matrix 0.1-0.4 历史无尾注勾选（真实债，留审查席）；CLI 不涉 · 语法 node 直跑过 | ✅ 待审查 | `59e7834`
| 2026-09-12 | 夜间通用轨（06:00，代审查席入库） | 审查三席报告统一入库（dod/test/redline 三份 ✅ 全过）· 四项待办处置：R5-a 已修（dda2731 前笔）· scenarios glob 缺口与台账口径两句留 06:30 汇总席定稿 · 0.4 快照夹具留轨道 A | ✅ 报告全过 | `e3ace1f`
| 2026-09-12 | 席7·汇总修复（06:20-07:25 槽） | 三报告已合并（06:00 轮代入库）· 四待办处置闭环：R5-a 已修（dda2731）· scenarios glob 缺口已修（CLI+根 test 口径 test/**/*.test.ts，todo 16 可见）· §0.7 补 sha 勘误豁免口径 · C1 补审注记定稿；全量门禁 db:up 仍阻塞（Docker 连续 7 轮未起）→ 替代口径 check+lint+CLI 138/138+todo16+test:ui 绿，verify 全链与 e2e 留痕次日补；tasks.md 定稿 | ✅ 定稿 | (sha见git log)
| 2026-09-13 | 席1·主轨开发（轨道A） | 0.4 快照测试——artifact-snapshot.test.ts 三用例：正样例产物 SKILL.md 字节级快照/私有键零泄漏+origin 在内部形式/旧样例（无首部+verify_target:null）经 scan→loadDetail→verify 全链零破坏；CLI 141/141 · check/lint 绿（verify 全链 Docker 阻塞留痕） | ✅ 待审查 | `e3ace1f`

## ★门 G-A 请求（P0 出口 · 2026-09-12 夜发出，等站长真机抽验）

**抽验目标**：产物「零工具可读」——落装到宿主技能目录的 SKILL.md 不依赖 AgentSignal 即可被任何工具/Agent 消费。

**抽验清单（10 分钟）**：
1. 任意机器跑 `agentsignal use "语义分块" --install`（或经 MCP `load_skill_detail` 后落一条），取 `~/.agentsignal/skills/<id>/SKILL.md`
2. 把整个 `<id>/` 目录拷进无 AgentSignal 的宿主技能目录（如 `~/.claude/skills/<id>/`）
3. 核对：SKILL.md 首部只有 `name`/`description` 两行 YAML（`---` 围栏），正文完整可读；无 layers/triggers/domains 等私有键
4. 让宿主内 Agent 直接读该 SKILL.md 并按正文执行——应无 AgentSignal 依赖即可用
5. （可选）用 APM 或任意 skill 管理器列目录——应正常识别不报错

**通过标准**：3–5 全过 → P0 出口，轨道 A 进 P1（适配器骨架+APM）。不过 → 驳回注记回 0.3/0.4 修复。
| 2026-09-13 | 席1·主轨开发（轨道A） | 1.1 capability/types.ts——design §四接口全量落地（PackageSource/CapabilityAdapter 两段·Cap 冻结枚举·DeployResult ladder+skipped[].reason·ReconcileReport 五态·UnsupportedCapability/HostLockConflict 结构化错含自纠建议）；capability-types.test.ts 4 用例，CLI 145/145 · check/lint 绿 | ✅ 待审查 | `e3ace1f`
| 2026-09-13 | 席2·副轨开发（轨道B） | 5.3 三计数分立——lifecycle.bumpSkillMetrics（批量 retrieved/injected·schema default(0) 旧库零破坏）+ 两埋点（search_skills 命中→retrieved·loadDetail 成功→injected）·used=use_count 零改名；**连带修生产级 bug：zod default(对象字面量) 返回共享可变引用**（无 metrics 技能 parse 原地改即污染全局，红测以 2!==1 当场暴露）→ metrics/lifecycle default 改函数工厂；CLI 153/153 · check/lint 绿 | ✅ 待审查 | (sha见下笔)

### ⚠️ 新缺口登记（5.3 连带发现，待审查/汇总席排期）

全仓其余 `zod .default(对象字面量)`（SkillDependenciesSchema/content/SyncStateSchema/ConfigSchema.arbitration/ConfigLayerSchema.stack_rules 等）存在同一引用共享风险——当前无消费方原地改（已核 verify/loadDetail 均替换式），但任何未来「parse 后原地改」都会中招。处置建议：清点排查 + 统一改函数工厂（一轮可完成）。
