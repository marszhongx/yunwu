import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { ChatView } from "@/components/biz/ChatView";
import type { CharacterCard, Chat, ChatMessage, ProviderSettings } from "@/types";
import * as chats from "@/services/chats";
import * as ai from "@/services/ai";
import * as settings from "@/services/settings";
import { toast } from "sonner";

vi.mock("@/services/chats", () => ({
  addMessage: vi.fn(),
  updateMessage: vi.fn(),
  deleteMessage: vi.fn(),
}));

vi.mock("@/services/ai", () => ({
  streamAssistantText: vi.fn(),
  generateImage: vi.fn(),
}));

vi.mock("@/services/settings", () => ({
  getActiveProvider: vi.fn(),
  getSettings: vi.fn(),
}));

let activeImageProvider: {
  apiKey: string;
  baseUrl: string;
  model: string;
  type: string;
} | null = null;

vi.mock("@/store/appState", () => ({
  useAppState: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) => selector({ activeImageProvider }),
    { getState: () => ({ activeImageProvider }) },
  ),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

beforeEach(() => {
  activeImageProvider = null;
  vi.resetAllMocks();
  vi.mocked(settings.getSettings).mockReturnValue({
    activeProviderId: "provider-1",
    providers: [activeProvider()],
    theme: "dark",
    systemPrompts: ["默认系统提示"],
    imageProviders: [],
    activeImageProviderId: "",
  });
});

test("shows provider error and does not add messages when no provider is active", async () => {
  vi.mocked(settings.getActiveProvider).mockReturnValue(null);

  render(<ChatView chat={chat()} character={null} />);

  fireEvent.change(screen.getByPlaceholderText("输入行动，Ctrl/⌘ + Enter 发送"), {
    target: { value: "走进雾中" },
  });
  fireEvent.click(screen.getByRole("button", { name: "发送" }));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("请先配置并激活 Provider"));
  expect(chats.addMessage).not.toHaveBeenCalled();
  expect(ai.streamAssistantText).not.toHaveBeenCalled();
});

test("adds user and assistant messages and displays streamed text", async () => {
  const provider = activeProvider();
  const onChanged = vi.fn();
  vi.mocked(settings.getActiveProvider).mockReturnValue(provider);
  vi.mocked(chats.addMessage)
    .mockResolvedValueOnce(message({ id: "user-1", role: "user", content: "走进雾中" }))
    .mockResolvedValueOnce(message({ id: "assistant-1", role: "assistant", content: "" }));
  vi.mocked(chats.updateMessage).mockResolvedValue(
    message({ id: "assistant-1", role: "assistant", content: "雾来了" }),
  );
  let finishStream: (() => void) | undefined;
  vi.mocked(ai.streamAssistantText).mockImplementation(
    ({ onText }) =>
      new Promise((resolve) => {
        onText?.("雾");
        finishStream = () => {
          onText?.("来了");
          resolve({ text: "雾来了" });
        };
      }),
  );

  render(<ChatView chat={chat()} character={character()} onChanged={onChanged} />);

  fireEvent.change(screen.getByPlaceholderText("输入行动，Ctrl/⌘ + Enter 发送"), {
    target: { value: "  走进雾中  " },
  });
  fireEvent.click(screen.getByRole("button", { name: "发送" }));

  expect(await screen.findByText("雾")).toBeInTheDocument();
  await act(async () => {
    finishStream?.();
  });
  await waitFor(() =>
    expect(chats.updateMessage).toHaveBeenCalledWith("chat-1", "assistant-1", {
      content: "雾来了",
    }),
  );
  expect(chats.addMessage).toHaveBeenNthCalledWith(1, "chat-1", {
    role: "user",
    content: "走进雾中",
  });
  expect(chats.addMessage).toHaveBeenNthCalledWith(2, "chat-1", {
    role: "assistant",
    content: "",
  });
  expect(ai.streamAssistantText).toHaveBeenCalledWith(
    expect.objectContaining({
      provider,
      messages: expect.any(Array),
      onText: expect.any(Function),
    }),
  );
  expect(onChanged).toHaveBeenCalledTimes(2);
});

test("shows a visual loading indicator instead of loading text", async () => {
  vi.mocked(settings.getActiveProvider).mockReturnValue(activeProvider());
  vi.mocked(chats.addMessage)
    .mockResolvedValueOnce(message({ id: "user-1", role: "user", content: "走进雾中" }))
    .mockResolvedValueOnce(message({ id: "assistant-1", role: "assistant", content: "" }));
  vi.mocked(ai.streamAssistantText).mockImplementation(() => new Promise(() => {}));

  render(<ChatView chat={chat()} character={null} />);

  fireEvent.change(screen.getByPlaceholderText("输入行动，Ctrl/⌘ + Enter 发送"), {
    target: { value: "走进雾中" },
  });
  fireEvent.click(screen.getByRole("button", { name: "发送" }));

  expect(await screen.findByLabelText("回复生成中")).toBeInTheDocument();
  expect(screen.queryByText("生成中")).not.toBeInTheDocument();
});

test("passes custom system prompts into AI request", async () => {
  vi.mocked(settings.getActiveProvider).mockReturnValue(activeProvider());
  vi.mocked(settings.getSettings).mockReturnValue({
    activeProviderId: "provider-1",
    providers: [activeProvider()],
    theme: "dark",
    systemPrompts: ["自定义第一条", "自定义第二条"],
    imageProviders: [],
    activeImageProviderId: "",
  });
  vi.mocked(chats.addMessage)
    .mockResolvedValueOnce(message({ id: "user-1", role: "user", content: "走进雾中" }))
    .mockResolvedValueOnce(message({ id: "assistant-1", role: "assistant", content: "" }));
  vi.mocked(chats.updateMessage).mockResolvedValue(
    message({ id: "assistant-1", role: "assistant", content: "雾来了" }),
  );
  vi.mocked(ai.streamAssistantText).mockResolvedValue({ text: "雾来了" });

  render(<ChatView chat={chat()} character={null} />);

  fireEvent.change(screen.getByPlaceholderText("输入行动，Ctrl/⌘ + Enter 发送"), {
    target: { value: "走进雾中" },
  });
  fireEvent.click(screen.getByRole("button", { name: "发送" }));

  await waitFor(() => expect(ai.streamAssistantText).toHaveBeenCalled());
  expect(vi.mocked(ai.streamAssistantText).mock.calls[0]?.[0].messages.slice(0, 2)).toEqual([
    { role: "system", content: "自定义第一条" },
    { role: "system", content: "自定义第二条" },
  ]);
});

test("hides CHOICES tag but shows SUMMARY and STATUS content in message bubbles", () => {
  render(
    <ChatView
      chat={chat({
        messages: [
          message({
            id: "assistant-1",
            role: "assistant",
            content:
              "<content>正文</content>\n<summary>摘要</summary>\n<status>状态</status>\n<choices>\nA: 向左走\nB: 向右走\nC: 原地等待\nD: 呼叫同伴\n</choices>",
          }),
        ],
      })}
      character={null}
    />,
  );

  expect(screen.getByText(/正文/)).toBeInTheDocument();
  expect(screen.getByText(/摘要/)).toBeInTheDocument();
  expect(screen.getByText(/状态/)).toBeInTheDocument();
  expect(screen.queryByText(/SUMMARY|STATUS|CHOICES/)).not.toBeInTheDocument();
  expect(screen.getByText("A: 向左走")).toBeInTheDocument();
});

test("shows a visual image loading bubble while generating an image", async () => {
  activeImageProvider = {
    apiKey: "image-key",
    baseUrl: "https://api.example.com/v1",
    model: "gpt-image-1",
    type: "openai",
  };
  vi.mocked(ai.generateImage).mockImplementation(() => new Promise(() => {}));

  render(
    <ChatView
      chat={chat({
        messages: [
          message({
            id: "assistant-1",
            role: "assistant",
            content: "画一片雾中的森林",
          }),
        ],
      })}
      character={null}
    />,
  );

  fireEvent.click(screen.getAllByRole("button")[0]);

  expect(await screen.findByLabelText("图片生成中")).toBeInTheDocument();
});

test("hides inactive assistant choices instead of disabling them", () => {
  render(
    <ChatView
      chat={chat({
        messages: [
          message({
            id: "assistant-1",
            role: "assistant",
            content: "正文\n<choices>\nA: 向左走\nB: 向右走\n</choices>",
          }),
          message({ id: "user-1", role: "user", content: "继续前进" }),
        ],
      })}
      character={null}
    />,
  );

  expect(screen.queryByRole("button", { name: "A: 向左走" })).not.toBeInTheDocument();
});

test("keeps assistant choices enabled when image messages follow", async () => {
  vi.mocked(settings.getActiveProvider).mockReturnValue(activeProvider());
  vi.mocked(chats.addMessage)
    .mockResolvedValueOnce(message({ id: "user-1", role: "user", content: "向左走" }))
    .mockResolvedValueOnce(message({ id: "assistant-2", role: "assistant", content: "新的回应" }));
  vi.mocked(chats.updateMessage).mockResolvedValue(
    message({ id: "assistant-2", content: "新的回应" }),
  );
  vi.mocked(ai.streamAssistantText).mockImplementation(async ({ onText }) => {
    onText?.("新的回应");
    return { text: "新的回应" };
  });

  render(
    <ChatView
      chat={chat({
        messages: [
          message({
            id: "assistant-1",
            role: "assistant",
            content: "正文\n<choices>\nA: 向左走\nB: 向右走\n</choices>",
          }),
          message({
            id: "image-1",
            role: "image",
            content: "https://pub.example.com/generated.jpg",
          }),
        ],
      })}
      character={null}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "A: 向左走" }));

  await waitFor(() =>
    expect(chats.addMessage).toHaveBeenNthCalledWith(1, "chat-1", {
      role: "user",
      content: "A: 向左走",
    }),
  );
});

test("does not duplicate pending messages when parent reloads persisted placeholders during stream", async () => {
  vi.mocked(settings.getActiveProvider).mockReturnValue(activeProvider());
  vi.mocked(chats.addMessage)
    .mockResolvedValueOnce(message({ id: "user-1", role: "user", content: "走进雾中" }))
    .mockResolvedValueOnce(message({ id: "assistant-1", role: "assistant", content: "" }));
  vi.mocked(chats.updateMessage).mockResolvedValue(
    message({ id: "assistant-1", role: "assistant", content: "雾来了" }),
  );
  let finishStream: (() => void) | undefined;
  vi.mocked(ai.streamAssistantText).mockImplementation(
    ({ onText }) =>
      new Promise((resolve) => {
        onText?.("雾");
        finishStream = () => resolve({ text: "雾" });
      }),
  );

  const initialChat = chat();
  const persistedChat = chat({
    messages: [
      message({ id: "user-1", role: "user", content: "走进雾中" }),
      message({ id: "assistant-1", role: "assistant", content: "" }),
    ],
  });
  let currentChat = initialChat;
  const { container, rerender } = render(
    <ChatView
      chat={currentChat}
      character={null}
      onChanged={() => {
        currentChat = persistedChat;
        rerender(<ChatView chat={currentChat} character={null} />);
      }}
    />,
  );

  fireEvent.change(screen.getByPlaceholderText("输入行动，Ctrl/⌘ + Enter 发送"), {
    target: { value: "走进雾中" },
  });
  fireEvent.click(screen.getByRole("button", { name: "发送" }));

  expect(await screen.findByText("雾")).toBeInTheDocument();
  await waitFor(() => expect(screen.getAllByText("走进雾中")).toHaveLength(1));
  expect(container.querySelectorAll(".whitespace-pre-wrap")).toHaveLength(2);

  await act(async () => {
    finishStream?.();
  });
});

test("keeps duplicate send attempts visible while a send is in flight", async () => {
  vi.mocked(settings.getActiveProvider).mockReturnValue(activeProvider());
  vi.mocked(chats.addMessage).mockImplementation(() => new Promise(() => {}));

  render(<ChatView chat={chat()} character={null} />);

  const input = screen.getByPlaceholderText("输入行动，Ctrl/⌘ + Enter 发送");
  const sendButton = screen.getByRole("button", { name: "发送" });
  fireEvent.change(input, { target: { value: "走进雾中" } });
  fireEvent.click(sendButton);
  fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });

  await waitFor(() => expect(sendButton).toBeDisabled());
  expect(chats.addMessage).toHaveBeenCalledTimes(1);
  expect(toast.error).toHaveBeenCalledWith("上一条回复生成中");
});

test("does not leak pending streaming state when switching chats mid-stream", async () => {
  vi.mocked(settings.getActiveProvider).mockReturnValue(activeProvider());
  vi.mocked(chats.addMessage)
    .mockResolvedValueOnce(message({ id: "user-1", role: "user", content: "走进雾中" }))
    .mockResolvedValueOnce(message({ id: "assistant-1", role: "assistant", content: "" }));
  vi.mocked(chats.updateMessage).mockResolvedValue(
    message({ id: "assistant-1", role: "assistant", content: "雾来了" }),
  );
  vi.mocked(ai.streamAssistantText).mockImplementation(
    ({ onText }) =>
      new Promise(() => {
        onText?.("雾");
      }),
  );

  const { rerender } = render(<ChatView chat={chat()} character={null} />);

  fireEvent.change(screen.getByPlaceholderText("输入行动，Ctrl/⌘ + Enter 发送"), {
    target: { value: "走进雾中" },
  });
  fireEvent.click(screen.getByRole("button", { name: "发送" }));
  expect(await screen.findByText("走进雾中")).toBeInTheDocument();

  rerender(
    <ChatView chat={chat({ id: "chat-2", title: "另一段旅途", messages: [] })} character={null} />,
  );

  expect(screen.queryByText("走进雾中")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "发送" })).toBeDisabled();
});

test("writes failure message and surfaces toast when stream rejects", async () => {
  vi.mocked(settings.getActiveProvider).mockReturnValue(activeProvider());
  vi.mocked(chats.addMessage)
    .mockResolvedValueOnce(message({ id: "user-1", role: "user", content: "走进雾中" }))
    .mockResolvedValueOnce(message({ id: "assistant-1", role: "assistant", content: "" }));
  vi.mocked(chats.updateMessage).mockResolvedValue(
    message({
      id: "assistant-1",
      role: "assistant",
      content: "请求失败：网络断开",
    }),
  );
  vi.mocked(ai.streamAssistantText).mockRejectedValue(new Error("网络断开"));

  render(<ChatView chat={chat()} character={null} />);

  fireEvent.change(screen.getByPlaceholderText("输入行动，Ctrl/⌘ + Enter 发送"), {
    target: { value: "走进雾中" },
  });
  fireEvent.click(screen.getByRole("button", { name: "发送" }));

  await waitFor(() =>
    expect(chats.updateMessage).toHaveBeenCalledWith("chat-1", "assistant-1", {
      content: "请求失败：网络断开",
    }),
  );
  expect(toast.error).toHaveBeenCalledWith("网络断开");
});

test("shows opening user choices before the first user message and sends the selected choice", async () => {
  vi.mocked(settings.getActiveProvider).mockReturnValue(activeProvider());
  vi.mocked(settings.getSettings).mockReturnValue({
    activeProviderId: "provider-1",
    providers: [activeProvider()],
    theme: "dark",
    systemPrompts: [],
    imageProviders: [],
    activeImageProviderId: "",
  });
  vi.mocked(chats.addMessage)
    .mockResolvedValueOnce(message({ id: "user-1", role: "user", content: "观察四周" }))
    .mockResolvedValueOnce(message({ id: "assistant-1", role: "assistant", content: "" }));
  vi.mocked(chats.updateMessage).mockResolvedValue(
    message({ id: "assistant-1", content: "新的回应" }),
  );
  vi.mocked(ai.streamAssistantText).mockImplementation(async ({ onText }) => {
    onText?.("新的回应");
    return { text: "新的回应" };
  });

  render(
    <ChatView
      chat={chat({
        messages: [message({ id: "opening-1", content: "你站在山路前。" })],
      })}
      character={character({
        opening_user_choices: ["观察四周", "向前走", "开口询问"],
      })}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "观察四周" }));

  await waitFor(() =>
    expect(chats.addMessage).toHaveBeenNthCalledWith(1, "chat-1", {
      role: "user",
      content: "观察四周",
    }),
  );
});

function chat(
  overrides: Partial<Chat & { messages: ChatMessage[] }> = {},
): Chat & { messages: ChatMessage[] } {
  return {
    id: "chat-1",
    title: "山间旅途",
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

function message(
  overrides: Partial<ChatMessage & { chatId: string; createdAt: string }> = {},
): ChatMessage & { chatId: string; createdAt: string } {
  return {
    id: "message-1",
    chatId: "chat-1",
    role: "assistant",
    content: "",
    createdAt: "2026-01-01T00:00:00.001Z",
    ...overrides,
  };
}

function character(overrides: Partial<CharacterCard> = {}): CharacterCard {
  return {
    id: "char-1",
    name: "云雀",
    description: "旅行者",
    first_mes: "你好",
    personality: "温和",
    scenario: "山间",
    mes_example: "",
    alternate_greetings: [],
    opening_user_choices: [],
    entries: [{ keys: ["雾"], content: "山间常有白雾。", enabled: true }],
    creator_notes: "",
    tags: [],
    creator: "",
    character_version: "",
    ...overrides,
  };
}

function activeProvider(overrides: Partial<ProviderSettings> = {}): ProviderSettings {
  return {
    id: "provider-1",
    name: "Gemini",
    type: "gemini",
    apiKey: "key",
    baseUrl: "",
    model: "gemini-test",
    ...overrides,
  };
}
