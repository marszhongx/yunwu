import { describe, expect, test } from "vitest";
import { fromCharaCardV2, toCharaCardV2 } from "@/lib/charaCardV2";
import type { CharacterCard } from "@/types";

describe("chara card v2", () => {
  test("exports an internal character as Chara Card V2", () => {
    const card = toCharaCardV2(character());

    expect(card.spec).toBe("chara_card_v2");
    expect(card.spec_version).toBe("2.0");
    expect(card.data.name).toBe("云雀");
    expect(card.data.character_book?.entries[0]).toMatchObject({
      keys: ["山"],
      content: "山中旧事",
      enabled: true,
    });
    expect(card.data.avatar).toBeUndefined();
    expect(card.data.opening_user_choices).toEqual(["观察四周"]);
  });

  test("imports standard Chara Card V2 data", () => {
    const result = fromCharaCardV2({
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: {
        name: "镜城侦探",
        description: "能读取霓虹倒影。",
        first_mes: "雨夜，你推开门。",
        personality: "冷静",
        scenario: "雨夜事务所",
        mes_example: "用户: 你好",
        alternate_greetings: ["又见面了"],
        creator_notes: "备注",
        tags: ["侦探"],
        creator: "mars",
        character_version: "1.0",
        system_prompt: "保持冷静叙述。",
        post_history_instructions: "记住委托目标。",
        opening_user_choices: ["说明委托"],
        character_book: {
          name: "镜城线索",
          entries: [
            {
              keys: ["霓虹"],
              content: "霓虹会暴露秘密。",
              enabled: false,
              case_sensitive: true,
              selective: true,
              secondary_keys: ["倒影"],
              constant: true,
              position: "after_char",
              priority: 200,
              extensions: { source: "test" },
            },
            { key: "雨", content: "雨声很密。" },
          ],
        },
      },
    });

    expect(result).toMatchObject({
      name: "镜城侦探",
      description: "能读取霓虹倒影。",
      first_mes: "雨夜，你推开门。",
      opening_user_choices: ["说明委托"],
      entries: [
        { keys: ["霓虹"], content: "霓虹会暴露秘密。", enabled: false },
        { keys: ["雨"], content: "雨声很密。", enabled: true },
      ],
    });
  });

  test("exports only fields supported by the app", () => {
    const imported = fromCharaCardV2({
      spec: "chara_card_v2",
      data: {
        name: "线索管理员",
        description: "管理线索。",
        system_prompt: "只说事实。",
        post_history_instructions: "保持记录。",
        character_book: {
          entries: [
            {
              keys: ["线索"],
              content: "线索不可忽视。",
              enabled: true,
              case_sensitive: true,
              selective: true,
              secondary_keys: ["证据"],
              constant: true,
              position: "after_char",
              priority: 300,
              extensions: { imported: true },
            },
          ],
        },
      },
    });
    const exported = toCharaCardV2({ ...character(), ...imported } as CharacterCard);

    expect(exported.data.system_prompt).toBe("");
    expect(exported.data.post_history_instructions).toBe("");
    expect(exported.data.character_book?.entries[0]).toMatchObject({
      keys: ["线索"],
      content: "线索不可忽视。",
      case_sensitive: false,
      selective: false,
      secondary_keys: [],
      constant: false,
      position: "before_char",
      priority: 100,
      extensions: {},
    });
  });

  test("uses character_book entries", () => {
    const result = fromCharaCardV2({
      spec: "chara_card_v2",
      data: {
        name: "混合角色",
        description: "包含角色书条目。",
        character_book: { entries: [{ keys: ["书"], content: "标准角色书。" }] },
      },
    });

    expect(result.entries).toEqual([{ keys: ["书"], content: "标准角色书。", enabled: true }]);
  });

  test("imports constant lorebook entries without keys", () => {
    const result = fromCharaCardV2({
      spec: "chara_card_v2",
      data: {
        name: "常驻规则角色",
        description: "包含常驻规则。",
        character_book: { entries: [{ keys: [], content: "始终注入。", constant: true }] },
      },
    });

    expect(result.entries).toEqual([{ keys: [], content: "始终注入。", enabled: true }]);
  });

  test("exports stored avatar", () => {
    const exported = toCharaCardV2({ ...character(), avatar: "data:image/png;base64,avatar" });

    expect(exported.data.avatar).toBe("data:image/png;base64,avatar");
  });

  test("omits avatar when exporting PNG metadata", () => {
    const exported = toCharaCardV2(
      { ...character(), avatar: "data:image/png;base64,avatar" },
      { includeAvatar: false },
    );

    expect(exported.data.avatar).toBeUndefined();
  });

  test("exports safely when array fields are missing", () => {
    const exported = toCharaCardV2({
      id: "char-1",
      name: "旧角色",
      description: "缺少数组字段。",
      first_mes: "",
      personality: "",
      scenario: "",
      mes_example: "",
      creator_notes: "",
      creator: "",
      character_version: "",
    } as CharacterCard);

    expect(exported.data.alternate_greetings).toEqual([]);
    expect(exported.data.tags).toEqual([]);
    expect(exported.data.character_book?.entries).toEqual([]);
  });

  test("uses filename as fallback name when character content exists", () => {
    const result = fromCharaCardV2(
      { spec: "chara_card_v2", data: { description: "无名角色" } },
      "fallback.json",
    );

    expect(result.name).toBe("fallback");
  });

  test("rejects empty character-like data", () => {
    expect(() => fromCharaCardV2({ spec: "chara_card_v2", data: { description: "" } }, "fallback.json")).toThrow(
      "不支持的角色卡格式",
    );
  });

  test("rejects unsupported data", () => {
    expect(() => fromCharaCardV2({ hello: "world" }, "fallback.json")).toThrow("不支持的角色卡格式");
    expect(() => fromCharaCardV2({ name: "直接 data 对象" }, "fallback.json")).toThrow("不支持的角色卡格式");
  });
});

function character(): CharacterCard {
  return {
    id: "char-1",
    name: "云雀",
    description: "旅行者",
    first_mes: "你好",
    personality: "温和",
    scenario: "山间",
    mes_example: "用户: 你好",
    alternate_greetings: ["早安"],
    opening_user_choices: ["观察四周"],
    entries: [{ keys: ["山"], content: "山中旧事", enabled: true }],
    creator_notes: "备注",
    tags: ["旅行"],
    creator: "mars",
    character_version: "1.0",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  };
}
