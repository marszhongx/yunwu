import { Fragment, type ComponentType, type ReactNode } from "react";
import { Heart, ScrollText } from "lucide-react";
import { parseMessageMarkup, type MessageMarkupNode } from "@/lib/messageMarkup";
import { resolveChoices } from "@/lib/messages";

export type MessageMarkupComponentProps = {
  node: MessageMarkupNode;
  children: ReactNode;
};

export type MessageMarkupRegistry = Record<string, ComponentType<MessageMarkupComponentProps>>;

type MessageRendererProps = {
  content: string;
  extraChoices?: string[];
  onChoice?: (choice: string) => void;
  choicesDisabled?: boolean;
  registry?: MessageMarkupRegistry;
};

const defaultRegistry: MessageMarkupRegistry = {
  content: ContentRegion,
  summary: SummaryRegion,
  status: StatusRegion,
};

export function MessageRenderer({
  content,
  extraChoices = [],
  onChoice,
  choicesDisabled = false,
  registry = {},
}: MessageRendererProps) {
  const nodes = parseMessageMarkup(content);
  const components = { ...defaultRegistry, ...registry };
  const choices = [
    ...nodes
      .filter((node) => node.name === "choices")
      .flatMap((node) => resolveChoices(node.content)),
    ...extraChoices,
  ];
  const contentNodes = nodes.filter((node) => node.name !== "choices");

  return (
    <>
      <div className="rounded-3xl rounded-bl-md border border-border/40 bg-card/75 px-4 py-3 text-sm leading-7 text-card-foreground shadow-lg shadow-primary/5 backdrop-blur-xl">
        {contentNodes.length > 0
          ? contentNodes.map((node, index) => {
              const Component = components[node.name] ?? Fragment;
              const children = <span className="whitespace-pre-wrap">{node.content}</span>;
              return Component === Fragment ? (
                <Fragment key={`${node.name}-${index}-${node.content}`}>{children}</Fragment>
              ) : (
                <Component key={`${node.name}-${index}-${node.content}`} node={node}>
                  {children}
                </Component>
              );
            })
          : " "}
      </div>
      {choices.length > 0 && onChoice ? (
        <div className="mt-2 flex flex-col gap-2">
          {choices.map((choice, index) => (
            <button
              key={`${index}-${choice}`}
              type="button"
              disabled={choicesDisabled}
              className="max-w-full rounded-2xl border border-border/40 bg-card/60 px-3.5 py-2 text-left text-sm leading-7 text-foreground shadow-sm backdrop-blur-xl transition-all duration-200 hover:border-primary/30 hover:bg-accent/80 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => onChoice(choice)}
            >
              <span className="whitespace-pre-wrap">{choice}</span>
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}

function ContentRegion({ children }: MessageMarkupComponentProps) {
  return children;
}

function SummaryRegion({ children }: MessageMarkupComponentProps) {
  return (
    <div className="mt-2 flex gap-1 text-xs leading-6 text-muted-foreground">
      <ScrollText className="mt-[6px] h-3 w-3 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function StatusRegion({ children }: MessageMarkupComponentProps) {
  return (
    <div className="mt-1 flex gap-1 text-xs leading-6 text-muted-foreground">
      <Heart className="mt-[6px] h-3 w-3 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
