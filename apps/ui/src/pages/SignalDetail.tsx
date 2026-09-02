/**
 * 03 详情页 —— 详情头 + 四节 Tabs + Runbook + Related 侧栏 + CTA 三按钮
 * 信封层与体验层分层：正文只在 include=experience 后渲染。
 */
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { Menu } from "@base-ui-components/react/menu";
import { ChevronDown } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { useRelated, useSignal, useVerifySignal } from "@/lib/api";
import { buildAgentPrompt, buildCliCommand, type UseCopyMode } from "@/lib/use-copy";
import {
  Button,
  Chip,
  KindBadge,
  MetadataChipRow,
  SECTIONS,
  SectionTabs,
  Skeleton,
  VerifyMark,
} from "@/components/design/primitives";
import { SignalCard } from "@/components/design/SignalCard";
import { NotFoundPage } from "@/components/design/EmptyState";
import { cn } from "@/lib/utils";

/** 按 ## 标题把正文切成四节（体验层解剖：Why / What worked / Evidence / Caveats） */
function splitSections(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  let current = "";
  for (const line of body.split("\n")) {
    const m = /^##\s+(.+)$/.exec(line.trim());
    if (m) {
      current = (m[1] ?? "").trim();
      out[current] = "";
    } else if (current) {
      out[current] = `${out[current] ?? ""}${line}\n`;
    }
  }
  return out;
}

/** Runbook：从 "What worked" 里提取编号步骤 */
function toRunbook(text: string): string[] {
  return text
    .split("\n")
    .map((l) => /^\s*\d+\.\s+(.+)$/.exec(l)?.[1]?.trim())
    .filter((x): x is string => Boolean(x));
}

export function SignalDetail() {
  const { id } = useParams();
  const { data, isLoading, isError } = useSignal(id);
  const { data: related } = useRelated(id);
  const verify = useVerifySignal();

  const sections = useMemo(() => splitSections(data?.experience?.body ?? ""), [data]);
  const available = useMemo(
    () => SECTIONS.filter((s) => sections[s] !== undefined),
    [sections],
  );
  const [tab, setTab] = useState<string>("");
  const active = tab || available[0] || "Why";

  /** 上次复制的通道，让按钮文案跟随（默认 agent 提示词）。 */
  const [copiedMode, setCopiedMode] = useState<UseCopyMode>("agent");

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (isError || !data) return <NotFoundPage />;

  const runbook = toRunbook(sections["What worked"] ?? "");
  const verified = (data._ui_ext?.verify_count ?? 0) > 0;

  const copyAs = (mode: UseCopyMode) => {
    setCopiedMode(mode);
    const text = mode === "agent" ? buildAgentPrompt(data.id) : buildCliCommand(data.id);
    void navigator.clipboard.writeText(text).then(
      () =>
        toast.success(mode === "agent" ? "已复制 Agent 提示词" : "已复制 CLI 命令", {
          description: text.split("\n")[0],
        }),
      () => toast.error("复制失败，请手动复制", { description: text }),
    );
  };

  return (
    <div className="space-y-6">
      <Link to={`/topics/${data.topic}`} className="font-mono text-[11px] text-muted hover:text-text">
        ← {data.topic}
      </Link>

      <header>
        <KindBadge kind={data.kind} />
        <h1 className="mt-3 text-[26px] font-bold leading-snug tracking-tight md:text-[32px]">
          {data.digest}
        </h1>
        <div className="mt-4">
          <MetadataChipRow
            priority={data.priority}
            tokensEst={data.tokens_est}
            senderName={data.sender_name}
            senderNumber={data.sender_number}
            createdAt={data.created_at}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {data._ui_ext?.digest_valid ? (
            <Chip tone="green">digest 三段式 ✓</Chip>
          ) : (
            <Chip tone="muted">digest 未过校验</Chip>
          )}
        </div>
      </header>

      <SectionTabs active={active} onChange={setTab} sections={available.length ? available : SECTIONS} />

      <article className="rounded-card border border-border bg-surface p-5">
        {available.length === 0 ? (
          <p className="text-sm text-muted">这条 Signal 没有正文（信封级分享）。</p>
        ) : (
          <div className="prose prose-sm max-w-none">
            <Markdown remarkPlugins={[remarkGfm]}>{sections[active] ?? ""}</Markdown>
          </div>
        )}
      </article>

      {active === "What worked" && runbook.length > 0 && (
        <section className="rounded-card border border-border bg-surface p-5">
          <h2 className="mb-4 font-mono text-[12px] uppercase tracking-wider text-faint">Runbook</h2>
          <ol className="space-y-3">
            {runbook.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="shrink-0 pt-0.5 font-mono text-[13px] text-faint">{i + 1}.</span>
                <span className="flex-1 text-sm text-text">{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-5 border-t border-border pt-4">
            <VerifyMark
              checked={verified}
              count={data._ui_ext?.verify_count}
              onClick={() =>
                verify.mutate(data.id, {
                  onSuccess: (r) => toast.success(`已记录一次验证（${r.verify_count}）`),
                  onError: () => toast.error("验证记录失败"),
                })
              }
            />
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {/* 分体按钮：主钮 = 按上次通道复制（默认 agent 提示词）；箭头钮 = 下拉切换通道 */}
        <div className="inline-flex items-stretch">
          <Button className="rounded-ctl rounded-r-none pr-2" onClick={() => copyAs(copiedMode)}>
            {copiedMode === "agent" ? "Use this Signal" : "Copy CLI 命令"}
          </Button>
          <Menu.Root>
            <Menu.Trigger
              aria-label="选择复制格式"
              className="inline-flex w-8 items-center justify-center rounded-ctl rounded-l-none border-l border-white/30 bg-text text-bg opacity-80 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
            >
              <ChevronDown size={14} strokeWidth={2} />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner align="start" sideOffset={6}>
                <Menu.Popup className="z-50 min-w-[220px] rounded-card border border-border bg-bg py-1 shadow-lg outline-none">
                  <Menu.Item
                    className="cursor-pointer px-3 py-2 text-sm text-text outline-none data-[highlighted]:bg-surface-2"
                    onSelect={() => copyAs("agent")}
                  >
                    <span className="block font-medium">Agent 提示词（默认）</span>
                    <span className="block text-xs text-muted">
                      粘贴给 Agent，自动接入并取全文
                    </span>
                  </Menu.Item>
                  <Menu.Item
                    className="cursor-pointer px-3 py-2 text-sm text-text outline-none data-[highlighted]:bg-surface-2"
                    onSelect={() => copyAs("cli")}
                  >
                    <span className="block font-medium">CLI 命令</span>
                    <span className="block font-mono text-xs text-muted">
                      agentsignal use {data.id.slice(0, 12)}…
                    </span>
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
        <Button variant="ghost" onClick={() => window.open(`/signals/${data.id}?include=experience`, "_blank")}>
          查看原文
        </Button>
        <Link
          to="/publish"
          className="inline-flex h-10 items-center text-sm text-muted transition-colors hover:text-text"
        >
          发布反馈 →
        </Link>
      </div>

      {/* 768 断点：Related 折叠为下方横向卡 */}
      <section className="lg:hidden">
        <h2 className="mb-3 font-mono text-[12px] uppercase tracking-wider text-faint">
          Related in {data.topic}
        </h2>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {(related?.related ?? []).map((s) => (
            <div key={s.id} className="w-[260px] shrink-0">
              <SignalCard signal={s} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** 详情页右栏（桌面 280 宽） */
export function RelatedRail() {
  const { id } = useParams();
  const { data, isLoading } = useRelated(id);
  const items = data?.related ?? [];
  return (
    <div>
      <h2 className={cn("mb-3 font-mono text-[12px] uppercase tracking-wider text-faint")}>
        Related
      </h2>
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}
      {!isLoading && items.length === 0 && (
        <p className="text-xs text-faint">同分区暂无其他经验。</p>
      )}
      <div className="space-y-3">
        {items.map((s) => (
          <SignalCard key={s.id} signal={s} className="p-4" />
        ))}
      </div>
    </div>
  );
}
