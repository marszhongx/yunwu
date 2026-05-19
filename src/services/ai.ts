import { GEMINI_SAFETY_SETTINGS, IMAGE_TIMEOUT, STREAM_TIMEOUT } from "../domain/constants";
import type { ProviderSettings, ProviderType } from "../domain/types";

export type AssistantMessageRole = "system" | "user" | "assistant";

export type AssistantMessage = {
  role: AssistantMessageRole;
  content: string;
};

type ProviderLike = Partial<ProviderSettings> & {
  provider?: ProviderType;
};

type StreamAssistantTextInput = {
  provider: ProviderLike | null;
  messages: AssistantMessage[];
  onText?: (text: string) => void;
};

type StreamRequest = {
  url: string;
  init: RequestInit;
  extractText: (payload: unknown) => string;
};

function validateProvider(provider: ProviderLike | null): ProviderLike & {
  provider: ProviderType;
  apiKey: string;
  model: string;
} {
  if (provider === null) {
    throw new Error("未配置 Provider");
  }

  if (!provider.apiKey) {
    throw new Error("Provider 缺少 API Key");
  }

  if (!provider.model) {
    throw new Error("Provider 缺少模型名");
  }

  return {
    ...provider,
    provider: provider.provider ?? "gemini",
    apiKey: provider.apiKey,
    model: provider.model,
  };
}

function textFromRecordPath(value: unknown, path: string[]): unknown {
  return path.reduce<unknown>((current, key) => {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }

    return (current as Record<string, unknown>)[key];
  }, value);
}

function getOpenAIText(payload: unknown): string {
  const choices = textFromRecordPath(payload, ["choices"]);
  const firstChoice = Array.isArray(choices) ? choices[0] : undefined;
  const content =
    textFromRecordPath(firstChoice, ["delta", "content"]) ??
    textFromRecordPath(firstChoice, ["message", "content"]);
  return typeof content === "string" ? content : "";
}

function getClaudeText(payload: unknown): string {
  const type = textFromRecordPath(payload, ["type"]);

  if (type !== "content_block_delta") {
    return "";
  }

  const text = textFromRecordPath(payload, ["delta", "text"]);
  return typeof text === "string" ? text : "";
}

function getGeminiText(payload: unknown): string {
  const parts = textFromRecordPath(payload, ["candidates"]);
  const firstCandidate = Array.isArray(parts) ? parts[0] : undefined;
  const contentParts = textFromRecordPath(firstCandidate, ["content", "parts"]);

  if (!Array.isArray(contentParts)) {
    return "";
  }

  return contentParts
    .map((part) => {
      const text = textFromRecordPath(part, ["text"]);
      return typeof text === "string" ? text : "";
    })
    .join("");
}

function normalizedOpenAIBaseUrl(baseUrl: string): string {
  return (baseUrl.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
}

export function openAIChatCompletionsUrl(baseUrl: string): string {
  return `${normalizedOpenAIBaseUrl(baseUrl)}/chat/completions`;
}

export function openAIImagesGenerationsUrl(baseUrl: string): string {
  return `${normalizedOpenAIBaseUrl(baseUrl)}/images/generations`;
}

function openAIRequest(
  provider: ProviderLike & { apiKey: string; model: string },
  messages: AssistantMessage[],
): StreamRequest {
  return {
    url: openAIChatCompletionsUrl(provider.baseUrl || ""),
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        stream: true,
        ...(provider.maxTokens ? { max_tokens: provider.maxTokens } : {}),
      }),
    },
    extractText: getOpenAIText,
  };
}

function claudeSystemBlocks(messages: AssistantMessage[]): { type: "text"; text: string; cache_control?: { type: "ephemeral" } }[] {
  const systemMessages = messages.filter((message) => message.role === "system");

  return systemMessages.map((message, index) => ({
    type: "text" as const,
    text: message.content,
    ...(index === systemMessages.length - 1 ? { cache_control: { type: "ephemeral" as const } } : {}),
  }));
}

function claudeRequest(
  provider: ProviderLike & { apiKey: string; model: string },
  messages: AssistantMessage[],
): StreamRequest {
  const system = claudeSystemBlocks(messages);
  const userMessages = messages.filter((message) => message.role !== "system");

  return {
    url: "https://api.anthropic.com/v1/messages",
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": provider.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: provider.model,
        system,
        messages: userMessages,
        stream: true,
        ...(provider.maxTokens ? { max_tokens: provider.maxTokens } : {}),
      }),
    },
    extractText: getClaudeText,
  };
}

function geminiRequest(
  provider: ProviderLike & { apiKey: string; model: string },
  messages: AssistantMessage[],
): StreamRequest {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const contents = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));

  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(provider.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(provider.apiKey)}`,
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: system }] },
        safetySettings: GEMINI_SAFETY_SETTINGS.google.safetySettings,
        generationConfig: provider.maxTokens ? { maxOutputTokens: provider.maxTokens } : {},
      }),
    },
    extractText: getGeminiText,
  };
}

function createRequest(
  provider: ProviderLike & { provider: ProviderType; apiKey: string; model: string },
  messages: AssistantMessage[],
): StreamRequest {
  if (provider.provider === "openai") {
    return openAIRequest(provider, messages);
  }

  if (provider.provider === "claude") {
    return claudeRequest(provider, messages);
  }

  return geminiRequest(provider, messages);
}

type NonStreamRequest = {
  url: string;
  init: RequestInit;
  responseText: (json: unknown) => string;
};

function openAINonStreamRequest(
  provider: ProviderLike & { apiKey: string; model: string },
  messages: AssistantMessage[],
): NonStreamRequest {
  return {
    url: openAIChatCompletionsUrl(provider.baseUrl || ""),
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        stream: false,
        response_format: { type: "json_object" },
        ...(provider.maxTokens ? { max_tokens: provider.maxTokens } : {}),
      }),
    },
    responseText: (json) => {
      const choices = textFromRecordPath(json, ["choices"]);
      const firstChoice = Array.isArray(choices) ? choices[0] : undefined;
      const content = textFromRecordPath(firstChoice, ["message", "content"]);
      return typeof content === "string" ? content : "";
    },
  };
}

function claudeNonStreamRequest(
  provider: ProviderLike & { apiKey: string; model: string },
  messages: AssistantMessage[],
): NonStreamRequest {
  const system = claudeSystemBlocks(messages);
  const userMessages = messages.filter((message) => message.role !== "system");

  return {
    url: "https://api.anthropic.com/v1/messages",
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": provider.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: provider.model,
        system,
        messages: userMessages,
        stream: false,
        ...(provider.maxTokens ? { max_tokens: provider.maxTokens } : {}),
      }),
    },
    responseText: (json) => {
      if (typeof json !== "object" || json === null) return "";
      const content = (json as Record<string, unknown>).content;
      if (!Array.isArray(content)) return "";
      return content
        .filter((block): block is { type: string; text: string } =>
          typeof block === "object" && block !== null && (block as { type?: string }).type === "text",
        )
        .map((block) => block.text)
        .join("");
    },
  };
}

function geminiNonStreamRequest(
  provider: ProviderLike & { apiKey: string; model: string },
  messages: AssistantMessage[],
): NonStreamRequest {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const contents = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));

  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(provider.model)}:generateContent?key=${encodeURIComponent(provider.apiKey)}`,
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: system }] },
        safetySettings: GEMINI_SAFETY_SETTINGS.google.safetySettings,
        generationConfig: {
          ...(provider.maxTokens ? { maxOutputTokens: provider.maxTokens } : {}),
          responseMimeType: "application/json",
        },
      }),
    },
    responseText: (json) => {
      const candidates = textFromRecordPath(json, ["candidates"]);
      const firstCandidate = Array.isArray(candidates) ? candidates[0] : undefined;
      const parts = textFromRecordPath(firstCandidate, ["content", "parts"]);
      if (!Array.isArray(parts)) return "";
      return parts
        .map((part) => {
          const text = textFromRecordPath(part, ["text"]);
          return typeof text === "string" ? text : "";
        })
        .join("");
    },
  };
}

function createNonStreamRequest(
  provider: ProviderLike & { provider: ProviderType; apiKey: string; model: string },
  messages: AssistantMessage[],
): NonStreamRequest {
  if (provider.provider === "openai") {
    return openAINonStreamRequest(provider, messages);
  }

  if (provider.provider === "claude") {
    return claudeNonStreamRequest(provider, messages);
  }

  return geminiNonStreamRequest(provider, messages);
}

function parsePayload(payload: string): unknown {
  try {
    return JSON.parse(payload) as unknown;
  } catch (error) {
    throw new Error(
      `Provider 响应解析失败：${error instanceof Error ? error.message : "无效 JSON"}`,
    );
  }
}

function eventData(event: string): string[] {
  return event
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart());
}

async function readStream(
  body: ReadableStream<Uint8Array>,
  extractText: (payload: unknown) => string,
  onText?: (text: string) => void,
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  async function processEvent(event: string): Promise<void> {
    const payloads = eventData(event);

    for (const payloadText of payloads) {
      const trimmed = payloadText.trim();

      if (trimmed === "" || trimmed === "[DONE]") {
        continue;
      }

      const chunk = extractText(parsePayload(trimmed));

      if (chunk !== "") {
        text += chunk;
        onText?.(chunk);
      }
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() ?? "";

    for (const event of events) {
      await processEvent(event);
    }

    if (done) {
      break;
    }
  }

  if (buffer.trim() !== "") {
    await processEvent(buffer);
  }

  if (text === "" && buffer.trim() !== "") {
    const chunk = extractText(parsePayload(buffer.trim()));
    if (chunk !== "") {
      text = chunk;
      onText?.(chunk);
    }
  }

  return text;
}

export async function streamAssistantText({
  provider: inputProvider,
  messages,
  onText,
}: StreamAssistantTextInput): Promise<{ text: string }> {
  const provider = validateProvider(inputProvider);
  const request = createRequest(provider, messages);
  const abortController = new AbortController();
  const timeoutId = globalThis.setTimeout(() => abortController.abort(), STREAM_TIMEOUT);

  try {
    const response = await fetch(request.url, {
      ...request.init,
      signal: abortController.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Provider 请求失败：${response.status} ${errorText}`.trim());
    }

    if (response.body === null) {
      throw new Error("Provider 未返回流式响应");
    }

    return { text: await readStream(response.body, request.extractText, onText) };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Provider 请求超时");
    }

    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

export async function requestAssistantText({
  provider: inputProvider,
  messages,
}: {
  provider: ProviderLike | null;
  messages: AssistantMessage[];
}): Promise<{ text: string }> {
  const provider = validateProvider(inputProvider);
  const request = createNonStreamRequest(provider, messages);
  const abortController = new AbortController();
  const timeoutId = globalThis.setTimeout(() => abortController.abort(), STREAM_TIMEOUT);

  try {
    const response = await fetch(request.url, {
      ...request.init,
      signal: abortController.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Provider 请求失败：${response.status} ${errorText}`.trim());
    }

    const json = (await response.json()) as unknown;
    const text = request.responseText(json);

    if (!text) {
      throw new Error("Provider 返回了空响应");
    }

    return { text };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Provider 请求超时");
    }

    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

export async function generateImage({
  apiKey,
  baseUrl,
  model,
  prompt,
}: {
  apiKey: string;
  baseUrl: string;
  model: string;
  prompt: string;
}): Promise<string> {
  const url = openAIImagesGenerationsUrl(baseUrl);
  const abortController = new AbortController();
  const timeoutId = globalThis.setTimeout(() => abortController.abort(), IMAGE_TIMEOUT);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt,
        size: "1024x1024",
        response_format: "b64_json",
      }),
      signal: abortController.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`图片生成请求失败：${response.status} ${errorText}`.trim());
    }

    const json = (await response.json()) as { data?: { b64_json?: string; url?: string }[] };
    const image = json.data?.[0];

    if (image?.url) {
      return image.url;
    }

    if (image?.b64_json) {
      return `data:image/png;base64,${image.b64_json}`;
    }

    throw new Error("图片生成返回了空响应");
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("图片生成请求超时");
    }

    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}
