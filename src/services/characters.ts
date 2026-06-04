import { uuid } from "@/lib/ids";
import { normalizeLorebookEntries } from "@/lib/lorebooks";
import type { CharacterCard } from "@/types";
import { deleteOne, getAll, getOne, putOne } from "@/services/db";

type CharacterInput = Partial<Record<keyof CharacterCard, unknown>>;

export async function listCharacters(): Promise<CharacterCard[]> {
  const characters = await getAll("characters");
  return characters.sort((a, b) => toTime(b.updatedAt).localeCompare(toTime(a.updatedAt)));
}

export function getCharacter(id: string): Promise<CharacterCard | null> {
  return getOne("characters", id);
}

export async function createCharacter(input: CharacterInput): Promise<CharacterCard> {
  const now = nowIso();
  const character = normalizeCharacter({ ...input, id: uuid(), createdAt: now, updatedAt: now });
  return putOne("characters", character);
}

export async function updateCharacter(
  id: string,
  patch: CharacterInput,
): Promise<CharacterCard | null> {
  const existing = await getCharacter(id);
  if (!existing) return null;

  const character = normalizeCharacter({ ...existing, ...patch, id, updatedAt: nowIso() });
  return putOne("characters", character);
}

export function deleteCharacter(id: string): Promise<void> {
  return deleteOne("characters", id);
}

function normalizeCharacter(input: CharacterInput): CharacterCard {
  return {
    id: text(input.id),
    name: text(input.name),
    description: text(input.description),
    first_mes: text(input.first_mes),
    personality: text(input.personality),
    scenario: text(input.scenario),
    mes_example: text(input.mes_example),
    alternate_greetings: textArray(input.alternate_greetings),
    opening_user_choices: textArray(input.opening_user_choices),
    entries: normalizeLorebookEntries(input.entries),
    creator_notes: text(input.creator_notes),
    tags: textArray(input.tags),
    creator: text(input.creator),
    character_version: text(input.character_version),
    createdAt: text(input.createdAt),
    updatedAt: text(input.updatedAt),
  };
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function textArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function nowIso(): string {
  return new Date().toISOString();
}

function toTime(value: unknown): string {
  return typeof value === "string" ? value : "";
}
