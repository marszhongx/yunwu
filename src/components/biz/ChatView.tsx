import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { buildMessages, parseMessage } from "@/lib/messages";
import { matchLorebook } from "@/lib/lorebooks";
import { Copy, Download, Heart, Image as ImageIcon, Loader2, ScrollText, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { generateImage, streamAssistantTextRequest } from "@/services/ai";
import { addMessage, deleteMessage, updateMessage } from "@/services/chats";
import { getActiveProvider, getSettings } from "@/services/settings";
import { useAppState } from "@/store/appState";
import type { CharacterCard, Chat, ChatMessage } from "@/types";

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
  const generationAbortRef = useRef<(() => void) | null>(null);
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

        const request = streamAssistantTextRequest({
          provider,
          messages,
          onText: (text) => {
            fullText += text;
            setStreamingText(fullText);
          },
        });
        generationAbortRef.current = request.abort;
        await request.promise;
        await updateMessage(chatId, assistantMessage.id, { content: fullText });
      } catch (error) {
        const message = error instanceof Error ? error.message : "请求失败";
        if (error instanceof DOMException && error.name === "AbortError") {
          await updateMessage(chatId, assistantMessage.id, { content: fullText });
          toast.error("已停止生成");
          return;
        }

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
      generationAbortRef.current = null;
      sendInFlightRef.current = false;
      setIsSending(false);
    }
  }

  function stopGeneration() {
    generationAbortRef.current?.();
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
      <div className="flex h-full min-h-[50vh] w-full flex-col items-center justify-center rounded-2xl border border-border/40 bg-card/50 px-6 text-center shadow-2xl shadow-primary/5 backdrop-blur-2xl">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/15 text-primary shadow-lg shadow-primary/10">
          <ScrollText className="h-7 w-7" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">还没有对话</h2>
        <p className="mt-2 text-sm text-muted-foreground">先创建一个对话，再继续角色扮演。</p>
        <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
          角色状态、剧情摘要和世界书会在左侧同步展示。
        </p>
        <Button
          type="button"
          className="mt-6 rounded-full px-6 shadow-lg shadow-primary/20"
          onClick={onCreateChat}
        >
          新建对话
        </Button>
      </div>
    );
  }

  return (
    <section className="flex h-full min-h-[60vh] w-full flex-col gap-4">
      <ScrollArea className="min-h-0 flex-1 rounded-3xl border border-border/40 bg-card/50 p-3 shadow-2xl shadow-primary/5 backdrop-blur-2xl sm:p-4">
        <div className="space-y-5 pr-3 sm:pr-4">
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
      <div className="flex items-end gap-2 rounded-3xl border border-border/40 bg-card/60 p-2.5 shadow-xl shadow-primary/5 backdrop-blur-2xl sm:p-3">
        <Textarea
          value={draft}
          placeholder="输入行动，Ctrl/⌘ + Enter 发送"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming || isSending}
          className="min-h-0 flex-1 resize-none border-0 bg-transparent px-3 shadow-none focus-visible:ring-0"
          rows={1}
        />
        <Button
          type="button"
          onClick={isStreaming || isSending ? stopGeneration : () => void sendMessage()}
          disabled={isStreaming || isSending ? false : !draft.trim()}
          variant={isStreaming || isSending ? "outline" : "default"}
          className="rounded-full px-5 shadow-md shadow-primary/20"
        >
          {isStreaming || isSending ? (
            <>
              <Square className="h-3.5 w-3.5 fill-current" />
              停止
            </>
          ) : (
            "发送"
          )}
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
    <output aria-label={label} className="flex h-7 items-center gap-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.2s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.1s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70" />
    </output>
  );
}

function LoadingBubble({ label }: { label: string }) {
  return (
    <div className="group flex justify-start">
      <div className="max-w-[82%]">
        <div className="whitespace-pre-wrap rounded-3xl rounded-bl-md border border-border/40 bg-card/70 px-4 py-3 text-sm leading-7 text-card-foreground shadow-lg shadow-primary/5 backdrop-blur-xl">
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
        <div className="max-w-[88%] sm:max-w-[82%]">
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
                className="flex h-7 w-7 items-center justify-center rounded-full border border-border/40 bg-card/90 text-muted-foreground shadow-sm backdrop-blur-xl transition-all duration-200 hover:bg-accent hover:text-accent-foreground"
              >
                <Download className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-border/40 bg-card/90 text-muted-foreground shadow-sm backdrop-blur-xl transition-all duration-200 hover:bg-destructive hover:text-destructive-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <img
            src={text}
            alt="生成的图片"
            className="max-w-full rounded-3xl border border-border/40 shadow-xl shadow-primary/5"
          />
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
      <div className="max-w-[88%] sm:max-w-[82%]">
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
                className="flex h-7 w-7 items-center justify-center rounded-full border border-border/40 bg-card/90 text-muted-foreground shadow-sm backdrop-blur-xl transition-all duration-200 hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
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
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border/40 bg-card/90 text-muted-foreground shadow-sm backdrop-blur-xl transition-all duration-200 hover:bg-accent hover:text-accent-foreground"
            >
              <Copy className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border/40 bg-card/90 text-muted-foreground shadow-sm backdrop-blur-xl transition-all duration-200 hover:bg-destructive hover:text-destructive-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        <div
          className={cn(
            "whitespace-pre-wrap rounded-3xl px-4 py-3 text-sm leading-7 shadow-lg shadow-primary/5",
            isUser
              ? "rounded-br-md bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-md shadow-primary/15"
              : "rounded-bl-md border border-border/40 bg-card/75 text-card-foreground backdrop-blur-xl",
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
                className="max-w-full rounded-2xl border border-border/40 bg-card/60 px-3.5 py-2 text-left text-sm leading-7 text-foreground shadow-sm backdrop-blur-xl transition-all duration-200 hover:border-primary/30 hover:bg-accent/80 hover:shadow-md"
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
