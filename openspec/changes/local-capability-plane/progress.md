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
| 2026-09-12 | 席3·基建轨（轨道C） | C3 台账一致性脚本 scripts/check-ledger.mjs——tasks↔git log(spec 尾注)↔progress 三方对账四类报告（任务号主键·sha 失效 warning）；顺手修正 LCP/host-matrix 两份台账 9 个 amend 废弃 sha；首跑暴露 host-matrix 0.1-0.4 历史无尾注勾选（真实债，留审查席）；CLI 不涉 · 语法 node 直跑过 | ✅ 待审查 | `d32e3bf`
