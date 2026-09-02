/**
 * Landing 首页契约测试（v5）：顶部导航 / 标语三层（主标语 · 动作链 · 英文伴标语）/ 双 CTA / 终端块。
 * i18n 默认上下文为 zh（lib/i18n fallback），英文案在 i18n 字典单测里锁。
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen , fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { queryClient } from "@/lib/api";
import { HomePage } from "./HomePage";

const wrap = (ui: React.ReactNode) => (
  <QueryClientProvider client={queryClient}>
    <MemoryRouter>{ui}</MemoryRouter>
  </QueryClientProvider>
);

describe("HomePage（landing · v5 单列叙事流）", () => {
  it("渲染标语三层：主标语 + 三词动作链 + 英文伴标语", () => {
    render(wrap(<HomePage />));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "给 Agent 一个解决问题的能力",
    );
    expect(screen.getByText("感知 · 复用 · 分享")).toBeTruthy();
    expect(screen.getByText("Spot it. Use it. Ship it.")).toBeTruthy();
  });

  it("CTA：Get started 进认证，Browse signals 进列表", () => {
    render(wrap(<HomePage />));
    expect(screen.getByRole("link", { name: "Get started" }).getAttribute("href")).toBe("/auth");
    expect(
      screen.getByRole("link", { name: /Browse signals/ }).getAttribute("href"),
    ).toBe("/signals");
  });

  it("顶部导航含 Sign in 与 Publish", () => {
    render(wrap(<HomePage />));
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/auth");
    expect(
      screen.getAllByRole("link", { name: "Publish" })[0]?.getAttribute("href"),
    ).toBe("/publish");
  });

  it("终端块双身份标签：我是人给 /skills 链接 / 我是 Agent 给 curl", () => {
    render(wrap(<HomePage />));
    expect(screen.getByRole("tab", { name: "我是人" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "我是 Agent" })).toBeTruthy();
    // 人侧零命令行门槛：整块只有一条可复制的 URL，且不带 $ 命令前缀
    expect(screen.getByText(`${window.location.origin}/skills`)).toBeTruthy();
    expect(screen.getByText("复制这条链接，发给你的 Agent")).toBeTruthy();
    expect(screen.queryByText(/npx/)).toBeNull();
    expect(screen.getByRole("button", { name: "Copy command" })).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "我是 Agent" }));
    expect(screen.getByText(/curl .*\/skills/)).toBeTruthy();
  });

  it("How it works 三步横排", () => {
    render(wrap(<HomePage />));
    expect(screen.getByText("检索")).toBeTruthy();
    expect(screen.getByText("验证")).toBeTruthy();
    expect(screen.getByText("复用")).toBeTruthy();
  });
});
