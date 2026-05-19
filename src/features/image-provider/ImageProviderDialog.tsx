import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SaveButton } from "@/components/ui/save-button";
import { openAIImagesGenerationsUrl } from "@/services/ai";
import { saveImageProvider } from "@/services/settings";
import { useAppState } from "@/store/appState";

type ImageProviderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ImageProviderDialog({ open, onOpenChange }: ImageProviderDialogProps) {
  const imageProvider = useAppState((s) => s.imageProvider);
  const reload = useAppState((s) => s.reload);
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");

  useEffect(() => {
    if (open) {
      reload();
      setBaseUrl(imageProvider?.baseUrl ?? "https://api.openai.com/v1");
      setApiKey(imageProvider?.apiKey ?? "");
      setModel(imageProvider?.model ?? "dall-e-3");
    }
  }, [open, reload]);

  function handleSave() {
    saveImageProvider({ baseUrl, apiKey, model });
    reload();
    onOpenChange(false);
  }

  const apiPreview = openAIImagesGenerationsUrl(baseUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>图片生成设置</DialogTitle>
          <DialogDescription>配置 OpenAI 兼容的图片生成 API。</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="image-base-url">API 地址</Label>
            <Input
              id="image-base-url"
              placeholder="https://api.openai.com/v1"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
            <p className="mt-2 break-all text-sm text-muted-foreground">预览：{apiPreview}</p>
          </div>
          <div>
            <Label htmlFor="image-api-key">API Key</Label>
            <Input
              id="image-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="image-model">模型</Label>
            <Input
              id="image-model"
              placeholder="dall-e-3"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <SaveButton onSave={handleSave} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
