import type { AppSettings, ProviderType } from "./types";

export const PROVIDER_TYPES = [
  "gemini",
  "openai",
  "claude",
  "huggingface",
] as const satisfies readonly ProviderType[];

export const DEFAULT_SYSTEM_PROMPT = `你是互动小说的叙事者（GM）。使用第二人称叙述。始终使用中文回复。`;

export const RESPONSE_INSTRUCTION = `回复必须且仅包含 [CONTENT]、[SUMMARY]、[STATUS]、[CHOICES] 四种标签，不要输出任何其他内容。格式如下：

[CONTENT]正文内容[/CONTENT]

[SUMMARY]一句话摘要[/SUMMARY]

[STATUS]当前状态[/STATUS]

[CHOICES]
A: 选项一
B: 选项二
C: 选项三
D: 选项四
[/CHOICES]`;

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

export const DEFAULT_SYSTEM_PROMPTS = [DEFAULT_SYSTEM_PROMPT, RESPONSE_INSTRUCTION];

export const DEFAULT_SETTINGS: AppSettings = {
  activeProviderId: "",
  providers: [],
  theme: "dark",
  systemPrompts: DEFAULT_SYSTEM_PROMPTS,
  imageProviders: [],
  activeImageProviderId: "",
};
