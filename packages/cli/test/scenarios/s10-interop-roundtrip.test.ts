/**
 * 场景 S10：互操作往返（轨道 C · C1 场景壳，待 P 阶段实现后填充）。
 *
 * 前置：导出 apm.yml → 再导入
 * 通过标准：标准部分往返无损；私有元数据零泄漏进产物
 * 验证层：V1
 * 填充注记：依赖 P4 4.1-4.3 导出/导入器落地后填充；产物零泄漏语义已由 artifact-frontmatter.test.ts 先行覆盖
 *
 * fixture 库：./fixtures.ts（makeScenarioRoot / seedHostSkillsDir / seedForeignSkill / seedTwoHosts）。
 * 纪律：不碰真实宿主配置；一切落临时目录；外部交互 fake/隔离。
 */
import { test } from "node:test";

test.todo("S10 互操作往返：待对应 P 阶段实现后填充断言");
