/**
 * ⌘K 命令面板 —— 半透明背景 + 居中宽面板 + 编号选项 + 底部键盘提示行。
 * 交互内核用 cmdk（已在依赖清单），外观全部走 design tokens。
 * 全局唤起：⌘K / Ctrl+K（AppLayout 挂载）；Esc 关闭。
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Command } from "cmdk";
import { ArrowRightCircle, FilePlus2, Layers, Search } from "lucide-react";
import { useTopics } from "@/lib/api";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { data } = useTopics();
  const [query, setQuery] = useState("");

  // 打开时清空上次输入
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  // Esc 关闭（cmdk 不管外层）
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const topics = useMemo(() => data?.topics ?? [], [data]);

  if (!open) return null;

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  const itemCls =
    "flex cursor-pointer items-center gap-3 rounded-ctl px-3 py-2.5 text-sm text-text aria-selected:bg-surface-2";

  const hint = (
    <span className="flex items-center gap-1.5">
      <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-faint">
        ↑↓
      </kbd>
      Navigate
    </span>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh]">
      {/* 毛玻璃背景：blur 渐显 */}
      <button
        type="button"
        aria-label="关闭命令面板"
        className="absolute inset-0 bg-black/40 animate-in fade-in duration-150"
        onClick={() => onOpenChange(false)}
      />
      <Command
        label="命令面板"
        className="relative w-[min(92vw,560px)] overflow-hidden rounded-card border border-border bg-surface shadow-[0_16px_60px_rgba(0,0,0,0.35)] animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search size={15} className="shrink-0 text-faint" />
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder="Search commands, signals, topics…"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-faint"
          />
          <span className="shrink-0 font-mono text-[10px] text-faint">Esc to close</span>
        </div>

        <Command.List className="max-h-[320px] overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-faint">
            没有匹配的命令
          </Command.Empty>

          <Command.Group heading={<GroupLabel>Commands</GroupLabel>}>
            <Command.Item value="go-to-signal 跳转详情" className={itemCls} onSelect={() => go("/signals")}>
              <ArrowRightCircle size={15} className="text-faint" />
              <span className="flex-1">Go to Signal</span>
              <NumChip n={1} />
            </Command.Item>
            <Command.Item value="switch-topic 切换分区" className={itemCls} onSelect={() => go("/signals")}>
              <Layers size={15} className="text-faint" />
              <span className="flex-1">Switch Topic</span>
              <NumChip n={2} />
            </Command.Item>
            <Command.Item value="create-signal 发布经验" className={itemCls} onSelect={() => go("/publish")}>
              <FilePlus2 size={15} className="text-faint" />
              <span className="flex-1">Create Signal</span>
              <NumChip n={3} />
            </Command.Item>
          </Command.Group>

          {topics.length > 0 && (
            <Command.Group heading={<GroupLabel>Topics</GroupLabel>}>
              {topics.map((t) => (
                <Command.Item
                  key={t.id}
                  value={`topic ${t.slug}`}
                  className={itemCls}
                  onSelect={() => go(`/topics/${t.slug}`)}
                >
                  <Layers size={15} className="text-faint" />
                  <span className="flex-1 font-mono text-[13px]">{t.slug}</span>
                  <span className="font-mono text-[10px] text-faint">{t.signal_count}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}
        </Command.List>

        {/* 底部 keyboard hint 栏 */}
        <div className="flex items-center gap-4 border-t border-border px-4 py-2.5 font-mono text-[12px] text-muted">
          {hint}
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-faint">↵</kbd>
            Select
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-faint">Esc</kbd>
            Close
          </span>
        </div>
      </Command>
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-wider text-faint">
      {children}
    </span>
  );
}

/** 右侧编号 chip（#1/#2/#3，等宽） */
function NumChip({ n }: { n: number }) {
  return (
    <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-faint">
      #{n}
    </span>
  );
}
