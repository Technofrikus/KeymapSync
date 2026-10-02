# Conventions - KeymapSync

## Coding Standards
- **JavaScript**: ES modules everywhere. `app/` is browser-only code (no Node APIs).
- **Naming**: camelCase for variables/functions; PascalCase for classes (rarely used).

## Architecture Patterns
- **Platform interface**: The shared app reaches files and keyboards only through `app/src/platform/index.js`.
- **Opaque file grants**: The app passes grant ids, never raw filesystem paths. Dialog selection and path resolution stay in the shell.
- **Data-Driven**: Keyboard behavior is defined by JSON (`alpha_layers.json`, `.vil`).

## Error Handling
- Errors from shells and keyboards are caught in the workflows and shown in the UI and log.

## State Management
- **Renderer**: Single object `configObj` holds the edited state.
- **Unsaved Changes**: Tracker `hasUnsavedChanges`; the shell prompts on window close.

## Typing Strategy
- No TypeScript. Pure JS with JSDoc comments in some places for clarity.

## Logging
- `appendLog` in the app displays console-like output in the Settings & Logs drawer.

## Avoid / Anti-Patterns
- **Avoid standard `JSON.parse` on `.vil`**: Large `uid` numbers will lose precision. Use `parseKeymapState` / `serializeKeymapState` from `app/src/core/keymap-state.js`.

## Test Strategy
- Node/assert regression scripts cover validation, transformation, keyboard protocol, platform adapters, and keyboard presentation behavior. Run `npm test` at the repo root.
- Keyboard protocol code is tested against a simulated Vial keyboard and against recorded vitaly output; `npm run test:e2e` runs the web build in Chromium.
- Run `docs/manual-web-smoke-test.md` with a physical keyboard before releasing web shell changes.
- Run `docs/manual-desktop-smoke-test.md` with a physical keyboard before releases that change the desktop shell, backup, apply, or close/save behavior.
- Manually verify layout diffs in the "Online Sync" preview.
