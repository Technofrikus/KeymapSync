# Agent Bootstrap - KeymapSync

## Tech Stack
- **Electron** (Node.js + DOM JS)
- **Rust** (`vitaly` CLI tool)
- **QMK/Vial** (Keyboard firmware protocols)

## Architecture
- **Offline**: The root `generate_vial_keymaps.js` CLI adapter invokes the shared transformation module at `gui-electron/generate_vial_keymaps.js`.
- **Online**: `main.js` exposes IPC handlers, while `device-transport.js` owns the Vitaly command protocol.

## Critical Rules (Do/Don't)
- **DO NOT** use `JSON.parse` on `.vil` files directly if they contain a `uid`. Use `loadJsonWithUid` in `generate_vial_keymaps.js`.
- **DO** verify keycodes using `keycode-mapping.js`.
- **DO** use `createDeviceTransport` in `device-transport.js` for Vitaly operations; `main.js` supplies the process and path dependencies.

## Quick Start Nav
- `gui-electron/main.js`: Electron lifecycle and IPC composition.
- `gui-electron/renderer.js`: Renderer composition and navigation.
- `gui-electron/editor-workflow.js`, `offline-workflow.js`, `online-workflow.js`: Workflow-owned UI state and orchestration.
- `gui-electron/config-validation.js`: Shared configuration validation.
- `gui-electron/file-authority.js`: Main-process filesystem grants; renderer code must never pass raw paths.
- `gui-electron/generate_vial_keymaps.js`: Shared Keymap State transformation and `.vil` persistence.
- `gui-electron/device-transport.js`: Vitaly-backed device operations.
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
- **Add Translation**: Check `translationTables` in `gui-electron/generate_vial_keymaps.js`.

## Verification

From `gui-electron/`, run `npm test`. It executes the transformation, device transport, and keyboard-presentation regression scripts.
