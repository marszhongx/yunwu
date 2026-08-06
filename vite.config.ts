import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { EnvHttpProxyAgent, fetch as upstreamFetch, type Dispatcher } from "undici";

const upstreamDispatcher: Dispatcher = new EnvHttpProxyAgent();

const FORWARD_HEADER_BLOCKLIST = new Set([
  "host",
  "connection",
  "content-length",
  "cookie",
  "x-proxy-target",
  "forwarded",
]);

const FORWARD_HEADER_BLOCKED_PREFIXES = ["x-forwarded-", "x-vercel-", "cf-"];

function forwardHeaders(req: IncomingMessage): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (FORWARD_HEADER_BLOCKLIST.has(name)) continue;
    if (FORWARD_HEADER_BLOCKED_PREFIXES.some((prefix) => name.startsWith(prefix))) continue;
    headers[name] = Array.isArray(value) ? value.join(", ") : value;
  }
  return headers;
}

function allowedHosts(): string[] | "*" {
  const raw = (process.env.PROXY_ALLOWED_HOSTS ?? "").trim();
  if (raw === "" || raw === "*") return "*";
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
    respondError(
      res,
      403,
      `目标域名 ${targetUrl.hostname} 不在代理白名单中,可在 PROXY_ALLOWED_HOSTS 中追加`,
    );
    return;
  }

  const headers = forwardHeaders(req);

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
