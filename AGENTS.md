# AGENTS.md

## Commands

- `npm install` uses the committed `package-lock.json`; keep npm as the package manager unless the lockfile changes.
- `npm run dev` starts the Vite app; use it for browser verification of UI flows.
- `npm start` has been removed; production is deployed to Vercel as a static build.
- `npm run build` is the production static build into `dist/`.
- `npm run lint` runs type-aware `oxlint --type-aware --type-check src` and is the repo's typecheck gate.
- `npm run format` only checks formatting with `oxfmt --check src`.
- `npm run test` runs Vitest once; focused runs are `npx vitest run src/path/to/file.test.tsx` or `npx vitest run -t "test name"`.

## App Shape

- This is a browser-only React app backed by localStorage/IndexedDB; do not move provider secrets out of browser-owned settings. All AI requests go directly from the browser; there is no server-side code.
- `src/main.tsx` mounts `App` and Sonner; `src/App.tsx` owns top-level dialog/screen state, selected chat/character, mobile sheet state, and theme toggling.
- Business UI is under `src/components/biz/`; low-level Radix/Tailwind wrappers are under `src/components/ui/`.
- Use the `@/` alias for `src` imports. Do not add barrel/re-export files; import from the defining module.

## State And Persistence

- `src/store/appState.ts` derives global settings and active providers from `src/services/settings.ts`; call `useAppState.getState().reload()` after local settings changes that must refresh UI state. (`init` and `reload` are currently identical; keep them in sync if one changes.)
- Settings and provider config are localStorage-backed in `src/services/settings.ts` under `yunwu.settings.v1`.
- Structured data is IndexedDB-backed in `src/services/db.ts`. Stores are `characters`, `chats`, and `messages`, with a `chatId` index on `messages`. A `lorebooks` store is created but is currently unused dead code — lorebook entries are stored inline on `CharacterCard.entries`, not in the `lorebooks` store.
- Character/chat CRUD normalization lives in `src/services/characters.ts` and `src/services/chats.ts`; avoid bypassing those services from UI code.

## AI And Prompt Flow

- `src/services/ai.ts` owns direct browser calls for OpenAI (chat completions) and OpenAI Responses, plus image generation endpoints. `src/services/aiGeneration.ts` builds on it for AI character-card generation.
- Prompt history shaping and response XML parsing helpers live in `src/lib/messages.ts`; lorebook helpers live in `src/lib/lorebooks.ts`; import/export helpers live in `src/lib/export.ts`.
- World book entries are injected wholesale: `enabledEntries` in `src/lib/lorebooks.ts` returns the content of every enabled entry, and `buildMessages` in `src/lib/messages.ts` appends them all as system messages. Entry `keys` are stored and normalized but are **not** used for runtime keyword matching — there is no selective/triggered injection.
- Provider API keys are user-entered browser data; never commit sample real keys or assume server-side secret storage.
- When changing `AppSettings`, update `normalizeSettings` in `src/services/settings.ts` and every exact `toEqual` settings assertion in tests.

## Tests And UI Checks

- Tests live beside source files as `*.test.ts` / `*.test.tsx` under `src/`.
- Vitest uses jsdom, globals, `src/test/setup.ts`, and `fake-indexeddb/auto`; IndexedDB-dependent tests should rely on that setup instead of browser-only globals.
- For UI behavior changes, run the relevant focused Vitest test and verify the flow in a browser via `npm run dev` when feasible.

## Styling

- Tailwind CSS v4 is wired through `@tailwindcss/postcss`; theme tokens and the `.light` override live in `src/styles.css`.
- Preserve the existing Radix primitives plus Tailwind utility style; add reusable UI wrappers in `src/components/ui/` only when multiple business components need them.
