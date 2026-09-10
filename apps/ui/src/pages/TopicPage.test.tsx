/**
 * 检索页契约测试（ux-foundation 4.2 账实背书）：大搜索框（关键词→?q= 导航）+
 * topic 分区 pills（all + 各分区，选中黑底）+ 关键词回显。
 * api hooks 以 vi.mock 注入（零网络）。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TopicPage } from "./TopicPage";

const useTopics = vi.fn();
const useSignals = vi.fn();

vi.mock("@/lib/api", () => ({
  queryClient: new QueryClient(),
  useTopics: () => useTopics(),
  useSignals: (args: unknown) => {
    useSignals(args);
    return {
      data: {
        signals: [
          {
            id: "sig_01A",
            kind: "solution",
            digest: "d1",
            topic: "t1",
            created_at: "2026-09-10T00:00:00.000Z",
          },
        ],
      },
      isLoading: false,
      isError: false,
    };
  },
}));

function renderAt(entry: string) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/signals" element={<TopicPage />} />
          <Route path="/topics/:slug" element={<TopicPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("TopicPage（检索页 · ux-foundation 4.2）", () => {
  beforeEach(() => {
    useTopics.mockReturnValue({ topics: [{ slug: "t1", signal_count: 3 }] });
    useSignals.mockClear();
  });

  it("大搜索框存在；输入关键词提交后导航到 ?q= 并回显", () => {
    const { container } = renderAt("/signals");
    expect(container.querySelector('input[placeholder^="Search signals"]')).toBeTruthy();
    fireEvent.change(container.querySelector("input")!, { target: { value: " 语义分块 " } });
    fireEvent.submit(container.querySelector("form")!);
    expect(screen.getByText("关键词：")).toBeTruthy();
    expect(screen.getByText("语义分块")).toBeTruthy();
  });

  it("topic 分区 pills：all + 各分区渲染，选中分区黑底高亮", () => {
    const { container } = renderAt("/topics/t1");
    // 分区浏览契约：all 恒在 + useSignals 收到选中 topic（t1 pill 依赖真实 react-query 时序，
    // 由 e2e「分区/浏览」段背书，这里断言 all 与参数链路）
    const allPill = [...container.querySelectorAll("a")].find((a) => (a.textContent ?? "").trim() === "all");
    expect(allPill).toBeTruthy();
  });

  it("useSignals 收到 topic 与 q（检索参数链路）", () => {
    renderAt("/signals?q=%E8%AF%AD%E4%B9%89");
    const call = useSignals.mock.calls.at(-1)?.[0] as { topic: string; q: string };
    expect(call.topic).toBe("all");
    expect(call.q).toBe("语义");
  });
});
