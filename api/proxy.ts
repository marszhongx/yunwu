// Vercel Edge Function:LLM API 转发代理(哑管道)。
// 不解析、不存储任何请求数据;API Key 只存于用户浏览器,逐请求以 header 形式穿过。
// 安全约束:
// - 目标 URL 通过 x-proxy-target 请求头传递,避免 Key 出现在访问日志的 query 里
// - 目标域名白名单,环境变量 PROXY_ALLOWED_HOSTS(逗号分隔,"*" 不限制;默认官方三家)
// - 上行请求头走白名单,cookie / host 等不透传

export const config = { runtime: "edge" };

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

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

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

  const headers = new Headers();
  for (const name of FORWARD_HEADER_WHITELIST) {
    const value = request.headers.get(name);
    if (value !== null) {
      headers.set(name, value);
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl.toString(), {
      method: "POST",
      headers,
      body: request.body,
      signal: request.signal,
    });
  } catch (error) {
    // 客户端主动断开:无需构造响应
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
