import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SaveButton } from "@/components/ui/save-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfigDialogLayout } from "@/components/layout/config-dialog-layout";
import type { ProviderSettings, ProviderType } from "@/domain/types";
import { cn } from "@/lib/utils";
import { openAIChatCompletionsUrl } from "@/services/ai";
import {
  addProvider,
  deleteProvider,
  setActiveProvider,
  updateProvider,
} from "@/services/settings";
import { useAppState } from "@/store/appState";

type SettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
};

type ProviderForm = {
  name: string;
  provider: ProviderType;
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens: string;
};

const emptyForm: ProviderForm = {
  name: "",
  provider: "openai",
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
    setForm((current) => ({ ...current, provider: value }));
  }

  function startCreate() {
    setSelectedId(null);
    setCreating(true);
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
      provider: provider.provider,
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl,
      model: provider.model,
      maxTokens: provider.maxTokens != null ? String(provider.maxTokens) : "",
    });
  }

  function saveProvider() {
    if (!creating && !selectedId) return;

    if (selectedId) {
      updateProvider(selectedId, form);
    } else {
      const provider = addProvider(form);
      setSelectedId(provider.id);
    }

    setCreating(false);
    reload();
    onChanged?.();
  }

  function activateSelectedProvider() {
    if (!selectedId) return;

    setActiveProvider(selectedId);
    reload();
    onChanged?.();
  }

  function removeSelectedProvider() {
    if (!selectedId) return;

    deleteProvider(selectedId);
    setSelectedId(null);
    setCreating(false);
    setForm(emptyForm);
    reload();
    onChanged?.();
  }

  const showList = settings.providers.length > 0 || creating || selectedId;
  const apiPreview = openAIChatCompletionsUrl(form.baseUrl);

  const isEditing = creating || selectedId !== null;

  return (
    <ConfigDialogLayout
      open={open}
      onOpenChange={onOpenChange}
      title="Provider 设置"
      description="管理本地 AI Provider 配置。"
      rightScroll={isEditing}
      rightFooter={
        isEditing ? (
          <DialogFooter className="flex-wrap gap-2 sm:space-x-0">
            {selectedId ? (
              <>
                <Button type="button" variant="destructive" onClick={removeSelectedProvider}>
                  删除
                </Button>
                <Button type="button" variant="outline" onClick={activateSelectedProvider}>
                  激活
                </Button>
              </>
            ) : null}
            <Button type="button" variant="outline" onClick={clearForm}>
              清空
            </Button>
            <SaveButton onSave={saveProvider} />
          </DialogFooter>
        ) : null
      }
      left={
        showList ? (
          <div className="w-full min-w-0 space-y-2">
            {settings.providers.map((provider) => (
              <ProviderListButton
                key={provider.id}
                active={selectedId === provider.id}
                current={provider.id === settings.activeProviderId}
                label={provider.name}
                onClick={() => editProvider(provider)}
              />
            ))}
            <ProviderListButton
              active={creating}
              dashed
              label="新建 Provider"
              onClick={startCreate}
            />
          </div>
        ) : null
      }
    >
      {isEditing ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="名称" value={form.name} onChange={(value) => updateField("name", value)} />
          <div>
            <Label htmlFor="provider-type">类型</Label>
            <Select value={form.provider} onValueChange={updateProviderType}>
              <SelectTrigger id="provider-type" aria-label="类型">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">Gemini</SelectItem>
                <SelectItem value="claude">Claude</SelectItem>
                <SelectItem value="openai">OpenAI 兼容</SelectItem>
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
            {form.provider === "openai" ? (
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
      ) : (
        <div className="flex min-h-[24rem] flex-col items-center justify-center rounded-lg border border-dashed border-border/70 p-8 text-center">
          <h3 className="text-base font-medium">
            {settings.providers.length === 0 ? "还没有 Provider" : "选择一个 Provider"}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {settings.providers.length === 0
              ? "先创建一个 Provider，再开始调用 AI 模型。"
              : "从左侧选择 Provider 进行编辑，或创建一个新 Provider。"}
          </p>
          <Button type="button" className="mt-4" onClick={startCreate}>
            新建 Provider
          </Button>
        </div>
      )}
    </ConfigDialogLayout>
  );
}

type ProviderListButtonProps = {
  active: boolean;
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
        "flex w-full items-center gap-2 rounded-md border border-border/70 px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
        dashed &&
          "justify-center border-dashed border-foreground/35 text-center text-foreground hover:border-ring hover:text-accent-foreground",
        active && "border-ring bg-accent text-accent-foreground",
      )}
      aria-current={active ? "true" : undefined}
      aria-label={`编辑 ${label}`}
      onClick={onClick}
    >
      {dashed ? <Plus className="size-4" /> : null}
      <span className="block min-w-0 truncate text-sm" style={{ flex: dashed ? "0 1 auto" : "1 1 0%", maxWidth: "100%" }}>
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
