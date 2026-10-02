# Architecture - KeymapSync

## High-Level System Overview
KeymapSync is a configuration management tool for Vial-compatible keyboards. It enables users to maintain unified character-to-symbol/number mappings across multiple keyboards.

## Main Modules
- **Shared app (`app/`)**: Browser code bundled by Vite. `src/main.js` composes the editor and online workflow modules. `keymap-presentation.js` prepares KLE geometry and renders keyboard previews. All file and device access goes through the platform interface (`src/platform/index.js`).
- **Electron shell (`shells/electron/`)**: Main process (`main.js`) manages lifecycle and IPC; `preload.cjs` exposes the platform interface. Loads the built app from `renderer/`.
- **Configuration validation (`config-validation.js`)**: Enforces the shared `alpha-layers.schema.json` structure and semantic invariants for every configuration entry point.
- **File authority (`shells/electron/file-authority.js`)**: Keeps user-selected paths in the main process behind opaque, owner-scoped grants; renderer IPC never supplies filesystem paths.
- **Keymap State transformation (`app/src/core/keymap-transform.js`)**: Pure transformation: applies Alpha Mappings and structural overrides. Runs in the app, not in a shell. UID-safe `.vil` parsing/serialization lives in `app/src/core/keymap-state.js`.
- **Keyboard Interface (`vitaly`)**: Rust-based CLI tool (bundled binary) for direct keyboard communication (HID).
- **Vial definition protocol (`app/src/core/vial-definition.js`)**: Reads the compressed keyboard definition over raw HID through an injected transport (`shells/electron/hid-definition.js` uses node-hid).

## Data Flow
1. **Input**: connected keyboards via `vitaly`.
2. **Processing**: app UI -> `keymap-transform.js` (in the app) -> modified Keymap State. Device I/O goes platform interface -> IPC -> `device-transport.js`.
3. **Output**: `vitaly load` to keyboard firmware; optional `.vil` backup via save dialog.

## Rendering/Runtime Model
- **Renderer**: Standard web tech (HTML/CSS/JS). Uses CSS Grids and SVG for keyboard visualization.
- **Runtime**: Electron/Node.js for file/process management; child processes for `vitaly` calls. Web and Tauri shells are planned (`docs/platform-plan.md`).

## API Structure (IPC)
- `device:*`: Device discovery, state snapshots, state application, locking, and layout info. The IPC handlers delegate all Vitaly-specific protocol details to `device-transport.js`.
- `config:*`: User-mediated configuration grants, loading, and saving.
- `vial:saveBackup`: Save a Keymap State backup as `.vil`.
- `vial:*`: Fetching keyboard definitions.

## State Management
- **Frontend**: `config-session.js` owns the active mapping configuration and dirty state. Editor and online workflows own their local UI state.
- **Persistence**: `alpha_layers.json` (user config), `localStorage` (UI preferences like layout).

## Build/Deployment
- **Tooling**: Vite builds the shared app; `electron-builder` packages the Electron shell.
- **Critical Steps**: `scripts/prep-dist.cjs` copies shared core modules, builds the renderer, copies `alpha_layers.json`, and runs `fetch-vitaly.cjs` for the OS-specific binary.

## Important Decisions
- **Extra Resources**: `vitaly` is bundled as an external binary to handle complex HID communication not easily done in Node.
- **UID Handling**: Special regex parsing for `uid` in `.vil` files to preserve large integers that standard `JSON.parse` might corrupt.

## Dependencies
- `node-hid`: Keyboard communication.
- `lzma`, `xz-decompress`: Decompressing keyboard definitions.
- `vite`: Building the shared app.
- `electron-builder`: Packaging.

## Technical Debt
- **KLE Parsing**: Complex manual decoding of KLE JSON into grids.
