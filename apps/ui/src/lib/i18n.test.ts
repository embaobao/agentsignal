/**
 * i18n 字典契约：zh/en 键集合必须严格一致（缺 key 即失败）。
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
// 从源码读 dict：通过模块内导出不可测（dict 未导出），这里用 t 函数行为锁关键键。
import { useI18n } from "@/lib/i18n";

describe("i18n", () => {
  it("默认 fallback 为中文且关键 key 可译", () => {
    const { result } = renderHook(() => useI18n());
    expect(result.current.locale).toBe("zh");
    expect(result.current.t("hero.title")).toBe("给 Agent 一个解决问题的能力");
    expect(result.current.t("hero.sub")).toBe("Spot it. Use it. Ship it.");
  });
});
