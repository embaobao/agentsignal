/**
 * host-matrix-alignment 1.3 单测：SOUL.md 块注入（node:test 单口径）。
 *
 * 标记段 `<!-- agentsignal:rules:start/end -->`：文件不存在则创建，存在则追加；
 * 重复注入不产生第二块（幂等）；摘除只删标记段，用户原有内容完好。
 * 夹具 = 临时目录，不碰真实宿主配置。
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import {
  injectSoulBlock,
  removeSoulBlock,
  SOUL_MARK_END,
  SOUL_MARK_START,
} from "../src/skills/wiring/soul.ts";

let root = "";
before(async () => {
  root = await mkdtemp(path.join(tmpdir(), "as-soul-"));
});
after(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

function soulPath(name: string): string {
  return path.join(root, name);
}

test("标记常量：start/end 成对（含 agentsignal:rules 命名空间）", () => {
  assert.equal(SOUL_MARK_START, "<!-- agentsignal:rules:start -->");
  assert.equal(SOUL_MARK_END, "<!-- agentsignal:rules:end -->");
});

test("文件不存在则创建：含标记段与规则行", async () => {
  const p = soulPath("new-SOUL.md");
  await injectSoulBlock(p, "- 规则一行\n");
  const text = await readFile(p, "utf8");
  assert.ok(text.includes(SOUL_MARK_START) && text.includes(SOUL_MARK_END));
  assert.ok(text.includes("- 规则一行"));
});

test("存在用户内容则追加：用户原有内容完好（前缀逐字保留）", async () => {
  const p = soulPath("user-SOUL.md");
  const user = "# 我的 SOUL\n\n身份与偏好……\n";
  await writeFile(p, user, "utf8");
  await injectSoulBlock(p, "- 规则一行\n");
  const text = await readFile(p, "utf8");
  assert.ok(text.startsWith(user), "用户内容必须逐字在前");
  const idx = text.indexOf(SOUL_MARK_START);
  assert.ok(idx > user.length - 1, "块追加在用户内容之后");
});

test("重复注入不产生第二块（幂等）", async () => {
  const p = soulPath("idem-SOUL.md");
  await injectSoulBlock(p, "- 规则一行\n");
  await injectSoulBlock(p, "- 规则一行\n");
  await injectSoulBlock(p, "- 另一行尝试\n");
  const text = await readFile(p, "utf8");
  assert.equal(text.split(SOUL_MARK_START).length - 1, 1, "start 标记只能有一处");
});

test("摘除只删标记段：用户原有内容完好", async () => {
  const p = soulPath("remove-SOUL.md");
  const user = "# 我的 SOUL\n\n身份与偏好……\n";
  await writeFile(p, user, "utf8");
  await injectSoulBlock(p, "- 规则一行\n");
  await removeSoulBlock(p);
  const text = await readFile(p, "utf8");
  assert.ok(!text.includes(SOUL_MARK_START) && !text.includes(SOUL_MARK_END), "标记段整体消失");
  assert.ok(!text.includes("- 规则一行"), "块内规则行一并消失");
  assert.ok(text.includes("# 我的 SOUL"), "用户标题保留");
  assert.ok(text.includes("身份与偏好……"), "用户正文保留");
});

test("摘除不存在的文件不抛；无块文件摘除为无操作", async () => {
  await removeSoulBlock(soulPath("absent-SOUL.md"));
  const p = soulPath("noblock-SOUL.md");
  await writeFile(p, "纯用户内容\n", "utf8");
  await removeSoulBlock(p);
  assert.equal(await readFile(p, "utf8"), "纯用户内容\n");
});
