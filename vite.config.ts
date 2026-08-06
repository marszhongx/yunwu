import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { EnvHttpProxyAgent, fetch as upstreamFetch, type Dispatcher } from "undici";

// Node 内置 fetch 不认 HTTP(S)_PROXY;使用 undici 自带的 fetch + EnvHttpProxyAgent,
// 避免与 Node 内置 undici 的 Dispatcher API 版本不匹配
const upstreamDispatcher: Dispatcher = new EnvHttpProxyAgent();

// 本地开发用的 /api/proxy 中间件,行为与 api/proxy.ts(Edge Function)一致
const FORWARD_HEADER_WHITELIST = [
  "content-type",
  "accept",
  "authorization",
  "x-api-key",
  "anthropic-version",
  "anthropic-beta",
  "anthropic-dangerous-direct-browser-access",
];

const DEFAULT_ALLOWED_HOSTS = [
  "api.openai.com",
  "generativelanguage.googleapis.com",
  "api.anthropic.com",
];

function allowedHosts(): string[] | "*" {
  const raw = (process.env.PROXY_ALLOWED_HOSTS ?? "").trim();
  if (raw === "*") return "*";
  if (raw === "") return DEFAULT_ALLOWED_HOSTS;
  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedHost(hostname: string, hosts: string[] | "*"): boolean {
  if (hosts === "*") return true;
  const lower = hostname.toLowerCase();
  return hosts.some((host) => lower === host || lower.endsWith(`.${host}`));
}

function respondError(res: ServerResponse, status: number, message: string): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: message }));
}

async function handleDevProxy(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") {
    respondError(res, 405, "代理仅支持 POST 请求");
    return;
  }

  const targetHeader = req.headers["x-proxy-target"];
  const target = Array.isArray(targetHeader) ? targetHeader[0] : targetHeader;

  let targetUrl: URL;
  try {
    targetUrl = new URL(target ?? "");
  } catch {
    respondError(res, 400, "缺少或非法的目标地址(x-proxy-target)");
    return;
  }

  if (targetUrl.protocol !== "https:") {
    respondError(res, 400, "目标地址必须使用 HTTPS");
    return;
  }

  if (!isAllowedHost(targetUrl.hostname, allowedHosts())) {
    respondError(res, 403, `目标域名 ${targetUrl.hostname} 不在代理白名单中`);
    return;
  }

  const headers: Record<string, string> = {};
  for (const name of FORWARD_HEADER_WHITELIST) {
    const value = req.headers[name];
    if (typeof value === "string" && value !== "") {
      headers[name] = value;
    }
  }

  const controller = new AbortController();
  res.once("close", () => {
    if (!res.writableFinished) controller.abort();
  });

  try {
    const upstream = await upstreamFetch(targetUrl.toString(), {
      method: "POST",
      headers,
      body: req,
      duplex: "half",
      signal: controller.signal,
      dispatcher: upstreamDispatcher,
    });

    res.statusCode = upstream.status;
    const contentType = upstream.headers.get("content-type");
    if (contentType !== null) {
      res.setHeader("content-type", contentType);
    }

    if (upstream.body === null) {
      res.end();
      return;
    }

    Readable.fromWeb(
      upstream.body as unknown as import("node:stream/web").ReadableStream<Uint8Array>,
    ).pipe(res);
  } catch (error) {
    if (controller.signal.aborted) return;
    const cause =
      error instanceof Error && error.cause instanceof Error
        ? ` (${error.cause.message} ${(error.cause as NodeJS.ErrnoException).code ?? ""})`
        : "";
    respondError(
      res,
      502,
      `代理请求上游失败:${error instanceof Error ? error.message : "未知错误"}${cause}`,
    );
  }
}

function devApiProxyPlugin(): Plugin {
  return {
    name: "yunwu-dev-api-proxy",
    configureServer(server) {
      server.middlewares.use("/api/proxy", (req, res) => {
        void handleDevProxy(req, res);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devApiProxyPlugin()],
  resolve: { alias: { "@": path.resolve(process.cwd(), "src") } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    passWithNoTests: true,
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
