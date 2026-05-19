# 图片生成功能设计

## 概述

用户在聊天中主动触发图片生成：点击 AI 叙述气泡上的图片按钮，将当前场景描述作为 prompt 发送到图片生成 API，生成结果以独立气泡展示在下方。

## 数据模型

### ChatMessage 扩展

`role` 新增 `"image"` 值。image 消息的 `content` 存 base64 data URL。

```typescript
export type MessageRole = "user" | "assistant" | "image";
```

- `buildMessages()` 中的 `normalizeMessage` 已跳过非 user/assistant 消息，图片不会进入 AI 上下文
- 不需要改 DB schema

### 图片 Provider 配置

```typescript
export type ImageProviderSettings = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

// AppSettings 新增可选字段
imageProvider?: ImageProviderSettings;
```

文字 provider 与图片 provider 完全独立。

## API 集成

在 `src/services/ai.ts` 中新增 `generateImage()` 函数：

- 调用 OpenAI 兼容 Images API：`POST {baseUrl}/images/generations`
- 请求体：`{ model, prompt, size: "1024x1024", response_format: "b64_json" }`
- 返回 base64 字符串，拼接为 `data:image/png;base64,...`
- 超时 120 秒

## 设置 UI

新增 `ImageProviderDialog` 独立弹窗：

- 从设置页面或侧边栏打开
- 字段：Base URL（默认 `https://api.openai.com/v1`）、API Key、Model（默认 `dall-e-3`）
- 配置存入 `AppSettings.imageProvider`

## 聊天 UI

### 触发

AI 叙述气泡工具栏增加图片按钮（排在复制、删除之前）：

- 点击后将 `bodyText` 作为 prompt 调用图片 API
- 加载中按钮变 loading 态
- 生成完成自动插入 `role: "image"` 消息
- 未配置图片 provider 时按钮置灰，hover 提示"请先在设置中配置图片生成"

### 图片气泡

`MessageBubble` 新增 image 角色渲染：

- `<img src={dataUrl}>`，最大宽度 `max-w-[82%]`，圆角风格统一
- 工具栏：删除按钮 + 下载按钮（替代复制，点击创建 `<a download>` 下载）
- 不显示 summary/status/choices
