# Conventions - KeymapSync

## Coding Standards
- **JavaScript**: CommonJS (`require`) in Node/Electron environment. Standard DOM manipulation in Renderer.
- **Naming**: camelCase for variables/functions; PascalCase for classes (rarely used).

## Architecture Patterns
- **IPC-first**: Complex logic (filesystem, child process) is moved to Main process via `ipcMain.handle`.
- **Data-Driven**: Keyboard behavior is defined by JSON (`alpha_layers.json`, `.vil`).

## Error Handling
- **Main Process**: Uses `try-catch` blocks; errors are often re-thrown or sent to Renderer via IPC.
- **Child Processes**: `vitaly` output (stderr) is checked for fatal keywords even if exit code is 0.

## State Management
- **Renderer**: Single object `configObj` holds the edited state.
- **Unsaved Changes**: Tracker `hasUnsavedChanges` in both processes; prompts on window close.

## Typing Strategy
- No TypeScript. Pure JS with JSDoc comments in some places for clarity.

## Logging
- Custom `appendLog` in `renderer.js` displays console-like output in a UI textarea.
- IPC `log:data` allows Main process to stream progress logs to the UI.

## Avoid / Anti-Patterns
- **Avoid standard `JSON.parse` on `.vil`**: Large `uid` numbers will lose precision. Use the regex-based `loadJsonWithUid` helper.
- **Don't hardcode vitaly path**: Use `resolveBundledVitalyPath` or `defaultPaths.vitaly`.

## Test Strategy
- Basic Jest testing in `generate_vial_keymaps.test.js` (if exists).
- Manual verification of layout diffs in the "Online Sync" preview.
