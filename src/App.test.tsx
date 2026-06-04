import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import App from "@/App";
import * as characters from "@/services/characters";
import * as chats from "@/services/chats";
import * as settings from "@/services/settings";

vi.mock("@/services/settings", () => ({
  getSettings: vi.fn().mockReturnValue({
    activeProviderId: "",
    providers: [],
    theme: "dark",
    systemPrompts: ["默认系统提示"],
    imageProviders: [],
    activeImageProviderId: "",
  }),
  getActiveProvider: vi.fn().mockReturnValue(null),
  getActiveImageProvider: vi.fn().mockReturnValue(null),
  saveTheme: vi.fn(),
}));

vi.mock("@/services/chats", () => ({
  createChat: vi.fn(),
  deleteChat: vi.fn(),
  getChat: vi.fn(),
  listChats: vi.fn(),
  renameChat: vi.fn(),
}));

vi.mock("@/services/characters", () => ({
  getCharacter: vi.fn(),
  listCharacters: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(settings.getSettings).mockReturnValue({
    activeProviderId: "",
    providers: [],
    theme: "dark",
    systemPrompts: ["默认系统提示"],
    imageProviders: [],
    activeImageProviderId: "",
  });
  vi.mocked(settings.getActiveProvider).mockReturnValue(null);
});

test("selects a chat from the records dialog and shows its chat view and sidebar details", async () => {
  vi.mocked(chats.listChats).mockResolvedValue([chat({ id: "chat-1", title: "山间旅途" })]);
  vi.mocked(characters.listCharacters).mockResolvedValue([character()]);
  vi.mocked(chats.getChat).mockResolvedValue(
    chat({
      id: "chat-1",
      title: "山间旅途",
      latestStatus: "状态文字",
      latestSummary: "摘要文字",
    }) as Awaited<ReturnType<typeof chats.getChat>>,
  );
  vi.mocked(characters.getCharacter).mockResolvedValue(
    character({
      name: "云雀",
      entries: [{ keys: ["山"], content: "山间常有白雾。", enabled: true }],
    }),
  );

  render(<App />);

  expect(screen.getByRole("heading", { name: "还没有对话" })).toBeInTheDocument();
  expect(screen.getByText("先创建一个对话，再继续角色扮演。")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "新建对话" }));
  expect(await screen.findByRole("dialog", { name: "对话记录" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await openChatFromDialog("山间旅途");

  await waitFor(() => expect(chats.getChat).toHaveBeenCalledWith("chat-1"));
  expect(await screen.findByPlaceholderText("输入行动，Ctrl/⌘ + Enter 发送")).toBeInTheDocument();
  expect(screen.getByText("状态文字")).toBeInTheDocument();
  expect(screen.getByText("摘要文字")).toBeInTheDocument();
  expect(screen.getByText(/云雀/)).toBeInTheDocument();
});

test("updates the main title when the selected chat is renamed from the records dialog", async () => {
  vi.mocked(chats.listChats)
    .mockResolvedValueOnce([chat({ id: "chat-1", title: "旧标题" })])
    .mockResolvedValueOnce([chat({ id: "chat-1", title: "旧标题" })])
    .mockResolvedValueOnce([chat({ id: "chat-1", title: "新标题" })]);
  vi.mocked(characters.listCharacters).mockResolvedValue([character()]);
  vi.mocked(chats.getChat)
    .mockResolvedValueOnce(chat({ id: "chat-1", title: "旧标题" }))
    .mockResolvedValueOnce(chat({ id: "chat-1", title: "新标题" }));
  vi.mocked(characters.getCharacter).mockResolvedValue(character());
  vi.mocked(chats.renameChat).mockResolvedValue(chat({ id: "chat-1", title: "新标题" }));

  render(<App />);

  await openChatFromDialog("旧标题");
  expect(await screen.findByPlaceholderText("输入行动，Ctrl/⌘ + Enter 发送")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "记录" }));
  fireEvent.click(await screen.findByRole("button", { name: "编辑 旧标题" }));
  const titleInput = screen.getByLabelText("标题");
  fireEvent.change(titleInput, { target: { value: "新标题" } });
  fireEvent.click(screen.getByRole("button", { name: "保存" }));

  await waitFor(() => expect(chats.renameChat).toHaveBeenCalledWith("chat-1", "新标题"));
  expect(await screen.findByRole("button", { name: "编辑 新标题" })).toBeInTheDocument();
});

test("clears the selected chat when it is deleted from the records dialog", async () => {
  vi.mocked(chats.listChats)
    .mockResolvedValueOnce([chat({ id: "chat-1", title: "待删对话", latestStatus: "旧状态" })])
    .mockResolvedValueOnce([chat({ id: "chat-1", title: "待删对话", latestStatus: "旧状态" })])
    .mockResolvedValueOnce([]);
  vi.mocked(characters.listCharacters).mockResolvedValue([character({ name: "云雀" })]);
  vi.mocked(chats.getChat).mockResolvedValue(
    chat({ id: "chat-1", title: "待删对话", latestStatus: "旧状态" }),
  );
  vi.mocked(characters.getCharacter).mockResolvedValue(character({ name: "云雀" }));
  vi.mocked(chats.deleteChat).mockResolvedValue();

  render(<App />);

  await openChatFromDialog("待删对话");
  expect(await screen.findByPlaceholderText("输入行动，Ctrl/⌘ + Enter 发送")).toBeInTheDocument();
  expect(screen.getByText("旧状态")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "记录" }));
  fireEvent.click(await screen.findByRole("button", { name: "编辑 待删对话" }));
  fireEvent.click(screen.getByRole("button", { name: "删除" }));

  await waitFor(() => expect(chats.deleteChat).toHaveBeenCalledWith("chat-1"));
  expect(await screen.findByRole("heading", { name: "还没有对话" })).toBeInTheDocument();
  expect(screen.queryByText("待删对话")).not.toBeInTheDocument();
  expect(screen.queryByText("旧状态")).not.toBeInTheDocument();
});

test("reopens character dialog with a fresh initial state", async () => {
  vi.mocked(characters.listCharacters).mockResolvedValue([character({ name: "云雀" })]);

  render(<App />);

  fireEvent.click(screen.getByRole("button", { name: "角色" }));
  fireEvent.click(await screen.findByRole("button", { name: "编辑 云雀" }));
  expect(screen.getByLabelText("名称")).toHaveValue("云雀");
  fireEvent.click(screen.getByRole("button", { name: "Close" }));

  fireEvent.click(screen.getByRole("button", { name: "角色" }));

  expect(await screen.findByRole("heading", { name: "选择一个角色" })).toBeInTheDocument();
  expect(screen.queryByLabelText("名称")).not.toBeInTheDocument();
});

async function openChatFromDialog(title: string) {
  fireEvent.click(screen.getByRole("button", { name: "记录" }));
  fireEvent.click(await screen.findByRole("button", { name: `编辑 ${title}` }));
  fireEvent.click(screen.getByRole("button", { name: "打开" }));
}

function chat(overrides: Partial<Awaited<ReturnType<typeof chats.listChats>>[number]> = {}) {
  return {
    id: "chat-1",
    title: "对话",
    charId: "char-1",
    summaries: [],
    latestSummary: "",
    latestStatus: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    messages: [],
    ...overrides,
  };
}

function character(
  overrides: Partial<Awaited<ReturnType<typeof characters.listCharacters>>[number]> = {},
) {
  return {
    id: "char-1",
    name: "角色",
    description: "描述",
    first_mes: "你好",
    personality: "温和",
    scenario: "山间",
    mes_example: "",
    alternate_greetings: [],
    opening_user_choices: [],
    entries: [],
    creator_notes: "",
    tags: [],
    creator: "",
    character_version: "",
    ...overrides,
  };
}
