# Architecture - KeymapSync

## High-Level System Overview
KeymapSync is a configuration management tool for Vial-compatible keyboards. It enables users to maintain unified mappings from each alpha key to its symbols, numbers and other layers across multiple keyboards.

## Main Modules
- **Shared app (`app/`)**: Browser code bundled by Vite. `src/main.js` composes the editor and online workflow modules. `keymap-presentation.js` prepares KLE geometry and renders keyboard previews. All file and device access goes through the platform interface (`src/platform/index.js`).
- **Web shell (`app/src/platform/web.js`)**: Used whenever the Tauri bridge is absent. Keyboards via WebHID (`webhid-transport.js`) and the JS Vial protocol (`app/src/core/vial-protocol.js`); configuration in browser storage or a picked file; backups downloaded.
- **Tauri shell (`shells/tauri/`)**: Small Rust app. Commands for raw HID messages and native file dialogs; the adapter `app/src/platform/tauri.js` runs the same JS Vial protocol as the web shell and owns the close guard.
- **Configuration validation (`config-validation.js`)**: Enforces the shared `alpha-layers.schema.json` structure and semantic invariants for every configuration entry point.
- **File grants**: User-selected paths stay on the Rust side behind opaque grants; the app never supplies raw paths.
- **Keymap State transformation (`app/src/core/keymap-transform.js`)**: Pure transformation: applies Alpha Mappings and structural overrides. Runs in the app, not in a shell. UID-safe `.vil` parsing/serialization lives in `app/src/core/keymap-state.js`.
- **Vial definition protocol (`app/src/core/vial-definition.js`)**: Reads the compressed keyboard definition over raw HID through an injected transport (WebHID in the web shell, Rust HID in the desktop shell).
- **Vial keyboard protocol (`app/src/core/vial-protocol.js`)**: Transport-independent read (`snapshot`) and write (`apply`, differences only) of the Keymap State, plus unlock/lock. Output matches `vitaly save` (recorded fixtures); keycode names come from `vial-keycodes.js` (vitaly's tables, protocol 5 and 6).
- **Preview normalization (`app/src/core/keymap-normalize.js`)**: Rewrites a transformed state in the keyboard's keycode spelling and slot counts before diffing.

## Data Flow
1. **Input**: connected keyboards via the JS Vial protocol.
2. **Processing**: app UI -> `keymap-transform.js` (in the app) -> modified Keymap State. Device I/O goes through the platform interface.
3. **Output**: written to keyboard firmware; optional `.vil` backup via save dialog.

## Rendering/Runtime Model
- **Renderer**: Standard web tech (HTML/CSS/JS). Uses CSS Grids and SVG for keyboard visualization.
- **Runtime**: Web shell in Chrome/Edge (WebHID, HTTPS); desktop shell in Tauri.

## Platform interface
See the comment at the top of `app/src/platform/index.js`: device calls, config files, backups, unsaved-changes guard.

## State Management
- **Frontend**: `config-session.js` owns the active mapping configuration and dirty state. Editor and online workflows own their local UI state.
- **Persistence**: `alpha_layers.json` (user config), `localStorage` (UI preferences like layout).

## Build/Deployment
- **Tooling**: Vite builds the shared app; Tauri packages the desktop app.
- **Critical Steps**: `npm run build:web` / `npm run build:tauri` build the shared app; `.github/workflows/tauri-release.yml` builds installers.

## Important Decisions
- **One keyboard implementation**: the JS Vial protocol serves both web and desktop; vitaly is no longer used.
- **UID Handling**: Special regex parsing for `uid` in `.vil` files to preserve large integers that standard `JSON.parse` might corrupt.

## Dependencies
- `xz-decompress`: Decompressing keyboard definitions.
- `playwright-core` (dev): Browser end-to-end test of the web shell.
- `vite`: Building the shared app.
- `@tauri-apps/cli` (dev): Desktop build.

## Technical Debt
- **KLE Parsing**: Complex manual decoding of KLE JSON into grids.
