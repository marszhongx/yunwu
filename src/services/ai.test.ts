import { afterEach, describe, expect, test, vi } from "vitest";
import { ImageProviderType, ProviderType } from "@/constants";
import type { ProviderSettings } from "@/types";
import {
  type AssistantMessage,
  streamAssistantText,
  streamAssistantTextRequest,
  requestAssistantText,
  generateImage,
} from "@/services/ai";

type FetchMock = ReturnType<typeof vi.fn>;

const encoder = new TextEncoder();

function provider(overrides: Partial<ProviderSettings> = {}): ProviderSettings {
  return {
    id: "provider-1",
    name: "Provider",
    type: ProviderType.OPENAI,
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

  test("streams reasoning separately before content, including split SSE events", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          streamResponse([
            'data: {"choices":[{"delta":{"role":"assistant","content":null}}]}\n\n',
            'data: {"choices":[{"delta":{"reasoning_con',
            'tent":"先分析","content":null}}]}\n\n',
            'data: {"choices":[{"delta":{"reasoning_content":"场景。","content":"<content>"}}]}\n\n',
            'data: {"choices":[{"delta":{"content":"雾来了</content>"}}]}\n\n',
            "data: [DONE]\n\n",
          ]),
        ),
    );
    const events: string[] = [];

    const result = await streamAssistantText({
      provider: provider(),
      messages: [{ role: "user", content: "继续" }],
      onReasoning: (text) => events.push(`reasoning:${text}`),
      onText: (text) => events.push(`content:${text}`),
    });

    expect(events).toEqual([
      "reasoning:先分析",
      "reasoning:场景。",
      "content:<content>",
      "content:雾来了</content>",
    ]);
    expect(result).toEqual({ text: "<content>雾来了</content>" });
  });

  test.each([
    ['data: {"choices":[{"delta":{"reasoning_content":"还在思考"}}]}', "还在思考", ""],
    [
      '{"choices":[{"message":{"reasoning_content":"分析完成","content":"正文"}}]}',
      "分析完成",
      "正文",
    ],
  ])(
    "reads reasoning from a final event or JSON fallback: %s",
    async (payload, reasoning, text) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamResponse([payload])));
      const reasoningChunks: string[] = [];

      const result = await streamAssistantText({
        provider: provider(),
        messages: [{ role: "user", content: "继续" }],
        onReasoning: (chunk) => reasoningChunks.push(chunk),
      });

      expect(reasoningChunks).toEqual([reasoning]);
      expect(result).toEqual({ text });
    },
  );

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

  test("streams OpenAI Responses output_text deltas with instructions", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        streamResponse([
          'data: {"type":"response.output_text.delta","delta":"你"}\n\n',
          'data: {"type":"response.output_text.delta","delta":"好"}\n\n',
          'data: {"type":"response.completed","response":{}}\n\n',
        ]),
      ) as FetchMock;
    vi.stubGlobal("fetch", fetchMock);

    const result = await streamAssistantText({
      provider: provider({ type: ProviderType.OPENAI_RESPONSE, model: "gpt-5.1" }),
      messages: [
        { role: "system", content: "规则" },
        { role: "user", content: "开始" },
        { role: "assistant", content: "继续" },
      ],
    });

    expect(result).toEqual({ text: "你好" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/v1/responses",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer api-key",
        },
        body: JSON.stringify({
          model: "gpt-5.1",
          instructions: "规则",
          input: [
            { role: "user", content: "开始" },
            { role: "assistant", content: "继续" },
          ],
          stream: true,
        }),
      }),
    );
  });

  test("falls back to the official OpenAI endpoint when base URL is empty", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        streamResponse([
          'data: {"choices":[{"delta":{"content":"好"}}]}\n\n',
          "data: [DONE]\n\n",
        ]),
      ) as FetchMock;
    vi.stubGlobal("fetch", fetchMock);

    await streamAssistantText({
      provider: provider({ type: ProviderType.OPENAI, baseUrl: " " }),
      messages: [{ role: "user", content: "hello" }],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.anything(),
    );
  });

  test("sends OpenAI chat completions request body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        streamResponse([
          'data: {"choices":[{"delta":{"content":"回应"}}]}\n\n',
          "data: [DONE]\n\n",
        ]),
      ) as FetchMock;
    vi.stubGlobal("fetch", fetchMock);

    const result = await streamAssistantText({
      provider: provider({ type: ProviderType.OPENAI, model: "gpt-4o" }),
      messages: [
        { role: "system", content: "系统规则" },
        { role: "user", content: "开始" },
        { role: "assistant", content: "继续" },
      ],
    });

    expect(result).toEqual({ text: "回应" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.com/v1/chat/completions");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer api-key");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "系统规则" },
        { role: "user", content: "开始" },
        { role: "assistant", content: "继续" },
      ],
      stream: true,
    });
  });

  test("throws provider request error for non-ok responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad key", { status: 401 })));

    await expect(
      streamAssistantText({ provider: provider(), messages: [{ role: "user", content: "hello" }] }),
    ).rejects.toThrow("Provider 请求失败：401 bad key");
  });

  test("returns a cancellable request handle for stopping streaming", async () => {
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    ) as FetchMock;
    vi.stubGlobal("fetch", fetchMock);

    const request = streamAssistantTextRequest({
      provider: provider(),
      messages: [{ role: "user", content: "hello" }],
    });
    request.abort();

    await expect(request.promise).rejects.toThrow(DOMException);
  });

  test("does not throw when the final SSE event has no trailing blank line", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          streamResponse([
            'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n',
            "data: [DONE]\n",
          ]),
        ),
    );

    const result = await streamAssistantText({
      provider: provider(),
      messages: [{ role: "user", content: "hello" }],
    });

    expect(result).toEqual({ text: "" });
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

describe.each([true, false])("Chat Completions system messages (stream: %s)", (stream) => {
  test.each<{
    name: string;
    messages: AssistantMessage[];
    expected: AssistantMessage[];
  }>([
    {
      name: "merges system content in order before the unchanged conversation",
      messages: [
        { role: "system", content: "叙事规则" },
        { role: "system", content: "<content>正文</content>\n<summary>摘要</summary>" },
        { role: "system", content: "角色设定\n世界书内容" },
        { role: "assistant", content: "你来到驿站。" },
        { role: "user", content: "推门进入" },
      ],
      expected: [
        {
          role: "system",
          content:
            "叙事规则\n\n<content>正文</content>\n<summary>摘要</summary>\n\n角色设定\n世界书内容",
        },
        { role: "assistant", content: "你来到驿站。" },
        { role: "user", content: "推门进入" },
      ],
    },
    {
      name: "places interleaved system content first without reordering conversation turns",
      messages: [
        { role: "user", content: "开始" },
        { role: "system", content: "规则" },
        { role: "assistant", content: "继续" },
        { role: "system", content: "背景" },
        { role: "user", content: "前进" },
      ],
      expected: [
        { role: "system", content: "规则\n\n背景" },
        { role: "user", content: "开始" },
        { role: "assistant", content: "继续" },
        { role: "user", content: "前进" },
      ],
    },
    {
      name: "does not add a system message when none is provided",
      messages: [
        { role: "assistant", content: "开场白" },
        { role: "user", content: "开始" },
      ],
      expected: [
        { role: "assistant", content: "开场白" },
        { role: "user", content: "开始" },
      ],
    },
    {
      name: "preserves a single system message including whitespace",
      messages: [
        { role: "system", content: "  规则\n" },
        { role: "user", content: "开始" },
      ],
      expected: [
        { role: "system", content: "  规则\n" },
        { role: "user", content: "开始" },
      ],
    },
    {
      name: "preserves an explicitly empty system message",
      messages: [
        { role: "system", content: "" },
        { role: "user", content: "开始" },
      ],
      expected: [
        { role: "system", content: "" },
        { role: "user", content: "开始" },
      ],
    },
  ])("$name", async ({ messages, expected }) => {
    const originalMessages = messages.map((message) => ({ ...message }));
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        stream
          ? streamResponse(['data: {"choices":[{"delta":{"content":"回应"}}]}\n\n'])
          : jsonResponse({ choices: [{ message: { content: "回应" } }] }),
      ) as FetchMock;
    vi.stubGlobal("fetch", fetchMock);

    const request = stream ? streamAssistantText : requestAssistantText;
    const result = await request({ provider: provider(), messages });

    expect(result).toEqual({ text: "回应" });
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init.body)).messages).toEqual(expected);
    expect(messages).toEqual(originalMessages);
  });
});

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

  test("requests OpenAI Responses with stream false and parses output items", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        output: [
          { type: "reasoning" },
          {
            type: "message",
            content: [{ type: "output_text", text: '{"name":"测试"}' }],
          },
        ],
      }),
    ) as FetchMock;
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestAssistantText({
      provider: provider({ type: ProviderType.OPENAI_RESPONSE, model: "gpt-5.1" }),
      messages: [
        { role: "system", content: "输出 JSON" },
        { role: "user", content: "生成角色" },
      ],
    });

    expect(result).toEqual({ text: '{"name":"测试"}' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.com/v1/responses");
    const body = JSON.parse(String(init.body));
    expect(body).toEqual({
      model: "gpt-5.1",
      instructions: "输出 JSON",
      input: [{ role: "user", content: "生成角色" }],
      stream: false,
    });
  });

  test("requests OpenAI with json responseMimeType and no streaming URL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ choices: [{ message: { content: '{"name":"测试"}' } }] }),
      ) as FetchMock;
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestAssistantText({
      provider: provider({ type: ProviderType.OPENAI, model: "gpt-4o" }),
      messages: [
        { role: "system", content: "输出 JSON" },
        { role: "user", content: "生成角色" },
      ],
    });

    expect(result).toEqual({ text: '{"name":"测试"}' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("chat/completions");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer api-key");
    const body = JSON.parse(String(init.body));
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  test("throws on empty response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: "" } }] })),
    );

    await expect(
      requestAssistantText({
        provider: provider(),
        messages: [{ role: "user", content: "hello" }],
      }),
    ).rejects.toThrow("Provider 返回了空响应");
  });

  test("throws on non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad key", { status: 401 })));

    await expect(
      requestAssistantText({
        provider: provider(),
        messages: [{ role: "user", content: "hello" }],
      }),
    ).rejects.toThrow("Provider 请求失败：401 bad key");
  });
});

describe("generateImage", () => {
  test("generates image via chat completions and returns image URL", async () => {
    const imageUrl = "https://pub.example.com/generated.jpg";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({
          choices: [{ message: { content: [{ type: "image_url", image_url: { url: imageUrl } }] } }],
        }),
      ) as FetchMock;
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateImage({
      apiKey: "test-key",
      baseUrl: "https://api.example.com/v1",
      model: "gpt-4o",
      prompt: "a cat",
    });

    expect(result).toBe(imageUrl);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.com/v1/chat/completions");
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      model: "gpt-4o",
      messages: [{ role: "user", content: "a cat" }],
    });
  });

  test("defaults base URL to openai for chat completions", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({
          choices: [{ message: { content: [{ type: "image_url", image_url: { url: "u" } }] } }],
        }),
      ) as FetchMock;
    vi.stubGlobal("fetch", fetchMock);

    await generateImage({ apiKey: "k", baseUrl: "", model: "m", prompt: "p" });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
  });

  test("generates image via responses API", async () => {
    const imageUrl = "https://pub.example.com/generated.jpg";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({
          output: [
            { type: "message", content: [{ type: "image_url", image_url: { url: imageUrl } }] },
          ],
        }),
      ) as FetchMock;
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateImage({
      apiKey: "test-key",
      baseUrl: "https://api.example.com/v1",
      model: "gpt-5.1",
      prompt: "a cat",
      type: ImageProviderType.OPENAI_RESPONSE,
    });

    expect(result).toBe(imageUrl);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.com/v1/responses");
    const body = JSON.parse(init.body);
    expect(body).toEqual({ model: "gpt-5.1", input: "a cat" });
  });

  test("throws on API error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("bad request", { status: 400 })) as FetchMock;
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generateImage({ apiKey: "k", baseUrl: "", model: "m", prompt: "p" }),
    ).rejects.toThrow("图片生成请求失败：400 bad request");
  });

  test("throws on empty response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ choices: [{ message: { content: [] } }] })) as FetchMock;
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generateImage({ apiKey: "k", baseUrl: "", model: "m", prompt: "p" }),
    ).rejects.toThrow("图片生成返回了空响应");
  });
});
