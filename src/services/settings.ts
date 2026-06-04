import { DEFAULT_SETTINGS, IMAGE_PROVIDER_TYPES, PROVIDER_TYPES } from "@/constants";
import { uuid } from "@/lib/ids";
import type {
  AppSettings,
  ImageProviderSettings,
  ImageProviderType,
  ProviderSettings,
  ProviderType,
} from "@/types";

const SETTINGS_KEY = "yunwu.settings.v1";

type ProviderInput = Partial<Record<keyof ProviderSettings, unknown>>;
type SettingsInput = Partial<Record<keyof AppSettings, unknown>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toStringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeProviderType(value: unknown): ProviderType {
  return typeof value === "string" && PROVIDER_TYPES.includes(value as ProviderType)
    ? (value as ProviderType)
    : "gemini";
}

function normalizeTheme(value: unknown): AppSettings["theme"] {
  return value === "light" ? "light" : "dark";
}

function normalizeSystemPrompts(value: unknown): string[] {
  if (Array.isArray(value)) {
    const prompts = value.filter(
      (prompt): prompt is string => typeof prompt === "string" && prompt.trim() !== "",
    );
    if (prompts.length > 0) return prompts;
  }

  return DEFAULT_SETTINGS.systemPrompts;
}

function normalizeProvider(value: unknown): ProviderSettings {
  const input = isRecord(value) ? value : {};
  const type = normalizeProviderType(input.type);
  const model = toStringValue(input.model);
  const name = toStringValue(input.name) || model || type;

  const rawMaxTokens =
    typeof input.maxTokens === "number" ? input.maxTokens : Number(input.maxTokens);
  const maxTokens =
    Number.isFinite(rawMaxTokens) && rawMaxTokens > 0 ? Math.round(rawMaxTokens) : undefined;

  return {
    id: toStringValue(input.id),
    name,
    type,
    apiKey: toStringValue(input.apiKey),
    baseUrl: toStringValue(input.baseUrl),
    model,
    maxTokens,
  };
}

function normalizeImageProvider(value: unknown): ImageProviderSettings {
  const input = isRecord(value) ? value : {};
  const type =
    typeof input.type === "string" && IMAGE_PROVIDER_TYPES.includes(input.type as ImageProviderType)
      ? (input.type as ImageProviderType)
      : "dall-e-3";
  const model = toStringValue(input.model);
  const name = toStringValue(input.name) || model || "图片生成";
  const baseUrl = toStringValue(input.baseUrl);

  return {
    id: toStringValue(input.id),
    name,
    type,
    apiKey: toStringValue(input.apiKey),
    baseUrl: baseUrl || "https://api.openai.com/v1",
    model: model || (type === "dall-e-3" ? "dall-e-3" : ""),
  };
}

function normalizeSettings(value: unknown): AppSettings {
  const input = isRecord(value) ? (value as SettingsInput) : {};
  const providers = Array.isArray(input.providers)
    ? input.providers.map(normalizeProvider)
    : DEFAULT_SETTINGS.providers;
  const activeProviderId = toStringValue(input.activeProviderId);
  const hasActiveProvider =
    activeProviderId !== "" && providers.some((provider) => provider.id === activeProviderId);

  let imageProviders = Array.isArray(input.imageProviders)
    ? input.imageProviders.map(normalizeImageProvider).filter((p) => p.id)
    : DEFAULT_SETTINGS.imageProviders;

  let activeImageProviderId = toStringValue(input.activeImageProviderId);

  const hasActiveImageProvider =
    activeImageProviderId !== "" && imageProviders.some((p) => p.id === activeImageProviderId);

  return {
    activeProviderId: hasActiveProvider ? activeProviderId : DEFAULT_SETTINGS.activeProviderId,
    providers,
    theme: normalizeTheme(input.theme),
    systemPrompts: normalizeSystemPrompts(input.systemPrompts),
    imageProviders,
    activeImageProviderId: hasActiveImageProvider
      ? activeImageProviderId
      : DEFAULT_SETTINGS.activeImageProviderId,
  };
}

function writeSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function getSettings(): AppSettings {
  const saved = localStorage.getItem(SETTINGS_KEY);

  if (saved === null) {
    return { ...DEFAULT_SETTINGS, providers: [] };
  }

  try {
    return normalizeSettings(JSON.parse(saved) as unknown);
  } catch {
    return { ...DEFAULT_SETTINGS, providers: [] };
  }
}

export function saveSettings(settings: unknown): AppSettings {
  const normalized = normalizeSettings(settings);
  writeSettings(normalized);
  return normalized;
}

export function addProvider(input: ProviderInput): ProviderSettings {
  const settings = getSettings();
  const provider = normalizeProvider({ ...input, id: uuid() });
  const nextSettings = saveSettings({
    ...settings,
    activeProviderId: settings.activeProviderId || provider.id,
    providers: [...settings.providers, provider],
  });

  return nextSettings.providers[nextSettings.providers.length - 1] ?? provider;
}

export function updateProvider(id: string, patch: ProviderInput): ProviderSettings | null {
  const settings = getSettings();
  const providerIndex = settings.providers.findIndex((provider) => provider.id === id);

  if (providerIndex === -1) {
    return null;
  }

  const providers = [...settings.providers];
  providers[providerIndex] = normalizeProvider({
    ...providers[providerIndex],
    ...patch,
    id,
  });
  saveSettings({ ...settings, providers });

  return providers[providerIndex];
}

export function deleteProvider(id: string): AppSettings {
  const settings = getSettings();
  const providers = settings.providers.filter((provider) => provider.id !== id);

  return saveSettings({
    ...settings,
    activeProviderId: settings.activeProviderId === id ? "" : settings.activeProviderId,
    providers,
  });
}

export function setActiveProvider(id: string): AppSettings {
  const settings = getSettings();

  if (!settings.providers.some((provider) => provider.id === id)) {
    return settings;
  }

  return saveSettings({ ...settings, activeProviderId: id });
}

export function getActiveProvider(): ProviderSettings | null {
  const settings = getSettings();

  if (settings.activeProviderId === "") {
    return null;
  }

  return settings.providers.find((provider) => provider.id === settings.activeProviderId) ?? null;
}

export function saveTheme(theme: unknown): AppSettings {
  return saveSettings({ ...getSettings(), theme: normalizeTheme(theme) });
}

export function saveSystemPrompts(systemPrompts: unknown): AppSettings {
  return saveSettings({ ...getSettings(), systemPrompts });
}

type ImageProviderInput = Partial<Record<keyof ImageProviderSettings, unknown>>;

export function addImageProvider(input: ImageProviderInput): ImageProviderSettings {
  const settings = getSettings();
  const provider = normalizeImageProvider({ ...input, id: uuid() });
  const nextSettings = saveSettings({
    ...settings,
    activeImageProviderId: settings.activeImageProviderId || provider.id,
    imageProviders: [...settings.imageProviders, provider],
  });

  return nextSettings.imageProviders[nextSettings.imageProviders.length - 1] ?? provider;
}

export function updateImageProvider(
  id: string,
  patch: ImageProviderInput,
): ImageProviderSettings | null {
  const settings = getSettings();
  const index = settings.imageProviders.findIndex((p) => p.id === id);

  if (index === -1) return null;

  const imageProviders = [...settings.imageProviders];
  imageProviders[index] = normalizeImageProvider({ ...imageProviders[index], ...patch, id });
  saveSettings({ ...settings, imageProviders });

  return imageProviders[index];
}

export function deleteImageProvider(id: string): AppSettings {
  const settings = getSettings();
  const imageProviders = settings.imageProviders.filter((p) => p.id !== id);

  return saveSettings({
    ...settings,
    activeImageProviderId:
      settings.activeImageProviderId === id ? "" : settings.activeImageProviderId,
    imageProviders,
  });
}

export function setActiveImageProvider(id: string): AppSettings {
  const settings = getSettings();

  if (!settings.imageProviders.some((p) => p.id === id)) {
    return settings;
  }

  return saveSettings({ ...settings, activeImageProviderId: id });
}

export function getActiveImageProvider(): ImageProviderSettings | null {
  const settings = getSettings();

  if (settings.activeImageProviderId === "") return null;

  return settings.imageProviders.find((p) => p.id === settings.activeImageProviderId) ?? null;
}
