# 图片生成功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用户在 AI 叙述气泡上点击图片按钮，将场景描述作为 prompt 发送到 OpenAI 兼容的 Images API，生成结果以独立气泡展示。

**Architecture:** 独立图片 provider 配置（与文字 provider 分离），在 ai.ts 中新增 generateImage 函数调用 OpenAI 兼容 Images API。消息模型扩展 role 为 "image"，content 存 base64 data URL。UI 上在气泡工具栏增加图片按钮，图片以独立气泡渲染。

**Tech Stack:** React, TypeScript, Vite, Vitest, IndexedDB, Tailwind CSS, lucide-react

---

## 文件清单

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/domain/types.ts` | 修改 | MessageRole 扩展 "image"，新增 ImageProviderSettings |
| `src/domain/constants.ts` | 修改 | DEFAULT_SETTINGS 增加 imageProvider |
| `src/services/ai.ts` | 修改 | 新增 generateImage 函数 |
| `src/services/ai.test.ts` | 修改 | 新增 generateImage 测试 |
| `src/services/settings.ts` | 修改 | 新增 saveImageProvider / getImageProvider |
| `src/services/settings.test.ts` | 修改 | 新增对应的单元测试 |
| `src/store/appState.ts` | 修改 | 新增 imageProvider 状态 |
| `src/features/image-provider/ImageProviderDialog.tsx` | 新建 | 图片 provider 配置弹窗 |
| `src/features/image-provider/ImageProviderDialog.test.tsx` | 新建 | 配置弹窗测试 |
| `src/features/chat/ChatView.tsx` | 修改 | 气泡工具栏加图片按钮，图片消息渲染 |
| `src/components/layout/AppShell.tsx` | 修改 | 导航栏新增图片 provider 入口 |
| `src/App.tsx` | 修改 | 集成 ImageProviderDialog |

---

### Task 1: 扩展数据模型

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/constants.ts`

- [ ] **Step 1: 修改 types.ts — 扩展 MessageRole 和新增 ImageProviderSettings**

```typescript
// 修改 MessageRole
export type MessageRole = "user" | "assistant" | "image";

// 新增 ImageProviderSettings 类型
export type ImageProviderSettings = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

// AppSettings 新增可选字段
export type AppSettings = {
  activeProviderId: string;
  providers: ProviderSettings[];
  theme: "dark" | "light";
  systemPrompts: string[];
  imageProvider?: ImageProviderSettings;
};
```

- [ ] **Step 2: 修改 constants.ts — DEFAULT_SETTINGS 增加 imageProvider**

在 `DEFAULT_SETTINGS` 中新增：
```typescript
export const DEFAULT_SETTINGS: AppSettings = {
  activeProviderId: "",
  providers: [],
  theme: "dark",
  systemPrompts: DEFAULT_SYSTEM_PROMPTS,
  imageProvider: undefined,
};
```

- [ ] **Step 3: 验证构建通过**

Run: `npm run build`
Expected: 成功

- [ ] **Step 4: 提交**

```bash
git add src/domain/types.ts src/domain/constants.ts
git commit -m "feat: 扩展数据模型支持图片生成"
```

---

### Task 2: 实现 generateImage API 函数

**Files:**
- Modify: `src/services/ai.ts`
- Modify: `src/services/ai.test.ts`

- [ ] **Step 1: 在 ai.ts 末尾新增 generateImage 函数**

```typescript
const IMAGE_TIMEOUT = 120000;

export async function generateImage({
  apiKey,
  baseUrl,
  model,
  prompt,
}: {
  apiKey: string;
  baseUrl: string;
  model: string;
  prompt: string;
}): Promise<string> {
  const normalizedBaseUrl = (baseUrl.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
  const url = `${normalizedBaseUrl}/images/generations`;
  const abortController = new AbortController();
  const timeoutId = globalThis.setTimeout(() => abortController.abort(), IMAGE_TIMEOUT);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt,
        size: "1024x1024",
        response_format: "b64_json",
      }),
      signal: abortController.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`图片生成请求失败：${response.status} ${errorText}`.trim());
    }

    const json = (await response.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;

    if (!b64) {
      throw new Error("图片生成返回了空响应");
    }

    return `data:image/png;base64,${b64}`;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("图片生成请求超时");
    }

    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}
```

- [ ] **Step 2: 在 ai.test.ts 新增 generateImage 测试**

```typescript
import { streamAssistantText, requestAssistantText, generateImage } from "./ai";

// ... 在文件末尾添加

describe("generateImage", () => {
  test("returns data URL from b64_json response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ b64_json: "aGVsbG8=" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ) as FetchMock;
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateImage({
      apiKey: "test-key",
      baseUrl: "https://api.example.com/v1",
      model: "dall-e-3",
      prompt: "a cat",
    });

    expect(result).toBe("data:image/png;base64,aGVsbG8=");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.com/v1/images/generations");
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      model: "dall-e-3",
      prompt: "a cat",
      size: "1024x1024",
      response_format: "b64_json",
    });
  });

  test("throws on API error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("bad request", { status: 400 }),
    ) as FetchMock;
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generateImage({ apiKey: "k", baseUrl: "", model: "m", prompt: "p" }),
    ).rejects.toThrow("图片生成请求失败：400 bad request");
  });

  test("throws on empty response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ) as FetchMock;
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generateImage({ apiKey: "k", baseUrl: "", model: "m", prompt: "p" }),
    ).rejects.toThrow("图片生成返回了空响应");
  });
});
```

- [ ] **Step 3: 运行测试确认通过**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 4: 提交**

```bash
git add src/services/ai.ts src/services/ai.test.ts
git commit -m "feat: 新增 generateImage 图片生成 API 函数"
```

---

### Task 3: 扩展 settings 服务和 appState

**Files:**
- Modify: `src/services/settings.ts`
- Modify: `src/store/appState.ts`

- [ ] **Step 1: 在 settings.ts 新增图片 provider 相关函数**

```typescript
import type { AppSettings, ImageProviderSettings, ProviderSettings, ProviderType } from "../domain/types";

// ... 在文件末尾添加

function normalizeImageProvider(value: unknown): ImageProviderSettings | undefined {
  if (!isRecord(value)) return undefined;
  const apiKey = toStringValue(value.apiKey);
  const baseUrl = toStringValue(value.baseUrl);
  const model = toStringValue(value.model);
  if (!apiKey && !baseUrl && !model) return undefined;
  return { apiKey, baseUrl: baseUrl || "https://api.openai.com/v1", model: model || "dall-e-3" };
}

export function saveImageProvider(input: unknown): AppSettings {
  const settings = getSettings();
  return saveSettings({ ...settings, imageProvider: normalizeImageProvider(input) });
}

export function getImageProvider(): ImageProviderSettings | null {
  const settings = getSettings();
  return settings.imageProvider ?? null;
}
```

同时在 `normalizeSettings` 函数中添加 imageProvider 的规范化：
```typescript
function normalizeSettings(value: unknown): AppSettings {
  const input = isRecord(value) ? (value as SettingsInput) : {};
  // ... existing code ...
  return {
    activeProviderId: hasActiveProvider ? activeProviderId : DEFAULT_SETTINGS.activeProviderId,
    providers,
    theme: normalizeTheme(input.theme),
    systemPrompts: normalizeSystemPrompts(input.systemPrompts, input.systemPrompt),
    imageProvider: normalizeImageProvider(input.imageProvider),
  };
}
```

- [ ] **Step 2: 修改 appState.ts — 新增 imageProvider 状态**

```typescript
import type { AppSettings, ImageProviderSettings, ProviderSettings } from "@/domain/types";
import { getActiveProvider, getImageProvider, getSettings } from "@/services/settings";

type AppState = {
  settings: AppSettings;
  activeProvider: ProviderSettings | null;
  imageProvider: ImageProviderSettings | null;
  init: () => void;
  reload: () => void;
};

export const useAppState = create<AppState>((set) => ({
  settings: getSettings(),
  activeProvider: getActiveProvider(),
  imageProvider: getImageProvider(),
  init: () => set({ settings: getSettings(), activeProvider: getActiveProvider(), imageProvider: getImageProvider() }),
  reload: () => set({ settings: getSettings(), activeProvider: getActiveProvider(), imageProvider: getImageProvider() }),
}));
```

- [ ] **Step 3: 验证构建通过**

Run: `npm run build`
Expected: 成功

- [ ] **Step 4: 提交**

```bash
git add src/services/settings.ts src/store/appState.ts
git commit -m "feat: 新增图片 provider 配置服务和状态管理"
```

---

### Task 4: 创建 ImageProviderDialog

**Files:**
- Create: `src/features/image-provider/ImageProviderDialog.tsx`
- Create: `src/features/image-provider/ImageProviderDialog.test.tsx`

- [ ] **Step 1: 创建 ImageProviderDialog 组件**

```tsx
// src/features/image-provider/ImageProviderDialog.tsx
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SaveButton } from "@/components/ui/save-button";
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
```

- [ ] **Step 2: 创建 ImageProviderDialog 测试**

```tsx
// src/features/image-provider/ImageProviderDialog.test.tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ImageProviderDialog } from "./ImageProviderDialog";

vi.mock("@/store/appState", () => ({
  useAppState: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ imageProvider: null, reload: vi.fn() }),
}));

vi.mock("@/services/settings", () => ({
  saveImageProvider: vi.fn(),
}));

describe("ImageProviderDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders form fields", () => {
    render(<ImageProviderDialog open onOpenChange={() => {}} />);

    expect(screen.getByText("图片生成设置")).toBeInTheDocument();
    expect(screen.getByLabelText("API 地址")).toBeInTheDocument();
    expect(screen.getByLabelText("API Key")).toBeInTheDocument();
    expect(screen.getByLabelText("模型")).toBeInTheDocument();
  });

  test("has default values", () => {
    render(<ImageProviderDialog open onOpenChange={() => {}} />);

    expect(screen.getByLabelText("API 地址")).toHaveValue("https://api.openai.com/v1");
    expect(screen.getByLabelText("模型")).toHaveValue("dall-e-3");
  });
});
```

- [ ] **Step 3: 运行测试**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 4: 提交**

```bash
git add src/features/image-provider/
git commit -m "feat: 新增图片 provider 配置弹窗"
```

---

### Task 5: 集成到 App 和 AppShell

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/layout/AppShell.tsx`

- [ ] **Step 1: 修改 AppShell — 新增图片设置入口按钮**

在导航栏的设置按钮下方新增一个图片按钮，新增 `onOpenImageProvider` 回调：

```tsx
import { Image } from "lucide-react";

type AppShellProps = {
  // ... existing props ...
  onOpenImageProvider: () => void;
};

// 在 nav 中的设置按钮下方添加：
<Button
  size="icon"
  variant="ghost"
  onClick={onOpenImageProvider}
  title="图片生成"
  aria-label="图片生成"
  className="h-9 w-9 lg:h-10 lg:w-10"
>
  <Image className="h-4 w-4 lg:h-5 lg:w-5" />
</Button>
```

- [ ] **Step 2: 修改 App.tsx — 集成 ImageProviderDialog**

```tsx
import { ImageProviderDialog } from "@/features/image-provider/ImageProviderDialog";

// 新增 state
const [imageProviderOpen, setImageProviderOpen] = useState(false);

// AppShell 传入 onOpenImageProvider
<AppShell
  // ... existing props ...
  onOpenImageProvider={() => setImageProviderOpen(true)}
>

// 在其他 Dialog 下方新增
{imageProviderOpen ? (
  <ImageProviderDialog
    open={imageProviderOpen}
    onOpenChange={setImageProviderOpen}
  />
) : null}
```

- [ ] **Step 3: 验证构建和测试**

Run: `npm run build && npm test`
Expected: 全部通过

- [ ] **Step 4: 提交**

```bash
git add src/App.tsx src/components/layout/AppShell.tsx
git commit -m "feat: 集成图片 provider 配置弹窗到 App"
```

---

### Task 6: 聊天气泡增加图片按钮和图片渲染

**Files:**
- Modify: `src/features/chat/ChatView.tsx`

- [ ] **Step 1: 在 MessageBubble 中增加图片按钮和图片消息渲染**

修改 `MessageBubbleProps` 增加 `onGenerateImage` 回调：

```typescript
type MessageBubbleProps = {
  message: ChatMessage;
  text: string;
  loading?: boolean;
  extraChoices?: string[];
  onChoice?: (choice: string) => void;
  onDelete?: () => void;
  onGenerateImage?: () => void;
  generatingImage?: boolean;
};
```

在 `MessageBubble` 函数中：

1. 在工具栏中新增图片按钮（复制按钮之前）：

```tsx
{onGenerateImage && (
  <button
    type="button"
    onClick={onGenerateImage}
    disabled={generatingImage}
    className="flex h-6 w-6 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground shadow-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
  >
    {generatingImage ? (
      <Loader2 className="h-3 w-3 animate-spin" />
    ) : (
      <Image className="h-3 w-3" />
    )}
  </button>
)}
```

2. 在气泡最外层增加 image 消息渲染分支：

```tsx
const isUser = message.role === "user";
const isImage = message.role === "image";

// 如果是 image 消息，渲染图片
if (isImage) {
  return (
    <div className="group flex justify-start">
      <div className="max-w-[82%]">
        {onDelete && (
          <div className="mb-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 justify-start">
            <button
              type="button"
              onClick={() => {
                const a = document.createElement("a");
                a.href = text;
                a.download = `image-${message.id}.png`;
                a.click();
              }}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
            >
              <Download className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground shadow-sm hover:bg-destructive hover:text-destructive-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        <img
          src={text}
          alt="生成的图片"
          className="max-w-full rounded-2xl shadow-sm"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 修改 import 添加新图标**

```typescript
import { Copy, Download, Heart, Image, Loader2, ScrollText, X } from "lucide-react";
```

- [ ] **Step 3: 修改 ChatView 渲染逻辑 — 传递 onGenerateImage 和处理图片生成**

在 `ChatView` 组件中：

1. 新增 state 管理正在生成图片的消息 ID：

```typescript
const [generatingImageId, setGeneratingImageId] = useState<string | null>(null);
```

2. 新增图片生成处理函数：

```typescript
async function handleGenerateImage(messageId: string, prompt: string) {
  const provider = useAppState.getState().imageProvider;
  if (!provider || !provider.apiKey) {
    toast.error("请先在设置中配置图片生成");
    return;
  }

  setGeneratingImageId(messageId);
  try {
    const dataUrl = await generateImage({
      apiKey: provider.apiKey,
      baseUrl: provider.baseUrl,
      model: provider.model,
      prompt,
    });
    await addMessage(chat.id, { role: "image", content: dataUrl });
    onChanged?.();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "图片生成失败");
  } finally {
    setGeneratingImageId(null);
  }
}
```

3. 在渲染 MessageBubble 时传递 props：

```tsx
<MessageBubble
  // ... existing props ...
  onGenerateImage={
    !isStreaming && !isSending && message.role === "assistant"
      ? () => handleGenerateImage(message.id, parsed?.body ?? message.content)
      : undefined
  }
  generatingImage={generatingImageId === message.id}
/>
```

- [ ] **Step 4: 更新 buildMessages 中的 normalizeMessage**

当前 `normalizeMessage` 已经跳过 `role === "image"` 的消息，确认不需要额外修改。同时确认 `buildHistoryMessages` 中 image 消息不会影响消息构建。

- [ ] **Step 5: 验证构建和测试**

Run: `npm run build && npm test`
Expected: 全部通过

- [ ] **Step 6: 提交**

```bash
git add src/features/chat/ChatView.tsx
git commit -m "feat: 聊天气泡增加图片生成按钮和图片消息渲染"
```

---

### Task 7: 更新受影响的测试

**Files:**
- Modify: `src/features/settings/SettingsDialog.test.tsx` (如需要)

- [ ] **Step 1: 检查 SettingsDialog 测试中的断言**

SettingsDialog.test.tsx 中的断言 `expect(screen.queryByText(/生图|图片|头像|image|avatar/i)).not.toBeInTheDocument()` 应该仍然通过，因为我们没有在 SettingsDialog 中添加图片相关字段，而是新建了独立的 ImageProviderDialog。

- [ ] **Step 2: 运行全部测试确认**

Run: `npm test`
Expected: 全部通过

- [ ] **Step 3: 提交（如有修改）**

如有测试修改则提交，否则跳过。

---

### Task 8: 端到端验证

- [ ] **Step 1: 启动开发服务器**

Run: `npm run dev`

- [ ] **Step 2: 手动验证功能清单**

1. 导航栏出现"图片生成"按钮，点击打开配置弹窗
2. 填写 API Key、Base URL、Model 后保存
3. 进入聊天，AI 叙述气泡上出现图片按钮
4. 点击图片按钮，按钮变为 loading 态
5. 图片生成完成后以独立气泡展示
6. 图片气泡上方有下载和删除按钮
7. 删除图片气泡正常删除
8. 下载按钮能触发图片下载
9. 未配置图片 provider 时，图片按钮置灰
10. 图片消息不参与 AI 上下文构建

- [ ] **Step 3: 构建确认**

Run: `npm run build`
Expected: 成功

- [ ] **Step 4: 最终提交（如有微调）**
```
