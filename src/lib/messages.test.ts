import { describe, expect, it } from "vitest";
import { DEFAULT_SYSTEM_PROMPTS } from "@/constants";
import {
  buildHistoryMessages,
  buildMessages,
  normalizeMessage,
  normalizeMessages,
  parseChoices,
  parseMessage,
  parseStatus,
  parseSummary,
  parseContent,
  resolveChoices,
} from "@/lib/messages";

import type { ChatMessage, CharacterCard } from "@/types";

describe("messages domain", () => {
  it("buildMessages builds system prompts, character info, lorebook context, and history", () => {
    const charData: Partial<CharacterCard> = {
      description: "来自雾中城的旅人",
      personality: "谨慎而好奇",
      scenario: "抵达废弃驿站",
      mes_example: "你：你好\n旁白：雾气回应了你。",
    };

    const messages: ChatMessage[] = [
      { id: "u1", role: "user", content: "推门进入" },
      { id: "a1", role: "assistant", content: "门后传来风声<status>身体：无</status>" },
    ];

    const result = buildMessages({
      messages,
      charData,
      lbEntries: ["驿站在满月时出现。", "雾都常年笼罩在迷雾中。"],
    });

    expect(result).toEqual([
      expect.objectContaining({ role: "system" }),
      expect.objectContaining({ role: "system" }),
      {
        role: "system",
        content: "来自雾中城的旅人",
      },
      { role: "system", content: "谨慎而好奇" },
      { role: "system", content: "抵达废弃驿站" },
      { role: "system", content: "驿站在满月时出现。" },
      { role: "system", content: "雾都常年笼罩在迷雾中。" },
      { role: "system", content: "你：你好\n旁白：雾气回应了你。" },
      { role: "user", content: "推门进入" },
      { role: "assistant", content: "门后传来风声<status>身体：无</status>" },
    ]);
  });

  it("uses custom system prompts when provided", () => {
    expect(buildMessages({ systemPrompts: ["第一条", "第二条"] }).slice(0, 2)).toEqual([
      { role: "system", content: "第一条" },
      { role: "system", content: "第二条" },
    ]);
  });

  it("falls back to default system prompts", () => {
    expect(buildMessages().slice(0, DEFAULT_SYSTEM_PROMPTS.length)).toEqual(
      DEFAULT_SYSTEM_PROMPTS.map((content) => ({ role: "system", content })),
    );
  });

  it("buildHistoryMessages strips tags for last 2 assistant messages, compresses older ones", () => {
    const result = buildHistoryMessages([
      { id: "u1", role: "user", content: "继续前进" },
      {
        id: "a1",
        role: "assistant",
        content:
          "<content>旧正文</content><summary>主角进入大厅</summary><status>身体：无</status>",
      },
      { id: "u2", role: "user", content: "查看四周" },
      {
        id: "a2",
        role: "assistant",
        content:
          "<content>中篇正文</content><summary>发现宝箱</summary><status>身体：疲惫</status>",
      },
      { id: "u3", role: "user", content: "打开宝箱" },
      {
        id: "a3",
        role: "assistant",
        content:
          "<content>最新正文</content><summary>获得钥匙</summary><status>身体：良好</status>",
      },
    ]);

    expect(result).toEqual([
      { id: "u1", role: "user", content: "继续前进" },
      { id: "a1", role: "assistant", content: "主角进入大厅" },
      { id: "u2", role: "user", content: "查看四周" },
      { id: "a2", role: "assistant", content: "中篇正文" },
      { id: "u3", role: "user", content: "打开宝箱" },
      { id: "a3", role: "assistant", content: "最新正文" },
    ]);
  });

  it("buildHistoryMessages keeps older assistant content when summary is missing", () => {
    const result = buildHistoryMessages([
      { id: "u1", role: "user", content: "继续前进" },
      {
        id: "a1",
        role: "assistant",
        content: "<content>没有摘要的旧正文</content><status>身体：无</status>",
      },
      { id: "u2", role: "user", content: "查看四周" },
      { id: "a2", role: "assistant", content: "<content>中篇正文</content>" },
      { id: "u3", role: "user", content: "打开宝箱" },
      { id: "a3", role: "assistant", content: "<content>最新正文</content>" },
    ]);

    expect(result[1]?.content).toBe("没有摘要的旧正文");
  });

  it("normalizeMessages drops image role objects entirely", () => {
    const result = normalizeMessages([
      { id: "u1", role: "user", content: "文字" },
      { id: "img1", role: "image", content: "图片" },
      { id: "a1", role: "assistant", content: "回复" },
    ]);

    expect(result).toEqual([
      { id: "u1", role: "user", content: "文字" },
      { id: "a1", role: "assistant", content: "回复" },
    ]);
  });

  it("normalizeMessage maps non-user roles to assistant and preserves usage", () => {
    const usage = { promptTokens: 1, completionTokens: 2 };

    expect(normalizeMessage({ id: "s1", role: "system", content: 123, usage })).toEqual({
      id: "s1",
      role: "assistant",
      content: "",
      usage,
    });
  });

  it("parseSummary and parseStatus extract XML tags", () => {
    expect(parseSummary("正文<summary>雾散了</summary>结尾")).toBe("雾散了");
    expect(parseStatus("正文<status>身体：疲惫\n地点：驿站</status>结尾")).toBe(
      "身体：疲惫\n地点：驿站",
    );
  });

  it("parseContent extracts content XML tag", () => {
    expect(parseContent("<content>正文内容</content><summary>摘要</summary>")).toBe("正文内容");
  });

  it("parseContent falls back to original text when no content tag", () => {
    const content =
      "正文<choices>A: 走</choices>\n中段<summary>摘要</summary>\n末尾<status>身体：无</status>";

    expect(parseContent(content)).toBe(content);
  });

  it("parseChoices extracts choices from XML tag", () => {
    expect(parseChoices("<choices>\nA: 走近\nB: 等待\n</choices>")).toEqual([
      "A: 走近",
      "B: 等待",
    ]);
  });

  it("stops an unclosed XML tag before the next known response tag", () => {
    const parsed = parseMessage(
      "<content>正文<summary>摘要<status>状态</status><choices>\nA: 前进\n</choices>",
    );

    expect(parsed.body).toBe("正文");
    expect(parsed.summary).toBe("摘要");
    expect(parsed.status).toBe("状态");
    expect(parsed.choices).toEqual(["A: 前进"]);
  });

  it("handles missing XML tags without dropping available content", () => {
    const parsed = parseMessage("<content>只有正文</content>");

    expect(parsed.body).toBe("只有正文");
    expect(parsed.summary).toBeNull();
    expect(parsed.status).toBeNull();
    expect(parsed.choices).toEqual([]);
  });

  it("uses the first repeated XML tag block", () => {
    expect(parseSummary("<summary>第一次</summary><summary>第二次</summary>")).toBe("第一次");
    expect(parseChoices("<choices>\nA: 第一次\n</choices><choices>\nA: 第二次\n</choices>")).toEqual([
      "A: 第一次",
    ]);
  });

  it("resolveChoices returns trimmed non-empty lines", () => {
    expect(resolveChoices("A: 走近\nB: 等待\nC: 逃跑")).toEqual([
      "A: 走近",
      "B: 等待",
      "C: 逃跑",
    ]);
  });

  it("resolveChoices returns empty array for empty string", () => {
    expect(resolveChoices("")).toEqual([]);
  });

  it("uses original text as body fallback when content tag is missing", () => {
    const content = "<summary>第一次</summary>第二次</summary>";
    const parsed = parseMessage(content);

    expect(parsed.summary).toBe("第一次");
    expect(parsed.body).toBe(content);
  });
});
