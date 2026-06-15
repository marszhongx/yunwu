import { BookOpen, Heart, ScrollText, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CharacterCard, Chat, LorebookEntry } from "@/types";

type ChatSidebarProps = {
  chat: Chat | null;
  character: CharacterCard | null;
};

export function ChatSidebar({ chat, character }: ChatSidebarProps) {
  const summaries = chat?.summaries?.length
    ? chat.summaries
    : chat?.latestSummary
      ? [chat.latestSummary]
      : [];

  return (
    <div className="space-y-4">
      <InfoCard
        title="角色状态"
        icon={<Heart className="h-3.5 w-3.5" />}
        empty="暂无状态"
        content={chat?.latestStatus}
      />
      <Card className="bg-card/70 shadow-sm shadow-primary/5 backdrop-blur transition-colors hover:border-primary/30">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <ScrollText className="h-3.5 w-3.5 text-primary" />
            剧情摘要
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 text-sm text-muted-foreground">
          {summaries.length === 0 ? (
            <span>暂无摘要</span>
          ) : (
            <ol className="list-inside list-decimal space-y-1">
              {summaries.map((summary, index) => (
                <li key={index} className="whitespace-pre-wrap">
                  {summary}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
      <InfoCard
        title="我的角色"
        icon={<User className="h-3.5 w-3.5" />}
        empty="未选择角色"
        content={character ? `${character.name}\n\n${character.description}` : ""}
      />
      <InfoCard
        title="世界书"
        icon={<BookOpen className="h-3.5 w-3.5" />}
        empty="暂无条目"
        content={formatEntries(character?.entries ?? [])}
      />
    </div>
  );
}

type InfoCardProps = {
  title: string;
  icon?: React.ReactNode;
  empty: string;
  content?: string;
};

function InfoCard({ title, icon, empty, content }: InfoCardProps) {
  const text = content?.trim() ? content : empty;

  return (
    <Card className="bg-card/70 shadow-sm shadow-primary/5 backdrop-blur transition-colors hover:border-primary/30">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <span className="text-primary">{icon}</span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="whitespace-pre-wrap p-4 pt-0 text-sm text-muted-foreground">
        {text}
      </CardContent>
    </Card>
  );
}

function formatEntries(entries: LorebookEntry[]): string {
  return entries
    .filter((entry) => entry.enabled)
    .map((entry) => `${entry.keys.join(", ")}\n${entry.content}`)
    .join("\n\n");
}
