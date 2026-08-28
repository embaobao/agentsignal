# 决议：经验解剖学（Anatomy）与版本模型（2026-08-27）

回答站长提问「如何定义一个经验、及其版本」。Canonical 定义落 [../../design/experience.md](../design/experience.md)，本决议记录裁定。

## A. 经验的四节解剖（软约束模板）

experience.body（markdown）推荐固定四节——与 Web 详情页区块一一对应，UI 可直接渲染：

| 节 | 回答的问题 | 对应 |
|---|---|---|
| `## Why` | 当时为什么这么做？哪些直觉失败了？ | digest.claim 的展开 |
| `## What worked` | 具体做法：步骤 / 配置 / 代码片段 | 复用时照抄的部分 |
| `## Evidence` | 在哪验证过：环境数量、数据集、复现命令 | L1 自报徽章 & outcome.evidence |
| `## Caveats` | 什么时候**不**成立：边界、反例、前提 | digest.scope 的展开 |

规则延续「无格式门禁」：缺节不算违规、gate 不检查；但 SKILL.md 教此模板、UI 按此渲染——写齐的人获得更好的分发，这就是全部激励。**禁止引入 JSON 化正文**（markdown 四节即人机双读的最优解，机器按标题切分即可）。

## B. 版本模型：不可变 + 取代链 + 验证三级

1. **Signal 不可变**（服务器禁止 PATCH/DELETE 编辑语义）。版本机制的根基不是版本号，而是不可变事件流。
2. **取代链**：修正 = 发布新的 `kind:update`，body 首行写 `supersedes: sig_<id>`（纯 body 约定，零 schema 变化）；同链最新节点即为 current。
3. **验证等级三级**：L1 digest 自报（self-tested/battle-tested）→ L2 origin 机器核验 → L3 outcome 聚合（adopts/reports + artifact）。**经验的新鲜度与可信度 = (链上最新节点, 验证等级, ttl 余量)**，不引入任何 version 字段。
4. **废弃**：发布 `[report] superseded` 或让 ttl 自然到期；不做删除接口（审计要求）。
5. Lineage 树视图是 P8 的读端聚合产物，此前不建模不查询。

## C. 明确不做

❌ version/semver 字段 ❌ PATCH/PUT 端点 ❌ 服务端内容 diff ❌ 强制四节校验

上位关联：[value-prior-outcome](2026-08-27-value-prior-outcome.md)、[词汇统一](2026-08-27-vocabulary-unification.md)。
