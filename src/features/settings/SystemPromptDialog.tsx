import { useCallback, useEffect, useState } from "react";
import { ConfigDialogLayout } from "@/components/layout/config-dialog-layout";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SaveButton } from "@/components/ui/save-button";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_SETTINGS } from "@/domain/constants";
import { saveSystemPrompts } from "@/services/settings";
import { useAppState } from "@/store/appState";

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
  }

  function removePrompt(index: number) {
    setSystemPrompts((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function savePrompts() {
    const settings = saveSystemPrompts(systemPrompts);
    setSystemPrompts(settings.systemPrompts);
    reload();
    onChanged?.();
  }

  function resetPrompts() {
    const settings = saveSystemPrompts(DEFAULT_SETTINGS.systemPrompts);
    setSystemPrompts(settings.systemPrompts);
    reload();
    onChanged?.();
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
          <Button type="button" variant="outline" onClick={resetPrompts}>
            恢复默认
          </Button>
          <SaveButton label="保存提示词" onSave={savePrompts} />
        </DialogFooter>
      }
    >
      <div className="space-y-4">
        {systemPrompts.map((prompt, index) => {
          const promptId = `system-prompt-${index}`;

          return (
            <section key={promptId} className="space-y-2 rounded-lg border border-border/70 p-3">
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
          <div className="rounded-lg border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
            暂无系统提示词，保存时会恢复默认值，也可以先新增一条。
          </div>
        ) : null}
      </div>
    </ConfigDialogLayout>
  );
}
