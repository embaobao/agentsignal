/**
 * P7 7.1 供应商注册表单测（local-capability-plane · node:test 单口径）。
 *
 * 数据驱动：内置打底（GLM/DeepSeek/Moonshot 国产端点打底）+ 用户区
 * ~/.agentsignal/providers.json5 覆盖/追加（**新增厂商 = 只改数据文件**，不硬编码）。
 * 加载校验：schema 逐条校验，非法条目跳过并收集（scanSkills 同款 fail-soft）。
 * 夹具 = AGENTSIGNAL_CONFIG 临时目录。
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { loadProviders } from "../src/capability/providers.ts";
import { resolvePaths } from "../src/skills/paths.ts";

let root = "";
before(async () => {
  root = await mkdtemp(path.join(tmpdir(), "as-prov-"));
  process.env.AGENTSIGNAL_CONFIG = root;
});
after(async () => {
  delete process.env.AGENTSIGNAL_CONFIG;
  if (root) await rm(root, { recursive: true, force: true });
});

test("内置打底：GLM/DeepSeek/Moonshot 国产端点齐且 schema 合规", async () => {
  const { providers } = await loadProviders(resolvePaths(root));
  assert.ok(providers.length >= 3, `至少三家内置：${providers.length}`);
  const glm = providers.find((p) => p.id === "glm");
  assert.equal(glm?.base_url, "https://open.bigmodel.cn/api/paas/v4");
  assert.ok(glm?.models.includes("glm-4.7") || glm?.models.length > 0);
  const ds = providers.find((p) => p.id === "deepseek");
  assert.equal(ds?.base_url, "https://api.deepseek.com");
  for (const p of providers) {
    assert.ok(p.base_url.startsWith("https://"), `${p.id} base_url 须 https`);
    assert.ok(p.models.length > 0, `${p.id} 建议模型非空`);
  }
});

test("用户区覆盖：providers.json5 同 id 覆盖 base_url（只改数据文件）", async () => {
  await mkdir(root, { recursive: true });
  await writeFile(
    path.join(root, "providers.json5"),
    JSON.stringify({
      providers: [
        {
          id: "deepseek",
          name: "DeepSeek 私有网关",
          base_url: "https://ds.corp.internal/v1",
          models: ["deepseek-chat"],
        },
      ],
    }),
    "utf8",
  );
  const { providers } = await loadProviders(resolvePaths(root));
  const ds = providers.find((p) => p.id === "deepseek");
  assert.equal(ds?.base_url, "https://ds.corp.internal/v1", "同 id 覆盖");
  assert.ok(
    providers.some((p) => p.id === "glm"),
    "未覆盖的内置保留",
  );
});

test("用户新增厂商：只改数据文件即可见（社区可补）", async () => {
  await writeFile(
    path.join(root, "providers.json5"),
    JSON.stringify({
      providers: [
        {
          id: "deepseek",
          name: "DeepSeek 私有网关",
          base_url: "https://ds.corp.internal/v1",
          models: ["deepseek-chat"],
        },
        {
          id: "yi",
          name: "零一万物",
          base_url: "https://api.lingyiwanwu.com/v1",
          models: ["yi-large"],
        },
      ],
    }),
    "utf8",
  );
  const { providers } = await loadProviders(resolvePaths(root));
  assert.ok(
    providers.some((p) => p.id === "yi"),
    "新增厂商直接可见",
  );
});

test("非法条目：缺 base_url 跳过并收集 errors（fail-soft 不炸）", async () => {
  await writeFile(
    path.join(root, "providers.json5"),
    JSON.stringify({
      providers: [{ id: "broken", name: "坏条目" }],
    }),
    "utf8",
  );
  const r = await loadProviders(resolvePaths(root));
  assert.equal(r.errors.length, 1);
  assert.ok(r.errors[0].includes("broken"));
  assert.ok(!r.providers.some((p) => p.id === "broken"), "坏条目不进结果");
});
