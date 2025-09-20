# Repository Guidelines

## Project Structure & Module Organization
- Source: `src/extension.ts` — activation, status bar UI, commands (`yap.toggle`, `yap.start`, `yap.stop`), and webview provider.
- Webview assets: `media/asr-webview.js` (mic + Whisper worker) and `media/yap-mic.svg`.
- Build output: `out/` — compiled JavaScript and maps (do not edit by hand).
- Config: `package.json` (VS Code contributes/commands), `tsconfig.json`, `.vscode/` (debug config).

## Build, Test, and Development Commands
- `npm run compile` — TypeScript → `out/`.
- `npm run watch` — incremental rebuild during development.
- `npm run lint` — ESLint over `src/**/*.ts`.
- `npm test` — VS Code extension tests (none checked in yet).
- Dev loop: run `watch`, then in VS Code use Run and Debug → “Extension” (or `F5`) to launch an Extension Development Host.

## Coding Style & Naming Conventions
- TypeScript, 2‑space indent, semicolons, single quotes.
- Classes `PascalCase`; variables/functions `camelCase`; assets `kebab-case`.
- Commands and settings live under the `yap.*` namespace (e.g., `yap.alwaysPrompt`).
- Keep webview scripts CSP‑safe: use a `nonce` and limit domains in the CSP inside `getWebviewHtml`.

## Testing Guidelines
- No formal tests yet. If adding tests, place them under `src/test` (or `src/__tests__`), compile, then run `npm test` (expects a runner at `out/test/runTest.js`).
- Prioritize command behavior (`yap.toggle`, `start/stop`) and message flow with the webview (`partial`, `final`, `error`).

## Commit & Pull Request Guidelines
- Use Conventional Commits as seen in history: `feat(panel): …`, `fix(keybinding): …`, `chore: …`.
- PRs should:
  - Describe the change and link issues.
  - Include screenshots/GIFs for UI updates (status bar, panel view).
  - Confirm `npm run lint` and `npm run compile` pass.
- Do not commit `out/` or `node_modules/` changes.

## Security & Configuration Tips
- Microphone access requires the recorder webview; if disabled, re‑enable `yap.showPopupWhileRecording`.
- Requires WebGPU; model files load via CDN inside the webview worker. Avoid adding Node‑side network calls.
- Adjust the webview CSP only when necessary; prefer local assets under `media/`.

## Agent‑Specific Instructions
- When adding features, update `package.json` contributes (commands, views) and mirror user‑facing changes in `README.md`.
- Keep changes minimal and focused; prefer editing `src/extension.ts` and webview code in `media/` over broad refactors.

