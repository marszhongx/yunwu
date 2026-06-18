import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type ConfigDialogLayoutProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  titleAction?: React.ReactNode;
  left?: React.ReactNode;
  rightScroll?: boolean;
  rightFooter?: React.ReactNode;
  children: React.ReactNode;
};

export function ConfigDialogLayout({
  open,
  onOpenChange,
  title,
  description,
  titleAction,
  left,
  rightScroll = true,
  rightFooter,
  children,
}: ConfigDialogLayoutProps) {
  const hasLeft = Boolean(left);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        {...(description ? {} : { "aria-describedby": undefined })}
        className="flex h-[min(90vh,_48rem)] max-w-full flex-col overflow-hidden sm:max-w-3xl"
      >
        <DialogHeader>
          <div className="flex items-center gap-2 pr-8">
            {titleAction}
            <DialogTitle>{title}</DialogTitle>
          </div>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div
          className={cn(
            "grid min-h-0 flex-1 gap-4",
            hasLeft && "md:grid-cols-[14rem_minmax(0,1fr)]",
          )}
        >
          {hasLeft ? (
            <section className="min-h-0 space-y-3 overflow-auto pr-4 md:border-r md:border-border/70">
              {left}
            </section>
          ) : null}
          {rightScroll ? (
            <section className="flex min-h-0 flex-col space-y-4">
              <ScrollArea className="config-dialog-scroll min-h-0 flex-1 pr-3">
                <div className="flex min-h-full flex-1 flex-col space-y-4">{children}</div>
              </ScrollArea>
              {rightFooter}
            </section>
          ) : (
            <>{children}</>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
