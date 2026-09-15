/**
 * P1 1.6 APM 适配器单测（local-capability-plane · node:test 单口径）。
 *
 * DoD：spawn 沙箱测试（PATH 注入 fake apm 可执行）；APM 缺席 probe 返回
 * {available:false}（S6 前半——缺席是降级信号不是错误）；capabilities() 不声明
 * remove（APM 实测无此命令——规则一门控守卫，盲调必抛）。
 * 沙箱 = 临时目录自建 fake apm 脚本注入 PATH，不依赖真实 APM 安装。
 */
import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { apmAdapter } from "../src/capability/adapters/apm.ts";
import { UnsupportedCapability } from "../src/capability/types.ts";

let sandbox = "";
const origPath = process.env.PATH ?? "";

before(async () => {
  sandbox = await mkdtemp(path.join(tmpdir(), "as-apm-"));
  await mkdir(path.join(sandbox, "bin"), { recursive: true });
  const fake = path.join(sandbox, "bin", "apm");
  await writeFile(fake, "#!/bin/sh\necho 'apm version 1.0.0'\n", "utf8");
  await chmod(fake, 0o755);
});

after(async () => {
  process.env.PATH = origPath;
  if (sandbox) await rm(sandbox, { recursive: true, force: true });
});

test("S6 前半：APM 缺席 → probe 返回 {available:false, reason}（不抛错）", async () => {
  process.env.PATH = path.join(sandbox, "empty-bin"); // 空目录：无 apm
  const { available, reason } = await apmAdapter.probe();
  assert.equal(available, false);
  assert.ok(typeof reason === "string" && reason.length > 0, "缺席必带 reason（D10 降级可见）");
});

test("spawn 沙箱：PATH 注入 fake apm → probe 可用且取到版本", async () => {
  process.env.PATH = path.join(sandbox, "bin");
  const probe = await apmAdapter.probe();
  assert.equal(probe.available, true);
  assert.ok(probe.version?.includes("1.0.0"), `应取到 fake 版本：${probe.version}`);
});

test("capabilities：不声明 remove（APM 实测无此命令）", () => {
  const caps = apmAdapter.capabilities();
  assert.ok(!caps.has("remove"), "规则一：remove 未声明");
  assert.ok(caps.has("deploy"), "deploy 已声明");
});

test("规则一守卫：未声明 remove 时 remove() 调用必抛 UnsupportedCapability", async () => {
  await assert.rejects(
    () => apmAdapter.remove([], "claude-code"),
    (err: unknown) =>
      err instanceof UnsupportedCapability && (err as UnsupportedCapability).adapter === "apm",
  );
});
