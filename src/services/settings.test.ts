import { beforeEach, describe, expect, test } from "vitest";
import { DEFAULT_SETTINGS, DEFAULT_SYSTEM_PROMPTS } from "../domain/constants";
import {
  addProvider,
  deleteProvider,
  getActiveProvider,
  getSettings,
  saveSystemPrompts,
  saveTheme,
  setActiveProvider,
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
    });
  });

  test("adds and activates first provider", () => {
    const provider = addProvider({
      provider: "gemini",
      apiKey: "key",
      model: "gemini-1.5-pro",
    });

    expect(provider).toMatchObject({
      name: "gemini-1.5-pro",
      provider: "gemini",
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
    });
  });

  test("updates provider and getActiveProvider reflects update", () => {
    const provider = addProvider({ provider: "gemini", model: "old-model" });

    const updated = updateProvider(provider.id, {
      id: "ignored-id",
      name: "Updated",
      provider: "openai",
      model: "new-model",
    });

    expect(updated).toEqual({
      id: provider.id,
      name: "Updated",
      provider: "openai",
      apiKey: "",
      baseUrl: "",
      model: "new-model",
    });
    expect(getActiveProvider()).toEqual(updated);
    expect(updateProvider("missing", { name: "Missing" })).toBeNull();
  });

  test("deleting active provider clears active id and removes it", () => {
    const provider = addProvider({ provider: "gemini", model: "gemini-pro" });

    const settings = deleteProvider(provider.id);

    expect(settings.activeProviderId).toBe("");
    expect(settings.providers).toEqual([]);
    expect(getActiveProvider()).toBeNull();
  });

  test("sets active provider and theme", () => {
    const first = addProvider({ provider: "gemini", model: "gemini-pro" });
    const second = addProvider({ provider: "claude", model: "claude-3" });

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
    });

    const provider = addProvider({ provider: "invalid", model: "" });

    expect(provider.provider).toBe("gemini");
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

    localStorage.setItem(
      "yunwu.settings.v1",
      JSON.stringify({
        systemPrompt: "旧提示词",
        providers: [],
      }),
    );

    expect(getSettings().systemPrompts).toEqual(["旧提示词", ...DEFAULT_SYSTEM_PROMPTS.slice(1)]);
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
});
