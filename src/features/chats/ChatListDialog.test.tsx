import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { ChatListDialog } from "./ChatListDialog";
import * as characters from "@/services/characters";
import * as chats from "@/services/chats";
vi.mock("@/services/chats", () => ({
  createChat: vi.fn(),
  deleteChat: vi.fn(),
  listChats: vi.fn(),
  renameChat: vi.fn(),
}));

vi.mock("@/services/characters", () => ({
  listCharacters: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

test("loads chats, characters, and lorebooks when opened and creates a chat", async () => {
  const onOpenChange = vi.fn();
  const onSelectChat = vi.fn();
  vi.mocked(chats.listChats).mockResolvedValue([]);
  vi.mocked(characters.listCharacters).mockResolvedValue([
    character({ id: "char-1", name: "云雀" }),
  ]);
  vi.mocked(chats.createChat).mockResolvedValue({
    ...chat({ id: "chat-1", charId: "char-1" }),
    messages: [],
  });

  render(<ChatListDialog open onOpenChange={onOpenChange} onSelectChat={onSelectChat} />);

  expect(await screen.findByText("还没有对话")).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "对话" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "编辑 新建对话" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("选择角色")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "新建对话" }));

  expect(screen.getByRole("button", { name: "编辑 新建对话" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  expect(screen.getByLabelText("选择角色")).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button", { name: "新建对话" })[0]);

  await waitFor(() =>
    expect(chats.createChat).toHaveBeenCalledWith({
      charId: "char-1",
      title: "云雀",
    }),
  );
  expect(onSelectChat).toHaveBeenCalledWith("chat-1");
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("shows a selection empty state when chats exist but none is selected", async () => {
  vi.mocked(chats.listChats).mockResolvedValue([chat({ id: "chat-1", title: "旅途" })]);
  vi.mocked(characters.listCharacters).mockResolvedValue([]);
  render(<ChatListDialog open onOpenChange={() => {}} onSelectChat={() => {}} />);

  expect(await screen.findByText("选择一个对话")).toBeInTheDocument();
  expect(screen.getByText("从左侧选择对话进行管理，或创建一个新对话。")).toBeInTheDocument();
  expect(screen.queryByLabelText("标题")).not.toBeInTheDocument();
});

test("places the new chat item after existing chats", async () => {
  vi.mocked(chats.listChats).mockResolvedValue([chat({ id: "chat-1", title: "旅途" })]);
  vi.mocked(characters.listCharacters).mockResolvedValue([]);

  render(<ChatListDialog open onOpenChange={() => {}} onSelectChat={() => {}} />);

  await screen.findByRole("button", { name: "编辑 旅途" });
  const buttons = screen.getAllByRole("button", { name: /编辑 (旅途|新建对话)/ });
  expect(buttons.map((button) => button.textContent)).toEqual(["旅途", "新建对话"]);
});

test("renames and deletes existing chats", async () => {
  vi.mocked(chats.listChats)
    .mockResolvedValueOnce([chat({ id: "chat-1", title: "旧标题" })])
    .mockResolvedValueOnce([chat({ id: "chat-1", title: "新标题" })])
    .mockResolvedValueOnce([]);
  vi.mocked(characters.listCharacters).mockResolvedValue([]);
  vi.mocked(chats.renameChat).mockResolvedValue(chat({ id: "chat-1", title: "新标题" }));
  vi.mocked(chats.deleteChat).mockResolvedValue();

  render(<ChatListDialog open onOpenChange={() => {}} onSelectChat={() => {}} />);

  fireEvent.click(await screen.findByRole("button", { name: "编辑 旧标题" }));
  const titleInput = screen.getByLabelText("标题");
  fireEvent.change(titleInput, { target: { value: "新标题" } });
  fireEvent.click(screen.getByRole("button", { name: "保存" }));

  await waitFor(() => expect(chats.renameChat).toHaveBeenCalledWith("chat-1", "新标题"));
  expect(await screen.findByRole("button", { name: "编辑 新标题" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "删除" }));

  await waitFor(() => expect(chats.deleteChat).toHaveBeenCalledWith("chat-1"));
});

test("notifies parent when renaming or deleting the current chat", async () => {
  const onCurrentChatChanged = vi.fn();
  const onCurrentChatDeleted = vi.fn();
  vi.mocked(chats.listChats)
    .mockResolvedValueOnce([chat({ id: "chat-1", title: "旧标题" })])
    .mockResolvedValueOnce([chat({ id: "chat-1", title: "新标题" })])
    .mockResolvedValueOnce([]);
  vi.mocked(characters.listCharacters).mockResolvedValue([]);
  vi.mocked(chats.renameChat).mockResolvedValue(chat({ id: "chat-1", title: "新标题" }));
  vi.mocked(chats.deleteChat).mockResolvedValue();

  render(
    <ChatListDialog
      open
      currentChatId="chat-1"
      onOpenChange={() => {}}
      onSelectChat={() => {}}
      onCurrentChatChanged={onCurrentChatChanged}
      onCurrentChatDeleted={onCurrentChatDeleted}
    />,
  );

  fireEvent.click(await screen.findByRole("button", { name: "编辑 旧标题" }));
  fireEvent.change(screen.getByLabelText("标题"), { target: { value: "新标题" } });
  fireEvent.click(screen.getByRole("button", { name: "保存" }));

  await waitFor(() => expect(onCurrentChatChanged).toHaveBeenCalledTimes(1));

  fireEvent.click(screen.getByRole("button", { name: "删除" }));

  await waitFor(() => expect(onCurrentChatDeleted).toHaveBeenCalledTimes(1));
});

test("shows the persisted trimmed title after rename", async () => {
  vi.mocked(chats.listChats)
    .mockResolvedValueOnce([chat({ id: "chat-1", title: "旧标题" })])
    .mockResolvedValueOnce([chat({ id: "chat-1", title: "新标题" })]);
  vi.mocked(characters.listCharacters).mockResolvedValue([]);
  vi.mocked(chats.renameChat).mockResolvedValue(chat({ id: "chat-1", title: "新标题" }));

  render(<ChatListDialog open onOpenChange={() => {}} onSelectChat={() => {}} />);

  fireEvent.click(await screen.findByRole("button", { name: "编辑 旧标题" }));
  fireEvent.change(screen.getByLabelText("标题"), { target: { value: "  新标题  " } });
  fireEvent.click(screen.getByRole("button", { name: "保存" }));

  await waitFor(() => expect(chats.renameChat).toHaveBeenCalledWith("chat-1", "新标题"));
  expect(await screen.findByRole("button", { name: "编辑 新标题" })).toBeInTheDocument();
  expect(screen.getByLabelText("标题")).toHaveValue("新标题");
});

test("opens an existing chat", async () => {
  const onOpenChange = vi.fn();
  const onSelectChat = vi.fn();
  vi.mocked(chats.listChats).mockResolvedValue([chat({ id: "chat-1", title: "旅途" })]);
  vi.mocked(characters.listCharacters).mockResolvedValue([]);

  render(<ChatListDialog open onOpenChange={onOpenChange} onSelectChat={onSelectChat} />);

  fireEvent.click(await screen.findByRole("button", { name: "编辑 旅途" }));
  fireEvent.click(screen.getByRole("button", { name: "打开" }));

  expect(onSelectChat).toHaveBeenCalledWith("chat-1");
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

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
    ...overrides,
  };
}
