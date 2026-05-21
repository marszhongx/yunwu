import { beforeEach, describe, expect, test } from "vitest";
import { DEFAULT_SETTINGS, DEFAULT_SYSTEM_PROMPTS } from "../domain/constants";
import {
  addImageProvider,
  addProvider,
  deleteImageProvider,
  deleteProvider,
  getActiveImageProvider,
  getActiveProvider,
  getSettings,
  saveSystemPrompts,
  saveTheme,
  setActiveImageProvider,
  setActiveProvider,
  updateImageProvider,
  updateProvider,
} from "./settings";

describe("settings service", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("returns default settings", () => {
    expect(getSettings()).toEqual({
      activeProviderId: "",
      providers: [],
      theme: "dark",
      systemPrompts: DEFAULT_SETTINGS.systemPrompts,
      imageProviders: [],
      activeImageProviderId: "",
    });
  });

  test("adds and activates first provider", () => {
    const provider = addProvider({
      type: "gemini",
      apiKey: "key",
      model: "gemini-1.5-pro",
    });

    expect(provider).toMatchObject({
      name: "gemini-1.5-pro",
      type: "gemini",
      apiKey: "key",
      baseUrl: "",
      model: "gemini-1.5-pro",
    });
    expect(provider.id).not.toBe("");
    expect(getSettings()).toEqual({
      activeProviderId: provider.id,
      providers: [provider],
      theme: "dark",
      systemPrompts: DEFAULT_SETTINGS.systemPrompts,
      imageProviders: [],
      activeImageProviderId: "",
    });
  });

  test("updates provider and getActiveProvider reflects update", () => {
    const provider = addProvider({ type: "gemini", model: "old-model" });

    const updated = updateProvider(provider.id, {
      id: "ignored-id",
      name: "Updated",
      type: "openai",
      model: "new-model",
    });

    expect(updated).toEqual({
      id: provider.id,
      name: "Updated",
      type: "openai",
      apiKey: "",
      baseUrl: "",
      model: "new-model",
    });
    expect(getActiveProvider()).toEqual(updated);
    expect(updateProvider("missing", { name: "Missing" })).toBeNull();
  });

  test("deleting active provider clears active id and removes it", () => {
    const provider = addProvider({ type: "gemini", model: "gemini-pro" });

    const settings = deleteProvider(provider.id);

    expect(settings.activeProviderId).toBe("");
    expect(settings.providers).toEqual([]);
    expect(getActiveProvider()).toBeNull();
  });

  test("sets active provider and theme", () => {
    const first = addProvider({ type: "gemini", model: "gemini-pro" });
    const second = addProvider({ type: "claude", model: "claude-3" });

    expect(setActiveProvider(second.id).activeProviderId).toBe(second.id);
    expect(setActiveProvider("missing").activeProviderId).toBe(second.id);
    expect(saveTheme("light").theme).toBe("light");
    expect(saveTheme("dark").theme).toBe("dark");
    expect(getActiveProvider()).toEqual(second);
    expect(first.id).not.toBe(second.id);
  });

  test("saves custom system prompts", () => {
    expect(saveSystemPrompts(["第一条", "第二条"]).systemPrompts).toEqual(["第一条", "第二条"]);
    expect(getSettings().systemPrompts).toEqual(["第一条", "第二条"]);
  });

  test("normalizes corrupt storage and invalid provider type", () => {
    localStorage.setItem("yunwu.settings.v1", "not-json");
    expect(getSettings()).toEqual({
      activeProviderId: "",
      providers: [],
      theme: "dark",
      systemPrompts: DEFAULT_SETTINGS.systemPrompts,
      imageProviders: [],
      activeImageProviderId: "",
    });

    const provider = addProvider({ type: "invalid", model: "" });

    expect(provider.type).toBe("gemini");
    expect(provider.name).toBe("gemini");
  });

  test("normalizes missing, invalid, empty, and legacy system prompts", () => {
    localStorage.setItem(
      "yunwu.settings.v1",
      JSON.stringify({
        theme: "light",
        providers: [],
      }),
    );

    expect(getSettings().systemPrompts).toEqual(DEFAULT_SYSTEM_PROMPTS);

    localStorage.setItem(
      "yunwu.settings.v1",
      JSON.stringify({
        systemPrompts: 123,
        providers: [],
      }),
    );

    expect(getSettings().systemPrompts).toEqual(DEFAULT_SYSTEM_PROMPTS);

    localStorage.setItem(
      "yunwu.settings.v1",
      JSON.stringify({
        systemPrompts: ["", "  "],
        providers: [],
      }),
    );

    expect(getSettings().systemPrompts).toEqual(DEFAULT_SYSTEM_PROMPTS);
  });

  test("does not activate malformed providers with empty ids", () => {
    localStorage.setItem(
      "yunwu.settings.v1",
      JSON.stringify({
        providers: [{}, { id: "" }],
      }),
    );

    expect(getActiveProvider()).toBeNull();

    localStorage.setItem(
      "yunwu.settings.v1",
      JSON.stringify({
        activeProviderId: "",
        providers: [{ id: "" }],
      }),
    );

    expect(getActiveProvider()).toBeNull();
  });

  test("adds and activates first image provider", () => {
    const provider = addImageProvider({
      apiKey: "img-key",
      model: "dall-e-3",
    });

    expect(provider).toMatchObject({
      name: "dall-e-3",
      type: "dall-e-3",
      apiKey: "img-key",
      baseUrl: "https://api.openai.com/v1",
      model: "dall-e-3",
    });
    expect(provider.id).not.toBe("");
    expect(getSettings().activeImageProviderId).toBe(provider.id);
    expect(getSettings().imageProviders).toEqual([provider]);
    expect(getActiveImageProvider()).toEqual(provider);
  });

  test("updates image provider", () => {
    const provider = addImageProvider({ apiKey: "old-key", model: "dall-e-3" });

    const updated = updateImageProvider(provider.id, {
      name: "My DALL-E",
      apiKey: "new-key",
    });

    expect(updated).toMatchObject({
      id: provider.id,
      name: "My DALL-E",
      apiKey: "new-key",
    });
    expect(getActiveImageProvider()).toEqual(updated);
    expect(updateImageProvider("missing", { name: "X" })).toBeNull();
  });

  test("deleting active image provider clears active id", () => {
    const provider = addImageProvider({ apiKey: "key", model: "dall-e-3" });

    const settings = deleteImageProvider(provider.id);

    expect(settings.activeImageProviderId).toBe("");
    expect(settings.imageProviders).toEqual([]);
    expect(getActiveImageProvider()).toBeNull();
  });

  test("sets active image provider", () => {
    addImageProvider({ apiKey: "k1", model: "dall-e-2" });
    const second = addImageProvider({ apiKey: "k2", model: "dall-e-3" });

    expect(setActiveImageProvider(second.id).activeImageProviderId).toBe(second.id);
    expect(setActiveImageProvider("missing").activeImageProviderId).toBe(second.id);
    expect(getActiveImageProvider()).toEqual(second);
  });

  test("huggingface image provider does not get openai baseUrl default", () => {
    const provider = addImageProvider({
      type: "huggingface",
      apiKey: "hf-key",
      model: "stabilityai/stable-diffusion-xl-base-1.0",
    });

    expect(provider).toMatchObject({
      type: "huggingface",
      apiKey: "hf-key",
      baseUrl: "",
      model: "stabilityai/stable-diffusion-xl-base-1.0",
    });

    const settings = getSettings();
    const saved = settings.imageProviders.find((p) => p.id === provider.id);
    expect(saved?.type).toBe("huggingface");
    expect(saved?.baseUrl).toBe("");
  });

  test("preserves provider type through save and reload", () => {
    const provider = addImageProvider({
      type: "huggingface",
      apiKey: "hf-key",
      model: "black-forest-labs/FLUX.1-schnell",
    });

    const settings = getSettings();
    const saved = settings.imageProviders.find((p) => p.id === provider.id);
    expect(saved?.type).toBe("huggingface");
  });
});
