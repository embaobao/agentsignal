/**
 * 场景 S1：黄金路径：全新机器首次接入（轨道 C · C1 场景壳，待 P 阶段实现后填充）。
 *
 * 前置：未装过 AgentSignal；一个 L1 宿主；平台有一条 solution
 * 通过标准：订阅→同步→装载→Agent 使用，全程无人工复制；sessions 留痕
 * 验证层：V2/V3
 * 填充注记：依赖订阅同步链（sync.ts）+ 装载；平台半需真服务（V2/V3 联调夜填充）
 *
 * fixture 库：./fixtures.ts（makeScenarioRoot / seedHostSkillsDir / seedForeignSkill / seedTwoHosts）。
 * 纪律：不碰真实宿主配置；一切落临时目录；外部交互 fake/隔离。
 */
import { test } from "node:test";

test.todo("S1 黄金路径：全新机器首次接入：待对应 P 阶段实现后填充断言");
