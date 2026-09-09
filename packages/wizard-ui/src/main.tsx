/**
 * 顶层状态机：A 初始化向导 / B 管理视图 / C 配置损坏修复（?state= 支持离线预览）。
 * 数据全部来自本地临时服务的 /api/state —— 页面不自带业务真源。
 */
import { createRoot } from "react-dom/client";
import { useEffect, useState, type ReactNode } from "react";
import { G } from "./copy.ts";
import { Header } from "./ui.tsx";
import { Wizard, type HostOption, type StackOption } from "./wizard.tsx";
import { Manage, type HostState, type LibraryItem, type SubscriptionRow } from "./manage.tsx";
import { Corrupt } from "./corrupt.tsx";

interface StateResponse {
  state: "wizard" | "manage" | "corrupt";
  corrupt?: string;
  hosts: HostState[];
  config: { domains?: { current?: string; available?: string[] }; layers?: { id: string; name: string }[] } | null;
  stats: { skill_count: number; bytes_total: number; index_rebuilt_at: string | null };
  metrics: { throughput_saved: number; residual: number };
  layout: { root: string };
  options: { domains: string[]; stacks: StackOption[] };
  library: LibraryItem[];
  sync: { subscriptions: SubscriptionRow[]; max_skills: number; base_url: string | null } | null;
  capacity: { count: number; max: number; over: boolean; candidates: { id: string }[] } | null;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  return (await res.json()) as T;
}

function App(): ReactNode {
  const [data, setData] = useState<StateResponse | null>(null);
  const [force, setForce] = useState<string | null>(
    new URLSearchParams(location.search).get("state"),
  );

  useEffect(() => {
    void (async () => {
      setData(await api<StateResponse>("/api/state"));
    })();
  }, []);

  useEffect(() => {
    if (!data) return;
    document.title =
      data.state === "manage" ? G.titleManage : data.state === "corrupt" ? G.titleWizard : G.titleWizard;
  }, [data]);

  if (!data) {
    return (
      <>
        <Header />
        <main className="page">
          <div className="container-wizard">
            <p className="step-desc">正在读取本地配置…</p>
          </div>
        </main>
      </>
    );
  }

  const state = force ?? data.state;
  const hosts: HostOption[] = data.hosts.map((h) => ({
    id: h.id,
    name: h.name,
    detected: h.detected,
    path: h.path,
  }));

  return (
    <>
      <Header />
      <main className="page">
        {state === "corrupt" ? (
          <Corrupt
            message={data.corrupt ?? "未知错误"}
            onAutofix={() => api<{ ok: boolean; reason?: string }>("/api/autofix", { method: "POST" })}
            onReinit={async () => {
              const r = await api<{ ok: boolean }>("/api/reinit", { method: "POST" });
              if (r.ok) {
                const fresh = await api<StateResponse>("/api/state");
                setData(fresh);
                setForce("wizard");
                return { ok: true, backup: "config.json5.bak-<时间戳>" };
              }
              return { ok: false };
            }}
          />
        ) : null}

        {state === "wizard" ? (
          <Wizard
            domainOptions={data.options.domains}
            stackOptions={data.options.stacks}
            hosts={hosts}
            defaults={{
              domains: (data.config?.domains?.available ?? []).filter((d) => d !== "common"),
              stacks: ["nextjs", "typescript"],
              hosts: data.hosts.filter((h) => h.mcp === "wired").map((h) => h.id),
            }}
            onSubmit={(payload) =>
              api<{ ok: boolean; written?: { host: string; path: string }[]; reason?: string }>(
                "/api/submit",
                {
                  method: "POST",
                  body: JSON.stringify({
                    domains: payload.domains,
                    stacks: payload.stacks,
                    hosts: payload.hosts,
                    defaults: payload.useDefaults ?? false,
                  }),
                },
              )
            }
          />
        ) : null}

        {state === "manage" && data.config ? (
          <Manage
            config={data.config}
            hosts={data.hosts}
            stats={data.stats}
            metrics={data.metrics}
            root={data.layout.root}
            sync={data.sync}
            capacity={data.capacity}
            library={data.library}
            onRerun={() => setForce("wizard")}
            onWire={(hosts) =>
              api<{ ok: boolean; failed?: { host: string; reason: string }[] }>("/api/wire", {
                method: "POST",
                body: JSON.stringify({ hosts }),
              })
            }
            onUninstall={async () => {
              const r = await api<{ ok: boolean; failed?: { host: string; reason: string }[]; dataKept: string }>(
                "/api/uninstall",
                { method: "POST" },
              );
              return r;
            }}
            onSubAdd={(topic) =>
              api<{ ok: boolean; reason?: string }>("/api/subscriptions/add", {
                method: "POST",
                body: JSON.stringify({ topic }),
              })
            }
            onSubRemove={(topic) =>
              api<{ ok: boolean; reason?: string }>("/api/subscriptions/remove", {
                method: "POST",
                body: JSON.stringify({ topic }),
              })
            }
            onSync={(topic) =>
              api<{ ok: boolean; reason?: string; report?: { installed: number; skipped: number } }>(
                "/api/sync",
                { method: "POST", body: JSON.stringify({ topic }) },
              )
            }
            onLibraryDelete={async (id) => {
              const r = await api<{ ok: boolean; reason?: string }>("/api/library/delete", {
                method: "POST",
                body: JSON.stringify({ id }),
              });
              if (r.ok) setData(await api<StateResponse>("/api/state"));
              return r;
            }}
          />
        ) : null}
      </main>
    </>
  );
}

const el = document.getElementById("root");
if (el) createRoot(el).render(<App />);
