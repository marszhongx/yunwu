import type { CharacterCard, LorebookEntry, ProviderSettings } from "@/domain/types";
import { requestAssistantText } from "./ai";

type CharacterGeneration = Pick<CharacterCard, "name" | "description" | "personality" | "scenario" | "first_mes" | "mes_example" | "opening_user_choices" | "entries">;

const CHARACTER_SCHEMA = `{
  "name": "角色名称，简短有辨识度",
  "description": "适合作为角色卡描述的完整中文设定，包含身份、外貌、性格、动机、可互动钩子",
  "personality": "性格特征摘要，2-3 句话",
  "scenario": "故事发生的时间、地点、当前情境",
  "first_mes": "角色或旁白开场白，直接把玩家带入场景",
  "mes_example": "2-3 轮示例对话，展示角色的语气和互动风格，格式：用户:...\n旁白:...",
  "opening_user_choices": ["玩家可选择的开场行动 1", "玩家可选择的开场行动 2", "玩家可选择的开场行动 3"],
  "entries": [
    {
      "keys": ["关键词1", "关键词2"],
      "content": "当关键词触发时注入上下文的世界观条目内容，具体、可用于角色扮演",
      "enabled": true
    }
  ]
}`;

function generationSystemPrompt(schema: string): string {
  return `你是开放世界 RPG 创作助手。根据用户需求生成结构化设定。必须只输出一个合法 JSON 对象，不要 Markdown 代码块，不要解释，不要额外文本。JSON 结构必须匹配：\n${schema}`;
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenceMatch?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI 未返回 JSON 对象");
  }

  try {
    return JSON.parse(candidate.slice(start, end + 1)) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : "格式错误";
    throw new Error(`AI 返回的 JSON 无法解析：${message}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(stringValue).filter(Boolean) : [];
}

function parseCharacter(text: string): CharacterGeneration {
  const data = extractJsonObject(text);

  if (!isRecord(data)) {
    throw new Error("AI 返回的角色卡格式无效");
  }

  const entries: LorebookEntry[] = Array.isArray(data.entries)
    ? data.entries
        .map((entry) => {
          if (!isRecord(entry)) return null;

          const keys = stringArray(entry.keys);
          const content = stringValue(entry.content);

          if (keys.length === 0 || !content) return null;

          return { keys, content, enabled: entry.enabled !== false };
        })
        .filter((entry): entry is LorebookEntry => entry !== null)
    : [];

  const character = {
    name: stringValue(data.name),
    description: stringValue(data.description),
    personality: stringValue(data.personality),
    scenario: stringValue(data.scenario),
    first_mes: stringValue(data.first_mes),
    mes_example: stringValue(data.mes_example),
    opening_user_choices: stringArray(data.opening_user_choices).slice(0, 6),
    entries,
  };

  if (!character.name || !character.description) {
    throw new Error("AI 返回的角色卡缺少名称或描述");
  }

  return character;
}

function characterUserPrompt(seed: string): string {
  const trimmedSeed = seed.trim();
  return `请生成一张适合开放世界角色扮演聊天应用的中文角色卡。${
    trimmedSeed
      ? `可以参考或扩展这些已有草稿：\n${trimmedSeed}`
      : "主题、身份、场景和冲突由你自行创作，要有强互动钩子。"
  }\n要求：角色设定有戏剧张力但便于长期互动；开场白应直接进入场景；提供 3-5 个玩家开场选项；同时生成 5-8 个世界设定条目（entries），每个条目有 2-4 个关键词，涵盖重要人物、地点、势力、规则等，内容具体可直接作为上下文注入。`;
}

export async function generateCharacterCard(
  provider: ProviderSettings,
  seed: string,
): Promise<CharacterGeneration> {
  const { text } = await requestAssistantText({
    provider,
    messages: [
      { role: "system", content: generationSystemPrompt(CHARACTER_SCHEMA) },
      { role: "user", content: characterUserPrompt(seed) },
    ],
  });

  return parseCharacter(text);
}
