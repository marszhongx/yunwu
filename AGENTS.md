# AGENTS.md

## Commands

- `npm install` uses the committed `package-lock.json`; keep npm as the package manager unless the lockfile changes.
- `npm run dev` starts the Vite app; use it for browser verification of UI flows.
- `npm run build` is the production static build into `dist/`.
- `npm run lint` runs type-aware `oxlint --type-aware --type-check src` and is the repo's typecheck gate.
- `npm run format` only checks formatting with `oxfmt --check src`.
- `npm run test` runs Vitest once; focused runs are `npx vitest run src/path/to/file.test.tsx` or `npx vitest run -t "test name"`.

## App Shape

- This is a static browser-only React app; do not add a backend requirement or move provider secrets out of browser-owned settings. The only server-side piece is the optional pass-through proxy (`api/proxy.ts`), which stores nothing and receives credentials per request from the browser.
- `src/main.tsx` mounts `App` and Sonner; `src/App.tsx` owns top-level dialog/screen state, selected chat/character, mobile sheet state, and theme toggling.
- Business UI is under `src/components/biz/`; low-level Radix/Tailwind wrappers are under `src/components/ui/`.
- Use the `@/` alias for `src` imports. Do not add barrel/re-export files; import from the defining module.

## State And Persistence

- `src/store/appState.ts` derives global settings and active providers from `src/services/settings.ts`; call `useAppState.getState().reload()` after local settings changes that must refresh UI state.
- Settings and provider config are localStorage-backed in `src/services/settings.ts` under `yunwu.settings.v1`.
- Structured data is IndexedDB-backed in `src/services/db.ts`; stores are `characters`, `lorebooks`, `chats`, and `messages`, with a `chatId` index on `messages`.
- Character/chat CRUD normalization lives in `src/services/characters.ts` and `src/services/chats.ts`; avoid bypassing those services from UI code.

## AI And Prompt Flow

- `src/services/ai.ts` owns direct browser calls for Gemini, Claude, OpenAI-compatible chat completions/responses, and image generation endpoints.
- Prompt history shaping and response XML parsing helpers live in `src/lib/messages.ts`; lorebook matching lives in `src/lib/lorebooks.ts`; import/export helpers live in `src/lib/export.ts`.
- Provider API keys are user-entered browser data; never commit sample real keys or assume server-side secret storage.
- `api/proxy.ts` is a self-contained Vercel Edge Function (Hono + `hono/proxy` + `hono/vercel` `handle`) that forwards browser requests to LLM APIs to avoid CORS blocks; the client wrapper is `src/services/proxy.ts` (`fetchWithOptionalProxy` only proxies when the user's `useProxy` setting is on — no automatic fallback; target URL carried in the `x-proxy-target` header). Forwarding is unconditional — any method, any target, all request headers pass through as-is (only hop-by-hop headers are handled per RFC 9110 by `hono/proxy`); no validation or allowlist exists by design. There is no dev equivalent: under `npm run dev` `/api/proxy` 404s — keep the `useProxy` setting off and use direct browser connections in dev; verify proxy flows against a Vercel (preview) deployment.
- When changing `AppSettings`, update `normalizeSettings` in `src/services/settings.ts` and every exact `toEqual` settings assertion in tests.

## Tests And UI Checks

- Tests live beside source files as `*.test.ts` / `*.test.tsx` under `src/` and `api/`.
- Vitest uses jsdom, globals, `src/test/setup.ts`, and `fake-indexeddb/auto`; IndexedDB-dependent tests should rely on that setup instead of browser-only globals.
- For UI behavior changes, run the relevant focused Vitest test and verify the flow in a browser via `npm run dev` when feasible.

## Styling

- Tailwind CSS v4 is wired through `@tailwindcss/postcss`; theme tokens and the `.light` override live in `src/styles.css`.
- Preserve the existing Radix primitives plus Tailwind utility style; add reusable UI wrappers in `src/components/ui/` only when multiple business components need them.
