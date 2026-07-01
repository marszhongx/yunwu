import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_SETTINGS } from "@/constants";
import { saveSystemPrompts } from "@/services/settings";
import { useAppState } from "@/store/appState";
import { ConfigDialogLayout } from "@/components/biz/ConfigDialogLayout";

type SystemPromptDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
};

export function SystemPromptDialog({ open, onOpenChange, onChanged }: SystemPromptDialogProps) {
  const reload = useAppState((s) => s.reload);
  const [systemPrompts, setSystemPrompts] = useState<string[]>([]);

  const loadSystemPrompts = useCallback(() => {
    useAppState.getState().reload();
    setSystemPrompts(useAppState.getState().settings.systemPrompts);
  }, []);

  useEffect(() => {
    if (open) {
      loadSystemPrompts();
    }
  }, [loadSystemPrompts, open]);

  function updatePrompt(index: number, value: string) {
    setSystemPrompts((current) =>
      current.map((prompt, itemIndex) => (itemIndex === index ? value : prompt)),
    );
  }

  function addPrompt() {
    setSystemPrompts((current) => [...current, ""]);
    toast.success("提示词已新增");
  }

  function removePrompt(index: number) {
    setSystemPrompts((current) => current.filter((_, itemIndex) => itemIndex !== index));
    toast.success("提示词已删除");
  }

  async function savePrompts() {
    try {
      const settings = await saveSystemPrompts(systemPrompts);
      setSystemPrompts(settings.systemPrompts);
      reload();
      onChanged?.();
      toast.success("提示词已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "提示词保存失败");
    }
  }

  async function resetPrompts() {
    try {
      const settings = await saveSystemPrompts(DEFAULT_SETTINGS.systemPrompts);
      setSystemPrompts(settings.systemPrompts);
      reload();
      onChanged?.();
      toast.success("提示词已恢复默认");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "提示词恢复默认失败");
    }
  }

  return (
    <ConfigDialogLayout
      open={open}
      onOpenChange={onOpenChange}
      title="系统提示词"
      description="编辑按顺序发送给 AI 的 system messages。"
      rightFooter={
        <DialogFooter>
          <Button type="button" variant="outline" onClick={addPrompt}>
            新增提示词
          </Button>
          <Button type="button" variant="outline" onClick={() => void resetPrompts()}>
            恢复默认
          </Button>
          <Button type="button" onClick={() => void savePrompts()}>
            保存提示词
          </Button>
        </DialogFooter>
      }
    >
      <div className="flex min-h-full flex-col space-y-4">
        {systemPrompts.map((prompt, index) => {
          const promptId = `system-prompt-${index}`;

          return (
            <section key={promptId} className="space-y-2 rounded-xl border border-border/40 bg-card/40 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={promptId}>内置系统提示词 {index + 1}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removePrompt(index)}
                >
                  删除
                </Button>
              </div>
              <Textarea
                id={promptId}
                value={prompt}
                onChange={(event) => updatePrompt(index, event.target.value)}
                className="min-h-40 resize-y"
              />
            </section>
          );
        })}
        {systemPrompts.length === 0 ? (
          <div className="flex min-h-full flex-1 items-center justify-center rounded-xl border border-dashed border-border/50 bg-card/30 p-8 text-center text-sm text-muted-foreground backdrop-blur-sm">
            暂无系统提示词，保存时会恢复默认值，也可以先新增一条。
          </div>
        ) : null}
      </div>
    </ConfigDialogLayout>
  );
}
