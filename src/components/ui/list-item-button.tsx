import type { ComponentProps } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type ListItemButtonProps = ComponentProps<"button"> & {
  label: string;
  description?: string;
  current?: boolean;
  active?: boolean;
  dashed?: boolean;
};

export function ListItemButton({
  label,
  description,
  current = false,
  active = false,
  dashed = false,
  className,
  ...props
}: ListItemButtonProps) {
  return (
    <button
      type="button"
      aria-label={`编辑 ${label}`}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg border border-border/50 bg-card/40 px-3 py-2.5 text-left text-sm backdrop-blur-sm transition-all duration-200 hover:bg-accent/60 hover:shadow-sm",
        dashed &&
          "justify-center border-dashed border-foreground/30 text-center text-foreground hover:border-primary/40 hover:bg-accent/40 hover:text-accent-foreground",
        active && "border-primary/40 bg-accent/60 text-accent-foreground shadow-sm",
        className,
      )}
      {...props}
    >
      {dashed ? (
        <>
          <Plus className="size-4 shrink-0" />
          <span className="flex-none">{label}</span>
        </>
      ) : (
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="block min-w-0 truncate text-sm">{label}</span>
          {description ? (
            <span className="block min-w-0 truncate text-xs text-muted-foreground">
              {description}
            </span>
          ) : null}
        </span>
      )}
      {current ? <span className="shrink-0 text-xs text-muted-foreground">当前</span> : null}
    </button>
  );
}
