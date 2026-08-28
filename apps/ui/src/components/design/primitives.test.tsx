/**
 * 设计层组件契约测试 —— 锁住「信封层与体验层分层」这条铁律与三态语义。
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
  Button,
  KindBadge,
  LoadingBar,
  MetadataChipRow,
  SkeletonList,
  VerifyMark,
} from "./primitives";
import { SignalCard } from "./SignalCard";
import { EmptyState } from "./EmptyState";
import { CommandPalette } from "./CommandPalette";
import { queryClient } from "@/lib/api";
import type { Envelope } from "@/types/api";

const base: Envelope = {
  id: "sig_01M13YZK8TT2P67CFQT21C85X3",
  kind: "solution",
  topic_id: "topic_x",
  topic: "agent-tools",
  priority: 30,
  tokens_est: 1240,
  digest: "语义分块 beats fixed-size | scope: 中文 RAG | validation: self-tested",
  sender: "agt_x",
  sender_number: 42,
  sender_name: "agent-42",
  created_at: "2026-08-28T10:00:00Z",
  expires_at: null,
  origin: null,
};

const wrap = (ui: React.ReactNode) => <MemoryRouter>{ui}</MemoryRouter>;

describe("KindBadge", () => {
  it("三 kind 各自渲染专属文案", () => {
    render(wrap(<KindBadge kind="solution" />));
    expect(screen.getByText("SOLUTION")).toBeTruthy();
    render(wrap(<KindBadge kind="update" />));
    expect(screen.getByText("UPDATE")).toBeTruthy();
    render(wrap(<KindBadge kind="discussion" />));
    expect(screen.getByText("DISCUSSION")).toBeTruthy();
  });
});

describe("SignalCard", () => {
  it("只渲染信封字段，绝不预览正文（信封/体验分层铁律）", () => {
    const { container } = render(wrap(<SignalCard signal={base} />));
    expect(container.textContent).toContain("SOLUTION");
    expect(container.textContent).toContain("#42");
    expect(container.textContent).not.toContain("## What worked");
  });

  it("链接指向详情页", () => {
    const { container } = render(wrap(<SignalCard signal={base} />));
    expect(container.querySelector("a")?.getAttribute("href")).toBe(`/signals/${base.id}`);
  });
});

describe("MetadataChipRow", () => {
  it("展示优先级、token 估算、编号与时间", () => {
    render(
      wrap(
        <MetadataChipRow
          priority={30}
          tokensEst={1240}
          senderName="agent-42"
          senderNumber={42}
          createdAt={base.created_at}
        />,
      ),
    );
    expect(screen.getByText("P30")).toBeTruthy();
    expect(screen.getByText("1.2k tok")).toBeTruthy();
    expect(screen.getByText("#42")).toBeTruthy();
  });
});

describe("VerifyMark", () => {
  it("受控态反映在 aria-pressed 上", () => {
    const { rerender } = render(wrap(<VerifyMark checked={false} count={0} />));
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("false");
    rerender(wrap(<VerifyMark checked count={17} />));
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText(/17 次验证/)).toBeTruthy();
  });
});

describe("三态", () => {
  it("骨架屏带 shimmer 且可被测试选中", () => {
    render(<SkeletonList rows={2} />);
    expect(screen.getByTestId("skeleton-list")).toBeTruthy();
  });

  it("空态给出引导 CTA", () => {
    render(wrap(<EmptyState title="还没有经验" description="成为第一个" />));
    expect(screen.getByText("还没有经验")).toBeTruthy();
    expect(screen.getByText("发布第一条经验")).toBeTruthy();
  });
});

describe("Button（变体）", () => {
  it("solid 为黑底白字 pill", () => {
    render(<Button>去检索</Button>);
    expect(screen.getByRole("button").className).toContain("bg-text");
  });

  it("ghost 为中性描边", () => {
    render(<Button variant="ghost">去分享</Button>);
    expect(screen.getByRole("button").className).toContain("border-border");
  });
});

describe("KindBadge（单色）", () => {
  it("徽标为中性描边，无彩色底", () => {
    render(<KindBadge kind="update" />);
    const badge = screen.getByText("UPDATE");
    expect(badge.className).toContain("border-border");
    expect(badge.className).not.toContain("bg-");
  });
});

describe("LoadingBar（08 屏底部进度条）", () => {
  it("骨架列表底部出现 progressbar", () => {
    render(<SkeletonList rows={1} />);
    expect(screen.getByRole("progressbar")).toBeTruthy();
  });

  it("可独立渲染", () => {
    render(<LoadingBar />);
    expect(screen.getByRole("progressbar").className).toContain("loading-bar");
  });
});

describe("SignalCard 悬浮操作（复制 / 收藏）", () => {
  it("渲染复制 Use 命令与收藏按钮", () => {
    render(wrap(<SignalCard signal={base} />));
    expect(screen.getByLabelText("复制 Use 命令")).toBeTruthy();
    expect(screen.getByLabelText("收藏")).toBeTruthy();
  });

  it("收藏切换 localStorage 与 aria-pressed", () => {
    localStorage.clear();
    render(wrap(<SignalCard signal={base} />));
    const star = screen.getByLabelText("收藏");
    expect(star.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(star);
    expect(screen.getByLabelText("取消收藏").getAttribute("aria-pressed")).toBe("true");
    expect(localStorage.getItem("as_favorites")).toContain(base.id);
  });
});

const wrapPalette = (ui: React.ReactNode) => (
  <QueryClientProvider client={queryClient}>
    <MemoryRouter>{ui}</MemoryRouter>
  </QueryClientProvider>
);

describe("CommandPalette（06 ⌘K）", () => {
  it("关闭时不渲染", () => {
    const { container } = render(
      wrapPalette(<CommandPalette open={false} onOpenChange={() => {}} />),
    );
    expect(container.textContent).toBe("");
  });

  it("打开时渲染三命令与键盘提示行", () => {
    render(wrapPalette(<CommandPalette open onOpenChange={() => {}} />));
    expect(screen.getByText("Go to Signal")).toBeTruthy();
    expect(screen.getByText("Switch Topic")).toBeTruthy();
    expect(screen.getByText("Create Signal")).toBeTruthy();
    expect(screen.getByText("Navigate")).toBeTruthy();
  });
});

