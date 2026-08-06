import { getSettings } from "@/services/settings";

export const PROXY_PATH = "/api/proxy";

export type ProxiedRequest = {
  url: string;
  init: RequestInit;
};

// 把一次直连请求包装成同源的代理请求;目标 URL 放进 header,避免 Key 进入代理日志
export function wrapRequestForProxy(targetUrl: string, init: RequestInit): ProxiedRequest {
  const headers = new Headers(init.headers);
  headers.set("x-proxy-target", targetUrl);
  return { url: PROXY_PATH, init: { ...init, headers } };
}

// 用户显式开启代理开关才走 /api/proxy,否则直连(不做自动降级)
export async function fetchWithOptionalProxy(
  url: string,
  init: RequestInit,
): Promise<Response> {
  if (!getSettings().useProxy) {
    return await fetch(url, init);
  }

  const proxied = wrapRequestForProxy(url, init);
  return await fetch(proxied.url, proxied.init);
}
