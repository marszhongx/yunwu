import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
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
import { ImageProviderType } from "@/constants";
import type { ImageProviderSettings } from "@/types";
import { cn } from "@/lib/utils";
import {
  openAIChatCompletionsUrl,
  openAIImagesGenerationsUrl,
  openAIResponsesUrl,
} from "@/services/ai";
import {
  addImageProvider,
  deleteImageProvider,
  setActiveImageProvider,
  updateImageProvider,
} from "@/services/settings";
import { useAppState } from "@/store/appState";
import { ConfigDialogLayout } from "@/components/biz/ConfigDialogLayout";
import { SaveButton } from "@/components/biz/SaveButton";
import { StepBackButton } from "@/components/biz/StepBackButton";

type ImageProviderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ImageProviderForm = {
  name: string;
  type: ImageProviderType;
  apiKey: string;
  baseUrl: string;
  model: string;
};

const emptyForm: ImageProviderForm = {
  name: "",
  type: ImageProviderType.DALL_E_3,
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  model: ImageProviderType.DALL_E_3,
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
      setSelectedId(null);
      setCreating(false);
      setForm(emptyForm);
    }
  }, [open, reload]);

  function updateField(field: keyof ImageProviderForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateProviderType(value: ImageProviderType) {
    setForm((current) => ({
      ...current,
      type: value,
      baseUrl: current.baseUrl || "https://api.openai.com/v1",
      model:
        current.model || (value === ImageProviderType.DALL_E_3 ? ImageProviderType.DALL_E_3 : ""),
    }));
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

  function editProvider(provider: ImageProviderSettings) {
    setSelectedId(provider.id);
    setCreating(false);
    setForm({
      name: provider.name,
      type: provider.type,
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl,
      model: provider.model,
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

  const apiPreview =
    form.type === ImageProviderType.DALL_E_3
      ? openAIImagesGenerationsUrl(form.baseUrl)
      : form.type === ImageProviderType.OPENAI
        ? openAIChatCompletionsUrl(form.baseUrl)
        : form.type === ImageProviderType.OPENAI_RESPONSE
          ? openAIResponsesUrl(form.baseUrl)
          : "";
  const isEditing = creating || selectedId !== null;
  const dialogTitle = creating
    ? "新建图片 Provider"
    : selectedId
      ? "修改图片 Provider"
      : "图片生成设置";

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
    >
      {isEditing ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="名称" value={form.name} onChange={(value) => updateField("name", value)} />
            <div>
              <Label htmlFor="image-provider-type">类型</Label>
              <Select value={form.type} onValueChange={updateProviderType}>
                <SelectTrigger id="image-provider-type" aria-label="类型">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ImageProviderType.DALL_E_3}>DALL-E / Images API</SelectItem>
                  <SelectItem value={ImageProviderType.OPENAI}>Chat Completions</SelectItem>
                  <SelectItem value={ImageProviderType.OPENAI_RESPONSE}>Responses API</SelectItem>
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
              placeholder={
                form.type === ImageProviderType.DALL_E_3 ? ImageProviderType.DALL_E_3 : "gpt-4o"
              }
              value={form.model}
              onChange={(value) => updateField("model", value)}
            />
            <div className="space-y-2 md:col-span-2">
              <Field
                label="API 地址"
                placeholder="https://api.openai.com/v1"
                value={form.baseUrl}
                onChange={(value) => updateField("baseUrl", value)}
              />
              <p className="break-all text-sm text-muted-foreground">预览：{apiPreview}</p>
            </div>
          </div>
        </>
      ) : (
        <ImageProviderList
          providers={settings.imageProviders}
          activeImageProviderId={settings.activeImageProviderId}
          onEdit={editProvider}
          onCreate={startCreate}
        />
      )}
    </ConfigDialogLayout>
  );
}

type ImageProviderListProps = {
  providers: ImageProviderSettings[];
  activeImageProviderId: string;
  onEdit: (provider: ImageProviderSettings) => void;
  onCreate: () => void;
};

function ImageProviderList({
  providers,
  activeImageProviderId,
  onEdit,
  onCreate,
}: ImageProviderListProps) {
  if (providers.length === 0) {
    return (
      <div className="flex min-h-[24rem] flex-col items-center justify-center rounded-lg border border-dashed border-border/70 p-8 text-center">
        <h3 className="text-base font-medium">还没有图片 Provider</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          先创建一个图片 Provider，再开始生成图片。
        </p>
        <Button type="button" className="mt-4" onClick={onCreate}>
          新建图片 Provider
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-2">
      {providers.map((provider) => (
        <ImageProviderListButton
          key={provider.id}
          current={provider.id === activeImageProviderId}
          label={provider.name}
          onClick={() => onEdit(provider)}
        />
      ))}
      <ImageProviderListButton dashed label="新建图片 Provider" onClick={onCreate} />
    </div>
  );
}

type ImageProviderListButtonProps = {
  active?: boolean;
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
