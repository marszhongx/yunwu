import { getSettings } from "@/services/settings";

export const PROXY_PATH = "/api/proxy";

export type ProxiedRequest = {
  url: string;
  init: RequestInit;
};

export function wrapRequestForProxy(targetUrl: string, init: RequestInit): ProxiedRequest {
  const headers = new Headers(init.headers);
  headers.set("x-proxy-target", targetUrl);
  return { url: PROXY_PATH, init: { ...init, headers } };
}

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
