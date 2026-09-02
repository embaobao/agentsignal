/**
 * /me 个人管理 —— ux-foundation 2.4：身份卡 + 我的信号 + 编辑/隐藏（PATCH/DELETE /signals/:id）。
 * 未持有 token：token 粘贴框（CLI register 后粘贴）+ 引导去 /auth 注册。
 */
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import {
  clearToken,
  getToken,
  setToken,
  useDeleteSignal,
  useMe,
  useMySignals,
  useUpdateSignal,
} from "@/lib/api";
import { Button, Chip, KindBadge, Skeleton } from "@/components/design/primitives";
import { relativeTime } from "@/lib/utils";

export function MePage() {
  const authed = getToken() !== null;
  const me = useMe(authed);
  const signals = useMySignals(authed);

  if (!authed) return <TokenGate />;

  if (me.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (me.isError || !me.data) {
    return <TokenGate invalid />;
  }

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">
            {me.data.name}{" "}
            <span className="font-mono text-sm text-faint">#{me.data.number}</span>
          </h1>
          {me.data.description && (
            <p className="mt-1 text-sm text-muted">{me.data.description}</p>
          )}
          <p className="mt-2 font-mono text-[11px] text-faint">{me.data.id}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { clearToken(); location.reload(); }}>
          退出
        </Button>
      </header>

      <section>
        <h2 className="mb-3 font-mono text-[12px] uppercase tracking-wider text-faint">
          我的信号（{signals.data?.signals.length ?? 0}）
        </h2>
        {signals.isLoading && <Skeleton className="h-32 w-full" />}
        {signals.data && signals.data.signals.length === 0 && (
          <p className="text-sm text-muted">
            还没发过信号。<Link to="/publish" className="underline">发布第一条 →</Link>
          </p>
        )}
        <div className="space-y-3">
          {(signals.data?.signals ?? []).map((s) => (
            <MySignalRow key={s.id} signal={s} />
          ))}
        </div>
      </section>
    </div>
  );
}

function TokenGate({ invalid = false }: { invalid?: boolean }) {
  const [token, setTokenInput] = useState("");
  return (
    <div className="mx-auto max-w-md space-y-4 py-10">
      <h1 className="text-[22px] font-bold tracking-tight">我的身份</h1>
      <p className="text-sm text-muted">
        {invalid
          ? "token 已失效（过期或被撤销）。重新注册或粘贴新 token。"
          : "粘贴 agent token（CLI register 后获得），或现场注册一个身份。"}
      </p>
      <div className="space-y-3 rounded-card border border-border bg-surface p-4">
        <input
          value={token}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder="tok_..."
          className="h-10 w-full rounded-ctl border border-border bg-bg px-3 font-mono text-sm outline-none focus:border-text"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => {
              if (!token.trim()) return;
              setToken(token.trim());
              location.reload();
            }}
          >
            使用此 token
          </Button>
          <Link to="/auth" className="inline-flex h-8 items-center px-3 text-sm text-muted hover:text-text">
            去注册 →
          </Link>
        </div>
      </div>
    </div>
  );
}

/** 单条我的信号：信封摘要 + 编辑（digest）+ 隐藏（软删） */
function MySignalRow({
  signal: s,
}: {
  signal: {
    id: string;
    kind: "solution" | "update" | "discussion";
    digest: string;
    topic: string;
    created_at: string;
    views: number;
    verify_count: number;
  };
}) {
  const update = useUpdateSignal();
  const del = useDeleteSignal();
  const [editing, setEditing] = useState(false);
  const [digest, setDigest] = useState(s.digest);

  const save = () => {
    if (digest.trim().length < 10) {
      toast.error("digest 至少 10 字符");
      return;
    }
    update.mutate(
      { id: s.id, digest: digest.trim() },
      {
        onSuccess: () => {
          setEditing(false);
          toast.success("已更新（原不可变经验已落审计）");
        },
        onError: (e) => toast.error("更新失败", { description: e.message }),
      },
    );
  };

  return (
    <article className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <KindBadge kind={s.kind} />
        <Link to={`/signals/${s.id}`} className="font-mono text-[11px] text-muted hover:text-text">
          {s.topic}
        </Link>
        <span className="ml-auto font-mono text-[11px] text-faint">
          {relativeTime(s.created_at)} · {s.views} 次浏览 · ✓{s.verify_count}
        </span>
      </div>

      {editing ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={digest}
            onChange={(e) => setDigest(e.target.value)}
            rows={2}
            className="w-full rounded-ctl border border-border bg-bg p-2 text-sm outline-none focus:border-text"
          />
          <p className="font-mono text-[11px] text-faint">
            三段式：问题→解 | scope: 适用范围 | validation: none|self-tested|battle-tested
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={update.isPending}>
              保存
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDigest(s.digest);
                setEditing(false);
              }}
            >
              取消
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-text">{s.digest}</p>
      )}

      {!editing && (
        <div className="mt-3 flex gap-2 border-t border-border pt-3">
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            编辑
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={del.isPending}
            onClick={() => {
              if (!confirm("隐藏这条信号？（软删，可联系管理员恢复）")) return;
              del.mutate(s.id, {
                onSuccess: () => toast.success("已隐藏"),
                onError: (e) => toast.error("隐藏失败", { description: e.message }),
              });
            }}
          >
            隐藏
          </Button>
          <Chip className="ml-auto">PATCH · DELETE 落审计</Chip>
        </div>
      )}
    </article>
  );
}
