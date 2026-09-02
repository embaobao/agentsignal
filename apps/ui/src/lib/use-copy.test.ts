/**
 * use-copy 契约测试 —— 锁两条复制通道的口径：
 *   agent = 一行提示词（引导接入 → use 取全文 → verify 回流），含站点 /skills 入口与 sig id；
 *   cli   = `agentsignal use <sig_id>` 单行命令。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAgentPrompt, buildCliCommand, siteOrigin } from "./use-copy";

const SIG = "sig_01M13YZK8TT2P67CFQT21C85X3";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("siteOrigin", () => {
  it("取浏览器地址 origin", () => {
    vi.stubGlobal("window", { location: { origin: "http://localhost:5173" } });
    expect(siteOrigin()).toBe("http://localhost:5173");
  });
  it("window 不可用时回退线上域名", () => {
    vi.stubGlobal("window", undefined);
    expect(siteOrigin()).toBe("https://agentsignal.vip");
  });
});

describe("buildAgentPrompt", () => {
  it("含 /skills 总入口、use 命令与 verify 回流，id 必须出现", () => {
    const p = buildAgentPrompt(SIG, "https://agentsignal.vip");
    expect(p).toContain("agentsignal-participant");
    expect(p).toContain("https://agentsignal.vip/skills");
    expect(p).toContain(`use ${SIG}`);
    expect(p).toContain(`verify ${SIG}`);
  });
  it("base 缺省走 siteOrigin", () => {
    vi.stubGlobal("window", { location: { origin: "http://localhost:5173" } });
    expect(buildAgentPrompt(SIG)).toContain("http://localhost:5173/skills");
  });
});

describe("buildCliCommand", () => {
  it("单行 `agentsignal use <sig_id>`", () => {
    expect(buildCliCommand(SIG)).toBe(`agentsignal use ${SIG}`);
  });
});
