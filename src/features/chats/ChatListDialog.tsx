import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SaveButton } from "@/components/ui/save-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfigDialogLayout } from "@/components/layout/config-dialog-layout";
import type { CharacterCard, Chat } from "@/domain/types";
import { cn } from "@/lib/utils";
import { listCharacters } from "@/services/characters";
import { createChat, deleteChat, listChats, renameChat } from "@/services/chats";

type ChatListDialogProps = {
  open: boolean;
  currentChatId?: string;
  onOpenChange: (open: boolean) => void;
  onSelectChat: (chatId: string) => void;
  onCurrentChatChanged?: () => void;
  onCurrentChatDeleted?: () => void;
};

export function ChatListDialog({
  open,
  currentChatId = "",
  onOpenChange,
  onSelectChat,
  onCurrentChatChanged,
  onCurrentChatDeleted,
}: ChatListDialogProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [characters, setCharacters] = useState<CharacterCard[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [charId, setCharId] = useState("");

  const reload = useCallback(async () => {
    const [nextChats, nextCharacters] = await Promise.all([
      listChats(),
      listCharacters(),
    ]);

    setChats(nextChats);
    setCharacters(nextCharacters);
    setCharId((current) => {
      if (current && nextCharacters.some((character) => character.id === current)) return current;
      return nextCharacters[0]?.id ?? "";
    });
    setSelectedId((current) => {
      if (current && nextChats.some((chat) => chat.id === current)) return current;
      return null;
    });
  }, []);

  useEffect(() => {
    if (open) {
      void reload();
    }
  }, [open, reload]);

  function startCreate() {
    setSelectedId(null);
    setCreating(true);
    setTitle("");
  }

  function editChat(chat: Chat) {
    setSelectedId(chat.id);
    setCreating(false);
    setTitle(chat.title);
    setCharId(chat.charId);
  }

  async function startChat() {
    if (!charId) return;

    let chatTitle = title.trim();
    if (!chatTitle) {
      chatTitle = characters.find((c) => c.id === charId)?.name ?? "";
    }

    const chat = await createChat({ charId, title: chatTitle });
    onSelectChat(chat.id);
    onOpenChange(false);
  }

  async function saveSelectedChat() {
    const chat = chats.find((item) => item.id === selectedId);
    if (!chat) return;

    const trimmed = title.trim();
    if (!trimmed) {
      setTitle(chat.title);
      return;
    }
    if (trimmed === chat.title) {
      setTitle(chat.title);
      return;
    }

    const renamed = await renameChat(chat.id, trimmed);
    setTitle(renamed?.title ?? trimmed);
    await reload();
    if (chat.id === currentChatId) onCurrentChatChanged?.();
  }

  async function removeSelectedChat() {
    if (!selectedId) return;

    const removedId = selectedId;
    await deleteChat(removedId);
    setSelectedId(null);
    setCreating(false);
    setTitle("");
    await reload();
    if (removedId === currentChatId) onCurrentChatDeleted?.();
  }

  function openSelectedChat() {
    if (!selectedId) return;

    onSelectChat(selectedId);
    onOpenChange(false);
  }

  const showList = chats.length > 0 || creating || selectedId;
  const isEditing = creating || selectedId !== null;

  return (
    <ConfigDialogLayout
      open={open}
      onOpenChange={onOpenChange}
      title="对话记录"
      description="创建新对话，或打开、重命名、删除已有对话。"
      rightScroll={isEditing}
      rightFooter={
        isEditing ? (
          <DialogFooter>
            {selectedId ? (
              <Button type="button" variant="destructive" onClick={() => void removeSelectedChat()}>
                删除
              </Button>
            ) : null}
            {selectedId ? (
              <Button type="button" variant="outline" onClick={openSelectedChat}>
                打开
              </Button>
            ) : null}
            {creating ? (
              <Button type="button" disabled={!charId} onClick={() => void startChat()}>
                新建对话
              </Button>
            ) : (
              <SaveButton onSave={() => void saveSelectedChat()} />
            )}
          </DialogFooter>
        ) : null
      }
      left={
        showList ? (
          <div className="space-y-2">
            {chats.map((chat) => (
              <ChatListButton
                key={chat.id}
                active={selectedId === chat.id}
                current={chat.id === currentChatId}
                label={chat.title}
                onClick={() => editChat(chat)}
              />
            ))}
            <ChatListButton active={creating} dashed label="新建对话" onClick={startCreate} />
          </div>
        ) : null
      }
    >
      {creating ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="chat-title">标题</Label>
            <Input
              id="chat-title"
              placeholder="留空自动生成"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="chat-character">角色</Label>
            <Select value={charId} onValueChange={setCharId}>
              <SelectTrigger id="chat-character" aria-label="选择角色">
                <SelectValue placeholder="选择角色" />
              </SelectTrigger>
              <SelectContent>
                {characters.map((character) => (
                  <SelectItem key={character.id} value={character.id}>
                    {character.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      ) : selectedId ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="chat-title">标题</Label>
            <Input
              id="chat-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>角色</Label>
            <Input value={characters.find((c) => c.id === charId)?.name ?? ""} disabled />
          </div>
        </>
      ) : (
        <div className="flex min-h-[24rem] flex-col items-center justify-center rounded-lg border border-dashed border-border/70 p-8 text-center">
          <h3 className="text-base font-medium">
            {chats.length === 0 ? "还没有对话" : "选择一个对话"}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {chats.length === 0
              ? "先创建一个对话，再继续角色扮演。"
              : "从左侧选择对话进行管理，或创建一个新对话。"}
          </p>
          <Button type="button" className="mt-4" onClick={startCreate}>
            新建对话
          </Button>
        </div>
      )}
    </ConfigDialogLayout>
  );
}

type ChatListButtonProps = {
  active: boolean;
  current?: boolean;
  dashed?: boolean;
  label: string;
  onClick: () => void;
};

function ChatListButton({
  active,
  current = false,
  dashed = false,
  label,
  onClick,
}: ChatListButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "block w-full rounded-md border border-border/70 px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
        dashed &&
          "flex items-center justify-center gap-2 border-dashed border-foreground/35 text-center text-foreground hover:border-ring hover:text-accent-foreground",
        active && "border-ring bg-accent text-accent-foreground",
      )}
      aria-current={active ? "true" : undefined}
      aria-label={`编辑 ${label}`}
      onClick={onClick}
    >
      {dashed ? (
        <>
          <Plus className="size-4" />
          {label}
        </>
      ) : (
        <span className="flex items-center justify-between gap-2">
          <span className="truncate">{label}</span>
          {current ? <span className="shrink-0 text-xs text-muted-foreground">当前</span> : null}
        </span>
      )}
    </button>
  );
}
