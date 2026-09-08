/**
 * P0.2 schema 扩展单测（dynamic-skill-management · node:test 单口径）。
 *
 * 覆盖：provenance 四新字段（base_url/topic/validation/synced_at，决议 2026-09-08 裁决 2）
 * 向后兼容 · SubscriptionSchema（topic/cursor/min_validation）· ConfigSchema.sync 安全默认
 * · 经 CLI config 加载器的写读回环（旧 config 无 sync 键零破坏）。
 * schema 断言直接引 protocol 真源 TS；回环用例经 @agentssignal/protocol（dist）全链。
 * 零外部依赖：临时目录夹具（AGENTSIGNAL_CONFIG），不碰真实 ~/.agentsignal。
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import {
  ConfigSchema,
  SkillProvenanceSchema,
  SubscriptionSchema,
  SyncStateSchema,
  validationLevels,
} from "../../protocol/src/skill-schema.ts";
import { defaultConfig, loadConfig, writeConfigAtomic } from "../src/skills/config.ts";

let root = "";
before(async () => {
  root = await mkdtemp(path.join(tmpdir(), "as-schema-sub-"));
  process.env.AGENTSIGNAL_CONFIG = root;
});
after(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

test("provenance：四新字段可解析（订阅落库溯源全录）", () => {
  const p = SkillProvenanceSchema.parse({
    sig_id: "sig_01ABC",
    digest: "语义分块 beats 固定分块 | scope: 中文RAG | validation: self-tested",
    base_url: "https://agentsignal.vip",
    topic: "ai-research",
    validation: "self-tested",
    synced_at: "2026-09-08T15:00:00.000Z",
  });
  assert.equal(p.base_url, "https://agentsignal.vip");
  assert.equal(p.topic, "ai-research");
  assert.equal(p.validation, "self-tested");
  assert.equal(p.synced_at, "2026-09-08T15:00:00.000Z");
});

test("provenance：旧形态（仅 sig_id/digest）零破坏（向后兼容）", () => {
  const p = SkillProvenanceSchema.parse({ sig_id: "sig_01ABC", digest: "d" });
  assert.equal(p.base_url, undefined);
  assert.equal(p.topic, undefined);
  assert.equal(p.validation, undefined);
  assert.equal(p.synced_at, undefined);
});

test("validation 词表与信封 v0.2 三档一致", () => {
  assert.deepEqual([...validationLevels], ["none", "self-tested", "battle-tested"]);
});

test("subscription：合法解析 · min_validation 安全默认 none · 非法枚举与缺 topic 拒绝", () => {
  const s = SubscriptionSchema.parse({ topic: "ai-research", cursor: "sig_01ABC" });
  assert.equal(s.topic, "ai-research");
  assert.equal(s.cursor, "sig_01ABC");
  assert.equal(s.min_validation, "none");
  assert.throws(() => SubscriptionSchema.parse({ topic: "t", min_validation: "verified" }));
  assert.throws(() => SubscriptionSchema.parse({ cursor: "sig_01ABC" }));
  assert.throws(() => SubscriptionSchema.parse({ topic: "" }));
});

test("sync 段：安全默认（subscriptions 空 · mirror_verify false · max_skills 200）", () => {
  const s = SyncStateSchema.parse({});
  assert.deepEqual(s.subscriptions, []);
  assert.equal(s.mirror_verify, false);
  assert.equal(s.max_skills, 200);
});

test("ConfigSchema：旧 config（无 sync 键）解析出安全默认，不破坏（裁决 5 向后兼容）", () => {
  const legacy = ConfigSchema.parse({
    version: "1.0.0",
    layers: [{ id: "base", name: "基线", auto_load: "true", max_tokens: 2048 }],
  });
  assert.deepEqual(legacy.sync.subscriptions, []);
  assert.equal(legacy.sync.mirror_verify, false);
  assert.equal(legacy.sync.max_skills, 200);
});

test("config 加载器回环：sync 段写读不丢（经 protocol dist 全链）", async () => {
  const cfg = defaultConfig();
  cfg.sync.subscriptions.push({
    topic: "ai-research",
    cursor: "sig_01ABC",
    min_validation: "self-tested",
  });
  await writeConfigAtomic(cfg);
  const loaded = await loadConfig();
  assert.ok(loaded, "config 应可加载");
  const sub = loaded.config.sync.subscriptions[0];
  assert.ok(sub, "订阅记录应在写读回环后保留");
  assert.equal(sub.topic, "ai-research");
  assert.equal(sub.cursor, "sig_01ABC");
  assert.equal(sub.min_validation, "self-tested");
  assert.equal(loaded.config.sync.mirror_verify, false);
});
