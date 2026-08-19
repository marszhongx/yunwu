import { useCallback, useEffect, useState } from "react";
import { MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListItemButton } from "@/components/ui/list-item-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
      <EmptyState
        icon={<MessageSquareText className="size-5" />}
        title="还没有对话"
        description="先创建一个对话，再继续角色扮演。"
      >
        <Button type="button" onClick={onCreate}>
          新建对话
        </Button>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-2">
      {chats.map((chat) => (
        <ListItemButton
          key={chat.id}
          current={chat.id === currentChatId}
          label={chat.title}
          onClick={() => onEdit(chat)}
        />
      ))}
      <ListItemButton dashed label="新建对话" onClick={onCreate} />
    </div>
  );
}
