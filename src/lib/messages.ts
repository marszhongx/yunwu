import { DEFAULT_SYSTEM_PROMPTS, ResponseTag } from "@/constants";
import { xml2json } from "@/lib/xml";
import type { CharacterCard, ChatMessage } from "@/types";

type PromptMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type BuildMessagesOptions = {
  messages?: unknown;
  charData?: Partial<CharacterCard> | null;
  lbEntries?: string[];
  systemPrompts?: string[];
};

export function buildMessages({
  messages = [],
  charData = null,
  lbEntries = [],
  systemPrompts = DEFAULT_SYSTEM_PROMPTS,
}: BuildMessagesOptions = {}): PromptMessage[] {
  const prompts = systemPrompts.length > 0 ? systemPrompts : DEFAULT_SYSTEM_PROMPTS;
  const result: PromptMessage[] = prompts.map((content) => ({ role: "system", content }));

  if (charData?.description) {
    result.push({ role: "system", content: charData.description });
  }

  if (charData?.personality) {
    result.push({ role: "system", content: charData.personality });
  }

  if (charData?.scenario) {
    result.push({ role: "system", content: charData.scenario });
  }

  for (const entry of lbEntries) {
    result.push({ role: "system", content: entry });
  }

  if (charData?.mes_example) {
    result.push({ role: "system", content: charData.mes_example });
  }

  result.push(
    ...buildHistoryMessages(messages)
      .filter((msg) => msg.role !== "image")
      .map(({ role, content }) => ({ role: role as PromptMessage["role"], content })),
  );
  return result;
}

export function normalizeMessage(input: unknown): ChatMessage | null {
  if (!isRecord(input)) return null;
  if (input.role === "image") return null;

  const message: ChatMessage = {
    id: typeof input.id === "string" ? input.id : "",
    role: input.role === "user" ? "user" : "assistant",
    content: typeof input.content === "string" ? input.content : "",
  };

  if ("usage" in input) {
    message.usage = input.usage;
  }

  return message;
}

export function normalizeMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages.flatMap((message) => {
    const normalized = normalizeMessage(message);
    return normalized ? [normalized] : [];
  });
}

export function buildHistoryMessages(messages: unknown): ChatMessage[] {
  const normalized = normalizeMessages(messages);
  const assistantIndices: number[] = [];
  for (let i = normalized.length - 1; i >= 0; i--) {
    if (normalized[i].role === "assistant") {
      assistantIndices.push(i);
      if (assistantIndices.length === 2) break;
    }
  }
  const keepFull = new Set(assistantIndices);
  return normalized.map((message, i) => ({
    ...message,
    content:
      message.role === "user"
        ? message.content
        : keepFull.has(i)
          ? parseContent(message.content)
          : compressContent(message.content),
  }));
}

const RESPONSE_TAGS = Object.values(ResponseTag);

export function resolveChoices(raw: string): string[] {
  return raw
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function parseChoices(content: string): string[] {
  const raw = parseTag(content, ResponseTag.CHOICES);
  return raw ? resolveChoices(raw) : [];
}

export function parseSummary(content: string): string | null {
  return parseTag(content, ResponseTag.SUMMARY);
}

export function parseStatus(content: string): string | null {
  return parseTag(content, ResponseTag.STATUS);
}

export function parseContent(content: string): string {
  const parsed = parseXmlResponse(content);
  return resolveBody(content, parsed[ResponseTag.CONTENT][0]);
}

export type ParsedMessage = {
  body: string;
  choices: string[];
  summary: string | null;
  status: string | null;
};

export function parseMessage(content: string): ParsedMessage {
  const parsed = parseXmlResponse(content);
  return {
    body: resolveBody(content, parsed[ResponseTag.CONTENT][0]),
    choices: resolveChoices(parsed[ResponseTag.CHOICES][0] ?? ""),
    summary: parsed[ResponseTag.SUMMARY][0] ?? null,
    status: parsed[ResponseTag.STATUS][0] ?? null,
  };
}

function compressContent(content: string): string {
  const parsed = parseXmlResponse(content);
  return parsed[ResponseTag.SUMMARY][0] ?? resolveBody(content, parsed[ResponseTag.CONTENT][0]);
}

function resolveBody(content: string, parsedContent: string | undefined): string {
  if (parsedContent !== undefined) return parsedContent;
  const tagStart = findFirstResponseTagStart(content);
  if (tagStart === -1) return content;
  const leadingText = content.slice(0, tagStart).trim();
  return leadingText || content;
}

function findFirstResponseTagStart(content: string): number {
  let first = -1;
  for (const tag of RESPONSE_TAGS) {
    const fullOpen = content.indexOf(`<${tag}>`);
    const partialOpen = findPartialOpenTagStart(content, tag);
    const index = minKnownIndex(fullOpen, partialOpen);
    if (index !== -1 && (first === -1 || index < first)) first = index;
  }
  return first;
}

function findPartialOpenTagStart(content: string, tag: string): number {
  const minLength = 2;
  for (let length = minLength; length < tag.length + 2; length++) {
    const partial = `<${tag.slice(0, length - 1)}`;
    if (content.endsWith(partial)) return content.length - partial.length;
  }
  return -1;
}

function minKnownIndex(a: number, b: number): number {
  if (a === -1) return b;
  if (b === -1) return a;
  return Math.min(a, b);
}

function parseTag(content: string, tag: ResponseTag): string | null {
  return parseXmlResponse(content)[tag][0] ?? null;
}

function parseXmlResponse(content: string) {
  return xml2json(content, RESPONSE_TAGS);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
