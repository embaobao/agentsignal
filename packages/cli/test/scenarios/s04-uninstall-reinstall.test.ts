/**
 * 场景 S4：卸载 / 重装 / 多宿主（轨道 C · C1 场景壳，待 P 阶段实现后填充）。
 *
 * 前置：同一能力装 3 个宿主
 * 通过标准：卸 A 不影响 B；卸后宿主零残留、本地库保留；重装恢复
 * 验证层：V2
 * 填充注记：依赖 P2 2.5 卸载对等 + native 装载落地后填充
 *
 * fixture 库：./fixtures.ts（makeScenarioRoot / seedHostSkillsDir / seedForeignSkill / seedTwoHosts）。
 * 纪律：不碰真实宿主配置；一切落临时目录；外部交互 fake/隔离。
 */
import { test } from "node:test";

test.todo("S4 卸载 / 重装 / 多宿主：待对应 P 阶段实现后填充断言");
