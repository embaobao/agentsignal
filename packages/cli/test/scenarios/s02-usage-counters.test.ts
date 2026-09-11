/**
 * 场景 S2：使用留痕：检索/注入/使用三计数分立（轨道 C · C1 场景壳，待 P 阶段实现后填充）。
 *
 * 前置：S1 完成
 * 通过标准：被检索 / 被注入 / 被使用分别计数（现状 use_count 只在 verify 时 +1——P5 5.3 修）
 * 验证层：V1/V2
 * 填充注记：阻塞于 P5 5.3（三计数分立）落地后填充
 *
 * fixture 库：./fixtures.ts（makeScenarioRoot / seedHostSkillsDir / seedForeignSkill / seedTwoHosts）。
 * 纪律：不碰真实宿主配置；一切落临时目录；外部交互 fake/隔离。
 */
import { test } from "node:test";

test.todo("S2 使用留痕：检索/注入/使用三计数分立：待对应 P 阶段实现后填充断言");
