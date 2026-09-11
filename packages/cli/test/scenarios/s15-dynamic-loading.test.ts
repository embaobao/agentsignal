/**
 * 场景 S15：动态加载（轨道 C · C1 场景壳，待 P 阶段实现后填充）。
 *
 * 前置：pi（热切）/ 其他宿主
 * 通过标准：支持者热切换；不支持者降级（重载/提示）且可见
 * 验证层：V2
 * 填充注记：依赖 P8 8.4 落地后填充；pi 热切待 G-C 门
 *
 * fixture 库：./fixtures.ts（makeScenarioRoot / seedHostSkillsDir / seedForeignSkill / seedTwoHosts）。
 * 纪律：不碰真实宿主配置；一切落临时目录；外部交互 fake/隔离。
 */
import { test } from "node:test";

test.todo("S15 动态加载：待对应 P 阶段实现后填充断言");
