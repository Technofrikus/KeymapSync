# Architecture - KeymapSync

## High-Level System Overview
KeymapSync is a configuration management tool for Vial-compatible keyboards. It enables users to maintain unified character-to-symbol/number mappings across multiple keyboards.

## Main Modules
- **GUI (Electron)**: Main process (`main.js`) manages lifecycle and IPC; Renderer process (`renderer.js`) handles UI orchestration. `keymap-presentation.js` prepares KLE geometry and renders keyboard previews.
- **Keymap State transformation module (`gui-electron/generate_vial_keymaps.js`)**: Shared logic for parsing `.vil` files, applying Alpha Mappings, preserving UIDs, and writing `_edited.vil` output. The root `generate_vial_keymaps.js` is its CLI adapter.
- **Keyboard Interface (`vitaly`)**: Rust-based CLI tool (bundled binary) for direct keyboard communication (HID).
- **Vial Integration (`vial-fetch-definition.js`)**: Fetches JSON definitions for specific keyboards from online/local sources.

## Data Flow
1. **Input**: `.vil` files (offline) or connected keyboards via `vitaly` (online).
2. **Processing**: `renderer.js` UI -> IPC -> shared `gui-electron/generate_vial_keymaps.js` -> modified Keymap State. Online device I/O passes through `device-transport.js`.
3. **Output**: `_edited.vil` files or `vitaly load` to keyboard firmware.

## Rendering/Runtime Model
- **Renderer**: Standard web tech (HTML/CSS/JS). Uses CSS Grids and SVG for keyboard visualization.
- **Runtime**: Electron/Node.js for file/process management; child processes for `vitaly` calls.

## API Structure (IPC)
- `device:*`: Device discovery, state snapshots, state application, locking, and layout info. The IPC handlers delegate all Vitaly-specific protocol details to `device-transport.js`.
- `alpha:*`: Loading/saving `alpha_layers.json`.
- `generator:*`: Running the mapping logic.
- `vial:*`: Fetching keyboard definitions.

## State Management
- **Frontend**: `configObj` (current mapping config) and `currentDeviceState`/`targetDeviceState` for keyboards. `renderer.js` is currently the main UI workflow hotspot.
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
