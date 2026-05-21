# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project overview

云雾聊天室是一个 AI 开放世界角色扮演聊天应用。用户通过角色卡扮演主角，与作为旁白 / GM 的 AI 在同一个世界中互动。项目是 React + Vite + TypeScript 静态前端应用。

- 聊天：支持 Gemini、Claude、OpenAI 兼容提供商
- 图片生成：支持 OpenAI 兼容端点和 Hugging Face Inference API（`@huggingface/inference` SDK）

## Commands

```bash
npm run dev
npm run lint
npm run format
npm run test
npm run build
```

## Core architecture

- 单页应用入口位于 `index.html`，前端源码位于 `src/`
- 使用 React、Vite、TypeScript 和 Tailwind CSS
- 聊天 AI 调用在浏览器端直接接入各提供商
- 图片生成通过 `@huggingface/inference` SDK（Hugging Face）或直接调用 OpenAI 兼容 API
- 数据存储在浏览器本地（localStorage + IndexedDB），不引入数据库

## Key constraints

- 保持静态前端部署形态，不引入运行时 Node 服务
- 不引入数据库，数据全部浏览器本地
- UI 调整优先复用现有组件，避免无必要的自定义样式覆盖
- 不写向后兼容代码，不写迁移代码
