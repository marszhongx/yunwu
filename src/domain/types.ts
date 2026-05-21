export type ProviderType = "gemini" | "openai" | "claude" | "huggingface";

export type ProviderSettings = {
  id: string;
  name: string;
  type: ProviderType;
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens?: number;
};

export type ImageProviderSettings = {
  id: string;
  name: string;
  type: ProviderType;
  provider?: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  parameters?: string;
};

export type AppSettings = {
  activeProviderId: string;
  providers: ProviderSettings[];
  theme: "dark" | "light";
  systemPrompts: string[];
  imageProviders: ImageProviderSettings[];
  activeImageProviderId: string;
};

export type MessageRole = "user" | "assistant" | "image";

export type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  usage?: unknown;
  createdAt?: string;
  chatId?: string;
};

export type LorebookEntry = {
  keys: string[];
  content: string;
  enabled: boolean;
};

export type Lorebook = {
  id: string;
  name: string;
  entries: LorebookEntry[];
};

export type CharacterCard = {
  id: string;
  name: string;
  description: string;
  first_mes: string;
  personality: string;
  scenario: string;
  mes_example: string;
  alternate_greetings: string[];
  opening_user_choices: string[];
  entries: LorebookEntry[];
  creator_notes: string;
  tags: string[];
  creator: string;
  character_version: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Chat = {
  id: string;
  title: string;
  charId: string;
  summaries: string[];
  latestSummary: string;
  latestStatus: string;
  createdAt: string;
  updatedAt: string;
};
