# Project Structure - KeymapSync

## Directory Overview
- `gui-electron/`
    - Main application logic (Electron).
    - `main.js`: Main process; manages window and IPC.
    - `device-transport.js`: Vitaly-backed device discovery, snapshot, apply, lock, and layout operations.
    - `renderer.js`: Small composition root and navigation.
    - `config-session.js`: Active configuration grant, state, dirty tracking, and save/reload transitions.
    - `editor-workflow.js`, `offline-workflow.js`, `online-workflow.js`: Renderer workflow modules.
    - `config-validation.js`, `alpha-layers.schema.json`: Shared configuration validation.
    - `file-authority.js`: Main-process capability registry for user-selected filesystem access.
    - `keymap-presentation.js`: Keyboard-preview layout preparation and rendering.
    - `preload.js`: IPC bridge between Main and Renderer.
    - `bin/`: Stores OS-specific `vitaly` binaries (development/distribution).
- `scripts/`
    - Build and utility scripts.
    - `build-vitaly.sh`: Compiles the Rust dependency.
- `docs/`
    - LLM-Agent reference documentation.
- `original/`
    - Input directory for offline `.vil` files.
- `output/`
    - Output directory for generated `.vil` files.
- `Reference only/`
    - Source code for the `vitaly` Rust tool (for reference, not built by Electron directly).

## Purpose of Main Components
- **Keyboard Layout Logic**: Found in `kle-parser.js`, `kle-layout.js`, `kle-rect-union.js`. Used for visual grid rendering.
- **Keycode Mappings**: `keycode-mapping.js` contains a massive map of QMK/Vial keycodes to names.
- **Generator Logic**: `gui-electron/generate_vial_keymaps.js` is the shared Keymap State transformation module. Root `generate_vial_keymaps.js` is the CLI adapter; both use `alpha_layers.json` from the project root.

## Hot Paths
- `gui-electron/editor-workflow.js`, `offline-workflow.js`, `online-workflow.js`: UI changes are localized by workflow.
- `gui-electron/main.js`: Electron lifecycle and IPC composition.
- `gui-electron/generate_vial_keymaps.js`: Heart of the shared data transformation.
- `gui-electron/device-transport.js`: Vitaly protocol and device I/O.

## Naming Conventions
- `.vil`: Vial Layout files (JSON format).
- `_edited.vil`: Standard suffix for processed layout files.
- `alphaMappings`: Key-value pairs in `alpha_layers.json`.

## Legacy / Inactive
- Root level `generate_vial_keymaps.js`: CLI adapter for the shared transformation module.
