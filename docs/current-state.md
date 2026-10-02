# Current State - KeymapSync

## Key Features
- **Online Sync**: Direct writing to Vial keyboards.
- **Visual KLE**: UI rendering of keyboard layouts.
- **Advanced Overrides**: Support for Tap-Dance, Combos, and Key-Overrides.

## Recently Changed / Hot Modules
- Web shell (Phase 2): WebHID transport, JS Vial protocol (`app/src/core/vial-protocol.js`), web platform adapter, simulated keyboard for tests.
- Repository split into the shared app (`app/`) and the Electron shell (`shells/electron/`); see `docs/platform-plan.md` (Phase 1).
- `app/src/platform/index.js`: Platform interface implemented by each shell.
- `app/src/core/keymap-transform.js`: Translation tables (de, fr, es, en) and pure transformation logic, now run in the app.
- `app/src/core/vial-definition.js`: Transport-independent Vial definition protocol (ready for WebHID).
- `shells/electron/device-transport.js`: Vitaly device protocol, including discovery, snapshots, applying state, locking, and layout lookup.

## Large TODOs / Future Work
- [ ] Improved translation for more languages.
- [ ] Better validation for Tap-Dance/Combo loops.
- [x] Web shell with WebHID (`docs/platform-plan.md`, Phase 2) — verify on real keyboards (`docs/manual-web-smoke-test.md`).
- [ ] Tauri desktop shell replacing Electron (Phase 3).

## Known Issues
- Web shell: macros and QMK settings are read but not written; LZMA-compressed definitions (very old Vial) and VIA-only keyboards are not supported.
- Vitaly can exit 0 for some failures; `device-transport.js` treats known fatal stderr output as an error.
- Large `uid` precision loss remains a risk if code bypasses the shared UID-safe load/save helpers.

## Areas of High Caution
- **UID Matching**: If `uid` in `.vil` is changed, the keyboard firmware may reject the load.
- **HID Communication**: Do not interrupt `vitaly` while it's "loading" state.
- **Manual release verification**: Run `docs/manual-electron-smoke-test.md` with a physical keyboard after IPC, backup, apply, or close/save changes.
