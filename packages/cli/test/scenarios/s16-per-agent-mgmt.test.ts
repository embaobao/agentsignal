/**
 * 场景 S16：分 Agent 管理（轨道 C · C1 场景壳，待 P 阶段实现后填充）。
 *
 * 前置：两宿主各配不同技能集
 * 通过标准：独立准入 / 计数 / 卸载互不影响
 * 验证层：V1/V2
 * 填充注记：依赖 P8 8.5 per-host 准入落地后填充；fixtures.seedTwoHosts 已备
 *
 * fixture 库：./fixtures.ts（makeScenarioRoot / seedHostSkillsDir / seedForeignSkill / seedTwoHosts）。
 * 纪律：不碰真实宿主配置；一切落临时目录；外部交互 fake/隔离。
 */
import { test } from "node:test";

test.todo("S16 分 Agent 管理：待对应 P 阶段实现后填充断言");
