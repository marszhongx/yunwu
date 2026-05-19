import { DEFAULT_SETTINGS, DEFAULT_SYSTEM_PROMPTS, PROVIDER_TYPES } from "../domain/constants";
import { uuid } from "../domain/ids";
import type { AppSettings, ImageProviderSettings, ProviderSettings, ProviderType } from "../domain/types";

const SETTINGS_KEY = "yunwu.settings.v1";

type ProviderInput = Partial<Record<keyof ProviderSettings, unknown>>;
type SettingsInput = Partial<Record<keyof AppSettings | "systemPrompt", unknown>>;

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

function normalizeSystemPrompts(value: unknown, legacySystemPrompt?: unknown): string[] {
  if (Array.isArray(value)) {
    const prompts = value.filter(
      (prompt): prompt is string => typeof prompt === "string" && prompt.trim() !== "",
    );
    if (prompts.length > 0) return prompts;
  }

  if (typeof legacySystemPrompt === "string" && legacySystemPrompt.trim() !== "") {
    return [legacySystemPrompt, ...DEFAULT_SYSTEM_PROMPTS.slice(1)];
  }

  return DEFAULT_SETTINGS.systemPrompts;
}

function normalizeProvider(value: unknown): ProviderSettings {
  const input = isRecord(value) ? value : {};
  const provider = normalizeProviderType(input.provider);
  const model = toStringValue(input.model);
  const name = toStringValue(input.name) || model || provider;

  const rawMaxTokens =
    typeof input.maxTokens === "number" ? input.maxTokens : Number(input.maxTokens);
  const maxTokens =
    Number.isFinite(rawMaxTokens) && rawMaxTokens > 0 ? Math.round(rawMaxTokens) : undefined;

  return {
    id: toStringValue(input.id),
    name,
    provider,
    apiKey: toStringValue(input.apiKey),
    baseUrl: toStringValue(input.baseUrl),
    model,
    maxTokens,
  };
}

function normalizeImageProvider(value: unknown): ImageProviderSettings | undefined {
  if (!isRecord(value)) return undefined;
  const apiKey = toStringValue(value.apiKey);
  const baseUrl = toStringValue(value.baseUrl);
  const model = toStringValue(value.model);
  if (!apiKey && !baseUrl && !model) return undefined;
  return { apiKey, baseUrl: baseUrl || "https://api.openai.com/v1", model: model || "dall-e-3" };
}

function normalizeSettings(value: unknown): AppSettings {
  const input = isRecord(value) ? (value as SettingsInput) : {};
  const providers = Array.isArray(input.providers)
    ? input.providers.map(normalizeProvider)
    : DEFAULT_SETTINGS.providers;
  const activeProviderId = toStringValue(input.activeProviderId);
  const hasActiveProvider =
    activeProviderId !== "" && providers.some((provider) => provider.id === activeProviderId);

  return {
    activeProviderId: hasActiveProvider ? activeProviderId : DEFAULT_SETTINGS.activeProviderId,
    providers,
    theme: normalizeTheme(input.theme),
    systemPrompts: normalizeSystemPrompts(input.systemPrompts, input.systemPrompt),
    imageProvider: normalizeImageProvider(input.imageProvider),
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

export function saveImageProvider(input: unknown): AppSettings {
  const settings = getSettings();
  return saveSettings({ ...settings, imageProvider: normalizeImageProvider(input) });
}

export function getImageProvider(): ImageProviderSettings | null {
  const settings = getSettings();
  return settings.imageProvider ?? null;
}
