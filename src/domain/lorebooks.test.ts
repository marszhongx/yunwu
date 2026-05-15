import { describe, expect, it } from "vitest";
import { matchLorebook, normalizeLorebookEntries } from "./lorebooks";

describe("lorebooks domain", () => {
  it("normalizeLorebookEntries turns comma and Chinese comma separated keys into array", () => {
    const result = normalizeLorebookEntries([
      { keys: "雾, 驿站，满月", content: "满月时驿站出现。" },
    ]);

    expect(result).toEqual([
      { keys: ["雾", "驿站", "满月"], content: "满月时驿站出现。", enabled: true },
    ]);
  });

  it("matchLorebook returns enabled contents", () => {
    const result = matchLorebook([
      { keys: ["雾"], content: "雾会低语。", enabled: true },
      { keys: ["火"], content: "火焰熄灭。", enabled: false },
    ]);

    expect(result).toEqual(["雾会低语。"]);
  });

  it("matchLorebook with includeDetails returns contents and matches", () => {
    const entries = [
      { keys: ["雾", "铃"], content: "铃声来自雾里。", enabled: true },
      { keys: ["门"], content: "门不会打开。", enabled: false },
    ];

    expect(matchLorebook(entries, { includeDetails: true })).toEqual({
      contents: ["铃声来自雾里。"],
      matches: [{ content: "铃声来自雾里。", keys: ["雾", "铃"] }],
    });
  });
});
