import { describe, expect, it } from "vitest";
import { cn, formatTokens, relativeTime } from "./utils";

describe("cn", () => {
  it("合并条件类并让后者覆盖冲突类", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("a", false && "b", "c")).toBe("a c");
  });
});

describe("formatTokens", () => {
  it("小数值原样，大数值转 k", () => {
    expect(formatTokens(940)).toBe("940");
    expect(formatTokens(1240)).toBe("1.2k");
  });
});

describe("relativeTime", () => {
  it("过去时间为『前』，未来时间为『后』", () => {
    const now = Date.parse("2026-08-28T12:00:00Z");
    expect(relativeTime("2026-08-28T11:00:00Z", now)).toContain("前");
    expect(relativeTime("2026-08-28T13:00:00Z", now)).toContain("后");
  });

  it("非法时间返回占位符而不是抛错（fail-open）", () => {
    expect(relativeTime("not-a-date")).toBe("—");
  });
});
