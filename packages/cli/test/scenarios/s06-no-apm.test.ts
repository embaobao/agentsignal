/**
 * 场景 S6：降级：未装 APM（轨道 C · C1 场景壳，待 P 阶段实现后填充）。
 *
 * 前置：无 APM 的机器
 * 通过标准：native 接管不报错；装上 APM 后仍正常（不双写冲突）
 * 验证层：V2
 * 填充注记：依赖 P1 1.6 apm adapter probe（available:false）落地后填充
 *
 * fixture 库：./fixtures.ts（makeScenarioRoot / seedHostSkillsDir / seedForeignSkill / seedTwoHosts）。
 * 纪律：不碰真实宿主配置；一切落临时目录；外部交互 fake/隔离。
 */
import { test } from "node:test";

test.todo("S6 降级：未装 APM：待对应 P 阶段实现后填充断言");
