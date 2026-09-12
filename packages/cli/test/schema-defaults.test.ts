/**
 * zod default 引用隔离回归测试（P5 5.3 连带缺口 · 轨道 C 补位）。
 *
 * 背景：`.default(对象字面量)` 返回跨 parse 共享的可变引用——无该键的技能 parse
 * 结果原地改（push/+=/加键）即全局污染后续所有 parse（5.3 红测当场暴露生产级实例）。
 * 本套件锁死：全 schema 的对象/数组 default 必须引用隔离（两次 parse 拿到独立实例）。
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { ConfigSchema, SkillFrontmatterSchema } from "../../protocol/src/skill-schema.ts";

test("dependencies default 引用隔离：改第一个的 env 不影响第二个", () => {
  const a = SkillFrontmatterSchema.parse({
    id: "skill_a",
    name: "a",
    description: "a",
    domains: ["common"],
    layers: ["base"],
    triggers: [],
  });
  const b = SkillFrontmatterSchema.parse({
    id: "skill_b",
    name: "b",
    description: "b",
    domains: ["common"],
    layers: ["base"],
    triggers: [],
  });
  a.dependencies.env.push("MY_VAR");
  assert.deepEqual(b.dependencies.env, [], "共享 default 引用即污染——必须隔离");
});

test("metrics default 引用隔离：retrieved 原地加不串库（5.3 回归）", () => {
  const mk = (id: string) =>
    SkillFrontmatterSchema.parse({
      id,
      name: id,
      description: id,
      domains: ["common"],
      layers: ["base"],
      triggers: [],
    });
  const a = mk("skill_a");
  const b = mk("skill_b");
  a.lifecycle.metrics.retrieved += 1;
  assert.equal(b.lifecycle.metrics.retrieved, 0, "metrics default 必须工厂隔离");
});

test("config domains/sync default 引用隔离", () => {
  const mkConfig = () =>
    ConfigSchema.parse({
      layers: [{ id: "base", name: "基础", auto_load: "true", max_tokens: 100 }],
    });
  const c1 = mkConfig();
  const c2 = mkConfig();
  c1.domains.available.push("extra");
  c1.sync.subscriptions.push({ topic: "t", min_validation: "none" });
  assert.deepEqual(c2.domains.available, ["common"]);
  assert.deepEqual(c2.sync.subscriptions, []);
});
