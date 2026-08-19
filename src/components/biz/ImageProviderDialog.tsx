import { useEffect, useState } from "react";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { ListItemButton } from "@/components/ui/list-item-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageProviderType } from "@/constants";
import type { ImageProviderSettings } from "@/types";
import { openAIChatCompletionsUrl, openAIResponsesUrl } from "@/services/ai";
import {
  addImageProvider,
  deleteImageProvider,
  setActiveImageProvider,
  updateImageProvider,
} from "@/services/settings";
import { useAppState } from "@/store/appState";
import { ConfigDialogLayout } from "@/components/biz/ConfigDialogLayout";
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
  type: ImageProviderType.OPENAI,
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  model: "",
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

  async function saveProvider() {
    if (!creating && !selectedId) return;

    try {
      if (selectedId) {
        await updateImageProvider(selectedId, form);
        toast.success("图片 Provider 已保存");
      } else {
        const provider = await addImageProvider(form);
        setSelectedId(provider.id);
        toast.success("图片 Provider 已新增");
      }

      setCreating(false);
      reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "图片 Provider 保存失败");
    }
  }

  async function activateSelectedProvider() {
    if (!selectedId) return;

    try {
      await setActiveImageProvider(selectedId);
      reload();
      toast.success("图片 Provider 已激活");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "图片 Provider 激活失败");
    }
  }

  async function removeSelectedProvider() {
    if (!selectedId) return;

    try {
      await deleteImageProvider(selectedId);
      setSelectedId(null);
      setCreating(false);
      setForm(emptyForm);
      reload();
      toast.success("图片 Provider 已删除");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "图片 Provider 删除失败");
    }
  }

  const apiPreview =
    form.type === ImageProviderType.OPENAI
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
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => void removeSelectedProvider()}
                >
                  删除
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void activateSelectedProvider()}
                >
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
            <Field
              id="image-provider-name"
              label="名称"
              value={form.name}
              onChange={(value) => updateField("name", value)}
            />
            <div>
              <Label htmlFor="image-provider-type">类型</Label>
              <Select value={form.type} onValueChange={updateProviderType}>
                <SelectTrigger id="image-provider-type" aria-label="类型">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ImageProviderType.OPENAI}>OpenAI</SelectItem>
                  <SelectItem value={ImageProviderType.OPENAI_RESPONSE}>
                    OpenAI Responses
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Field
              id="image-provider-api-key"
              label="API Key"
              type="password"
              value={form.apiKey}
              onChange={(value) => updateField("apiKey", value)}
            />
            <Field
              id="image-provider-model"
              label="模型"
              placeholder="gpt-4o"
              value={form.model}
              onChange={(value) => updateField("model", value)}
            />
            <div className="space-y-2 md:col-span-2">
              <Field
                id="image-provider-base-url"
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
      <EmptyState
        icon={<ImagePlus className="size-5" />}
        title="还没有图片 Provider"
        description="先创建一个图片 Provider，再开始生成图片。"
      >
        <Button type="button" onClick={onCreate}>
          新建图片 Provider
        </Button>
      </EmptyState>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-2">
      {providers.map((provider) => (
        <ListItemButton
          key={provider.id}
          current={provider.id === activeImageProviderId}
          label={provider.name}
          onClick={() => onEdit(provider)}
        />
      ))}
      <ListItemButton dashed label="新建图片 Provider" onClick={onCreate} />
    </div>
  );
}
