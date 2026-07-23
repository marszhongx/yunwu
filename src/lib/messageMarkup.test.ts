import { describe, expect, it } from "vitest";
import { parseMessageMarkup } from "@/lib/messageMarkup";

describe("parseMessageMarkup", () => {
  it("keeps top-level tags in source order", () => {
    expect(
      parseMessageMarkup("<content>正文</content><summary>摘要</summary><status>状态</status>"),
    ).toEqual([
      { type: "element", name: "content", content: "正文" },
      { type: "element", name: "summary", content: "摘要" },
      { type: "element", name: "status", content: "状态" },
    ]);
  });

  it("treats untagged text as content", () => {
    expect(parseMessageMarkup("普通 **Markdown** 回复")).toEqual([
      { type: "element", name: "content", content: "普通 **Markdown** 回复" },
    ]);
  });

  it("keeps leading body and streamed unclosed known tags", () => {
    expect(parseMessageMarkup("正文<summary>摘要</summary><status>状")).toEqual([
      { type: "element", name: "content", content: "正文" },
      { type: "element", name: "summary", content: "摘要" },
      { type: "element", name: "status", content: "状" },
    ]);
  });

  it("stops an unclosed tag before the next opening tag", () => {
    expect(
      parseMessageMarkup(
        "<content>正文<summary>摘要<status>状态</status><choices>- 前进</choices>",
      ),
    ).toEqual([
      { type: "element", name: "content", content: "正文" },
      { type: "element", name: "summary", content: "摘要" },
      { type: "element", name: "status", content: "状态" },
      { type: "element", name: "choices", content: "- 前进" },
    ]);
  });

  it("hides a trailing partial known tag from the body", () => {
    expect(parseMessageMarkup("正文\n\n<sum")).toEqual([
      { type: "element", name: "content", content: "正文" },
    ]);
  });

  it("restores the existing delimiter placeholders", () => {
    expect(parseMessageMarkup("__LT__content__GT__正文__LT__/content__GT__")).toEqual([
      { type: "element", name: "content", content: "正文" },
    ]);
  });

  it("keeps an unknown complete tag for transparent rendering", () => {
    expect(parseMessageMarkup("<scene>雨夜</scene>")).toEqual([
      { type: "element", name: "scene", content: "雨夜" },
    ]);
  });
});
