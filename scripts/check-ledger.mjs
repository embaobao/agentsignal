#!/usr/bin/env node
/**
 * 台账一致性对账（local-capability-plane 轨道 C · C3）。
 *
 * 三方对账：openspec/changes/<name>/tasks.md（勾选）↔ git log（spec 尾注）↔ progress.md（台账 sha）。
 * 提交关联约定：提交信息尾 `(spec: <change> <任务号[,任务号…]>)`（Conventional Commits 本仓风格）。
 *
 * 四类违规（DoD）：
 *   1 勾了没提交   —— tasks.md 已勾任务号在 git log（该 change 路径）找不到 spec 尾注
 *   2 提交没勾     —— git log 有该 change 任务号提交但 tasks.md 未勾该项
 *   3 无台账条目   —— 该 change 的 spec 尾注任务号未出现在 progress.md（按任务号对账；
 *                     sha 自指悖论：台账内 sha 由 amend 产生会自失效，任务号才是对账主键）
 *   4 台账 sha 失效（warning，不计违规）—— progress.md 引用的 sha 不在 git log
 *                     （amend 前的废弃 sha；汇总席可顺手修正为最终 sha）
 *
 * 用法：node scripts/check-ledger.mjs [change名...]（缺省 = 全部在册 change，排除 archive）
 * 退出码：0 = 干净；1 = 有违规（报告列明；warning 不影响退出码）。
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CHANGES_DIR = path.join(ROOT, "openspec", "changes");

function git(args) {
  return execFileSync("git", ["-C", ROOT, ...args], { encoding: "utf8" }).trim();
}

/** 解析 tasks.md：{ done: Set<任务号>, undone: Set<任务号> }（任务号 = 行首 `- [x] **N.N**` 或 `- [x] N.N`） */
function parseTasks(file) {
  const done = new Set();
  const undone = new Set();
  if (!existsSync(file)) return { done, undone };
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^-\s\[(.)\]\s\*{0,2}([A-Z]?\d[\d.]*)/.exec(line.trim());
    if (m) (m[1] === "x" ? done : undone).add(m[2]);
  }
  return { done, undone };
}

/** git log 该 change 路径：[{ sha, subject, specIds: Set<任务号> }] */
function commitsFor(change) {
  const out = git([
    "log",
    "--format=%H%x09%s",
    "--",
    path.join("openspec", "changes", change),
  ]);
  if (!out) return [];
  return out.split("\n").map((line) => {
    const [sha, subject] = line.split("\t");
    const specIds = new Set();
    const spec = /\(spec:\s*([^)]+)\)/.exec(subject ?? "");
    if (spec && spec[1].startsWith(change)) {
      for (const tok of spec[1].split(/[\s,]+/).slice(1)) {
        const id = tok.replace(/[:,;]+$/, "");
        if (/^[A-Z]?\d[\d.]*$/.test(id)) specIds.add(id);
      }
    }
    return { sha: sha.slice(0, 10), subject: subject ?? "", specIds };
  });
}

/** progress.md 中记录的 sha 集合（表格行 `| … | `sha` |` 或任意 10 位内 hex 词） */
function ledgerShas(file) {
  const shas = new Set();
  if (!existsSync(file)) return shas;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    for (const m of line.matchAll(/\b([0-9a-f]{7,10})\b/g)) shas.add(m[1]);
  }
  return shas;
}

const allShaList = new Set(git(["log", "--format=%h"]).split("\n"));

function short(sha) {
  return sha.slice(0, 10);
}

const requested = process.argv.slice(2);
const changes = requested.length
  ? requested
  : readdirSync(CHANGES_DIR).filter(
      (d) => !d.startsWith(".") && d !== "archive" && existsSync(path.join(CHANGES_DIR, d, "tasks.md")),
    );

let violations = 0;
let warnings = 0;
for (const change of changes) {
  const dir = path.join(CHANGES_DIR, change);
  const { done, undone } = parseTasks(path.join(dir, "tasks.md"));
  const commits = commitsFor(change);
  const committed = new Set(commits.flatMap((c) => [...c.specIds]));
  const shas = ledgerShas(path.join(dir, "progress.md"));
  const problems = [];
  const changeWarnings = [];

  // 1 勾了没提交
  for (const id of done) {
    if (!committed.has(id)) problems.push(`  [1 勾了没提交] ${id} 已勾但无 spec 尾注提交`);
  }
  // 2 提交没勾
  for (const id of committed) {
    if (undone.has(id)) problems.push(`  [2 提交没勾] ${id} 有提交但 tasks.md 未勾`);
  }
  // 3 无台账条目（spec 尾注任务号应出现在 progress.md 文本——任务号是对账主键）
  const progressText = existsSync(path.join(dir, "progress.md"))
    ? readFileSync(path.join(dir, "progress.md"), "utf8")
    : "";
  for (const c of commits) {
    for (const id of c.specIds) {
      if (!progressText.includes(id)) {
        problems.push(`  [3 无台账条目] 提交 ${c.sha}（${id}）未记入 progress.md`);
      }
    }
  }
  // 4 台账 sha 失效（warning，不计违规——amend 前的废弃 sha）
  for (const sha of shas) {
    if (!allShaList.has(sha) && !allShaList.has(short(sha))) {
      warnings.push(`  [4 台账 sha 失效] ${sha} 不在 git log（可修正为 amend 后最终 sha）`);
    }
  }

  const head = `${change}：${done.size} 勾 / ${commits.length} 提交 / ${shas.size} 台账 sha`;
  if (problems.length || changeWarnings.length) {
    violations += problems.length;
    warnings += changeWarnings.length;
    console.log(`${problems.length ? "✗" : "⚠"} ${head}`);
    for (const p of problems) console.log(p);
    for (const w of changeWarnings) console.log(w);
  } else {
    console.log(`✓ ${head}`);
  }
}

const tail = [];
if (violations) tail.push(`${violations} 项不一致`);
if (warnings) tail.push(`${warnings} 条 sha 失效警告`);
console.log(tail.length ? `\n${tail.join(" · ")}` : "\n台账一致");
process.exit(violations ? 1 : 0);
