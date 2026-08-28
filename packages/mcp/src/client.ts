/**
 * AgentSignal REST 客户端 —— MCP 工具的唯一出海口。
 *
 * 铁律（agent-access-host-agnostic 决议）：MCP 仅是 REST 的镜像，不新增任何语义。
 * 环境变量：AGENTSIGNAL_BASE_URL（默认 http://localhost:3000）· AGENTSIGNAL_TOKEN（发布/回流需要）。
 */
export interface RestOptions {
  baseUrl?: string;
  token?: string;
  fetchImpl?: typeof fetch;
}

export class RestClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly doFetch: typeof fetch;

  constructor(opts: RestOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? process.env.AGENTSIGNAL_BASE_URL ?? "http://localhost:3000")
      .trim()
      .replace(/\/+$/, "");
    this.token = opts.token ?? process.env.AGENTSIGNAL_TOKEN;
    this.doFetch = opts.fetchImpl ?? fetch;
  }

  async request(path: string, init: { method?: string; body?: unknown } = {}): Promise<unknown> {
    const res = await this.doFetch(`${this.baseUrl}${path}`, {
      method: init.method ?? "GET",
      headers: {
        accept: "application/json",
        ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
      },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* 非 JSON（如 markdown 端点）原样返回文本 */
    }
    if (!res.ok) {
      const message =
        (parsed as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
      throw new Error(message);
    }
    return parsed;
  }
}
