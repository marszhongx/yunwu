import { describe, expect, it } from "vitest";
import { DEFAULT_SYSTEM_PROMPTS } from "@/constants";
import {
  buildHistoryMessages,
  buildMessages,
  normalizeMessage,
  normalizeMessages,
  parseStatus,
  parseSummary,
  parseContent,
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
      { id: "a1", role: "assistant", content: "门后传来风声[STATUS]身体：无[/STATUS]" },
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
      { role: "assistant", content: "门后传来风声" },
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
          "[CONTENT]旧正文[/CONTENT][SUMMARY]主角进入大厅[/SUMMARY][STATUS]身体：无[/STATUS]",
      },
      { id: "u2", role: "user", content: "查看四周" },
      {
        id: "a2",
        role: "assistant",
        content:
          "[CONTENT]中篇正文[/CONTENT][SUMMARY]发现宝箱[/SUMMARY][STATUS]身体：疲惫[/STATUS]",
      },
      { id: "u3", role: "user", content: "打开宝箱" },
      {
        id: "a3",
        role: "assistant",
        content:
          "[CONTENT]最新正文[/CONTENT][SUMMARY]获得钥匙[/SUMMARY][STATUS]身体：良好[/STATUS]",
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

  it("parseSummary and parseStatus extract tags", () => {
    expect(parseSummary("正文【SUMMARY】雾散了【/SUMMARY】结尾")).toBe("雾散了");
    expect(parseStatus("正文[STATUS]身体：疲惫\n地点：驿站[/STATUS]结尾")).toBe(
      "身体：疲惫\n地点：驿站",
    );
  });

  it("parseContent extracts CONTENT tag", () => {
    expect(parseContent("[CONTENT]正文内容[/CONTENT][SUMMARY]摘要[/SUMMARY]")).toBe("正文内容");
  });

  it("parseContent falls back to stripping tags when no CONTENT tag", () => {
    const content =
      "正文[CHOICES]A: 走[/CHOICES]\n中段【SUMMARY】摘要【/SUMMARY】\n末尾[STATUS]身体：无[/STATUS]";

    expect(parseContent(content)).toBe("正文\n中段\n末尾");
  });
});
