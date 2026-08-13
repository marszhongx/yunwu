import { describe, expect, it } from "vitest";
import { enabledEntries, normalizeLorebookEntries } from "@/lib/lorebooks";

describe("lorebooks domain", () => {
  it("normalizeLorebookEntries turns comma and Chinese comma separated keys into array", () => {
    const result = normalizeLorebookEntries([
      { keys: "雾, 驿站，满月", content: "满月时驿站出现。" },
    ]);

    expect(result).toEqual([
      { keys: ["雾", "驿站", "满月"], content: "满月时驿站出现。", enabled: true },
    ]);
  });

  it("enabledEntries returns enabled entry contents", () => {
    const result = enabledEntries([
      { keys: ["雾"], content: "雾会低语。", enabled: true },
      { keys: ["火"], content: "火焰熄灭。", enabled: false },
    ]);

    expect(result).toEqual(["雾会低语。"]);
  });

  it("enabledEntries skips entries without content", () => {
    const result = enabledEntries([
      { keys: ["雾"], content: "", enabled: true },
      { keys: ["门"], content: "门不会打开。", enabled: true },
    ]);

    expect(result).toEqual(["门不会打开。"]);
  });
});
