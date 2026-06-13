import { beforeEach, describe, expect, test } from "vitest";
import {
  DEFAULT_SETTINGS,
  DEFAULT_SYSTEM_PROMPTS,
  ImageProviderType,
  ProviderType,
} from "@/constants";
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
} from "@/services/settings";

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

  test("adds and activates first provider", async () => {
    const provider = await addProvider({
      type: ProviderType.GEMINI,
      apiKey: "key",
      model: "gemini-1.5-pro",
    });

    expect(provider).toMatchObject({
      name: "gemini-1.5-pro",
      type: ProviderType.GEMINI,
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

  test("updates provider and getActiveProvider reflects update", async () => {
    const provider = await addProvider({ type: ProviderType.GEMINI, model: "old-model" });

    const updated = await updateProvider(provider.id, {
      id: "ignored-id",
      name: "Updated",
      type: ProviderType.OPENAI,
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
    await expect(updateProvider("missing", { name: "Missing" })).resolves.toBeNull();
  });

  test("deleting active provider clears active id and removes it", async () => {
    const provider = await addProvider({ type: ProviderType.GEMINI, model: "gemini-pro" });

    const settings = await deleteProvider(provider.id);

    expect(settings.activeProviderId).toBe("");
    expect(settings.providers).toEqual([]);
    expect(getActiveProvider()).toBeNull();
  });

  test("sets active provider and theme", async () => {
    const first = await addProvider({ type: ProviderType.GEMINI, model: "gemini-pro" });
    const second = await addProvider({ type: ProviderType.CLAUDE, model: "claude-3" });

    expect((await setActiveProvider(second.id)).activeProviderId).toBe(second.id);
    expect((await setActiveProvider("missing")).activeProviderId).toBe(second.id);
    expect((await saveTheme("light")).theme).toBe("light");
    expect((await saveTheme("dark")).theme).toBe("dark");
    expect(getActiveProvider()).toEqual(second);
    expect(first.id).not.toBe(second.id);
  });

  test("saves custom system prompts", async () => {
    expect((await saveSystemPrompts(["第一条", "第二条"])).systemPrompts).toEqual(["第一条", "第二条"]);
    expect(getSettings().systemPrompts).toEqual(["第一条", "第二条"]);
  });

  test("normalizes corrupt storage", () => {
    localStorage.setItem("yunwu.settings.v1", "not-json");
    expect(getSettings()).toEqual({
      activeProviderId: "",
      providers: [],
      theme: "dark",
      systemPrompts: DEFAULT_SETTINGS.systemPrompts,
      imageProviders: [],
      activeImageProviderId: "",
    });
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

  test("adds and activates first image provider", async () => {
    const provider = await addImageProvider({
      apiKey: "img-key",
      model: ImageProviderType.DALL_E_3,
    });

    expect(provider).toMatchObject({
      name: "dall-e-3",
      type: "dall-e-3",
      apiKey: "img-key",
      baseUrl: "https://api.openai.com/v1",
      model: ImageProviderType.DALL_E_3,
    });
    expect(provider.id).not.toBe("");
    expect(getSettings().activeImageProviderId).toBe(provider.id);
    expect(getSettings().imageProviders).toEqual([provider]);
    expect(getActiveImageProvider()).toEqual(provider);
  });

  test("updates image provider", async () => {
    const provider = await addImageProvider({ apiKey: "old-key", model: "dall-e-3" });

    const updated = await updateImageProvider(provider.id, {
      name: "My DALL-E",
      apiKey: "new-key",
    });

    expect(updated).toMatchObject({
      id: provider.id,
      name: "My DALL-E",
      apiKey: "new-key",
    });
    expect(getActiveImageProvider()).toEqual(updated);
    await expect(updateImageProvider("missing", { name: "X" })).resolves.toBeNull();
  });

  test("deleting active image provider clears active id", async () => {
    const provider = await addImageProvider({ apiKey: "key", model: "dall-e-3" });

    const settings = await deleteImageProvider(provider.id);

    expect(settings.activeImageProviderId).toBe("");
    expect(settings.imageProviders).toEqual([]);
    expect(getActiveImageProvider()).toBeNull();
  });

  test("sets active image provider", async () => {
    await addImageProvider({ apiKey: "k1", model: "dall-e-2" });
    const second = await addImageProvider({ apiKey: "k2", model: "dall-e-3" });

    expect((await setActiveImageProvider(second.id)).activeImageProviderId).toBe(second.id);
    expect((await setActiveImageProvider("missing")).activeImageProviderId).toBe(second.id);
    expect(getActiveImageProvider()).toEqual(second);
  });
});
