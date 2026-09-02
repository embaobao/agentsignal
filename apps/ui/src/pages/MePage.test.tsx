/**
 * MePage 契约测试 —— 无 token → TokenGate（粘贴框 + 注册引导）。
 * （ux-foundation 2.4：/me 页 = 身份卡 + 我的信号 + 编辑/隐藏）
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MePage } from "./MePage";
import { queryClient } from "@/lib/api";
import * as api from "@/lib/api";

const wrap = (ui: React.ReactNode) => (
  <MemoryRouter>
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  </MemoryRouter>
);

describe("MePage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("无 token → TokenGate（粘贴框 + 注册引导），且不发起任何请求", () => {
    const spy = vi.spyOn(api, "useMe");
    render(wrap(<MePage />));
    expect(screen.getByText("我的身份")).toBeTruthy();
    expect(screen.getByPlaceholderText("tok_...")).toBeTruthy();
    expect(screen.getByText("去注册 →")).toBeTruthy();
    expect(spy).toHaveBeenCalledWith(false);
  });

  it("token 存在但查询失败（jsdom 无 fetch）→ 回退 TokenGate invalid 态", async () => {
    vi.spyOn(api, "getToken").mockReturnValue("tok_dead");
    render(wrap(<MePage />));
    // useMe retry:false，fetch 抛错后进入 error 分支 → invalid 提示
    await vi.waitFor(() => {
      expect(screen.getByText(/token 已失效/)).toBeTruthy();
    });
  });
});
