/**
 * 场景 S5：降级：无 L1 宿主（轨道 C · C1 场景壳，待 P 阶段实现后填充）。
 *
 * 前置：只有 MCP、无 skills 位的宿主
 * 通过标准：自动落 L2；status 显示落档 + 原因；不报错
 * 验证层：V2
 * 填充注记：依赖 P2 2.6 status 体检行落地后填充
 *
 * fixture 库：./fixtures.ts（makeScenarioRoot / seedHostSkillsDir / seedForeignSkill / seedTwoHosts）。
 * 纪律：不碰真实宿主配置；一切落临时目录；外部交互 fake/隔离。
 */
import { test } from "node:test";

test.todo("S5 降级：无 L1 宿主：待对应 P 阶段实现后填充断言");
