import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { listCharacters } from "@/services/characters";
import { createChat, deleteChat, listChats, renameChat } from "@/services/chats";
import type { CharacterCard, Chat } from "@/types";
import { ConfigDialogLayout } from "@/components/biz/ConfigDialogLayout";
import { StepBackButton } from "@/components/biz/StepBackButton";

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
    const [nextChats, nextCharacters] = await Promise.all([listChats(), listCharacters()]);

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

  function backToList() {
    setSelectedId(null);
    setCreating(false);
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

    try {
      const chat = await createChat({ charId, title: chatTitle });
      onSelectChat(chat.id);
      onOpenChange(false);
      toast.success("对话已新增");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "对话新增失败");
    }
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

    try {
      const renamed = await renameChat(chat.id, trimmed);
      setTitle(renamed?.title ?? trimmed);
      await reload();
      if (chat.id === currentChatId) onCurrentChatChanged?.();
      toast.success("对话已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "对话保存失败");
    }
  }

  async function removeSelectedChat() {
    if (!selectedId) return;

    const removedId = selectedId;

    try {
      await deleteChat(removedId);
      setSelectedId(null);
      setCreating(false);
      setTitle("");
      await reload();
      if (removedId === currentChatId) onCurrentChatDeleted?.();
      toast.success("对话已删除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "对话删除失败");
    }
  }

  function openSelectedChat() {
    if (!selectedId) return;

    onSelectChat(selectedId);
    onOpenChange(false);
  }

  const isEditing = creating || selectedId !== null;
  const dialogTitle = creating ? "新建对话" : selectedId ? "修改对话" : "对话记录";

  return (
    <ConfigDialogLayout
      open={open}
      onOpenChange={onOpenChange}
      title={dialogTitle}
      titleAction={isEditing ? <StepBackButton onClick={backToList} /> : null}
      rightScroll
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
              <Button type="button" onClick={() => void saveSelectedChat()}>
                保存
              </Button>
            )}
          </DialogFooter>
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
        <ChatList
          chats={chats}
          currentChatId={currentChatId}
          onEdit={editChat}
          onCreate={startCreate}
        />
      )}
    </ConfigDialogLayout>
  );
}

type ChatListProps = {
  chats: Chat[];
  currentChatId: string;
  onEdit: (chat: Chat) => void;
  onCreate: () => void;
};

function ChatList({ chats, currentChatId, onEdit, onCreate }: ChatListProps) {
  if (chats.length === 0) {
    return (
      <div className="flex min-h-[24rem] flex-col items-center justify-center rounded-lg border border-dashed border-border/70 p-8 text-center">
        <h3 className="text-base font-medium">还没有对话</h3>
        <p className="mt-2 text-sm text-muted-foreground">先创建一个对话，再继续角色扮演。</p>
        <Button type="button" className="mt-4" onClick={onCreate}>
          新建对话
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {chats.map((chat) => (
        <ChatListButton
          key={chat.id}
          current={chat.id === currentChatId}
          label={chat.title}
          onClick={() => onEdit(chat)}
        />
      ))}
      <ChatListButton dashed label="新建对话" onClick={onCreate} />
    </div>
  );
}

type ChatListButtonProps = {
  active?: boolean;
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
