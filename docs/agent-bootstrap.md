# Agent Bootstrap - KeymapSync

## Tech Stack
- **Shared app**: plain JavaScript ES modules + DOM, bundled by **Vite** (`app/`).
- **Electron** desktop shell (`shells/electron/`), using the **Rust** `vitaly` CLI for keyboard I/O.
- **QMK/Vial** keyboard firmware protocols.

## Architecture
- The shared app talks only to the platform interface (`app/src/platform/index.js`). Each shell implements it.
- **Transformation**: `app/src/core/keymap-transform.js` is a pure Keymap State transform (no I/O), run in the app.
- **Electron**: `shells/electron/main.js` exposes IPC handlers; `device-transport.js` owns the vitaly command protocol.

## Critical Rules (Do/Don't)
- **DO NOT** use `JSON.parse` on `.vil` text if it contains a `uid`. Use `parseKeymapState` / `serializeKeymapState` in `app/src/core/keymap-state.js`.
- **DO NOT** import Node or Electron APIs from `app/`. Platform access goes through the platform interface.
- **DO** edit shared core modules in `app/src/core/` only; `shells/electron/core/` is a generated copy.
- **DO** verify keycodes using `keycode-mapping.js`.

## Quick Start Nav
- `app/src/main.js`: App composition and navigation.
- `app/src/ui/editor-workflow.js`, `online-workflow.js`: Workflow-owned UI state and orchestration.
- `app/src/core/config-validation.js`: Shared configuration validation.
- `app/src/core/keymap-transform.js`: Keymap State transformation.
- `shells/electron/main.js`: Electron lifecycle and IPC composition.
- `shells/electron/file-authority.js`: Main-process file grants; renderer code never passes raw paths.
- `shells/electron/device-transport.js`: Vitaly-backed device operations.

## Relevant Documents
- `docs/architecture.md`, `docs/project-structure.md`, `docs/platform-plan.md`.

## Frequent Pitfalls
- **Vitaly not found**: In dev, check `shells/electron/bin/`. In production, check `process.resourcesPath`.
- **Stale renderer**: `npm start` in `shells/electron` rebuilds the app; when running Electron directly, run `node scripts/sync-shared.cjs --renderer` first.

## Verification
- Repo root: `npm install && npm test` (shared app tests).
- `shells/electron`: `npm install && npm test` (shell tests).
