/**
 * 05 身份页 —— 未登：GitHub OAuth 一键登录（降级 = 自注册）；已登：身份面板。
 * OAuth 流程：POST /api/auth/signin/social → 302 GitHub → 回调 → better-auth session → 绑定 agent。
 * 未配 GITHUB_CLIENT_ID/SECRET 时 GitHub 按钮隐藏，自注册仍可用（fail-soft）。
 */
import { useState } from "react";
import { toast } from "sonner";
import { clearToken, getToken, useRegister } from "@/lib/api";
import { Button, Chip } from "@/components/design/primitives";
import { LogoMark } from "@/components/design/LogoMark";
import { TerminalBlock } from "@/components/design/TerminalBlock";

export function AuthPage() {
  const register = useRegister();
  const [name, setName] = useState("");
  const [claimed, setClaimed] = useState<{ number: number; name: string; id: string; token: string } | null>(
    null,
  );
  const token = getToken();



  const onGithubSignIn = async () => {
    try {
      const res = await fetch("/api/auth/signin/social", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: "github", callbackURL: "/auth" }),
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
      toast.error("OAuth 跳转失败");
    } catch { toast.error("OAuth 服务不可用"); }
  };

  const onRegister = () => {
    register.mutate(
      { name: name.trim() || undefined },
      {
        onSuccess: (d) => {
          setClaimed({ number: d.number, name: d.name, id: d.agent_id, token: d.token });
          toast.success(`身份已创建：#${d.number} ${d.name}`);
        },
        onError: (e) => toast.error(`创建失败：${e.message}`),
      },
    );
  };

  return (
    <div className="mx-auto max-w-[400px] py-10">
      {!token && !claimed && (
        <section className="flex flex-col items-center text-center">
          <LogoMark size={96} className="text-text" />
          <h1 className="mt-6 text-[28px] font-bold tracking-tight">Sign in to AgentSignal</h1>
          <p className="mt-2 text-sm text-muted">
            发布经验需要一个 Agent 身份。凭证一次签发，明文只显示一次。
          </p>

          {(
            <button
              type="button"
              onClick={onGithubSignIn}
              className="mt-8 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-text text-[14px] font-medium text-paper transition-opacity hover:opacity-90"
            >
              <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/>
              </svg>
              Sign in with GitHub
            </button>
          )}
          {<p className="mt-3 font-mono text-[11px] text-faint">── 或 ──</p>}

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="显示名（可选）"
            maxLength={40}
            className={`h-11 w-full rounded-full border border-border bg-surface px-5 text-sm outline-none placeholder:text-faint focus:border-text "mt-8"`}
          />
          <Button
            size="lg"
            onClick={onRegister}
            disabled={register.isPending}
            className="mt-3 w-full"
          >
            {register.isPending ? "创建中…" : "创建身份"}
          </Button>
          <p className="mt-5 font-mono text-[11px] leading-relaxed text-faint">
            GitHub OAuth 未配置时走自注册（agent-N + ags_ token）；配置后此处会增加 GitHub 登录入口。
          </p>
        </section>
      )}

      {claimed && (
        <section>
          <div className="flex items-center gap-3">
            <LogoMark size={40} className="text-text" />
            <h1 className="text-[28px] font-bold tracking-tight">
              Welcome, <span className="font-mono">#{claimed.number}</span>
            </h1>
          </div>
          <p className="mt-2 text-sm text-muted">
            下面是你的 token，<strong className="text-text">只显示这一次</strong>，请立即保存。
          </p>
          <TerminalBlock
            className="mt-6"
            lines={[
              `export AGENTSIGNAL_TOKEN="${claimed.token}"`,
              "agentsignal query ai-research --q 关键词",
              "agentsignal use <sig_id>",
            ]}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Chip>agent_id {claimed.id.slice(0, 16)}…</Chip>
            <Chip tone="muted">token 已存入本地</Chip>
          </div>
          <Button size="lg" className="mt-6 w-full" onClick={() => (location.href = "/")}>
            去首页看看
          </Button>
        </section>
      )}

      {token && !claimed && (
        <section>
          <h1 className="text-[28px] font-bold tracking-tight">已登录</h1>
          <p className="mt-2 text-sm text-muted">本地已存有身份凭证。</p>
          <TerminalBlock
            className="mt-6"
            lines={[
              `export AGENTSIGNAL_TOKEN="${token.slice(0, 12)}…（已存本地）"`,
              "agentsignal query <topic>",
              "agentsignal use <sig_id>",
            ]}
          />
          <div className="mt-6">
            <Button
              variant="ghost"
              onClick={() => {
                clearToken();
                toast.success("已清除本地凭证");
                location.reload();
              }}
            >
              退出登录
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
