<p align="center">
  <img src="./public/logo.png" alt="云雾聊天室" width="128" height="128" />
</p>

<h1 align="center">云雾聊天室</h1>

<p align="center">受 SillyTavern 启发的轻量 AI 角色扮演聊天应用</p>

项目是静态前端应用,AI 调用在浏览器端完成,配置、Provider、角色卡、世界书和聊天记录全部保存在浏览器本地。

## 主要能力

- 支持用户自行配置模型 Provider,覆盖 OpenAI、OpenAI Responses 两种类型
- 支持图片生成 Provider(OpenAI、OpenAI Responses)
- 支持角色卡管理:手动编辑、AI 生成、JSON / PNG(带 metadata)导入导出
- 支持世界书(角色卡内嵌条目)与多会话管理
- 支持剧情摘要、开场选项、XML 标签化回复解析与流式输出
- 支持浏览器本地数据存储(IndexedDB + localStorage)
- 内置可选的 API 代理模式,规避第三方中转站的 CORS 限制

## 与常见角色扮演 App 的区别

| 维度     | AI 角色扮演平台 | SillyTavern / Tavern 系 | 云雾聊天室 |
| -------- | --------------- | ----------------------- | ---------- |
| 免费使用 | ❌              | ✅                      | ✅         |
| 自定模型 | ❌              | ✅                      | ✅         |
| 简单上手 | ✅              | ❌                      | ✅         |
| 静态部署 | ❌              | ❌                      | ✅         |
| 本地数据 | ❌              | ✅                      | ✅         |

## 快速开始

```bash
npm install
npm run dev
```

打开 Vite 输出的本地地址,并在设置中配置可用的模型 Provider。

## 使用说明

1. **配置 Provider**:在「设置」中新建并激活一个聊天 Provider(类型、API Key、模型、API 地址、最大输出 Token)。
2. **创建角色**:在「角色」中新建角色卡,或通过 AI 生成、导入 JSON / PNG 角色卡。
3. **开始对话**:在「记录」中新建对话并选择角色,即可开始角色扮演。
4. **生成图片**:在「图片生成」中配置图片 Provider,对话中可对任意回复生成配图。

## 部署

```bash
npm run build
```

构建产物位于 `dist/`,可部署到静态站点托管服务。

### Vercel

直接导入仓库即可,项目自带 `vercel.json`(Vite 构建)和 Edge Function `api/proxy.ts`:

- 遇到个别 API 中转站不支持浏览器跨域(CORS)时,可在 Provider 设置中开启“通过服务器代理转发 API 请求”:LLM 请求经 `/api/proxy` 同源转发绕开限制;关闭时一律浏览器直连。
- 代理为无条件透传(任意方法、任意目标地址),请只在自己掌控的部署上开启。
- 域名若套 Cloudflare 橙云,免费版约 100 秒就会切断等待首字节的请求——需要长推理请将该子域设为灰云(DNS only)直连 Vercel。

纯静态部署(无 Serverless 能力)时应用仍完全可用,只是代理开关无效。

## 技术栈

React 19 · Vite · TypeScript · Tailwind CSS v4 · Radix UI · Zustand · IndexedDB · Vitest · Hono(代理)
