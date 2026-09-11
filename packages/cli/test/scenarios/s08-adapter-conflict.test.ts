/**
 * 场景 S8：适配器冲突（轨道 C · C1 场景壳，待 P 阶段实现后填充）。
 *
 * 前置：两个适配器争同一宿主同一能力
 * 通过标准：归属锁拒绝 + 结构化错（含持锁方与建议）
 * 验证层：V0
 * 填充注记：依赖 P1 1.3/1.4 ledger+lock 落地后填充；届时在 fixtures.ts 补 fakeAdapter 构造器
 *
 * fixture 库：./fixtures.ts（makeScenarioRoot / seedHostSkillsDir / seedForeignSkill / seedTwoHosts）。
 * 纪律：不碰真实宿主配置；一切落临时目录；外部交互 fake/隔离。
 */
import { test } from "node:test";

test.todo("S8 适配器冲突：待对应 P 阶段实现后填充断言");
