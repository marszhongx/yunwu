import { DEFAULT_SYSTEM_PROMPTS } from "@/constants";
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

const tagEnd = "(?:\\]|】)";
const openBracket = "(?:\\[|【)";

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

export function parseChoices(content: string): string[] {
  const raw = parseTag(content, "CHOICES");
  if (!raw) return [];

  return raw
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => /^[A-Z]:\s/.test(line))
    .map((line) => line.slice(2).trim());
}

export function parseSummary(content: string): string | null {
  return parseTag(content, "SUMMARY");
}

export function parseStatus(content: string): string | null {
  return parseTag(content, "STATUS");
}

export function parseContent(content: string): string {
  const extracted = parseTag(content, "CONTENT");
  if (extracted) return extracted;
  return ["CHOICES", "SUMMARY", "STATUS"]
    .reduce((current, tag) => current.replace(tagPattern(tag, "g"), ""), content)
    .trim();
}

export type ParsedMessage = {
  body: string;
  choices: string[];
  summary: string | null;
  status: string | null;
};

export function parseMessage(content: string): ParsedMessage {
  const choices = parseChoices(content);
  const summary = parseSummary(content);
  const status = parseStatus(content);
  const body = parseContent(content);
  return { body, choices, summary, status };
}

function compressContent(content: string): string {
  const summary = parseSummary(content);
  if (summary) return summary;
  return ["CONTENT", "CHOICES", "SUMMARY", "STATUS"]
    .reduce((current, tag) => current.replace(tagPattern(tag, "g"), ""), content)
    .trim();
}

function parseTag(content: string, tag: string): string | null {
  const match = content.match(tagPattern(tag));
  return match ? match[1].trim() : null;
}

function tagPattern(tag: string, flags?: string): RegExp {
  return new RegExp(
    `${openBracket}${tag}${tagEnd}([\\s\\S]*?)(${openBracket}/${tag}${tagEnd}|$)`,
    flags,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
