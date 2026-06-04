import { beforeEach, describe, expect, test } from "vitest";
import {
  createCharacter,
  deleteCharacter,
  listCharacters,
  updateCharacter,
} from "@/services/characters";
import {
  addMessage,
  createChat,
  deleteChat,
  deleteMessage,
  getChat,
  listChats,
  renameChat,
  updateMessage,
} from "@/services/chats";
import { clearDatabase } from "@/services/db";

describe("IndexedDB data services", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  test("stores characters", async () => {
    const character = await createCharacter({
      name: " 雾中人 ",
      description: " desc ",
      first_mes: " hello ",
      personality: " calm ",
      scenario: " mist ",
      mes_example: " ex ",
      alternate_greetings: [" hi ", ""],
      creator_notes: " notes ",
      tags: [" npc ", ""],
      creator: " mars ",
      character_version: " 1 ",
    });

    const updated = await updateCharacter(character.id, { personality: " brave " });

    expect(updated).toEqual({ ...character, personality: "brave", updatedAt: updated?.updatedAt });
    expect(updated?.updatedAt).not.toBe(character.updatedAt);
    expect(await listCharacters()).toEqual([updated]);

    await deleteCharacter(character.id);

    expect(await listCharacters()).toEqual([]);
  });

  test("stores chats and messages", async () => {
    const character = await createCharacter({ name: "云雾", first_mes: "初见" });
    const chat = await createChat({ charId: character.id });
    const userMessage = await addMessage(chat.id, { role: "user", content: "你好" });
    const imageMessage = await addMessage(chat.id, {
      role: "image",
      content: "https://pub.example.com/generated.jpg",
    });
    const assistantMessage = await addMessage(chat.id, {
      role: "assistant",
      content: "见到了你 [SUMMARY]met[/SUMMARY] [STATUS]身体：健康[/STATUS]",
    });

    expect(imageMessage.role).toBe("image");
    expect((await getChat(chat.id))?.messages).toEqual([
      expect.objectContaining({ role: "assistant", content: "初见" }),
      userMessage,
      expect.objectContaining({ role: "image", content: "https://pub.example.com/generated.jpg" }),
      assistantMessage,
    ]);

    const renamed = await renameChat(chat.id, " 新标题 ");

    expect(renamed?.title).toBe("新标题");
    expect((await listChats())[0]?.title).toBe("新标题");

    await deleteMessage(chat.id, userMessage.id);

    expect((await getChat(chat.id))?.messages.map((message) => message.id)).toEqual([
      chat.messages[0]?.id,
      imageMessage.id,
      assistantMessage.id,
    ]);

    await deleteChat(chat.id);

    expect(await listChats()).toEqual([]);
    expect(await getChat(chat.id)).toBeNull();
  });

  test("addMessage collects summaries into array and tracks latest status", async () => {
    const character = await createCharacter({ name: "云雾" });
    const chat = await createChat({ charId: character.id });

    await addMessage(chat.id, {
      role: "assistant",
      content: "[SUMMARY]first[/SUMMARY] [STATUS]旧[/STATUS]",
    });
    await addMessage(chat.id, {
      role: "assistant",
      content: "[SUMMARY]second[/SUMMARY] 没有状态标签",
    });

    const updated = await getChat(chat.id);
    expect(updated?.summaries).toEqual(["first", "second"]);
    expect(updated?.latestSummary).toBe("second");
    expect(updated?.latestStatus).toBe("旧");
  });

  test("summaries reflect current messages without preserveExisting", async () => {
    const character = await createCharacter({ name: "云雾" });
    const chat = await createChat({ charId: character.id });

    await addMessage(chat.id, {
      role: "assistant",
      content: "[SUMMARY]old[/SUMMARY] [STATUS]旧[/STATUS]",
    });
    await addMessage(chat.id, {
      role: "assistant",
      content: "没有摘要和状态标签",
    });

    const updated = await getChat(chat.id);
    expect(updated?.summaries).toEqual(["old"]);
    expect(updated?.latestSummary).toBe("old");
    expect(updated?.latestStatus).toBe("旧");
  });

  test("deleteMessage removes summary from array and recomputes", async () => {
    const character = await createCharacter({ name: "云雾" });
    const chat = await createChat({ charId: character.id });
    const first = await addMessage(chat.id, {
      role: "assistant",
      content: "[SUMMARY]old[/SUMMARY] [STATUS]旧[/STATUS]",
    });
    const second = await addMessage(chat.id, {
      role: "assistant",
      content: "[SUMMARY]new[/SUMMARY] [STATUS]新[/STATUS]",
    });

    expect((await getChat(chat.id))?.summaries).toEqual(["old", "new"]);

    await deleteMessage(chat.id, second.id);

    let updated = await getChat(chat.id);
    expect(updated?.summaries).toEqual(["old"]);
    expect(updated?.latestSummary).toBe("old");
    expect(updated?.latestStatus).toBe("旧");
    expect(updated?.messages.map((message) => message.id)).toEqual([first.id]);

    const third = await addMessage(chat.id, {
      role: "assistant",
      content: "没有摘要和状态标签",
    });
    const fourth = await addMessage(chat.id, {
      role: "assistant",
      content: "[SUMMARY]newest[/SUMMARY] [STATUS]最新[/STATUS]",
    });

    await deleteMessage(chat.id, fourth.id);

    updated = await getChat(chat.id);
    expect(updated?.summaries).toEqual(["old"]);
    expect(updated?.latestSummary).toBe("old");
    expect(updated?.latestStatus).toBe("旧");
    expect(updated?.messages.map((message) => message.id)).toEqual([first.id, third.id]);

    await deleteMessage(chat.id, third.id);
    await deleteMessage(chat.id, first.id);

    updated = await getChat(chat.id);
    expect(updated?.summaries).toEqual([]);
    expect(updated?.latestSummary).toBe("");
    expect(updated?.latestStatus).toBe("");
    expect(updated?.messages).toEqual([]);
  });

  test("updateMessage removes summary from array when tags are stripped", async () => {
    const character = await createCharacter({ name: "云雾" });
    const chat = await createChat({ charId: character.id });
    const message = await addMessage(chat.id, {
      role: "assistant",
      content: "[SUMMARY]old[/SUMMARY] [STATUS]旧[/STATUS]",
    });

    await updateMessage(chat.id, message.id, { content: "没有摘要和状态标签" });

    const updated = await getChat(chat.id);
    expect(updated?.summaries).toEqual([]);
    expect(updated?.latestSummary).toBe("");
    expect(updated?.latestStatus).toBe("");
  });
});
