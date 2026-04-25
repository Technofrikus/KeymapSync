# Agent Bootstrap - KeymapSync

## Tech Stack
- **Electron** (Node.js + DOM JS)
- **Rust** (`vitaly` CLI tool)
- **QMK/Vial** (Keyboard firmware protocols)

## Architecture
- **Offline**: CLI/Batch mode (`generate_vial_keymaps.js`).
- **Online**: HID interaction via `vitaly` IPC calls from `main.js`.

## Critical Rules (Do/Don't)
- **DO NOT** use `JSON.parse` on `.vil` files directly if they contain a `uid`. Use `loadJsonWithUid` in `generate_vial_keymaps.js`.
- **DO** verify keycodes using `keycode-mapping.js`.
- **DO** run `vitaly` through `runVitaly` in `main.js` to ensure proper binary path resolution.

## Quick Start Nav
- `gui-electron/main.js`: Start here for IPC/App logic.
- `gui-electron/renderer.js`: UI/Visual logic.
- `generate_vial_keymaps.js`: Mapping transformation logic.
- `alpha_layers.json`: Data schema for character mappings.

## Relevant Documents
- See `docs/architecture.md` for deep dive.
- See `docs/project-structure.md` for file locations.

## Frequent Pitfalls
- **Vitaly not found**: In Dev, check `gui-electron/bin/`. In Prod, check `process.resourcesPath`.
- **Large Integers**: JSON stringification of `uid` (64-bit int) will fail in JS. Handled via regex-based string injection.

## If you want to change X, check Y first:
- **Change Mappings**: Check `alpha_layers.json` schema.
- **Add Keycode**: Check `keycode-mapping.js`.
- **Add Translation**: Check `translationTables` in `generate_vial_keymaps.js`.
