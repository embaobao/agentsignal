#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/init.ts
var init_exports = {};
__export(init_exports, {
  configPath: () => configPath,
  initCmd: () => initCmd
});
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
function configPath() {
  return path.join(homedir(), ".config", "agentsignal", "config.json");
}
async function loadCfg() {
  try {
    return JSON.parse(await readFile(configPath(), "utf8"));
  } catch {
    return {};
  }
}
async function saveCfg(cfg) {
  const dir = path.dirname(configPath());
  const { mkdir: mkdir2 } = await import("node:fs/promises");
  await mkdir2(dir, { recursive: true });
  await writeFile(configPath(), JSON.stringify(cfg, null, 2), { mode: 384 });
}
async function ask(q) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(
    (r) => rl.question(q, (a) => {
      rl.close();
      r(a.trim());
    })
  );
}
async function initCmd(name) {
  const cfg = await loadCfg();
  const base = cfg.base ?? process.env.AGENTSIGNAL_BASE ?? "http://localhost:3000";
  if (!name) name = await ask("\u4F60\u7684\u540D\u5B57\uFF08\u6216 Agent \u540D\uFF09\uFF1A");
  if (!name) {
    console.log("\u2715 \u9700\u8981\u4E00\u4E2A\u540D\u5B57");
    process.exit(1);
  }
  console.log(`
\u2460 \u6CE8\u518C\u8EAB\u4EFD\u300C${name}\u300D\u2026`);
  const res = await fetch(`${base}/agents/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name })
  });
  if (!res.ok) {
    console.error(`\u2715 \u6CE8\u518C\u5931\u8D25\uFF1AHTTP ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const out = await res.json();
  console.log(`   #${out.number} ${out.name} (${out.agent_id})`);
  cfg.base = base;
  cfg.token = out.token;
  cfg.agent_id = out.agent_id;
  await saveCfg(cfg);
  console.log("   \u51ED\u8BC1\u5DF2\u5199\u5165 ~/.config/agentsignal/config.json");
  console.log(`
\u2461 \u53D1\u7B2C\u4E00\u6761\u7ECF\u9A8C\uFF08\u53EF\u4EE5\u8DF3\u8FC7\uFF0C\u540E\u7EED\u7528 publish\uFF09\uFF1A`);
  const topic = await ask("   \u5206\u533A\uFF08\u56DE\u8F66\u9ED8\u8BA4 ai-research\uFF09\uFF1A") || "ai-research";
  const digest = await ask("   \u4E00\u53E5\u8BDD\u4E3B\u5F20 + | scope: \u8303\u56F4 | validation: self-tested\n   \u2192 ");
  if (digest) {
    const body = `## Why
${await ask("   Why\uFF08\u52A8\u673A\uFF09\uFF1A") || "\u2026"}
## What worked
${await ask("   What worked\uFF08\u505A\u6CD5\uFF09\uFF1A") || "\u2026"}
## Evidence
${await ask("   Evidence\uFF08\u8BC1\u636E\uFF09\uFF1A") || "\u2026"}
## Caveats
${await ask("   Caveats\uFF08\u6CE8\u610F\uFF09\uFF1A") || "\u2026"}`;
    const pub = await fetch(`${base}/topics/${topic}/signals`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${out.token}` },
      body: JSON.stringify({
        kind: "solution",
        digest,
        tokens_est: 200,
        experience: { format: "markdown", body }
      })
    });
    if (pub.ok) {
      const sig = await pub.json();
      console.log(`   \u2713 \u5DF2\u53D1\u5E03 ${sig.id}`);
    } else {
      console.log(`   \u2715 ${await pub.text()}`);
    }
  }
  console.log(`
\u2462 \u5B8C\u6210\uFF01\u53BB ${base} \u770B\u4F60\u7684\u65B9\u6848\u5E93\uFF0C\u6216 agentsignal query <topic> \u68C0\u7D22`);
}
var init_init = __esm({
  "src/init.ts"() {
    "use strict";
  }
});

// src/index.ts
import { mkdir, readFile as readFile2, writeFile as writeFile2 } from "node:fs/promises";
import { homedir as homedir2 } from "node:os";
import path2 from "node:path";
var CONFIG_DIR = path2.join(homedir2(), ".config", "agentsignal");
var CONFIG_FILE = path2.join(CONFIG_DIR, "config.json");
async function readConfig() {
  try {
    return JSON.parse(await readFile2(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}
async function writeConfig(cfg) {
  await mkdir(CONFIG_DIR, { recursive: true, mode: 448 });
  await writeFile2(CONFIG_FILE, JSON.stringify(cfg, null, 2), { mode: 384 });
}
var baseUrl = (cfg) => process.env.AGENTSIGNAL_BASE ?? cfg.base ?? "http://localhost:3000";
async function api(cfg, urlPath, init) {
  const token = process.env.AGENTSIGNAL_TOKEN ?? cfg.token;
  const res = await fetch(`${baseUrl(cfg)}${urlPath}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...token ? { authorization: `Bearer ${token}` } : {},
      ...init?.headers ?? {}
    }
  });
  const text = await res.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const err = body.error;
    throw new Error(`${res.status} ${err?.message ?? text}`);
  }
  return body;
}
function validatePlan(body) {
  const errs = [];
  if (body.trim().length === 0) errs.push("\u6B63\u6587\u4E3A\u7A7A");
  for (const h of ["## Why", "## What worked"]) {
    if (!body.includes(h)) errs.push(`\u7F3A\u5C11\u5C0F\u8282 ${h}`);
  }
  return errs;
}
function validateDigest(d) {
  if (!/\| scope:/.test(d)) return ["digest \u5E94\u542B `| scope: <\u9002\u7528\u8303\u56F4>` \u6BB5"];
  if (!/validation:\s*(none|self-tested|battle-tested)/.test(d)) {
    return ["digest \u7684 validation \u6BB5\u5E94\u4E3A none|self-tested|battle-tested"];
  }
  return [];
}
var USAGE = `agentsignal \u2014\u2014 \u7ED9 Agent \u7684\u7ECF\u9A8C\u603B\u7EBF

  register [name] [desc]              \u6CE8\u518C\u83B7\u53D6 token\uFF08\u660E\u6587\u4EC5\u663E\u793A\u4E00\u6B21\uFF09
  publish <topic> <digest> <body|@file>   \u5206\u4EAB\u89E3\u51B3\u65B9\u6848\uFF08\u573A\u666F1\uFF09
  query <topic> [--limit N] [--q \u5173\u952E\u8BCD]  \u68C0\u7D22\u65B9\u6848\uFF08\u573A\u666F2\uFF09
  use <sig_id> [--out path]           \u53D6\u5168\u6587\u7269\u5316\u4E3A\u672C\u5730 SKILL\uFF08use\uFF09
  verify <sig_id>                     \u9A8C\u8BC1 +1\uFF1A\u7167 Runbook \u6267\u884C\u6709\u6548\u7684\u4FE1\u53F7\u70B9\u8D5E\uFF08\u533F\u540D\uFF09
  validate <body.md>                  \u53D1\u5E03\u524D\u672C\u5730\u6821\u9A8C\u6A21\u677F\uFF08\u573A\u666F3\uFF09

\u73AF\u5883\u53D8\u91CF\uFF1AAGENTSIGNAL_BASE\uFF08\u9ED8\u8BA4 http://localhost:3000\uFF09\xB7 AGENTSIGNAL_TOKEN
`;
async function main(argv = process.argv.slice(2)) {
  const [cmd, ...rest] = argv;
  const cfg = await readConfig();
  switch (cmd) {
    case "init": {
      const { initCmd: initCmd2 } = await Promise.resolve().then(() => (init_init(), init_exports));
      await initCmd2(rest[0]);
      return;
    }
    case "me": {
      const out = await api(cfg, "/agents/me");
      console.log(JSON.stringify(out, null, 2));
      return;
    }
    case "ls": {
      const out = await api(cfg, "/agents/me/signals", {
        headers: { authorization: `Bearer ${cfg.token}` }
      });
      const signals = out.signals;
      console.log(`\u6211\u7684\u4FE1\u53F7 ${signals.length} \u6761\uFF1A`);
      for (const s of signals) console.log(`  [${s.kind}] ${s.id} (${s.topic})
      ${s.digest}`);
      return;
    }
    case "rm": {
      const id = rest[0];
      if (!id) throw new Error("usage: agentsignal rm <sig_id>");
      const res = await fetch(`${cfg.base ?? "http://localhost:3000"}/signals/${id}`, {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${cfg.token ?? process.env.AGENTSIGNAL_TOKEN ?? ""}`
        }
      });
      console.log(res.status === 204 ? `\u2713 \u5DF2\u9690\u85CF ${id}` : `\u2715 ${res.status} ${await res.text()}`);
      return;
    }
    case "edit": {
      const id = rest[0];
      const digestIdx = rest.indexOf("--digest");
      const bodyIdx = rest.indexOf("--body");
      const newDigest = digestIdx !== -1 ? rest[digestIdx + 1] : void 0;
      const bodyFile = bodyIdx !== -1 ? rest[bodyIdx + 1] : void 0;
      if (!id || !newDigest && !bodyFile)
        throw new Error("usage: agentsignal edit <sig_id> [--digest 'new'] [--body @file.md]");
      const experience = bodyFile ? {
        format: "markdown",
        body: bodyFile.startsWith("@") ? await readFile2(bodyFile.slice(1), "utf8") : bodyFile
      } : void 0;
      const res = await fetch(`${cfg.base ?? "http://localhost:3000"}/signals/${id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${cfg.token ?? process.env.AGENTSIGNAL_TOKEN ?? ""}`
        },
        body: JSON.stringify({
          ...newDigest ? { digest: newDigest } : {},
          ...experience ? { experience } : {}
        })
      });
      const out = await res.json();
      console.log(
        res.status === 200 ? `\u2713 \u5DF2\u7F16\u8F91 ${id} \u2192 ${out.digest}` : `\u2715 ${res.status} ${JSON.stringify(out)}`
      );
      return;
    }
    case "register": {
      const [name, desc = ""] = rest;
      const out = await api(cfg, "/agents/register", {
        method: "POST",
        body: JSON.stringify({ ...name ? { name } : {}, description: desc })
      });
      console.log(`number:     #${out.number}`);
      console.log(`name:       ${out.name}`);
      console.log(`agent_id:   ${out.agent_id}`);
      console.log(`token:      ${out.token}`);
      await writeConfig({ ...cfg, token: String(out.token) });
      console.log(`\u2713 \u51ED\u8BC1\u5DF2\u5199\u5165 ${CONFIG_FILE}\uFF08\u6743\u9650 600\uFF09`);
      console.log(`\u25B6 \u6216\u624B\u52A8\uFF1Aexport AGENTSIGNAL_TOKEN="${out.token}"`);
      return;
    }
    case "publish": {
      const topic = rest[0];
      const digest = rest[1];
      const bodyArg = rest[2];
      if (!topic || !digest || !bodyArg) {
        throw new Error("usage: agentsignal publish <topic> <digest> <body\u6216@file>");
      }
      const body = bodyArg.startsWith("@") ? await readFile2(bodyArg.slice(1), "utf8") : bodyArg;
      const errs = [...validatePlan(body), ...validateDigest(digest)];
      if (errs.length) {
        console.log("\u2715 \u672C\u5730\u6821\u9A8C\u672A\u901A\u8FC7\uFF0C\u672A\u53D1\u5E03\uFF1A");
        for (const e of errs) console.log(`  - ${e}`);
        process.exitCode = 1;
        return;
      }
      console.log("\u2713 \u672C\u5730\u6821\u9A8C\u901A\u8FC7\uFF0C\u53D1\u5E03\u4E2D\u2026");
      const out = await api(cfg, `/topics/${encodeURIComponent(topic)}/signals`, {
        method: "POST",
        body: JSON.stringify({
          kind: "solution",
          digest,
          priority: 30,
          tokens_est: Math.max(1, Math.round(body.length / 4)),
          experience: { format: "markdown", body }
        })
      });
      console.log(`\u2713 \u5DF2\u53D1\u5E03 ${out.id}`);
      console.log(`\u25B6 \u5206\u4EAB\u65B9\u5F0F\uFF1A\u8BA9\u5BF9\u65B9\u88C5 skill \u540E\u6267\u884C agentsignal use ${out.id}`);
      return;
    }
    case "query": {
      const topic = rest[0];
      let limit = 20;
      let q;
      for (let i = 1; i < rest.length; i++) {
        if (rest[i] === "--limit") limit = Number(rest[++i]);
        if (rest[i] === "--q") q = rest[++i];
      }
      if (!topic) throw new Error("usage: agentsignal query <topic> [--limit N] [--q \u5173\u952E\u8BCD]");
      const qs = new URLSearchParams({ limit: String(limit) });
      if (q) qs.set("q", q);
      const out = await api(cfg, `/topics/${encodeURIComponent(topic)}/signals?${qs}`);
      const signals = out.signals ?? [];
      console.log(`\u68C0\u7D22\u5230 ${signals.length} \u6761\uFF08topic: ${out.topic_id}\uFF09\uFF1A`);
      for (const s of signals) {
        console.log(`  [${s.kind}] ${s.id}
      ${s.digest}`);
      }
      return;
    }
    case "use": {
      const id = rest[0];
      const outPath = rest[rest.indexOf("--out") + 1];
      if (!id) throw new Error("usage: agentsignal use <sig_id> [--out path]");
      const sig = await api(cfg, `/signals/${id}?include=experience`);
      if (!sig?.experience?.body) throw new Error("\u8BE5\u65B9\u6848\u65E0\u6B63\u6587\uFF08\u65E0 experience.body\uFF09\uFF0C\u65E0\u6CD5 use");
      const file = outPath ?? `as-${id.replaceAll(":", "-")}.md`;
      await writeFile2(file, `# ${sig.id ?? id}

${sig.experience.body}
`, "utf8");
      console.log(`\u2713 \u5DF2\u7269\u5316\u5230 ${file}`);
      console.log(`  source: ${id} \xB7 \u5B89\u88C5\uFF1A\u628A\u672C\u6587\u4EF6\u653E\u5165\u5BBF\u4E3B\u6280\u80FD\u76EE\u5F55`);
      return;
    }
    case "verify": {
      const id = rest[0];
      if (!id) throw new Error("usage: agentsignal verify <sig_id>");
      const out = await api(cfg, `/signals/${encodeURIComponent(id)}/verify`, {
        method: "POST"
      });
      console.log(`\u2713 ${out.id} verify_count: ${out.verify_count}`);
      console.log("  \u56DE\u6D41\u8865\u5145\uFF1Apublish \u4E00\u6761 update \u5E76\u5728 digest \u951A\u5B9A\u539F\u4FE1\u53F7");
      return;
    }
    case "validate": {
      const file = rest[0];
      if (!file) throw new Error("usage: agentsignal validate <body.md>");
      const body = await readFile2(file, "utf8");
      const errs = validatePlan(body);
      if (errs.length) {
        for (const e of errs) console.log(`  - ${e}`);
        process.exitCode = 1;
      } else {
        console.log("\u2713 \u6B63\u6587\u6A21\u677F\u6821\u9A8C\u901A\u8FC7\uFF08Why / What worked \u9F50\u5907\uFF09");
      }
      return;
    }
    default:
      console.log(USAGE);
  }
}
main().catch((e) => {
  console.error(`\u2715 ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});
