/**
 * 场景 S14：依赖管理（轨道 C · C1 场景壳，待 P 阶段实现后填充）。
 *
 * 前置：skill.json5 dependencies
 * 通过标准：预检告警 · 显式安装 · 白名单外拦截 · origin=npm-install
 * 验证层：V1/V2
 * 填充注记：预检已有 loadDetail 覆盖；白名单安装待 P8 8.2 落地后填充
 *
 * fixture 库：./fixtures.ts（makeScenarioRoot / seedHostSkillsDir / seedForeignSkill / seedTwoHosts）。
 * 纪律：不碰真实宿主配置；一切落临时目录；外部交互 fake/隔离。
 */
import { test } from "node:test";

test.todo("S14 依赖管理：待对应 P 阶段实现后填充断言");
