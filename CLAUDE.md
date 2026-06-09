# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Yunwu is a static, browser-only AI roleplay chat app inspired by SillyTavern. AI requests are made directly from the browser, while settings, provider config, character cards, lorebooks, chats, and messages are stored locally in the browser.

## Commands

- `npm install` - install dependencies.
- `npm run dev` - start the Vite development server.
- `npm run build` - build the static app into `dist/`.
- `npm run preview` - preview the production build locally.
- `npm run lint` - run type-aware `oxlint` over `src`.
- `npm run format` - run `oxfmt --check src`.
- `npm run test` - run the Vitest suite once.
- `npx vitest run src/path/to/file.test.tsx` - run a single test file.
- `npx vitest run -t "test name"` - run tests matching a name pattern.

## Architecture

- The app uses Vite, React 19, TypeScript, Tailwind CSS v4, Radix UI primitives, Zustand, and Vitest with jsdom.
- `src/main.tsx` mounts `App` and the global Sonner toaster.
- `src/App.tsx` owns top-level screen state: selected chat/character, mobile sheet state, theme toggling, and opening the settings/character/chat dialogs.
- Business UI lives under `src/components/biz/`; low-level reusable UI wrappers live under `src/components/ui/`.
- Global derived app state is centralized in `src/store/appState.ts`. It loads settings and active providers through `src/services/settings.ts` and exposes a `reload()` action used after local persistence changes.
- Persistent structured data is handled by `src/services/db.ts`, an IndexedDB wrapper with stores for `characters`, `chats`, and `messages`. Settings and provider configuration are stored in localStorage via `src/services/settings.ts`.
- Domain services in `src/services/characters.ts` and `src/services/chats.ts` provide CRUD operations over IndexedDB and normalize records before returning them to UI code.
- `src/services/ai.ts` contains provider API calls for Gemini, OpenAI-compatible Chat Completions, OpenAI-compatible Responses, Claude, and image generation endpoints. `src/services/aiGeneration.ts` builds on it for character-card generation.
- Prompt/message preparation is in `src/lib/messages.ts`; lorebook key normalization and matching is in `src/lib/lorebooks.ts`; JSON import/export helpers are in `src/lib/export.ts`.
- Shared domain types are in `src/types/index.ts`, including provider settings, image provider settings, chat messages, lorebook entries, character cards, and chats.

## Testing notes

- Tests live beside source files as `*.test.ts` / `*.test.tsx` under `src/`.
- Vitest is configured in `vite.config.ts` with `jsdom`, globals, `src/test/setup.ts`, and `passWithNoTests: true`.
- UI tests use Testing Library and fake browser storage where needed; persistence tests cover IndexedDB behavior with fake-indexeddb.

## Development notes

- Use the `@/` alias for imports from `src`.
- Do not use re-exports or barrel files. Types, enums, constants, functions, and components must be imported directly from the module where they are defined.
- Keep the app static/browser-only; do not add a backend requirement for normal operation.
- This product has not been officially released yet; do not add backward-compatibility code for old internal formats unless explicitly requested.
- When changing UI behavior, run the dev server and verify the flow in a browser in addition to running relevant tests.
- Provider secrets are user-supplied browser settings; avoid moving them into committed config or server assumptions.
