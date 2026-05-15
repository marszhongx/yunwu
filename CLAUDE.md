# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project overview

云雾聊天室是一个 AI 开放世界角色扮演聊天应用。用户通过角色卡扮演主角，与作为旁白 / GM 的 AI 在同一个世界中互动。项目当前是 React + Vite + TypeScript 静态前端应用，支持 Gemini、Claude 和 OpenAI 兼容提供商。

## Commands

```bash
npm run dev
npm test
npm run test:unit
npm run test:api
npm run build
```

## Core architecture

- 单页应用入口位于 `index.html`，前端源码位于 `src/`
- 使用 React、Vite、TypeScript 和 Tailwind CSS
- AI 调用在浏览器端直接接入 Gemini、Claude 和 OpenAI 兼容模型
- 项目使用浏览器本地存储保存配置、角色卡、世界书和聊天记录

## Key constraints

- 保持静态前端部署形态，不引入运行时 Node 服务
- 数据存储在浏览器本地，不引入数据库
- UI 调整优先复用现有组件，避免无必要的自定义样式覆盖
- 管理弹窗的空状态应保留该弹窗的完整起始操作，不能因为列表为空隐藏侧栏而丢失导入等同级入口
- 更新文档时优先记录长期稳定的高层事实，不记录容易过时的实现细节