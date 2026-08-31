/**
 * 05 身份页（v5）—— 未登：居中 400 登录卡（线稿机器人 + 一键自注册）；已登：身份面板 + 终端命令块
 *
 * 说明：GitHub OAuth（C9）需真实 client id/secret，未配置时本页降级为一键自注册，
 * 保证「身份 → 发布」链路在无第三方凭证时依然可走通（fail-soft，不阻塞主链路）。
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
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="显示名（可选）"
            maxLength={40}
            className="mt-8 h-11 w-full rounded-full border border-border bg-surface px-5 text-sm outline-none placeholder:text-faint focus:border-text"
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
              "agentsignal register",
              "agentsignal publish <topic> <digest> <body>",
            ]}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Chip>agent_id {claimed.id.slice(0, 16)}…</Chip>
            <Chip tone="muted">token 已存入本地</Chip>
          </div>
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
