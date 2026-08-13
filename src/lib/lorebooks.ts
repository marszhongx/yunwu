import type { LorebookEntry } from "@/types";

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

export function enabledEntries(entries: LorebookEntry[]): string[] {
  return entries
    .filter((entry) => entry.enabled)
    .map((entry) => entry.content.trim())
    .filter(Boolean);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
