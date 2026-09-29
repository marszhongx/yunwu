import { ImageProviderType, IMAGE_TIMEOUT, ProviderType, STREAM_TIMEOUT } from "@/constants";
import type { ProviderSettings } from "@/types";
import { fetchWithOptionalProxy } from "@/services/proxy";

export type AssistantMessageRole = "system" | "user" | "assistant";

export type AssistantMessage = {
  role: AssistantMessageRole;
  content: string;
};

type ProviderLike = Partial<ProviderSettings> & {
  type?: ProviderType;
};

type StreamAssistantTextInput = {
  provider: ProviderLike | null;
  messages: AssistantMessage[];
  onText?: (text: string) => void;
};

type StreamAssistantTextRequest = {
  promise: Promise<{ text: string }>;
  abort: () => void;
  signal: AbortSignal;
};

type StreamRequest = {
  url: string;
  init: RequestInit;
  extractText: (payload: unknown) => string;
};

function validateProvider(provider: ProviderLike | null): ProviderLike & {
  type: ProviderType;
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
    type: provider.type ?? ProviderType.OPENAI,
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

function getOpenAIResponseStreamText(payload: unknown): string {
  const type = textFromRecordPath(payload, ["type"]);

  if (type !== "response.output_text.delta") {
    return "";
  }

  const delta = textFromRecordPath(payload, ["delta"]);
  return typeof delta === "string" ? delta : "";
}

function getOpenAIResponseText(json: unknown): string {
  const outputText = textFromRecordPath(json, ["output_text"]);
  if (typeof outputText === "string" && outputText !== "") {
    return outputText;
  }

  const output = textFromRecordPath(json, ["output"]);
  if (!Array.isArray(output)) {
    return "";
  }

  let text = "";
  for (const item of output) {
    const content = textFromRecordPath(item, ["content"]);
    if (!Array.isArray(content)) {
      continue;
    }
    for (const part of content) {
      if (textFromRecordPath(part, ["type"]) !== "output_text") {
        continue;
      }
      const partText = textFromRecordPath(part, ["text"]);
      if (typeof partText === "string") {
        text += partText;
      }
    }
  }
  return text;
}

function normalizedOpenAIBaseUrl(baseUrl: string): string {
  return (baseUrl.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
}

export function openAIChatCompletionsUrl(baseUrl: string): string {
  return `${normalizedOpenAIBaseUrl(baseUrl)}/chat/completions`;
}

export function openAIResponsesUrl(baseUrl: string): string {
  return `${normalizedOpenAIBaseUrl(baseUrl)}/responses`;
}

// Some OpenAI-compatible chat templates only accept one leading system message.
function mergeSystemMessages(messages: AssistantMessage[]): AssistantMessage[] {
  const systemMessages = messages.filter((message) => message.role === "system");
  if (systemMessages.length === 0) return messages;

  return [
    { role: "system", content: systemMessages.map((message) => message.content).join("\n\n") },
    ...messages.filter((message) => message.role !== "system"),
  ];
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
        messages: mergeSystemMessages(messages),
        stream: true,
        ...(provider.maxTokens ? { max_tokens: provider.maxTokens } : {}),
      }),
    },
    extractText: getOpenAIText,
  };
}

type ResponsesPayload = {
  model: string;
  instructions?: string;
  input: { role: string; content: string }[];
  stream: boolean;
  max_output_tokens?: number;
};

function openAIResponsesPayload(
  provider: ProviderLike & { apiKey: string; model: string },
  messages: AssistantMessage[],
  stream: boolean,
): ResponsesPayload {
  const instructions = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const input = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({ role: message.role, content: message.content }));

  return {
    model: provider.model,
    ...(instructions ? { instructions } : {}),
    input,
    stream,
    ...(provider.maxTokens ? { max_output_tokens: provider.maxTokens } : {}),
  };
}

function openAIResponsesRequest(
  provider: ProviderLike & { apiKey: string; model: string },
  messages: AssistantMessage[],
): StreamRequest {
  return {
    url: openAIResponsesUrl(provider.baseUrl || ""),
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify(openAIResponsesPayload(provider, messages, true)),
    },
    extractText: getOpenAIResponseStreamText,
  };
}

function createRequest(
  provider: ProviderLike & { type: ProviderType; apiKey: string; model: string },
  messages: AssistantMessage[],
): StreamRequest {
  if (provider.type === ProviderType.OPENAI_RESPONSE) {
    return openAIResponsesRequest(provider, messages);
  }

  return openAIRequest(provider, messages);
}

type NonStreamRequest = {
  url: string;
  init: RequestInit;
  responseText: (json: unknown) => string;
};

function openAINonStreamRequest(
  provider: ProviderLike & { apiKey: string; model: string },
  messages: AssistantMessage[],
  jsonMode: boolean,
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
        messages: mergeSystemMessages(messages),
        stream: false,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
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

function openAIResponsesNonStreamRequest(
  provider: ProviderLike & { apiKey: string; model: string },
  messages: AssistantMessage[],
): NonStreamRequest {
  return {
    url: openAIResponsesUrl(provider.baseUrl || ""),
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify(openAIResponsesPayload(provider, messages, false)),
    },
    responseText: getOpenAIResponseText,
  };
}

function createNonStreamRequest(
  provider: ProviderLike & { type: ProviderType; apiKey: string; model: string },
  messages: AssistantMessage[],
  jsonMode: boolean,
): NonStreamRequest {
  if (provider.type === ProviderType.OPENAI_RESPONSE) {
    return openAIResponsesNonStreamRequest(provider, messages);
  }

  return openAINonStreamRequest(provider, messages, jsonMode);
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
    const trimmed = buffer.trim();
    if (!trimmed.startsWith("data:")) {
      const chunk = extractText(parsePayload(trimmed));
      if (chunk !== "") {
        text = chunk;
        onText?.(chunk);
      }
    }
  }

  return text;
}

export async function streamAssistantText({
  provider: inputProvider,
  messages,
  onText,
}: StreamAssistantTextInput): Promise<{ text: string }> {
  return streamAssistantTextRequest({ provider: inputProvider, messages, onText }).promise;
}

export function streamAssistantTextRequest({
  provider: inputProvider,
  messages,
  onText,
}: StreamAssistantTextInput): StreamAssistantTextRequest {
  const provider = validateProvider(inputProvider);
  const request = createRequest(provider, messages);
  const abortController = new AbortController();
  let timedOut = false;
  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    abortController.abort();
  }, STREAM_TIMEOUT);

  const promise = (async () => {
    try {
      const response = await fetchWithOptionalProxy(request.url, {
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
      if (error instanceof DOMException && error.name === "AbortError" && timedOut) {
        throw new Error("Provider 请求超时");
      }

      throw error;
    } finally {
      globalThis.clearTimeout(timeoutId);
    }
  })();

  return {
    promise,
    abort: () => abortController.abort(),
    signal: abortController.signal,
  };
}

export async function requestAssistantText({
  provider: inputProvider,
  messages,
  jsonMode = true,
}: {
  provider: ProviderLike | null;
  messages: AssistantMessage[];
  jsonMode?: boolean;
}): Promise<{ text: string }> {
  const provider = validateProvider(inputProvider);
  const request = createNonStreamRequest(provider, messages, jsonMode);
  const abortController = new AbortController();
  const timeoutId = globalThis.setTimeout(() => abortController.abort(), STREAM_TIMEOUT);

  try {
    const response = await fetchWithOptionalProxy(request.url, {
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
  type,
}: {
  apiKey: string;
  baseUrl: string;
  model: string;
  prompt: string;
  type?: ImageProviderType;
}): Promise<string> {
  if (type === ImageProviderType.OPENAI_RESPONSE) {
    return generateResponsesImage({ apiKey, baseUrl, model, prompt });
  }

  return generateChatImage({ apiKey, baseUrl, model, prompt });
}

async function generateChatImage({
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
  const url = openAIChatCompletionsUrl(baseUrl);
  const abortController = new AbortController();
  const timeoutId = globalThis.setTimeout(() => abortController.abort(), IMAGE_TIMEOUT);

  try {
    const response = await fetchWithOptionalProxy(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: abortController.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`图片生成请求失败：${response.status} ${errorText}`.trim());
    }

    const json = (await response.json()) as {
      choices?: {
        message?: { content?: { type?: string; image_url?: { url?: string } }[] | string };
      }[];
    };
    const content = json.choices?.[0]?.message?.content;

    if (typeof content === "string") {
      return content;
    }

    if (Array.isArray(content)) {
      for (const part of content) {
        if (part.type === "image_url" && part.image_url?.url) {
          return part.image_url.url;
        }
      }
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

async function generateResponsesImage({
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
  const url = openAIResponsesUrl(baseUrl);
  const abortController = new AbortController();
  const timeoutId = globalThis.setTimeout(() => abortController.abort(), IMAGE_TIMEOUT);

  try {
    const response = await fetchWithOptionalProxy(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: prompt,
      }),
      signal: abortController.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`图片生成请求失败：${response.status} ${errorText}`.trim());
    }

    const json = (await response.json()) as {
      output?: { type?: string; content?: { type?: string; image_url?: { url?: string } }[] }[];
    };
    const outputs = json.output ?? [];

    for (const item of outputs) {
      if (Array.isArray(item.content)) {
        for (const part of item.content) {
          if (part.type === "image_url" && part.image_url?.url) {
            return part.image_url.url;
          }
        }
      }
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
