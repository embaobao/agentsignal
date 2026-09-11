/**
 * 场景 S11：模型接入（轨道 C · C1 场景壳，待 P 阶段实现后填充）。
 *
 * 前置：宿主 + 供应商注册表
 * 通过标准：env 写入 → 国产端点跑通 → 切换供应商 → 快照回滚恢复；token 不进产物/导出
 * 验证层：V2
 * 填充注记：依赖 P7 7.3 env 写入器落地后填充；V2 真机段列站长项（G-E）
 *
 * fixture 库：./fixtures.ts（makeScenarioRoot / seedHostSkillsDir / seedForeignSkill / seedTwoHosts）。
 * 纪律：不碰真实宿主配置；一切落临时目录；外部交互 fake/隔离。
 */
import { test } from "node:test";

test.todo("S11 模型接入：待对应 P 阶段实现后填充断言");
