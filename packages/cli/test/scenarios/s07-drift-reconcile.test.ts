/**
 * 场景 S7：漂移与对账（轨道 C · C1 场景壳，待 P 阶段实现后填充）。
 *
 * 前置：用户手改宿主技能目录 / 别的工具装了东西
 * 通过标准：reconcile 五态正确；外来条目 foreign 只读；我方条目可修复
 * 验证层：V1/V2
 * 填充注记：依赖 P2 2.3 对账器落地后填充；fixtures.seedForeignSkill 已备
 *
 * fixture 库：./fixtures.ts（makeScenarioRoot / seedHostSkillsDir / seedForeignSkill / seedTwoHosts）。
 * 纪律：不碰真实宿主配置；一切落临时目录；外部交互 fake/隔离。
 */
import { test } from "node:test";

test.todo("S7 漂移与对账：待对应 P 阶段实现后填充断言");
