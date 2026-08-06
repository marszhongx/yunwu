<p align="center">
  <img src="./public/logo.png" alt="云雾聊天室" width="128" height="128" />
</p>

<h1 align="center">云雾聊天室</h1>

<p align="center">受 SillyTavern 启发的轻量 AI 角色扮演聊天应用</p>

项目是静态前端应用,AI 调用在浏览器端完成,配置、角色卡、世界书和聊天记录保存在浏览器本地。

## 主要能力

- 支持用户自行配置模型 Provider
- 内置可选的 API 代理模式,规避第三方中转站的 CORS 限制
- 支持角色卡、世界书和多会话管理
- 支持浏览器本地数据存储和 JSON 导入导出
- 支持静态前端部署

## 与常见角色扮演 App 的区别

| 维度 | AI 角色扮演平台 | SillyTavern / Tavern 系 | 云雾聊天室 |
| --- | --- | --- | --- |
| 免费使用 | ❌ | ✅ | ✅ |
| 自定模型 | ❌ | ✅ | ✅ |
| 简单上手 | ✅ | ❌ | ✅ |
| 静态部署 | ❌ | ❌ | ✅ |
| 本地数据 | ❌ | ✅ | ✅ |

## 快速开始

```bash
npm install
npm run dev
```

打开 Vite 输出的本地地址，并在设置中配置可用的模型 Provider。

## 部署

```bash
npm run build
```

构建产物位于 `dist/`,可部署到静态站点托管服务。

### Vercel(推荐)

直接导入仓库即可,项目自带 `vercel.json`(Vite 构建)和 Edge Function `api/proxy.ts`:

- 遇到个别 API 中转站不支持浏览器跨域(CORS)时,可在 Provider 设置中开启“通过服务器代理转发 API 请求”:LLM 请求经 `/api/proxy` 同源转发绕开限制;关闭时一律浏览器直连。
- 代理只做转发,不解析、不存储任何数据;API Key 仍只保存在用户自己的浏览器里。
- 可用环境变量 `PROXY_ALLOWED_HOSTS` 配置目标域名白名单(逗号分隔,`*` 表示不限制),默认为 `api.openai.com`、`generativelanguage.googleapis.com`、`api.anthropic.com`。

纯静态部署(无 Serverless 能力)时应用仍完全可用,只是代理开关无效。
