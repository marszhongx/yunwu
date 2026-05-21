import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import type { ImageProviderSettings, ProviderType } from "@/domain/types";
import { cn } from "@/lib/utils";
import { openAIImagesGenerationsUrl } from "@/services/ai";
import {
  addImageProvider,
  deleteImageProvider,
  setActiveImageProvider,
  updateImageProvider,
} from "@/services/settings";
import { useAppState } from "@/store/appState";

type ImageProviderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ImageProviderForm = {
  name: string;
  type: ProviderType;
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  parameters: string;
};

const emptyForm: ImageProviderForm = {
  name: "",
  type: "openai",
  provider: "",
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  model: "dall-e-3",
  parameters: "",
};

export function ImageProviderDialog({ open, onOpenChange }: ImageProviderDialogProps) {
  const settings = useAppState((s) => s.settings);
  const reload = useAppState((s) => s.reload);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<ImageProviderForm>(emptyForm);

  useEffect(() => {
    if (open) {
      reload();
      const current = useAppState.getState().settings;
      const target =
        current.imageProviders.find((p) => p.id === current.activeImageProviderId) ??
        current.imageProviders[0];
      if (target) {
        setSelectedId(target.id);
        setCreating(false);
        setForm({
          name: target.name,
          type: target.type,
          provider: target.provider ?? "",
          apiKey: target.apiKey,
          baseUrl: target.baseUrl,
          model: target.model,
          parameters: target.parameters ?? "",
        });
      }
    }
  }, [open, reload]);

  function updateField(field: keyof ImageProviderForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateProviderType(value: ProviderType) {
    setForm((current) => ({
      ...current,
      type: value,
      baseUrl: value === "huggingface" ? "" : current.baseUrl || "https://api.openai.com/v1",
      model:
        value === "huggingface"
          ? current.model || ""
          : current.model || "dall-e-3",
    }));
  }

  function startCreate() {
    setSelectedId(null);
    setCreating(true);
    setForm(emptyForm);
  }

  function clearForm() {
    setForm(emptyForm);
  }

  function editProvider(provider: ImageProviderSettings) {
    setSelectedId(provider.id);
    setCreating(false);
    setForm({
      name: provider.name,
      type: provider.type,
      provider: provider.provider ?? "",
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl,
      model: provider.model,
      parameters: provider.parameters ?? "",
    });
  }

  function saveProvider() {
    if (!creating && !selectedId) return;

    if (selectedId) {
      updateImageProvider(selectedId, form);
    } else {
      const provider = addImageProvider(form);
      setSelectedId(provider.id);
    }

    setCreating(false);
    reload();
  }

  function activateSelectedProvider() {
    if (!selectedId) return;

    setActiveImageProvider(selectedId);
    reload();
  }

  function removeSelectedProvider() {
    if (!selectedId) return;

    deleteImageProvider(selectedId);
    setSelectedId(null);
    setCreating(false);
    setForm(emptyForm);
    reload();
  }

  const showList = settings.imageProviders.length > 0 || creating || selectedId;
  const isOpenAI = form.type === "openai";
  const apiPreview = isOpenAI ? openAIImagesGenerationsUrl(form.baseUrl) : "";
  const isEditing = creating || selectedId !== null;

  return (
    <ConfigDialogLayout
      open={open}
      onOpenChange={onOpenChange}
      title="图片生成设置"
      description="管理图片生成 Provider 配置。"
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
            {settings.imageProviders.map((provider) => (
              <ImageProviderListButton
                key={provider.id}
                active={selectedId === provider.id}
                current={provider.id === settings.activeImageProviderId}
                label={provider.name}
                onClick={() => editProvider(provider)}
              />
            ))}
            <ImageProviderListButton
              active={creating}
              dashed
              label="新建图片 Provider"
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
            <Label htmlFor="image-provider-type">类型</Label>
            <Select value={form.type} onValueChange={updateProviderType}>
              <SelectTrigger id="image-provider-type" aria-label="类型">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI 兼容</SelectItem>
                <SelectItem value="huggingface">Hugging Face</SelectItem>
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
            placeholder={isOpenAI ? "dall-e-3" : "stabilityai/stable-diffusion-xl-base-1.0"}
            value={form.model}
            onChange={(value) => updateField("model", value)}
          />
          {!isOpenAI ? (
            <Field
              label="推理 Provider"
              placeholder="fal-ai"
              value={form.provider}
              onChange={(value) => updateField("provider", value)}
            />
          ) : null}
          {!isOpenAI ? (
            <div className="min-w-0 md:col-span-2">
              <Label htmlFor="image-provider-parameters">参数 (JSON)</Label>
              <Textarea
                id="image-provider-parameters"
                placeholder='{"num_inference_steps": 5}'
                value={form.parameters}
                onChange={(event) => updateField("parameters", event.target.value)}
                rows={2}
              />
            </div>
          ) : null}
          {isOpenAI ? (
            <div className="space-y-2 md:col-span-2">
              <Field
                label="API 地址"
                placeholder="https://api.openai.com/v1"
                value={form.baseUrl}
                onChange={(value) => updateField("baseUrl", value)}
              />
              <p className="break-all text-sm text-muted-foreground">预览：{apiPreview}</p>
            </div>
          ) : (
            <div className="space-y-2 md:col-span-2">
              <Label>API 地址</Label>
              <p className="break-all text-sm text-muted-foreground">
                {form.model
                  ? `https://api-inference.huggingface.co/models/${form.model}`
                  : "https://api-inference.huggingface.co/models/{model}"}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex min-h-[24rem] flex-col items-center justify-center rounded-lg border border-dashed border-border/70 p-8 text-center">
          <h3 className="text-base font-medium">
            {settings.imageProviders.length === 0
              ? "还没有图片 Provider"
              : "选择一个图片 Provider"}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {settings.imageProviders.length === 0
              ? "先创建一个图片 Provider，再开始生成图片。"
              : "从左侧选择图片 Provider 进行编辑，或创建一个新图片 Provider。"}
          </p>
          <Button type="button" className="mt-4" onClick={startCreate}>
            新建图片 Provider
          </Button>
        </div>
      )}
    </ConfigDialogLayout>
  );
}

type ImageProviderListButtonProps = {
  active: boolean;
  current?: boolean;
  dashed?: boolean;
  label: string;
  onClick: () => void;
};

function ImageProviderListButton({
  active,
  current = false,
  dashed = false,
  label,
  onClick,
}: ImageProviderListButtonProps) {
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
      <span
        className="block min-w-0 truncate text-sm"
        style={{ flex: dashed ? "0 1 auto" : "1 1 0%", maxWidth: "100%" }}
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
      <Label htmlFor={`image-provider-${label}`}>{label}</Label>
      <Input
        id={`image-provider-${label}`}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
