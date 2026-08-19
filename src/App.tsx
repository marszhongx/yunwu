import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { CharacterDialog } from "@/components/biz/CharacterDialog";
import { ChatListDialog } from "@/components/biz/ChatListDialog";
import { ChatSidebar } from "@/components/biz/ChatSidebar";
import { ChatView } from "@/components/biz/ChatView";
import { ImageProviderDialog } from "@/components/biz/ImageProviderDialog";
import { SettingsDialog } from "@/components/biz/SettingsDialog";
import { SystemPromptDialog } from "@/components/biz/SystemPromptDialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { CharacterCard, Chat } from "@/types";
import {
  History,
  Image,
  Menu,
  MessageSquareText,
  Moon,
  Settings,
  Sun,
  UserRound,
} from "lucide-react";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { getCharacter } from "@/services/characters";
import { createChat, getChat } from "@/services/chats";
import { saveTheme } from "@/services/settings";
import { useAppState } from "@/store/appState";

export default function App() {
  const theme = useAppState((s) => s.settings.theme);
  const activeProviderName = useAppState((s) => s.activeProvider?.name ?? "");
  const [chatsOpen, setChatsOpen] = useState(false);
  const [charactersOpen, setCharactersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [imageProviderOpen, setImageProviderOpen] = useState(false);
  const [systemPromptOpen, setSystemPromptOpen] = useState(false);
  const [currentChatId, setCurrentChatId] = useState("");
  const currentChatIdRef = useRef(currentChatId);
  const reloadRequestIdRef = useRef(0);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [currentCharacter, setCurrentCharacter] = useState<CharacterCard | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    useAppState.getState().init();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const clearCurrentChatDetails = useCallback(() => {
    setCurrentCharacter(null);
  }, []);

  const clearCurrentChat = useCallback(() => {
    setCurrentChat(null);
    clearCurrentChatDetails();
  }, [clearCurrentChatDetails]);

  const loadCurrentChat = useCallback(
    async (chatId: string) => {
      const requestId = ++reloadRequestIdRef.current;

      if (!chatId) {
        clearCurrentChat();
        return;
      }

      const chat = await getChat(chatId);
      if (requestId !== reloadRequestIdRef.current || chatId !== currentChatIdRef.current) return;

      setCurrentChat(chat);

      if (!chat) {
        clearCurrentChatDetails();
        return;
      }

      const character = chat.charId ? await getCharacter(chat.charId) : null;
      if (requestId !== reloadRequestIdRef.current || chatId !== currentChatIdRef.current) return;

      setCurrentCharacter(character);
    },
    [clearCurrentChat, clearCurrentChatDetails],
  );

  useEffect(() => {
    currentChatIdRef.current = currentChatId;
    void loadCurrentChat(currentChatId);
  }, [currentChatId, loadCurrentChat]);

  function reloadCurrentChat() {
    void loadCurrentChat(currentChatId);
  }

  function deleteCurrentChat() {
    setCurrentChatId("");
    currentChatIdRef.current = "";
    clearCurrentChat();
  }

  async function toggleTheme() {
    await saveTheme(theme === "dark" ? "light" : "dark");
    useAppState.getState().reload();
  }

  const ThemeIcon = theme === "dark" ? Sun : Moon;

  return (
    <>
      <div className="flex h-[100dvh] max-w-[1600px] mx-auto overflow-hidden bg-background/90 text-foreground">
        <aside className="hidden w-80 shrink-0 flex-col border-r border-border/40 bg-card/60 p-5 shadow-2xl shadow-primary/5 backdrop-blur-2xl lg:flex">
          <BrandTitle activeProviderName={activeProviderName} />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ChatSidebar chat={currentChat} character={currentCharacter} />
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-2 border-b border-border/40 bg-card/70 px-3 py-2 shadow-sm backdrop-blur-2xl lg:hidden">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setSidebarOpen(true)}
              title="菜单"
              aria-label="菜单"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <span className="text-base font-semibold tracking-tight">云雾聊天室</span>
            {activeProviderName ? (
              <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {activeProviderName}
              </span>
            ) : null}
          </header>
          <main className="flex flex-1 min-h-0 p-3 lg:p-5">
            <ChatView
              chat={currentChat}
              character={currentCharacter}
              onChanged={reloadCurrentChat}
              onCreateChat={() => setChatsOpen(true)}
            />
          </main>
        </div>
        <nav className="flex shrink-0 flex-col items-center gap-1 border-l border-border/40 bg-card/60 p-1.5 shadow-2xl shadow-primary/5 backdrop-blur-2xl lg:p-2">
          <NavButton
            icon={History}
            label="记录"
            active={chatsOpen}
            onClick={() => setChatsOpen(true)}
          />
          <NavButton
            icon={UserRound}
            label="角色"
            active={charactersOpen}
            onClick={() => setCharactersOpen(true)}
          />
          <NavButton
            icon={MessageSquareText}
            label="提示词"
            active={systemPromptOpen}
            onClick={() => setSystemPromptOpen(true)}
          />
          <NavButton
            icon={Settings}
            label="设置"
            active={settingsOpen}
            onClick={() => setSettingsOpen(true)}
          />
          <NavButton
            icon={Image}
            label="图片生成"
            active={imageProviderOpen}
            onClick={() => setImageProviderOpen(true)}
          />
          <NavButton icon={ThemeIcon} label="切换主题" onClick={() => void toggleTheme()} />
        </nav>
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent
            side="left"
            className="w-80 border-border/40 bg-card/90 p-5 backdrop-blur-2xl lg:hidden"
          >
            <SheetTitle className="sr-only">侧栏</SheetTitle>
            <BrandTitle activeProviderName={activeProviderName} />
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ChatSidebar chat={currentChat} character={currentCharacter} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <Toaster theme={theme} richColors position="top-center" />
      {settingsOpen ? (
        <SettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          onChanged={reloadCurrentChat}
        />
      ) : null}
      {imageProviderOpen ? (
        <ImageProviderDialog open={imageProviderOpen} onOpenChange={setImageProviderOpen} />
      ) : null}
      {systemPromptOpen ? (
        <SystemPromptDialog
          open={systemPromptOpen}
          onOpenChange={setSystemPromptOpen}
          onChanged={reloadCurrentChat}
        />
      ) : null}
      {charactersOpen ? (
        <CharacterDialog
          open={charactersOpen}
          onOpenChange={setCharactersOpen}
          onChanged={reloadCurrentChat}
          onStartChat={async (characterId) => {
            const chat = await createChat({ charId: characterId });
            setCurrentChatId(chat.id);
          }}
        />
      ) : null}
      {chatsOpen ? (
        <ChatListDialog
          open={chatsOpen}
          currentChatId={currentChatId}
          onOpenChange={setChatsOpen}
          onSelectChat={setCurrentChatId}
          onCurrentChatChanged={reloadCurrentChat}
          onCurrentChatDeleted={deleteCurrentChat}
        />
      ) : null}
    </>
  );
}

function BrandTitle({ activeProviderName }: { activeProviderName: string }) {
  return (
    <h1 className="mb-5 text-2xl font-semibold tracking-tight">
      <span className="text-foreground">云雾聊天室</span>
      {activeProviderName ? (
        <span className="ml-2 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 align-middle text-xs font-medium text-primary shadow-sm shadow-primary/10">
          {activeProviderName}
        </span>
      ) : null}
    </h1>
  );
}

type NavButtonProps = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick: () => void;
};

function NavButton({ icon: Icon, label, active = false, onClick }: NavButtonProps) {
  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn("h-9 w-9 lg:h-10 lg:w-10", active && "bg-accent/60 text-accent-foreground")}
    >
      <Icon className="h-4 w-4 lg:h-5 lg:w-5" />
    </Button>
  );
}
