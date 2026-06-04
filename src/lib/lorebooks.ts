import type { LorebookEntry } from "@/types";

type Match = {
  content: string;
  keys: string[];
};

type MatchLorebookOptions<T extends boolean = boolean> = {
  includeDetails?: T;
};

export function normalizeKeys(keys: unknown): string[] {
  if (Array.isArray(keys)) {
    return keys.map((key) => String(key).trim()).filter(Boolean);
  }

  if (typeof keys === "string") {
    return keys
      .split(/[,，]/)
      .map((key) => key.trim())
      .filter(Boolean);
  }

  return [];
}

export function normalizeLorebookEntries(entries: unknown): LorebookEntry[] {
  if (!Array.isArray(entries)) return [];

  return entries.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    return [
      {
        keys: normalizeKeys(entry.keys),
        content: typeof entry.content === "string" ? entry.content : "",
        enabled: entry.enabled !== false,
      },
    ];
  });
}

export function matchLorebook(
  entries: LorebookEntry[],
  options: MatchLorebookOptions<true>,
): { contents: string[]; matches: Match[] };
export function matchLorebook(
  entries: LorebookEntry[],
  options?: MatchLorebookOptions<false>,
): string[];
export function matchLorebook(entries: LorebookEntry[], options: MatchLorebookOptions = {}) {
  const matches = entries.flatMap((entry) => {
    if (!entry.enabled) return [];
    return [{ content: entry.content, keys: normalizeKeys(entry.keys) }];
  });

  if (options.includeDetails) {
    return {
      contents: matches.map((match) => match.content),
      matches,
    };
  }

  return matches.map((match) => match.content);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
