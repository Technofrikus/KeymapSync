# Project Structure - KeymapSync

## Directory Overview
- `gui-electron/`
    - Main application logic (Electron).
    - `main.js`: Main process; manages window, IPC, and calls `vitaly`.
    - `renderer.js`: UI logic; visualization, diffing, and user interaction.
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
- **Generator Logic**: `generate_vial_keymaps.js` (duplicated in root and `gui-electron/`?) - contains the logic for applying `alpha_layers.json` to `.vil` files.

## Hot Paths
- `gui-electron/renderer.js`: Most active UI changes happen here.
- `gui-electron/main.js`: Core IPC and process management.
- `generate_vial_keymaps.js`: Heart of the data transformation.

## Naming Conventions
- `.vil`: Vial Layout files (JSON format).
- `_edited.vil`: Standard suffix for processed layout files.
- `alphaMappings`: Key-value pairs in `alpha_layers.json`.

## Legacy / Inactive
- Root level `generate_vial_keymaps.js` vs `gui-electron/generate_vial_keymaps.js`: Keep track of which one is used for what. (Mainly Root for CLI, GUI for the app).
