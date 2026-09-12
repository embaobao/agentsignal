/**
 * host-matrix-alignment 1.2 单测：Hermes 宿主 skills 落盘（node:test 单口径）。
 *
 * 目录式落盘：$hermesHome/skills/<name>/SKILL.md——产物格式复用 renderArtifactSkillMd
 * （首部 name=目录名 + 正文，零工具可读），内部形式 skill.json5 不出库（零泄漏）。
 * id 白名单防路径穿越；卸载只删自己条目、零残留。夹具 = 临时 HERMES_HOME。
 */
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { removeHostSkill, writeHostSkill } from "../src/skills/wiring/hostSkills.ts";

let home = "";
before(async () => {
  home = await mkdtemp(path.join(tmpdir(), "as-hostskill-"));
});
after(async () => {
  if (home) await rm(home, { recursive: true, force: true });
});

const SKILLS = () => path.join(home, "skills");

test("目录式落盘：skills/<id>/SKILL.md 产物首部合规（name=目录名）且不含 skill.json5", async () => {
  const dir = await writeHostSkill(SKILLS(), "skill_auth_jwt", "JWT 鉴权方案", "## 正文\n步骤……\n");
  assert.equal(path.basename(dir), "skill_auth_jwt");
  const md = await readFile(path.join(dir, "SKILL.md"), "utf8");
  assert.ok(md.startsWith(`---\nname: "skill_auth_jwt"\ndescription: "JWT 鉴权方案"\n---\n\n`));
  assert.ok(md.endsWith("## 正文\n步骤……\n"));
  const entries = await readdir(dir);
  assert.deepEqual(entries, ["SKILL.md"], "目录式：宿主侧只有 SKILL.md，无内部形式");
});

test("重复落盘幂等覆盖（同 id 重写不报错，内容以最新为准）", async () => {
  await writeHostSkill(SKILLS(), "skill_x", "v1 描述", "v1 正文");
  const dir = await writeHostSkill(SKILLS(), "skill_x", "v2 描述", "v2 正文");
  const md = await readFile(path.join(dir, "SKILL.md"), "utf8");
  assert.ok(md.includes("v2 描述") && md.includes("v2 正文"));
});

test("id 白名单：大写/斜杠/点开头的目录名拒绝（防路径穿越）", async () => {
  for (const bad of ["Skill_X", "../escape", "a/b", ".hidden", ""]) {
    await assert.rejects(
      () => writeHostSkill(SKILLS(), bad, "d", "b"),
      (err: unknown) => err instanceof Error && err.message.includes("小写 slug"),
      `非法 id 应被拒：${bad}`,
    );
  }
  // 未产生任何越界目录
  const entries = await readdir(SKILLS());
  assert.deepEqual(entries.sort(), ["skill_auth_jwt", "skill_x"], "拒绝路径未产生目录");
});

test("卸载对等：只删自己条目目录、零残留；他人条目与 skills 根保留", async () => {
  await writeHostSkill(SKILLS(), "skill_remove_me", "删我", "正文");
  const removed = await removeHostSkill(SKILLS(), "skill_remove_me");
  assert.equal(removed, true);
  await assert.rejects(() => stat(path.join(SKILLS(), "skill_remove_me")));
  const entries = await readdir(SKILLS());
  assert.deepEqual(entries.sort(), ["skill_auth_jwt", "skill_x"], "他人条目保留");
  const again = await removeHostSkill(SKILLS(), "skill_remove_me");
  assert.equal(again, false, "重复卸载返回 false");
});

test("卸载非法 id 拒绝（fail-fast 抛错，不静默）", async () => {
  await assert.rejects(
    () => removeHostSkill(SKILLS(), "../escape"),
    (err: unknown) => err instanceof Error && err.message.includes("小写 slug"),
  );
});
