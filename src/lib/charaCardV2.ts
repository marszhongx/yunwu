import { normalizeKeys } from "@/lib/lorebooks";
import type { CharacterCard, LorebookEntry } from "@/types";

export type CharaCardV2 = {
  spec: "chara_card_v2";
  spec_version: "2.0";
  data: CharaCardV2Data;
};

type CharaCardV2Data = {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator_notes: string;
  system_prompt: string;
  post_history_instructions: string;
  alternate_greetings: string[];
  tags: string[];
  creator: string;
  character_version: string;
  avatar?: string;
  opening_user_choices: string[];
  extensions: Record<string, unknown>;
  character_book?: CharaCardV2Book;
};

type CharaCardV2Book = {
  name: string;
  entries: CharaCardV2BookEntry[];
};

type CharaCardV2BookEntry = {
  keys: string[];
  content: string;
  enabled: boolean;
  insertion_order: number;
  case_sensitive: boolean;
  name: string;
  priority: number;
  id: number;
  selective: boolean;
  secondary_keys: string[];
  constant: boolean;
  position: "before_char";
  extensions: Record<string, unknown>;
};

type CharacterInput = Partial<CharacterCard>;

type ExportOptions = {
  includeAvatar?: boolean;
};

export function toCharaCardV2(character: CharacterCard, options: ExportOptions = {}): CharaCardV2 {
  const includeAvatar = options.includeAvatar ?? true;

  return {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name: text(character.name),
      description: text(character.description),
      personality: text(character.personality),
      scenario: text(character.scenario),
      first_mes: text(character.first_mes),
      mes_example: text(character.mes_example),
      creator_notes: text(character.creator_notes),
      system_prompt: "",
      post_history_instructions: "",
      alternate_greetings: textArray(character.alternate_greetings),
      tags: textArray(character.tags),
      creator: text(character.creator),
      character_version: text(character.character_version),
      avatar: includeAvatar ? text(character.avatar) || undefined : undefined,
      opening_user_choices: textArray(character.opening_user_choices),
      extensions: {},
      character_book: {
        name: `${text(character.name)} Lorebook`,
        entries: lorebookArray(character.entries).map(toCharaCardV2BookEntry),
      },
    },
  };
}

export function fromCharaCardV2(input: unknown, fallbackName = ""): CharacterInput {
  if (!isRecord(input) || input.spec !== "chara_card_v2" || !isRecord(input.data)) {
    throw new Error("不支持的角色卡格式");
  }

  const source = input.data;
  const entries = readEntries(source);
  const name = text(source.name) || filenameWithoutExtension(fallbackName);

  if (!name || (!text(source.name) && !hasCharacterContent(source, entries))) {
    throw new Error("不支持的角色卡格式");
  }

  return {
    name,
    description: text(source.description),
    first_mes: text(source.first_mes),
    personality: text(source.personality),
    scenario: text(source.scenario),
    mes_example: text(source.mes_example),
    alternate_greetings: textArray(source.alternate_greetings),
    opening_user_choices: textArray(source.opening_user_choices),
    entries,
    creator_notes: text(source.creator_notes),
    tags: textArray(source.tags),
    creator: text(source.creator),
    character_version: text(source.character_version),
    avatar: text(source.avatar),
    extensions: {},
  };
}

function toCharaCardV2BookEntry(entry: LorebookEntry, index: number): CharaCardV2BookEntry {
  return {
    keys: entry.keys,
    content: entry.content,
    enabled: entry.enabled,
    insertion_order: index,
    case_sensitive: false,
    name: entry.keys[0] || `Entry ${index + 1}`,
    priority: 100,
    id: index,
    selective: false,
    secondary_keys: [],
    constant: entry.keys.length === 0,
    position: "before_char",
    extensions: {},
  };
}

function readEntries(source: Record<string, unknown>): LorebookEntry[] {
  const characterBook = record(source.character_book);
  const bookEntries = Array.isArray(characterBook.entries)
    ? characterBook.entries.flatMap((entry) => normalizeEntry(entry, false))
    : [];
  const internalEntries = Array.isArray(source.entries) ? source.entries.flatMap((entry) => normalizeEntry(entry, true)) : [];

  return internalEntries.length > 0 ? internalEntries : bookEntries;
}

function normalizeEntry(entry: unknown, allowEmptyKeys: boolean): LorebookEntry[] {
  if (!isRecord(entry)) return [];

  const keys = normalizeKeys(entry.keys ?? entry.key);
  const content = text(entry.content);
  if (!content) return [];
  if (keys.length === 0 && !allowEmptyKeys && entry.constant !== true) return [];

  return [{ keys, content, enabled: entry.enabled !== false }];
}

function lorebookArray(value: unknown): LorebookEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const keys = Array.isArray((entry as LorebookEntry).keys) ? (entry as LorebookEntry).keys : [];
    const content = text((entry as LorebookEntry).content);
    return [{ keys: keys.map(String).map((key) => key.trim()).filter(Boolean), content, enabled: (entry as LorebookEntry).enabled !== false }];
  });
}

function hasCharacterContent(source: Record<string, unknown>, entries: LorebookEntry[]): boolean {
  return Boolean(
    text(source.description) ||
      text(source.first_mes) ||
      text(source.personality) ||
      text(source.scenario) ||
      text(source.mes_example) ||
      textArray(source.alternate_greetings).length > 0 ||
      textArray(source.opening_user_choices).length > 0 ||
      entries.length > 0,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? { ...value } : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function textArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function filenameWithoutExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").trim();
}
