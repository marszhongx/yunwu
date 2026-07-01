import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProviderType } from "@/constants";
import type { ProviderSettings } from "@/types";
import { cn } from "@/lib/utils";
import { openAIChatCompletionsUrl } from "@/services/ai";
import {
  addProvider,
  deleteProvider,
  setActiveProvider,
  updateProvider,
} from "@/services/settings";
import { useAppState } from "@/store/appState";
import { ConfigDialogLayout } from "@/components/biz/ConfigDialogLayout";
import { StepBackButton } from "@/components/biz/StepBackButton";

type SettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
};

type ProviderForm = {
  name: string;
  type: ProviderType;
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens: string;
};

const emptyForm: ProviderForm = {
  name: "",
  type: ProviderType.OPENAI,
  apiKey: "",
  baseUrl: "",
  model: "",
  maxTokens: "",
};

export function SettingsDialog({ open, onOpenChange, onChanged }: SettingsDialogProps) {
  const settings = useAppState((s) => s.settings);
  const reload = useAppState((s) => s.reload);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (open) reload();
  }, [open, reload]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<ProviderForm>(emptyForm);
  const [showAdvanced, setShowAdvanced] = useState(false);

  function updateField(field: keyof ProviderForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateProviderType(value: ProviderType) {
    setForm((current) => ({ ...current, type: value }));
  }

  function startCreate() {
    setSelectedId(null);
    setCreating(true);
    setForm(emptyForm);
  }

  function backToList() {
    setSelectedId(null);
    setCreating(false);
    setForm(emptyForm);
  }

  function clearForm() {
    setForm(emptyForm);
  }

  function editProvider(provider: ProviderSettings) {
    setSelectedId(provider.id);
    setCreating(false);
    setForm({
      name: provider.name,
      type: provider.type,
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl,
      model: provider.model,
      maxTokens: provider.maxTokens != null ? String(provider.maxTokens) : "",
    });
  }

  async function saveProvider() {
    if (!creating && !selectedId) return;

    try {
      if (selectedId) {
        await updateProvider(selectedId, form);
        toast.success("Provider 已保存");
      } else {
        const provider = await addProvider(form);
        setSelectedId(provider.id);
        toast.success("Provider 已新增");
      }

      setCreating(false);
      reload();
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Provider 保存失败");
    }
  }

  async function activateSelectedProvider() {
    if (!selectedId) return;

    try {
      await setActiveProvider(selectedId);
      reload();
      onChanged?.();
      toast.success("Provider 已激活");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Provider 激活失败");
    }
  }

  async function removeSelectedProvider() {
    if (!selectedId) return;

    try {
      await deleteProvider(selectedId);
      setSelectedId(null);
      setCreating(false);
      setForm(emptyForm);
      reload();
      onChanged?.();
      toast.success("Provider 已删除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Provider 删除失败");
    }
  }

  const apiPreview = openAIChatCompletionsUrl(form.baseUrl);

  const isEditing = creating || selectedId !== null;
  const dialogTitle = creating ? "新建 Provider" : selectedId ? "修改 Provider" : "Provider 设置";

  return (
    <ConfigDialogLayout
      open={open}
      onOpenChange={onOpenChange}
      title={dialogTitle}
      titleAction={isEditing ? <StepBackButton onClick={backToList} /> : null}
      rightScroll
      rightFooter={
        isEditing ? (
          <DialogFooter className="flex-wrap gap-2 sm:space-x-0">
            {selectedId ? (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => void removeSelectedProvider()}
                >
                  删除
                </Button>
                <Button type="button" variant="outline" onClick={() => void activateSelectedProvider()}>
                  激活
                </Button>
              </>
            ) : null}
            <Button type="button" variant="outline" onClick={clearForm}>
              清空
            </Button>
            <Button type="button" onClick={() => void saveProvider()}>
              保存
            </Button>
          </DialogFooter>
        ) : null
      }
    >
      {isEditing ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="名称" value={form.name} onChange={(value) => updateField("name", value)} />
            <div>
              <Label htmlFor="provider-type">类型</Label>
              <Select value={form.type} onValueChange={updateProviderType}>
                <SelectTrigger id="provider-type" aria-label="类型">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ProviderType.GEMINI}>Gemini</SelectItem>
                  <SelectItem value={ProviderType.CLAUDE}>Claude</SelectItem>
                  <SelectItem value={ProviderType.OPENAI}>OpenAI 兼容</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Field
              label="API Key"
              type="password"
              value={form.apiKey}
              onChange={(value) => updateField("apiKey", value)}
            />
            <Field
              label="模型"
              value={form.model}
              onChange={(value) => updateField("model", value)}
            />
            <div className="space-y-2 md:col-span-2">
              <Field
                label="API 地址"
                placeholder="https://api.example.com/v1"
                value={form.baseUrl}
                onChange={(value) => updateField("baseUrl", value)}
              />
              {form.type === ProviderType.OPENAI ? (
                <p className="break-all text-sm text-muted-foreground">预览：{apiPreview}</p>
              ) : null}
            </div>
            <div className="md:col-span-2">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <span className="mr-1.5 inline-block w-4 text-center text-sm leading-none">
                  {showAdvanced ? "▼" : "▶"}
                </span>
                高级设置
              </button>
              {showAdvanced ? (
                <div className="grid gap-4 pt-3 md:grid-cols-2">
                  <Field
                    label="最大输出 Token"
                    type="number"
                    placeholder="不填则使用模型默认值"
                    value={form.maxTokens}
                    onChange={(value) => updateField("maxTokens", value)}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        <ProviderList
          providers={settings.providers}
          activeProviderId={settings.activeProviderId}
          onEdit={editProvider}
          onCreate={startCreate}
        />
      )}
    </ConfigDialogLayout>
  );
}

type ProviderListProps = {
  providers: ProviderSettings[];
  activeProviderId: string;
  onEdit: (provider: ProviderSettings) => void;
  onCreate: () => void;
};

function ProviderList({ providers, activeProviderId, onEdit, onCreate }: ProviderListProps) {
  if (providers.length === 0) {
    return (
      <div className="flex min-h-full flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border/50 bg-card/30 p-8 text-center backdrop-blur-sm">
        <h3 className="text-base font-medium">还没有 Provider</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          先创建一个 Provider，再开始调用 AI 模型。
        </p>
        <Button type="button" className="mt-4" onClick={onCreate}>
          新建 Provider
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-2">
      {providers.map((provider) => (
        <ProviderListButton
          key={provider.id}
          current={provider.id === activeProviderId}
          label={provider.name}
          onClick={() => onEdit(provider)}
        />
      ))}
      <ProviderListButton dashed label="新建 Provider" onClick={onCreate} />
    </div>
  );
}

type ProviderListButtonProps = {
  active?: boolean;
  current?: boolean;
  dashed?: boolean;
  label: string;
  onClick: () => void;
};

function ProviderListButton({
  active,
  current = false,
  dashed = false,
  label,
  onClick,
}: ProviderListButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 rounded-lg border border-border/50 bg-card/40 px-3 py-2.5 text-left text-sm backdrop-blur-sm transition-all duration-200 hover:bg-accent/60 hover:shadow-sm",
        dashed &&
          "justify-center border-dashed border-foreground/30 text-center text-foreground hover:border-primary/40 hover:bg-accent/40 hover:text-accent-foreground",
        active && "border-primary/40 bg-accent/60 text-accent-foreground shadow-sm",
      )}
      aria-current={active ? "true" : undefined}
      aria-label={`编辑 ${label}`}
      onClick={onClick}
    >
      {dashed ? <Plus className="size-4" /> : null}
      <span
        className={cn(
          "block min-w-0 truncate text-sm",
          dashed ? "flex-auto" : "flex-1",
        )}
      >
        {label}
      </span>
      {current ? <span className="shrink-0 text-xs text-muted-foreground">当前</span> : null}
    </button>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
};

function Field({ label, value, onChange, type = "text", placeholder }: FieldProps) {
  return (
    <div className="min-w-0">
      <Label htmlFor={`provider-${label}`}>{label}</Label>
      <Input
        id={`provider-${label}`}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
