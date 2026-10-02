# Project Structure - KeymapSync

## Directory Overview
- `app/` — Shared app (browser code, built with Vite). Runs unchanged in every shell.
    - `index.html`, `styles.css`: UI markup and styles.
    - `src/main.js`: Composition root and view navigation.
    - `src/platform/`: Platform interface (`index.js`) and one adapter per shell (`electron.js`; web and Tauri follow).
    - `src/ui/`: `editor-workflow.js`, `online-workflow.js`, `config-session.js`, `keymap-presentation.js`.
    - `src/core/`: Pure logic with no DOM, file or device access:
        - `keymap-transform.js`: Keymap State transformation (Alpha Mappings, overrides, translation tables).
        - `config-validation.js`, `alpha-layers.schema.json`: Configuration validation.
        - `keymap-state.js`: UID-safe `.vil` parse/serialize.
        - `vial-definition.js`: Transport-independent Vial definition protocol.
        - `keycode-mapping.js`, `kle-parser.js`, `kle-layout.js`, `kle-rect-union.js`.
    - `test/`: Node test files (`npm test` at the repo root).
- `shells/electron/` — Electron desktop shell.
    - `main.js`: Main process; window lifecycle and IPC.
    - `preload.cjs`: Exposes the platform interface on `window.api`.
    - `device-transport.js`: Vitaly-backed device discovery, snapshot, apply, lock, layout.
    - `hid-definition.js`: node-hid transport for `core/vial-definition.js`.
    - `file-authority.js`: Main-process capability registry for user-selected files.
    - `scripts/sync-shared.cjs`: Copies needed `app/src/core` modules into `core/` and builds the app into `renderer/` (both generated, git-ignored).
    - `scripts/prep-dist.cjs`, `scripts/fetch-vitaly.cjs`: Packaging preparation.
    - `bin/`: OS-specific `vitaly` binaries (git-ignored).
- `alpha_layers.json` — Default rule configuration.
- `scripts/` — vitaly build helpers.
- `docs/` — Reference documentation.
- `Reference only/` — Local, unversioned reference sources (e.g. vitaly).

## Hot Paths
- `app/src/ui/*-workflow.js`: UI changes are localized by workflow.
- `app/src/core/keymap-transform.js`: Heart of the data transformation.
- `app/src/platform/index.js`: The contract every shell implements.
- `shells/electron/main.js`, `device-transport.js`: Electron IPC and vitaly protocol.

## Naming Conventions
- `.vil`: Vial Layout files (JSON format).
- `alphaMappings`: Key-value pairs in `alpha_layers.json`.
