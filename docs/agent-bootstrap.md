# Agent Bootstrap - KeymapSync

## Tech Stack
- **Shared app**: plain JavaScript ES modules + DOM, bundled by **Vite** (`app/`).
- **Tauri** desktop shell (`shells/tauri/`): Rust HID pass-through and file dialogs; the JS Vial protocol runs on top.
- **Web** shell (`app/src/platform/web.js`): WebHID + the JS Vial protocol in `app/src/core/vial-protocol.js`.
- **QMK/Vial** keyboard firmware protocols.

## Architecture
- The shared app talks only to the platform interface (`app/src/platform/index.js`). Each shell implements it.
- **Transformation**: `app/src/core/keymap-transform.js` is a pure Keymap State transform (no I/O), run in the app.
- **Tauri**: `platform/tauri.js` calls Rust commands in `shells/tauri/src-tauri/src/` (`hid.rs`, `files.rs`).
- **Web**: `platform/index.js` loads `web.js` when `window.__TAURI__` is missing. Keymap State JSON must stay identical to `vitaly save` output (recorded fixtures).

## Critical Rules (Do/Don't)
- **DO NOT** use `JSON.parse` on `.vil` text if it contains a `uid`. Use `parseKeymapState` / `serializeKeymapState` in `app/src/core/keymap-state.js`.
- **DO NOT** import Node APIs from `app/`. Platform access goes through the platform interface.
- **DO** verify keycodes using `keycode-mapping.js`.
- **DO NOT** edit `app/src/core/vial-keycode-tables.js` by hand; regenerate it with `scripts/generate-vial-keycodes.mjs <vitaly checkout>`.
- **DO** test keyboard protocol changes against the simulated keyboard (`app/test/support/simulated-vial-keyboard.js`).

## Quick Start Nav
- `app/src/main.js`: App composition and navigation.
- `app/src/ui/editor-workflow.js`, `online-workflow.js`: Workflow-owned UI state and orchestration.
- `app/src/core/config-validation.js`: Shared configuration validation.
- `app/src/core/keymap-transform.js`: Keymap State transformation.
- `app/src/platform/`: One adapter per shell (`web.js`, `tauri.js`).
- `shells/tauri/src-tauri/src/`: Rust side of the desktop app.

## Relevant Documents
- `docs/architecture.md`, `docs/project-structure.md`, `docs/archive/platform-plan.md` (finished migration plan).

## Frequent Pitfalls
- **Desktop dev**: needs a Rust toolchain; use `npm run tauri dev`.

## Verification
- Repo root: `npm install && npm test` (shared app tests).
- Repo root: `npm run test:e2e` (web build in Chromium against the simulated keyboard).
