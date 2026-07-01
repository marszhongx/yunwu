import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type StepBackButtonProps = {
  onClick: () => void;
};

export function StepBackButton({ onClick }: StepBackButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="group h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      aria-label="返回列表"
      onClick={onClick}
    >
      <ArrowLeft className="size-4 transition-transform duration-200 ease-out group-hover:-translate-x-1" />
    </Button>
  );
}
