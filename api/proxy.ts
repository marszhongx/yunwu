export const config = { runtime: "edge" };

const FORWARD_HEADER_BLOCKLIST = new Set([
  "host",
  "connection",
  "content-length",
  "cookie",
  "x-proxy-target",
  "forwarded",
]);

const FORWARD_HEADER_BLOCKED_PREFIXES = ["x-forwarded-", "x-vercel-", "cf-"];

function forwardHeaders(request: Request): Headers {
  const headers = new Headers();
  request.headers.forEach((value, name) => {
    if (FORWARD_HEADER_BLOCKLIST.has(name)) return;
    if (FORWARD_HEADER_BLOCKED_PREFIXES.some((prefix) => name.startsWith(prefix))) return;
    headers.set(name, value);
  });
  return headers;
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
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

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (request.method !== "POST") {
    return jsonError(405, "代理仅支持 POST 请求");
  }

  const target = request.headers.get("x-proxy-target") ?? "";

  let targetUrl: URL;
  try {
    targetUrl = new URL(target);
  } catch {
    return jsonError(400, "缺少或非法的目标地址(x-proxy-target)");
  }

  if (targetUrl.protocol !== "https:") {
    return jsonError(400, "目标地址必须使用 HTTPS");
  }

  if (!isAllowedHost(targetUrl.hostname, allowedHosts())) {
    return jsonError(
      403,
      `目标域名 ${targetUrl.hostname} 不在代理白名单中,可在部署环境变量 PROXY_ALLOWED_HOSTS 中追加(逗号分隔,"*" 表示不限制)`,
    );
  }

  const headers = forwardHeaders(request);

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl.toString(), {
      method: "POST",
      headers,
      body: request.body,
      signal: request.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return new Response(null, { status: 499 });
    }

    return jsonError(
      502,
      `代理请求上游失败:${error instanceof Error ? error.message : "未知错误"}`,
    );
  }

  const responseHeaders = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType !== null) {
    responseHeaders.set("content-type", contentType);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
