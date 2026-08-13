import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fetchWithOptionalProxy, PROXY_PATH, wrapRequestForProxy } from "@/services/proxy";
import { getSettings, saveUseProxy } from "@/services/settings";

const TARGET_URL = "https://api.example.com/v1/chat/completions";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("proxy service", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("wrapRequestForProxy preserves headers, body and signal", () => {
    const controller = new AbortController();
    const init: RequestInit = {
      method: "POST",
      headers: { Authorization: "Bearer key", "Content-Type": "application/json" },
      body: "{}",
      signal: controller.signal,
    };

    const wrapped = wrapRequestForProxy(TARGET_URL, init);

    expect(wrapped.url).toBe(PROXY_PATH);
    const headers = new Headers(wrapped.init.headers);
    expect(headers.get("x-proxy-target")).toBe(TARGET_URL);
    expect(headers.get("authorization")).toBe("Bearer key");
    expect(headers.get("content-type")).toBe("application/json");
    expect(wrapped.init.body).toBe("{}");
    expect(wrapped.init.signal).toBe(controller.signal);
    expect(new Headers(init.headers).has("x-proxy-target")).toBe(false);
  });

  test("proxies the request when useProxy is enabled", async () => {
    await saveUseProxy(true);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchWithOptionalProxy(TARGET_URL, { method: "POST" });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstCall = fetchMock.mock.calls[0] ?? [];
    expect(firstCall[0]).toBe(PROXY_PATH);
    const headers = new Headers((firstCall[1] as RequestInit).headers);
    expect(headers.get("x-proxy-target")).toBe(TARGET_URL);
  });

  test("fetches directly when useProxy is disabled", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchWithOptionalProxy(TARGET_URL, { method: "POST" });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(TARGET_URL);
    expect(getSettings().useProxy).toBe(false);
  });

  test("network errors propagate without proxy retry", async () => {
    const corsError = new TypeError("Failed to fetch");
    const fetchMock = vi.fn().mockRejectedValue(corsError);
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchWithOptionalProxy(TARGET_URL, { method: "POST" })).rejects.toBe(corsError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(TARGET_URL);
    expect(getSettings().useProxy).toBe(false);
  });
});
