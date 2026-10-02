# Architecture - KeymapSync

## High-Level System Overview
KeymapSync is a configuration management tool for Vial-compatible keyboards. It enables users to maintain unified character-to-symbol/number mappings across multiple keyboards.

## Main Modules
- **GUI (Electron)**: Main process (`main.js`) manages lifecycle and IPC. `renderer.js` composes separate editor and online workflow modules. `keymap-presentation.js` prepares KLE geometry and renders keyboard previews.
- **Configuration validation (`config-validation.js`)**: Enforces the shared `alpha-layers.schema.json` structure and semantic invariants for every configuration entry point.
- **File authority (`file-authority.js`)**: Keeps user-selected paths in the main process behind opaque, owner-scoped grants; renderer IPC never supplies filesystem paths.
- **Keymap State transformation module (`gui-electron/generate_vial_keymaps.js`)**: Pure Keymap State transformation: applies Alpha Mappings and structural overrides. No file system or device access. UID-safe `.vil` parsing/serialization lives in `device-transport.js`.
- **Keyboard Interface (`vitaly`)**: Rust-based CLI tool (bundled binary) for direct keyboard communication (HID).
- **Vial Integration (`vial-fetch-definition.js`)**: Fetches JSON definitions for specific keyboards from online/local sources.

## Data Flow
1. **Input**: connected keyboards via `vitaly`.
2. **Processing**: `renderer.js` UI -> IPC -> shared `gui-electron/generate_vial_keymaps.js` -> modified Keymap State. Online device I/O passes through `device-transport.js`.
3. **Output**: `vitaly load` to keyboard firmware; optional `.vil` backup via save dialog.

## Rendering/Runtime Model
- **Renderer**: Standard web tech (HTML/CSS/JS). Uses CSS Grids and SVG for keyboard visualization.
- **Runtime**: Electron/Node.js for file/process management; child processes for `vitaly` calls.

## API Structure (IPC)
- `device:*`: Device discovery, state snapshots, state application, locking, and layout info. The IPC handlers delegate all Vitaly-specific protocol details to `device-transport.js`.
- `config:*`: User-mediated configuration grants, loading, and saving.
- `vial:saveBackup`: Save a Keymap State backup as `.vil`.
- `generator:process`: Running the mapping logic on a Keymap State.
- `vial:*`: Fetching keyboard definitions.

## State Management
- **Frontend**: `config-session.js` owns the active mapping configuration and dirty state. Editor and online workflows own their local UI state.
- **Persistence**: `alpha_layers.json` (user config), `localStorage` (UI preferences like layout).

## Build/Deployment
- **Tooling**: `electron-builder` for packaging.
- **Critical Steps**: `predist` script copies `alpha_layers.json`; `fetch-vitaly.js` pulls OS-specific binaries.

## Important Decisions
- **Extra Resources**: `vitaly` is bundled as an external binary to handle complex HID communication not easily done in Node.
- **UID Handling**: Special regex parsing for `uid` in `.vil` files to preserve large integers that standard `JSON.parse` might corrupt.

## Dependencies
- `node-hid`: Keyboard communication.
- `lzma`: Decompressing keyboard definitions.
- `electron-builder`: Packaging.

## Technical Debt
- **KLE Parsing**: Complex manual decoding of KLE JSON into grids.
