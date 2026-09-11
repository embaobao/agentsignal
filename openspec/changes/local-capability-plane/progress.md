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
| 2026-09-12 | 席1·主轨开发（轨道A） | 0.1 AGENTS.md 定位更新（D1/D2 三节：定位扩展行+当前阶段刷 P0+剩余列当前主线）· docs/README.md 进度行/定位行同步（0.3.0→0.5.0 · 主线刷 local-capability-plane P0） | ✅ 待审查 | `ba25b0b`
| 2026-09-12 | 席1·主轨开发（轨道A） | 0.2 产物 frontmatter——protocol 新增 ArtifactFrontmatterSchema（name/description 必填）+ parseArtifactFrontmatter（目录名一致性）+ 类型导出；私有层字段零泄漏断言；CLI 5 新用例（红→绿，104/104）· protocol build · check/lint 绿 | ✅ 待审查 | `84f887e`
| 2026-09-12 | 席1·主轨开发（轨道A） | 0.3 落库生成/校验——transcoder 新增 renderArtifactSkillMd（首部产物 frontmatter+正文逐字·JSON 值序列化 YAML 安全·写前过 parseArtifactFrontmatter）+ stripArtifactFrontmatter（注入侧剥离·旧技能/水平线正文零破坏）；install.ts 落库接产物首部；loader.ts loadDetail 剥离注入（Token Firewall）；3 处既有文件级断言升级新语义；CLI 111/111 · lint/check 绿 | ✅ 待审查 | `484533e`
