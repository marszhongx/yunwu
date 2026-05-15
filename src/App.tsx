import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import type { CharacterCard, Chat } from "@/domain/types";
import { ChatSidebar } from "@/features/chat/ChatSidebar";
import { ChatView } from "@/features/chat/ChatView";
import { CharacterDialog } from "@/features/characters/CharacterDialog";
import { ChatListDialog } from "@/features/chats/ChatListDialog";
import { SettingsDialog } from "@/features/settings/SettingsDialog";
import { SystemPromptDialog } from "@/features/settings/SystemPromptDialog";
import { getCharacter } from "@/services/characters";
import { getChat } from "@/services/chats";
import { saveTheme } from "@/services/settings";
import { useAppState } from "@/store/appState";

export default function App() {
  const theme = useAppState((s) => s.settings.theme);
  const activeProviderName = useAppState((s) => s.activeProvider?.name ?? "");
  const [chatsOpen, setChatsOpen] = useState(false);
  const [charactersOpen, setCharactersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [systemPromptOpen, setSystemPromptOpen] = useState(false);
  const [currentChatId, setCurrentChatId] = useState("");
  const currentChatIdRef = useRef(currentChatId);
  const reloadRequestIdRef = useRef(0);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [currentCharacter, setCurrentCharacter] = useState<CharacterCard | null>(null);

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

  function toggleTheme() {
    saveTheme(theme === "dark" ? "light" : "dark");
    useAppState.getState().reload();
  }

  return (
    <>
      <AppShell
        theme={theme}
        activeProviderName={activeProviderName}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenSystemPrompt={() => setSystemPromptOpen(true)}
        onOpenChats={() => setChatsOpen(true)}
        onOpenCharacters={() => setCharactersOpen(true)}
        sidebar={
          <ChatSidebar chat={currentChat} character={currentCharacter} />
        }
      >
        <ChatView
          chat={currentChat}
          character={currentCharacter}
          onChanged={reloadCurrentChat}
          onCreateChat={() => setChatsOpen(true)}
        />
      </AppShell>
      {settingsOpen ? (
        <SettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          onChanged={reloadCurrentChat}
        />
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
