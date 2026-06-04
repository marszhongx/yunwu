import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { buildMessages, parseMessage } from "@/domain/messages";
import { matchLorebook } from "@/domain/lorebooks";
import type { CharacterCard, Chat, ChatMessage } from "@/domain/types";
import { Copy, Download, Heart, Image as ImageIcon, Loader2, ScrollText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { generateImage, streamAssistantText } from "@/services/ai";
import { addMessage, deleteMessage, updateMessage } from "@/services/chats";
import { getActiveProvider, getSettings } from "@/services/settings";
import { useAppState } from "@/store/appState";

type ChatWithMessages = Chat & { messages?: ChatMessage[] };

type ChatViewProps = {
  chat: ChatWithMessages | null;
  character: CharacterCard | null;
  onChanged?: () => void;
  onCreateChat?: () => void;
};

export function ChatView({ chat, character, onChanged, onCreateChat }: ChatViewProps) {
  const [draft, setDraft] = useState("");
  const [streamingId, setStreamingId] = useState("");
  const [streamingChatId, setStreamingChatId] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [pendingMessages, setPendingMessages] = useState<ChatMessage[]>([]);
  const [pendingChatId, setPendingChatId] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(null);
  const sendInFlightRef = useRef(false);
  const activeChatId = chat?.id ?? "";
  const isStreaming = streamingId !== "" && streamingChatId === activeChatId;
  const activePendingMessages = pendingChatId === activeChatId ? pendingMessages : [];

  async function sendMessage(choice?: string) {
    const content = (choice ?? draft).trim();

    if (sendInFlightRef.current) {
      toast.error("上一条回复生成中");
      return;
    }

    if (!content || !chat || isStreaming) return;

    const provider = getActiveProvider();

    if (!provider) {
      toast.error("请先配置并激活 Provider");
      return;
    }

    const chatId = chat.id;
    sendInFlightRef.current = true;
    setIsSending(true);
    setDraft("");

    try {
      const userMessage = await addMessage(chatId, { role: "user", content });
      const assistantMessage = await addMessage(chatId, { role: "assistant", content: "" });
      let fullText = "";

      setPendingChatId(chatId);
      setPendingMessages([userMessage, assistantMessage]);
      setStreamingChatId(chatId);
      setStreamingId(assistantMessage.id);
      setStreamingText("");
      onChanged?.();

      try {
        const messages = buildMessages({
          messages: [...(chat.messages ?? []), userMessage],
          charData: character,
          lbEntries: matchLorebook(character?.entries || []),
          systemPrompts: getSettings().systemPrompts,
        });

        await streamAssistantText({
          provider,
          messages,
          onText: (text) => {
            fullText += text;
            setStreamingText(fullText);
          },
        });
        await updateMessage(chatId, assistantMessage.id, { content: fullText });
      } catch (error) {
        const message = error instanceof Error ? error.message : "请求失败";
        await updateMessage(chatId, assistantMessage.id, { content: `请求失败：${message}` });
        toast.error(message);
      } finally {
        setStreamingId("");
        setStreamingChatId("");
        setStreamingText("");
        setPendingMessages([]);
        setPendingChatId("");
        onChanged?.();
      }
    } finally {
      sendInFlightRef.current = false;
      setIsSending(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void sendMessage();
    }
  }

  async function handleGenerateImage(messageId: string, prompt: string) {
    const provider = useAppState.getState().activeImageProvider;
    if (!provider || !provider.apiKey) {
      toast.error("请先在设置中配置图片生成");
      return;
    }

    setGeneratingImageId(messageId);
    try {
      const dataUrl = await generateImage({
        apiKey: provider.apiKey,
        baseUrl: provider.baseUrl,
        model: provider.model,
        prompt,
        type: provider.type,
      });
      await addMessage(chat!.id, { role: "image", content: dataUrl });
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "图片生成失败");
    } finally {
      setGeneratingImageId(null);
    }
  }

  const messages = useMemo(
    () => mergeMessages(chat?.messages ?? [], activePendingMessages),
    [activePendingMessages, chat?.messages],
  );
  const lastNonImageIndex = getLastNonImageMessageIndex(messages);
  const showOpeningChoices =
    !isStreaming &&
    !isSending &&
    messages.length > 0 &&
    messages.every((message) => message.role !== "user") &&
    (character?.opening_user_choices.length ?? 0) > 0;

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (bottomRef.current && "scrollIntoView" in bottomRef.current) {
      bottomRef.current.scrollIntoView();
    }
  });

  if (!chat) {
    return (
      <div className="flex h-full w-full min-h-[50vh] flex-col items-center justify-center px-6 text-center">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">还没有对话</h2>
        <p className="mt-2 text-sm text-muted-foreground">先创建一个对话，再继续角色扮演。</p>
        <Button type="button" className="mt-6" onClick={onCreateChat}>
          新建对话
        </Button>
      </div>
    );
  }

  return (
    <section className="flex h-full min-h-[60vh] w-full flex-col gap-4">
      <ScrollArea className="min-h-0 flex-1 rounded-lg border border-border/70 bg-card/40 p-4">
        <div className="space-y-4 pr-4">
          {messages.map((message, index) => (
            <MessageBubble
              key={message.id}
              message={message}
              text={
                message.id === streamingId && streamingChatId === chat.id
                  ? streamingText
                  : message.content
              }
              loading={message.id === streamingId && streamingText === ""}
              onChoice={
                !isStreaming && !isSending && index === lastNonImageIndex
                  ? (choice) => void sendMessage(choice)
                  : undefined
              }
              extraChoices={
                showOpeningChoices && index === lastNonImageIndex
                  ? character?.opening_user_choices
                  : undefined
              }
              onDelete={
                !isStreaming && !isSending
                  ? () => void deleteMessage(chat.id, message.id).then(() => onChanged?.())
                  : undefined
              }
              onGenerateImage={
                !isStreaming && !isSending && message.role === "assistant"
                  ? () => {
                      const parsed = parseMessage(message.content);
                      void handleGenerateImage(message.id, parsed?.body ?? message.content);
                    }
                  : undefined
              }
              generatingImage={generatingImageId === message.id}
            />
          ))}
          {generatingImageId ? <LoadingBubble label="图片生成中" /> : null}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      <div className="flex items-end gap-2 rounded-lg border border-border/70 bg-card p-3 shadow-sm">
        <Textarea
          value={draft}
          placeholder="输入行动，Ctrl/⌘ + Enter 发送"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming || isSending}
          className="min-h-0 flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
          rows={1}
        />
        <Button
          type="button"
          onClick={() => void sendMessage()}
          disabled={!draft.trim() || isStreaming || isSending}
        >
          发送
        </Button>
      </div>
    </section>
  );
}

function getLastNonImageMessageIndex(messages: ChatMessage[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== "image") return i;
  }

  return -1;
}

function LoadingDots({ label }: { label: string }) {
  return (
    <span aria-label={label} className="flex h-7 items-center gap-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.2s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.1s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70" />
    </span>
  );
}

function LoadingBubble({ label }: { label: string }) {
  return (
    <div className="group flex justify-start">
      <div className="max-w-[82%]">
        <div className="whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-border/70 bg-card px-4 py-3 text-sm leading-7 text-card-foreground shadow-sm">
          <LoadingDots label={label} />
        </div>
      </div>
    </div>
  );
}

function mergeMessages(messages: ChatMessage[], pendingMessages: ChatMessage[]) {
  const merged = [...messages];
  const messageIds = new Set(messages.map((message) => message.id));

  for (const message of pendingMessages) {
    if (!messageIds.has(message.id)) {
      merged.push(message);
      messageIds.add(message.id);
    }
  }

  return merged;
}

type MessageBubbleProps = {
  message: ChatMessage;
  text: string;
  loading?: boolean;
  extraChoices?: string[];
  onChoice?: (choice: string) => void;
  onDelete?: () => void;
  onGenerateImage?: () => void;
  generatingImage?: boolean;
};

function MessageBubble({
  message,
  text,
  loading = false,
  extraChoices = [],
  onChoice,
  onDelete,
  onGenerateImage,
  generatingImage = false,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isImage = message.role === "image";

  if (isImage) {
    return (
      <div className="group flex justify-start">
        <div className="max-w-[82%]">
          {onDelete && (
            <div className="mb-1 flex gap-1 justify-start opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = text;
                  a.download = `image-${message.id}.png`;
                  a.click();
                }}
                className="flex h-6 w-6 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
              >
                <Download className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="flex h-6 w-6 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground shadow-sm hover:bg-destructive hover:text-destructive-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <img src={text} alt="生成的图片" className="max-w-full rounded-2xl shadow-sm" />
        </div>
      </div>
    );
  }

  const parsed = isUser ? null : parseMessage(text);
  const bodyText = loading ? "" : isUser ? text : (parsed?.body ?? "");
  const choices = isUser ? [] : [...(parsed?.choices ?? []), ...extraChoices];
  const summary = parsed?.summary ?? null;
  const status = parsed?.status ?? null;

  return (
    <div className={cn("group flex", isUser ? "justify-end" : "justify-start")}>
      <div className="max-w-[82%]">
        {onDelete && (
          <div
            className={cn(
              "mb-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100",
              isUser ? "justify-end" : "justify-start",
            )}
          >
            {onGenerateImage && (
              <button
                type="button"
                onClick={onGenerateImage}
                disabled={generatingImage}
                className="flex h-6 w-6 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground shadow-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
              >
                {generatingImage ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <ImageIcon className="h-3 w-3" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(bodyText)}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
            >
              <Copy className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground shadow-sm hover:bg-destructive hover:text-destructive-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        <div
          className={cn(
            "whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-7 shadow-sm",
            isUser
              ? "rounded-br-sm bg-primary text-primary-foreground"
              : "rounded-bl-sm border border-border/70 bg-card text-card-foreground",
          )}
        >
          {loading ? (
            <LoadingDots label="回复生成中" />
          ) : (
            <>
              {bodyText || (message.id ? " " : "")}
              {summary && (
                <span className="mt-2 flex gap-1 text-xs leading-6 text-muted-foreground">
                  <ScrollText className="mt-[6px] h-3 w-3 shrink-0" />
                  <span>{summary}</span>
                </span>
              )}
              {status && (
                <span className="mt-1 flex gap-1 text-xs leading-6 text-muted-foreground">
                  <Heart className="mt-[6px] h-3 w-3 shrink-0" />
                  <span>{status}</span>
                </span>
              )}
            </>
          )}
        </div>
        {choices.length > 0 && onChoice ? (
          <div className="mt-2 flex flex-col gap-2">
            {choices.map((choice) => (
              <button
                key={choice}
                type="button"
                className="max-w-full rounded-lg border border-border/70 bg-background px-3 py-1.5 text-left text-sm leading-7 text-foreground transition-colors hover:bg-accent"
                onClick={() => onChoice(choice)}
              >
                {choice}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
