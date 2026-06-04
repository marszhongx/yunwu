import { uuid } from "../domain/ids";
import { parseStatus, parseSummary } from "../domain/messages";
import type { Chat, ChatMessage, MessageRole } from "../domain/types";
import {
  deleteMessagesByChatId,
  deleteOne,
  getAll,
  getMessagesByChatId,
  getOne,
  putOne,
} from "./db";
import { getCharacter } from "./characters";

type ChatWithMessages = Chat & { messages: StoredMessage[] };
type ChatInput = { charId: string; title?: string };
type MessageInput = Partial<Record<keyof ChatMessage, unknown>>;
type StoredMessage = ChatMessage & { id: string; chatId: string; createdAt: string };
type DerivedChatState = Pick<Chat, "summaries" | "latestSummary" | "latestStatus">;

let lastTimestamp = 0;

export async function listChats(): Promise<Chat[]> {
  const chats = await getAll("chats");
  return chats.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getChat(id: string): Promise<ChatWithMessages | null> {
  const chat = await getOne("chats", id);
  if (!chat) return null;

  return { ...chat, messages: await getMessagesByChatId(id) };
}

export async function createChat({ charId, title }: ChatInput): Promise<ChatWithMessages> {
  const character = await getCharacter(charId);
  const now = nowIso();
  const chat: Chat = {
    id: uuid(),
    title: title || character?.name || "新对话",
    charId,
    summaries: [],
    latestSummary: "",
    latestStatus: "",
    createdAt: now,
    updatedAt: now,
  };
  await putOne("chats", chat);

  if (character?.first_mes) {
    await putMessage(
      normalizeMessage(chat.id, { role: "assistant", content: character.first_mes }),
    );
  }

  const created = await getChat(chat.id);
  if (!created) throw new Error("Failed to create chat");
  return created;
}

export async function renameChat(id: string, title: string): Promise<Chat | null> {
  const chat = await getOne("chats", id);
  if (!chat) return null;

  const updated = { ...chat, title: title.trim(), updatedAt: nowIso() };
  return putOne("chats", updated);
}

export async function deleteChat(id: string): Promise<void> {
  await deleteMessagesByChatId(id);
  await deleteOne("chats", id);
}

export async function addMessage(chatId: string, input: MessageInput): Promise<StoredMessage> {
  const message = normalizeMessage(chatId, input);
  await putMessage(message);
  await recomputeChatState(chatId);
  return message;
}

export async function updateMessage(
  chatId: string,
  messageId: string,
  patch: MessageInput,
): Promise<StoredMessage | null> {
  const existing = await getOne("messages", messageId);
  if (!existing || existing.chatId !== chatId) return null;

  const message = normalizeMessage(chatId, { ...existing, ...patch, id: messageId, chatId });
  await putMessage(message);
  await recomputeChatState(chatId);
  return message;
}

export async function deleteMessage(chatId: string, messageId: string): Promise<void> {
  const existing = await getOne("messages", messageId);
  if (!existing || existing.chatId !== chatId) return;

  await deleteOne("messages", messageId);
  await recomputeChatState(chatId);
}

async function recomputeChatState(chatId: string): Promise<void> {
  const chat = await getOne("chats", chatId);
  if (!chat) return;

  const messages = await getMessagesByChatId(chatId);
  const derived = deriveStateFromMessages(messages);

  await putOne("chats", {
    ...chat,
    ...derived,
    updatedAt: nowIso(),
  });
}

function deriveStateFromMessages(messages: StoredMessage[]): DerivedChatState {
  const summaries: string[] = [];
  let latestStatus = "";

  for (const message of messages) {
    if (message.role !== "assistant") continue;

    const summary = parseSummary(message.content);
    if (summary !== null) summaries.push(summary);

    const status = parseStatus(message.content);
    if (status !== null) latestStatus = status;
  }

  return {
    summaries,
    latestSummary: summaries.length > 0 ? summaries[summaries.length - 1] : "",
    latestStatus,
  };
}

function normalizeMessage(chatId: string, input: MessageInput): StoredMessage {
  const message: StoredMessage = {
    id: text(input.id) || uuid(),
    chatId,
    role: normalizeRole(input.role),
    content: text(input.content),
    createdAt: text(input.createdAt) || nowIso(),
  };

  if ("usage" in input) {
    message.usage = input.usage;
  }

  return message;
}

function putMessage(message: StoredMessage): Promise<StoredMessage> {
  return putOne("messages", message);
}

function normalizeRole(role: unknown): MessageRole {
  if (role === "user" || role === "image") return role;
  return "assistant";
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nowIso(): string {
  const now = Date.now();
  lastTimestamp = Math.max(now, lastTimestamp + 1);
  return new Date(lastTimestamp).toISOString();
}
