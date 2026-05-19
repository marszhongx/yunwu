import { useState, type ReactNode } from "react";
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

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

type Theme = "light" | "dark";

type AppShellProps = {
  theme: Theme;
  activeProviderName: string;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onOpenSystemPrompt: () => void;
  onOpenCharacters: () => void;
  onOpenChats: () => void;
  onOpenImageProvider: () => void;
  sidebar: ReactNode;
  children: ReactNode;
};

export function AppShell({
  theme,
  activeProviderName,
  onToggleTheme,
  onOpenSettings,
  onOpenSystemPrompt,
  onOpenCharacters,
  onOpenChats,
  onOpenImageProvider,
  sidebar,
  children,
}: AppShellProps) {
  const ThemeIcon = theme === "dark" ? Sun : Moon;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-border/70 bg-card/50 p-4 lg:flex">
        <h1 className="mb-4 text-lg font-semibold">
          云雾聊天室
          {activeProviderName ? (
            <span className="ml-2 rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">
              {activeProviderName}
            </span>
          ) : null}
        </h1>
        <div className="min-h-0 flex-1 overflow-y-auto">{sidebar}</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-border/70 px-3 py-2 lg:hidden">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setSidebarOpen(true)}
            title="菜单"
            aria-label="菜单"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="text-sm font-semibold">云雾聊天室</span>
          {activeProviderName ? (
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">
              {activeProviderName}
            </span>
          ) : null}
        </header>
        <main className="flex flex-1 min-h-0 p-3 lg:p-6">{children}</main>
      </div>
      <nav className="flex shrink-0 flex-col items-center gap-1 border-l border-border/70 bg-card/50 p-1.5 lg:p-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={onOpenChats}
          title="记录"
          aria-label="记录"
          className="h-9 w-9 lg:h-10 lg:w-10"
        >
          <History className="h-4 w-4 lg:h-5 lg:w-5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onOpenCharacters}
          title="角色"
          aria-label="角色"
          className="h-9 w-9 lg:h-10 lg:w-10"
        >
          <UserRound className="h-4 w-4 lg:h-5 lg:w-5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onOpenSystemPrompt}
          title="提示词"
          aria-label="提示词"
          className="h-9 w-9 lg:h-10 lg:w-10"
        >
          <MessageSquareText className="h-4 w-4 lg:h-5 lg:w-5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onOpenSettings}
          title="设置"
          aria-label="设置"
          className="h-9 w-9 lg:h-10 lg:w-10"
        >
          <Settings className="h-4 w-4 lg:h-5 lg:w-5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onOpenImageProvider}
          title="图片生成"
          aria-label="图片生成"
          className="h-9 w-9 lg:h-10 lg:w-10"
        >
          <Image className="h-4 w-4 lg:h-5 lg:w-5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onToggleTheme}
          title="切换主题"
          aria-label="切换主题"
          className="h-9 w-9 lg:h-10 lg:w-10"
        >
          <ThemeIcon className="h-4 w-4 lg:h-5 lg:w-5" />
        </Button>
      </nav>
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-72 p-4 lg:hidden">
          <SheetTitle className="sr-only">侧栏</SheetTitle>
          <h1 className="mb-4 text-lg font-semibold">
            云雾聊天室
            {activeProviderName ? (
              <span className="ml-2 rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">
                {activeProviderName}
              </span>
            ) : null}
          </h1>
          <div className="min-h-0 flex-1 overflow-y-auto">{sidebar}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
