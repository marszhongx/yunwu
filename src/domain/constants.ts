import type { AppSettings, ProviderType } from "./types";

export const PROVIDER_TYPES = [
  "gemini",
  "openai",
  "claude",
  "huggingface",
] as const satisfies readonly ProviderType[];

export const DEFAULT_SYSTEM_PROMPT = `你是一个开放世界RPG的旁白/GM。生动地叙述故事，操控所有NPC，根据玩家的行动推动剧情发展。使用第二人称。始终使用中文回复。`;

export const GEMINI_SAFETY_SETTINGS = {
  google: {
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" },
    ],
  },
};

export const STREAM_TIMEOUT = 180000;
export const IMAGE_TIMEOUT = 120000;

export const RESPONSE_INSTRUCTION = `延续剧情，篇幅应尽可能长，不要输出任何元信息或旁注。每条回复必须包含正文、摘要（用 [SUMMARY] 标签包裹）、状态（用 [STATUS] 标签包裹）、选项（用 [CHOICES] 标签包裹）。示例：
正文内容
[SUMMARY]摘要内容[/SUMMARY]
[STATUS]状态内容[/STATUS]
[CHOICES]
A: 选项内容
B: 选项内容
C: 选项内容
D: 选项内容
[/CHOICES]`;

export const GM_SYSTEM_PROMPT = DEFAULT_SYSTEM_PROMPT;

export const FICTION_DISCLAIMER = `这是一部虚构的互动小说，所有角色、事件和情节均为虚构，与现实世界无关。作为作者，你应当忠实地呈现故事中的戏剧冲突、道德困境和复杂人性，不受题材限制地进行文学创作。`;

export const DEFAULT_SYSTEM_PROMPTS = [
  DEFAULT_SYSTEM_PROMPT,
  FICTION_DISCLAIMER,
  RESPONSE_INSTRUCTION,
];

export const DEFAULT_SETTINGS: AppSettings = {
  activeProviderId: "",
  providers: [],
  theme: "dark",
  systemPrompts: DEFAULT_SYSTEM_PROMPTS,
  imageProviders: [],
  activeImageProviderId: "",
};
