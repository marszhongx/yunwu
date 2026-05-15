import { afterEach, describe, expect, test, vi } from "vitest";
import type { ProviderSettings } from "../domain/types";
import { streamAssistantText, requestAssistantText } from "./ai";

type FetchMock = ReturnType<typeof vi.fn>;

const encoder = new TextEncoder();

function provider(overrides: Partial<ProviderSettings> = {}): ProviderSettings {
  return {
    id: "provider-1",
    name: "Provider",
    provider: "openai",
    apiKey: "api-key",
    baseUrl: "https://example.com/v1/",
    model: "model-name",
    ...overrides,
  };
}

function streamResponse(chunks: string[], init: ResponseInit = {}): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(stream, { status: 200, ...init });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("streamAssistantText", () => {
  test("streams OpenAI-compatible chunks and returns concatenated text", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        streamResponse([
          'data: {"choices":[{"delta":{"content":"你"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"好"}}]}\n\n',
          "data: [DONE]\n\n",
        ]),
      ) as FetchMock;
    vi.stubGlobal("fetch", fetchMock);
    const onText = vi.fn();

    const result = await streamAssistantText({
      provider: provider(),
      messages: [{ role: "user", content: "hello" }],
      onText,
    });

    expect(result).toEqual({ text: "你好" });
    expect(onText).toHaveBeenNthCalledWith(1, "你");
    expect(onText).toHaveBeenNthCalledWith(2, "好");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer api-key",
        },
        body: JSON.stringify({
          model: "model-name",
          messages: [{ role: "user", content: "hello" }],
          stream: true,
        }),
      }),
    );
  });

  test("throws clear error when provider is missing", async () => {
    await expect(
      streamAssistantText({ provider: null, messages: [{ role: "user", content: "hello" }] }),
    ).rejects.toThrow("未配置 Provider");
  });

  test("validates missing api key and model", async () => {
    await expect(
      streamAssistantText({ provider: provider({ apiKey: "" }), messages: [] }),
    ).rejects.toThrow("Provider 缺少 API Key");
    await expect(
      streamAssistantText({ provider: provider({ model: "" }), messages: [] }),
    ).rejects.toThrow("Provider 缺少模型名");
  });

  test("sends Claude system messages separately and streams content deltas", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        streamResponse([
          'data: {"type":"content_block_delta","delta":{"text":"旁白"}}\n\n',
          "data: [DONE]\n\n",
        ]),
      ) as FetchMock;
    vi.stubGlobal("fetch", fetchMock);

    const result = await streamAssistantText({
      provider: provider({ provider: "claude", model: "claude-3-5-sonnet" }),
      messages: [
        { role: "system", content: "规则一" },
        { role: "system", content: "规则二" },
        { role: "user", content: "开始" },
        { role: "assistant", content: "好的" },
      ],
    });

    expect(result).toEqual({ text: "旁白" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "api-key",
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet",
          system: [
            { type: "text", text: "规则一" },
            { type: "text", text: "规则二", cache_control: { type: "ephemeral" } },
          ],
          messages: [
            { role: "user", content: "开始" },
            { role: "assistant", content: "好的" },
          ],
          stream: true,
        }),
      }),
    );
  });

  test("sends Gemini safety settings at the request body top level", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        streamResponse([
          'data: {"candidates":[{"content":{"parts":[{"text":"回应"}]}}]}\n\n',
          "data: [DONE]\n\n",
        ]),
      ) as FetchMock;
    vi.stubGlobal("fetch", fetchMock);

    const result = await streamAssistantText({
      provider: provider({ provider: "gemini", model: "gemini-2.5-pro" }),
      messages: [
        { role: "system", content: "系统规则" },
        { role: "user", content: "开始" },
        { role: "assistant", content: "继续" },
      ],
    });

    expect(result).toEqual({ text: "回应" });
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      contents: [
        { role: "user", parts: [{ text: "开始" }] },
        { role: "model", parts: [{ text: "继续" }] },
      ],
      systemInstruction: { parts: [{ text: "系统规则" }] },
      generationConfig: {},
    });
    expect(body.safetySettings).toEqual([
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" },
    ]);
    expect(body.google).toBeUndefined();
  });

  test("throws provider request error for non-ok responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad key", { status: 401 })));

    await expect(
      streamAssistantText({ provider: provider(), messages: [{ role: "user", content: "hello" }] }),
    ).rejects.toThrow("Provider 请求失败：401 bad key");
  });

  test("throws clear provider response error for malformed SSE JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamResponse(["data: {bad-json}\n\n"])));

    await expect(
      streamAssistantText({ provider: provider(), messages: [{ role: "user", content: "hello" }] }),
    ).rejects.toThrow("Provider 响应解析失败");
  });
});

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("requestAssistantText", () => {
  test("requests OpenAI with json_object response format and stream false", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ choices: [{ message: { content: '{"name":"测试"}' } }] }),
      ) as FetchMock;
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestAssistantText({
      provider: provider(),
      messages: [
        { role: "system", content: "输出 JSON" },
        { role: "user", content: "生成角色" },
      ],
    });

    expect(result).toEqual({ text: '{"name":"测试"}' });
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init.body));
    expect(body.stream).toBe(false);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  test("requests Claude with stream false", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ content: [{ type: "text", text: '{"name":"测试"}' }] }),
      ) as FetchMock;
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestAssistantText({
      provider: provider({ provider: "claude", model: "claude-3-5-sonnet" }),
      messages: [
        { role: "system", content: "输出 JSON" },
        { role: "user", content: "生成角色" },
      ],
    });

    expect(result).toEqual({ text: '{"name":"测试"}' });
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init.body));
    expect(body.stream).toBe(false);
    expect(body.system).toEqual([
      { type: "text", text: "输出 JSON", cache_control: { type: "ephemeral" } },
    ]);
  });

  test("requests Gemini with json responseMimeType and no streaming URL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ candidates: [{ content: { parts: [{ text: '{"name":"测试"}' }] } }] }),
      ) as FetchMock;
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestAssistantText({
      provider: provider({ provider: "gemini", model: "gemini-2.5-pro" }),
      messages: [
        { role: "system", content: "输出 JSON" },
        { role: "user", content: "生成角色" },
      ],
    });

    expect(result).toEqual({ text: '{"name":"测试"}' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("generateContent");
    expect(url).not.toContain("streamGenerateContent");
    const body = JSON.parse(String(init.body));
    expect(body.generationConfig.responseMimeType).toBe("application/json");
  });

  test("throws on empty response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: "" } }] })),
    );

    await expect(
      requestAssistantText({ provider: provider(), messages: [{ role: "user", content: "hello" }] }),
    ).rejects.toThrow("Provider 返回了空响应");
  });

  test("throws on non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad key", { status: 401 })));

    await expect(
      requestAssistantText({ provider: provider(), messages: [{ role: "user", content: "hello" }] }),
    ).rejects.toThrow("Provider 请求失败：401 bad key");
  });
});
