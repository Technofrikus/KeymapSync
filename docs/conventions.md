# Conventions - KeymapSync

## Coding Standards
- **JavaScript**: ES modules everywhere. `app/` is browser-only code (no Node APIs); Electron's preload and packaging scripts are `.cjs`.
- **Naming**: camelCase for variables/functions; PascalCase for classes (rarely used).

## Architecture Patterns
- **Platform interface**: The shared app reaches files and keyboards only through `app/src/platform/index.js`.
- **IPC-first (Electron)**: The main process composes filesystem and child-process capabilities behind `ipcMain.handle`; dedicated modules own transformation and Vitaly protocol details.
- **Opaque file grants**: Renderer code passes owner-scoped grant ids, never raw filesystem paths. Dialog selection and path resolution stay in the main process.
- **Data-Driven**: Keyboard behavior is defined by JSON (`alpha_layers.json`, `.vil`).

## Error Handling
- **Main Process**: Uses `try-catch` blocks; errors are re-thrown through IPC where appropriate.
- **Device transport**: `device-transport.js` checks Vitaly output for fatal stderr keywords even if the command exits 0.

## State Management
- **Renderer**: Single object `configObj` holds the edited state.
- **Unsaved Changes**: Tracker `hasUnsavedChanges` in both processes; prompts on window close.

## Typing Strategy
- No TypeScript. Pure JS with JSDoc comments in some places for clarity.

## Logging
- `appendLog` in the app displays console-like output in the Settings & Logs drawer.

## Avoid / Anti-Patterns
- **Avoid standard `JSON.parse` on `.vil`**: Large `uid` numbers will lose precision. Use `parseKeymapState` / `serializeKeymapState` from `app/src/core/keymap-state.js`.
- **Don't hardcode vitaly paths or command details**: use the device transport composed by `shells/electron/main.js`.

## Test Strategy
- Node/assert regression scripts cover validation, file authority, transformation, device transport, and keyboard presentation behavior. Run `npm test` at the repo root and in `shells/electron/`.
- Run `docs/manual-electron-smoke-test.md` with a physical keyboard before releases that change IPC, backup, apply, or close/save behavior.
- Manually verify layout diffs in the "Online Sync" preview.
