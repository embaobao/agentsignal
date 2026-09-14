/**
 * 性能评估基线（local-capability-plane 轨道 C · C4）。
 *
 * 三条关键路径：1 检索（Orama 建库 + 100 次 mandarin 查询）· 2 装配（scan+loadDetail 渲染）
 * · 3 对账（reconcile 适配器 P2 落地后启用——占位）。
 * 临时目录夹具；数字仅参考，不入 CI 门禁（DoD）。
 * 运行：node --experimental-strip-types test/scenarios/bench.ts [技能条数=50]
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { loadDetail } from "../../src/skills/loader.ts";
import { resolvePaths } from "../../src/skills/paths.ts";
import { buildIndex, ensureIndex, saveIndex, scanSkills } from "../../src/skills/store.ts";

const COUNT = Number(process.argv[2] ?? 50);
const root = await mkdtemp(path.join(tmpdir(), "as-bench-"));
process.env.AGENTSIGNAL_CONFIG = root;

for (let i = 0; i < COUNT; i++) {
  const dir = path.join(root, "skills", `skill_bench_${String(i).padStart(4, "0")}`);
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "skill.json5"),
    JSON.stringify({
      id: `skill_bench_${String(i).padStart(4, "0")}`,
      name: `基准技能 ${i} 号`,
      description: `第 ${i} 条中文经验：数据库连接池的容量估算与慢查询排查定位思路`,
      domains: ["common"],
      layers: ["base"],
      triggers: [{ field: "keyword", operator: "contains_any", values: [`基准${i}`, "数据库"] }],
      verify_target: null,
    }),
    "utf8",
  );
  await writeFile(path.join(dir, "SKILL.md"), `## 步骤\n\n${"排查内容行\n".repeat(20)}`, "utf8");
}

const paths = resolvePaths(root);

// ── 1 检索 ──
const t0 = performance.now();
const { skills } = await scanSkills(paths);
const idx0 = performance.now();
const { db } = await ensureIndex(skills);
const t1 = performance.now();
const timings: number[] = [];
for (let q = 0; q < 100; q++) {
  const { oramaSearch } = await import("../../src/skills/store.ts");
  const s = performance.now();
  await oramaSearch(db, q % 2 === 0 ? "数据库 连接池" : `基准技能 ${q}`);
  timings.push(performance.now() - s);
}
timings.sort((a, b) => a - b);
const mean = timings.reduce((a, b) => a + b, 0) / timings.length;
const median = timings[Math.floor(timings.length / 2)] ?? 0;

// ── 2 装配 ──
const s2 = performance.now();
await loadDetail("skill_bench_0007", paths);
const assemble = performance.now() - s2;

console.log(`# bench · ${COUNT} 技能 · node ${process.version}`);
console.log(`scan（${COUNT} 目录扫描+schema 校验）: ${(idx0 - t0).toFixed(1)} ms`);
console.log(`索引建库+持久化: ${(t1 - idx0).toFixed(1)} ms`);
console.log(
  `检索 100 次均值: ${mean.toFixed(2)} ms · 中位 ${median.toFixed(2)} ms · P95 ${timings[Math.floor(timings.length * 0.95)]?.toFixed(2)} ms`,
);
console.log(`装配（loadDetail 单次，含首部剥离+mustache）: ${assemble.toFixed(1)} ms`);
console.log(`对账路径: 占位（reconcile 适配器 P2 2.3 落地后启用）`);

await rm(root, { recursive: true, force: true });
