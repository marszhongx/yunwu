import { useCallback, useRef, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type SaveButtonProps = {
  onSave: () => void | Promise<void>;
  label?: string;
  disabled?: boolean;
};

export function SaveButton({ onSave, label = "保存", disabled }: SaveButtonProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleClick = useCallback(async () => {
    if (saving) return;

    setSaving(true);
    try {
      await onSave();
      setSaved(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setSaved(false), 1000);
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  }, [onSave, saving]);

  return (
    <Button type="button" disabled={disabled || saving} onClick={() => void handleClick()}>
      {saving ? <LoaderCircle className="animate-spin" /> : null}
      {saved ? <Check /> : null}
      {label}
    </Button>
  );
}
