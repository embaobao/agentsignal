#!/usr/bin/env node
/** 薄入口：node --experimental-strip-types 解析 TS 实现（模块解析基于文件位置，须在 cli 包内）。 */
import { spawnSync } from "node:child_process";
import path from "node:path";

const impl = path.resolve(import.meta.dirname, "../../packages/cli/test/scenarios/bench.ts");
const r = spawnSync(process.execPath, ["--experimental-strip-types", impl, ...process.argv.slice(2)], {
  stdio: "inherit",
});
process.exit(r.status ?? 1);
