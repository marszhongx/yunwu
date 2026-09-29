import { beforeEach, describe, expect, test } from "vitest";
import {
  DEFAULT_SETTINGS,
  DEFAULT_SYSTEM_PROMPTS,
  ProviderType,
  ReasoningEffort,
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
  saveSidebarCollapsed,
  saveTheme,
  saveUseProxy,
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
      useProxy: false,
      sidebarCollapsed: false,
    });
  });

  test("adds and activates first provider", async () => {
    const provider = await addProvider({
      type: ProviderType.OPENAI,
      apiKey: "key",
      model: "gpt-4o",
    });

    expect(provider).toMatchObject({
      name: "gpt-4o",
      type: ProviderType.OPENAI,
      apiKey: "key",
      baseUrl: "",
      model: "gpt-4o",
    });
    expect(provider.id).not.toBe("");
    expect(getSettings()).toEqual({
      activeProviderId: provider.id,
      providers: [provider],
      theme: "dark",
      systemPrompts: DEFAULT_SETTINGS.systemPrompts,
      imageProviders: [],
      activeImageProviderId: "",
      useProxy: false,
      sidebarCollapsed: false,
    });
  });

  test("updates provider and getActiveProvider reflects update", async () => {
    const provider = await addProvider({ type: ProviderType.OPENAI, model: "old-model" });

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
      reasoningEffort: "auto",
    });
    expect(getActiveProvider()).toEqual(updated);
    await expect(updateProvider("missing", { name: "Missing" })).resolves.toBeNull();
  });

  test("defaults reasoning effort to auto and keeps a valid level", async () => {
    const provider = await addProvider({ type: ProviderType.OPENAI, model: "gpt-5" });
    expect(provider.reasoningEffort).toBe(ReasoningEffort.AUTO);

    const updated = await updateProvider(provider.id, {
      reasoningEffort: ReasoningEffort.HIGH,
    });

    expect(updated?.reasoningEffort).toBe(ReasoningEffort.HIGH);
    expect(getSettings().providers[0]?.reasoningEffort).toBe(ReasoningEffort.HIGH);
  });

  test("falls back to auto for an unknown reasoning effort", async () => {
    localStorage.setItem(
      "yunwu.settings.v1",
      JSON.stringify({
        providers: [{ id: "p1", type: "openai", model: "m", reasoningEffort: "turbo" }],
      }),
    );

    expect(getSettings().providers[0]?.reasoningEffort).toBe(ReasoningEffort.AUTO);
  });

  test("saves and normalizes useProxy flag", async () => {
    expect((await saveUseProxy(true)).useProxy).toBe(true);
    expect(getSettings().useProxy).toBe(true);
    expect((await saveUseProxy(false)).useProxy).toBe(false);

    localStorage.setItem("yunwu.settings.v1", JSON.stringify({ useProxy: "yes" }));
    expect(getSettings().useProxy).toBe(false);
  });

  test("deleting active provider clears active id and removes it", async () => {
    const provider = await addProvider({ type: ProviderType.OPENAI, model: "gpt-4o" });

    const settings = await deleteProvider(provider.id);

    expect(settings.activeProviderId).toBe("");
    expect(settings.providers).toEqual([]);
    expect(getActiveProvider()).toBeNull();
  });

  test("sets active provider and theme", async () => {
    const first = await addProvider({ type: ProviderType.OPENAI, model: "gpt-4o" });
    const second = await addProvider({ type: ProviderType.OPENAI_RESPONSE, model: "gpt-5.1" });

    expect((await setActiveProvider(second.id)).activeProviderId).toBe(second.id);
    expect((await setActiveProvider("missing")).activeProviderId).toBe(second.id);
    expect((await saveTheme("light")).theme).toBe("light");
    expect((await saveTheme("dark")).theme).toBe("dark");
    expect(getActiveProvider()).toEqual(second);
    expect(first.id).not.toBe(second.id);
  });

  test("saves custom system prompts", async () => {
    expect((await saveSystemPrompts(["第一条", "第二条"])).systemPrompts).toEqual([
      "第一条",
      "第二条",
    ]);
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
      useProxy: false,
      sidebarCollapsed: false,
    });
  });

  test("saves and normalizes sidebar collapse", async () => {
    expect(getSettings().sidebarCollapsed).toBe(false);
    expect((await saveSidebarCollapsed(true)).sidebarCollapsed).toBe(true);
    expect(getSettings().sidebarCollapsed).toBe(true);
    expect((await saveSidebarCollapsed(false)).sidebarCollapsed).toBe(false);

    localStorage.setItem("yunwu.settings.v1", JSON.stringify({ sidebarCollapsed: "yes" }));
    expect(getSettings().sidebarCollapsed).toBe(false);
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
      model: "gpt-4o",
    });

    expect(provider).toMatchObject({
      name: "gpt-4o",
      type: "openai",
      apiKey: "img-key",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o",
    });
    expect(provider.id).not.toBe("");
    expect(getSettings().activeImageProviderId).toBe(provider.id);
    expect(getSettings().imageProviders).toEqual([provider]);
    expect(getActiveImageProvider()).toEqual(provider);
  });

  test("updates image provider", async () => {
    const provider = await addImageProvider({ apiKey: "old-key", model: "gpt-4o" });

    const updated = await updateImageProvider(provider.id, {
      name: "My Image",
      apiKey: "new-key",
    });

    expect(updated).toMatchObject({
      id: provider.id,
      name: "My Image",
      apiKey: "new-key",
    });
    expect(getActiveImageProvider()).toEqual(updated);
    await expect(updateImageProvider("missing", { name: "X" })).resolves.toBeNull();
  });

  test("deleting active image provider clears active id", async () => {
    const provider = await addImageProvider({ apiKey: "key", model: "gpt-4o" });

    const settings = await deleteImageProvider(provider.id);

    expect(settings.activeImageProviderId).toBe("");
    expect(settings.imageProviders).toEqual([]);
    expect(getActiveImageProvider()).toBeNull();
  });

  test("sets active image provider", async () => {
    await addImageProvider({ apiKey: "k1", model: "gpt-4o" });
    const second = await addImageProvider({ apiKey: "k2", model: "gpt-5.1" });

    expect((await setActiveImageProvider(second.id)).activeImageProviderId).toBe(second.id);
    expect((await setActiveImageProvider("missing")).activeImageProviderId).toBe(second.id);
    expect(getActiveImageProvider()).toEqual(second);
  });
});
