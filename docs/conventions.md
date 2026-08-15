# Conventions - KeymapSync

## Coding Standards
- **JavaScript**: CommonJS (`require`) in Node/Electron environment. Standard DOM manipulation in Renderer.
- **Naming**: camelCase for variables/functions; PascalCase for classes (rarely used).

## Architecture Patterns
- **IPC-first**: The main process composes filesystem and child-process capabilities behind `ipcMain.handle`; dedicated modules own transformation and Vitaly protocol details.
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
- Custom `appendLog` in `renderer.js` displays console-like output in a UI textarea.
- IPC `log:data` allows Main process to stream progress logs to the UI.

## Avoid / Anti-Patterns
- **Avoid standard `JSON.parse` on `.vil`**: Large `uid` numbers will lose precision. Use the regex-based `loadJsonWithUid` helper.
- **Don't hardcode vitaly paths or command details**: use the device transport composed by `main.js`.

## Test Strategy
- Node/assert regression scripts cover transformation, device transport, and basic keyboard presentation behavior. Run `cd gui-electron && npm test`.
- Manually verify layout diffs in the "Online Sync" preview.
