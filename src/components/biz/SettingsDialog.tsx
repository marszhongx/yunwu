import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
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
import { ProviderType, ReasoningEffort } from "@/constants";
import type { ProviderSettings } from "@/types";
import { openAIChatCompletionsUrl, openAIResponsesUrl } from "@/services/ai";
import {
  addProvider,
  deleteProvider,
  saveUseProxy,
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
  reasoningEffort: ReasoningEffort;
};

const emptyForm: ProviderForm = {
  name: "",
  type: ProviderType.OPENAI,
  apiKey: "",
  baseUrl: "",
  model: "",
  maxTokens: "",
  reasoningEffort: ReasoningEffort.AUTO,
};

const reasoningEffortLabels: Record<ReasoningEffort, string> = {
  [ReasoningEffort.AUTO]: "Auto",
  [ReasoningEffort.NONE]: "None",
  [ReasoningEffort.MINIMAL]: "Minimal",
  [ReasoningEffort.LOW]: "Low",
  [ReasoningEffort.MEDIUM]: "Medium",
  [ReasoningEffort.HIGH]: "High",
  [ReasoningEffort.XHIGH]: "XHigh",
  [ReasoningEffort.MAX]: "Max",
};

const apiPreviewBuilders: Record<
  ProviderType,
  (form: Pick<ProviderForm, "baseUrl" | "model">) => string
> = {
  [ProviderType.OPENAI]: ({ baseUrl }) => openAIChatCompletionsUrl(baseUrl),
  [ProviderType.OPENAI_RESPONSE]: ({ baseUrl }) => openAIResponsesUrl(baseUrl),
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

  function updateReasoningEffort(value: ReasoningEffort) {
    setForm((current) => ({ ...current, reasoningEffort: value }));
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
      reasoningEffort: provider.reasoningEffort,
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

  async function toggleUseProxy(checked: boolean) {
    try {
      await saveUseProxy(checked);
      reload();
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "代理设置保存失败");
    }
  }

  const apiPreview = apiPreviewBuilders[form.type](form);

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
              id="provider-name"
              label="名称"
              value={form.name}
              onChange={(value) => updateField("name", value)}
            />
            <div>
              <Label htmlFor="provider-type">类型</Label>
              <Select value={form.type} onValueChange={updateProviderType}>
                <SelectTrigger id="provider-type" aria-label="类型">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ProviderType.OPENAI}>OpenAI</SelectItem>
                  <SelectItem value={ProviderType.OPENAI_RESPONSE}>OpenAI Responses</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Field
              id="provider-api-key"
              label="API Key"
              type="password"
              value={form.apiKey}
              onChange={(value) => updateField("apiKey", value)}
            />
            <Field
              id="provider-model"
              label="模型"
              value={form.model}
              onChange={(value) => updateField("model", value)}
            />
            <div className="space-y-2 md:col-span-2">
              <Field
                id="provider-base-url"
                label="API 地址"
                placeholder="https://api.example.com/v1"
                value={form.baseUrl}
                onChange={(value) => updateField("baseUrl", value)}
              />
              <p className="break-all text-sm text-muted-foreground">预览：{apiPreview}</p>
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
                    id="provider-max-tokens"
                    label="最大输出 Token"
                    type="number"
                    placeholder="不填则使用模型默认值"
                    value={form.maxTokens}
                    onChange={(value) => updateField("maxTokens", value)}
                  />
                  <div>
                    <Label htmlFor="provider-reasoning-effort">思考等级</Label>
                    <Select value={form.reasoningEffort} onValueChange={updateReasoningEffort}>
                      <SelectTrigger id="provider-reasoning-effort" aria-label="思考等级">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(ReasoningEffort).map((effort) => (
                          <SelectItem key={effort} value={effort}>
                            {reasoningEffortLabels[effort]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        <div className="w-full min-w-0">
          <ProviderList
            providers={settings.providers}
            activeProviderId={settings.activeProviderId}
            onEdit={editProvider}
            onCreate={startCreate}
          />
          <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg border border-border/50 bg-card/40 px-3 py-2.5 text-sm backdrop-blur-sm transition-colors hover:bg-accent/60">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-primary"
              checked={settings.useProxy}
              onChange={(event) => void toggleUseProxy(event.target.checked)}
            />
            <span className="min-w-0">
              通过服务器代理转发 API 请求
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                跨域（CORS）报错时开启；关闭时直连。
              </span>
            </span>
          </label>
        </div>
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
      <EmptyState
        icon={<KeyRound className="size-5" />}
        title="还没有 Provider"
        description="先创建一个 Provider，再开始调用 AI 模型。"
      >
        <Button type="button" onClick={onCreate}>
          新建 Provider
        </Button>
      </EmptyState>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-2">
      {providers.map((provider) => (
        <ListItemButton
          key={provider.id}
          current={provider.id === activeProviderId}
          label={provider.name}
          description={provider.model}
          onClick={() => onEdit(provider)}
        />
      ))}
      <ListItemButton dashed label="新建 Provider" onClick={onCreate} />
    </div>
  );
}
