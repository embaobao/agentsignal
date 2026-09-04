#!/usr/bin/env node
/**
 * 构建管线（设计规范 §8 验收：产物 = 单文件 HTML，零外部请求）。
 *
 *   ① logo-mark.png → sips 缩 96px → base64 → src/generated/logo.ts
 *   ② esbuild bundle main.tsx（含 @xyflow/react 样式导出为 dist/index.css）
 *   ③ @tailwindcss/cli 编译 app.css（tokens 内联）
 *   ④ 组装 dist/index.html（style/script 全内联）→ 产物注入 packages/cli/src/skills/wizard/html.ts
 */
import { execFileSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const src = path.join(here, "src");
const dist = path.join(here, "dist");
const logoSource = path.join(root, "apps/ui/public/logo-mark.png");
const cliWizard = path.join(root, "packages/cli/src/skills/wizard");
const CLI_TARGET = path.join(cliWizard, "html.ts");

/** ① logo → 96px base64 → generated/logo.ts */
async function buildLogo() {
  const gen = path.join(src, "generated");
  await mkdir(gen, { recursive: true });
  let buf = await readFile(logoSource);
  const tmp = path.join(gen, "logo-96.png");
  try {
    await writeFile(tmp, buf);
    execFileSync("sips", ["-Z", "96", tmp], { stdio: "ignore" });
    buf = await readFile(tmp);
  } catch {
    // sips 不可用（非 macOS）：原图内联
  }
  const dataUrl = `data:image/png;base64,${buf.toString("base64")}`;
  await writeFile(
    path.join(gen, "logo.ts"),
    `/** 构建期生成（build.mjs ①）：logo-mark 96px base64，运行期零外部请求。 */\nexport const LOGO_DATA_URL =\n  "${dataUrl}";\n`,
    "utf8",
  );
  await rm(tmp, { force: true });
  return buf.byteLength;
}

/** 二进制解析：包内 .bin → 根 .bin → PATH */
function binOf(name) {
  const candidates = [
    path.join(here, "node_modules/.bin", name),
    path.join(root, "node_modules/.bin", name),
    name,
  ];
  for (const c of candidates) {
    if (c === name) return c;
    try {
      execFileSync(c, ["--version"], { stdio: "ignore" });
      return c;
    } catch {
      /* 试下一个 */
    }
  }
  return name;
}

async function run(name, args) {
  execFileSync(binOf(name), args, { stdio: "inherit", cwd: here });
}

async function main() {
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });

  const logoBytes = await buildLogo();
  process.stdout.write(`① logo 内联 ${logoBytes} B\n`);

  // ② esbuild：JS + 三方 CSS（xyflow）
  await run("esbuild", [
    "src/main.tsx",
    "--bundle",
    "--minify",
    "--format=iife",
    "--jsx=automatic",
    "--target=es2022",
    "--define:process.env.NODE_ENV=\"'production'\"",
    "--loader:.css=css",
    "--outfile=dist/index.js",
  ]);

  // ③ tailwind v4 CLI：tokens + utilities
  await run("tailwindcss", ["-i", "src/css/app.css", "-o", "dist/app.css", "--minify"]);

  // ④ 组装单文件 HTML
  const js = await readFile(path.join(dist, "index.js"), "utf8");
  const css = [
    await readFile(path.join(dist, "app.css"), "utf8"),
    // esbuild 输出的三方 CSS（xyflow）若单独成文件则一并内联
    ...(await extraCss()),
  ].join("\n");

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>AgentSignal · 本地管理</title>
<style>
${css}
</style>
</head>
<body>
<div id="root"></div>
<script>
${js}
</script>
</body>
</html>
`;

  await writeFile(path.join(dist, "index.html"), html, "utf8");
  // 注入 CLI：以 TS 字符串常量承载，esbuild 打包 CLI 时内联，运行期零文件依赖
  await writeFile(
    CLI_TARGET,
    `/**\n * 构建产物（自动生成，勿手改）—— 由 packages/wizard-ui/build.mjs 写入。\n * 单文件 HTML：内联全部 JS/CSS/logo，运行期零外部请求（设计规范 §8）。\n */\nexport const WIZARD_HTML = ${JSON.stringify(html)};\n`,
    "utf8",
  );

  const external = /src\s*=\s*["']https?:|@import\s+url\(|fonts\.googleapis/.test(html);
  if (external) {
    throw new Error("产物出现外部请求，违反零外部请求约束（规范 §8）");
  }
  if (/skills/i.test(html.replaceAll(/search_skills|load_skill_detail|verify_skill/g, ""))) {
    process.stdout.write("⚠ 产物中检测到 skills 字样（若为用户可见文案，违反规范红线）\n");
  }

  process.stdout.write(`④ 单文件产物 ${(html.length / 1024).toFixed(1)} KB → ${CLI_TARGET}\n`);
}

async function extraCss() {
  const extra = path.join(dist, "index.css");
  try {
    return [await readFile(extra, "utf8")];
  } catch {
    return [];
  }
}

await main();
