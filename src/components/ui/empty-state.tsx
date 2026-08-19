import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: ReactNode;
  title?: string;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, children, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-full flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border/50 bg-card/30 p-8 text-center backdrop-blur-sm",
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary shadow-sm shadow-primary/10">
          {icon}
        </div>
      ) : null}
      {title ? <h3 className="text-base font-medium">{title}</h3> : null}
      {description ? (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      ) : null}
      {children ? <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  );
}
