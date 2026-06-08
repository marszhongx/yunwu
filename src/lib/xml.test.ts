import { describe, expect, it } from "vitest";
import { xml2json } from "@/lib/xml";

describe("xml2json", () => {
  it("parses known XML tags", () => {
    expect(xml2json("开头<summary>摘要</summary>结尾", ["summary"])).toEqual({
      summary: ["摘要"],
    });
  });

  it("stops an unclosed tag before the next known opening tag", () => {
    expect(
      xml2json("<content>正文<summary>摘要<status>状态</status>", [
        "content",
        "summary",
        "status",
      ]),
    ).toEqual({
      content: ["正文"],
      summary: ["摘要"],
      status: ["状态"],
    });
  });

  it("keeps repeated tag blocks in order", () => {
    expect(xml2json("<summary>第一次</summary><summary>第二次</summary>", ["summary"])).toEqual({
      summary: ["第一次", "第二次"],
    });
  });

  it("ignores stray closing tags outside known tag values", () => {
    expect(xml2json("<summary>第一次</summary>第二次</summary>", ["summary"])).toEqual({
      summary: ["第一次"],
    });
  });

  it("ignores unknown tags", () => {
    expect(xml2json("<unknown>保留</unknown><summary>摘要</summary>", ["summary"])).toEqual({
      summary: ["摘要"],
    });
  });
});
