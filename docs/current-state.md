# Current State - KeymapSync

## Key Features
- **Online Sync**: Direct writing to Vial keyboards (WebHID in the browser, Rust HID pass-through in the desktop app).
- **Visual KLE**: UI rendering of keyboard layouts.
- **Advanced Overrides**: Support for Tap-Dance, Combos, and Key-Overrides.

## Recently Changed / Hot Modules
- Electron and the vitaly scripts are removed; the desktop app is Tauri only (`shells/tauri/`).
- The platform migration plan is finished and archived: `docs/archive/platform-plan.md`.
- `app/src/core/vial-protocol.js`: the one keyboard implementation for web and desktop.

## Large TODOs / Future Work
- [ ] **UI redesign (next)**: collect what's not working per screen, define the main flow (connect keyboard -> review mappings -> preview changes -> write), then redesign in the shared app (`app/index.html`, `app/styles.css`, `app/src/ui/`). Both shells get it.
- [ ] Improved translation for more languages.
- [ ] Better validation for Tap-Dance/Combo loops.
- [ ] Run `docs/manual-web-smoke-test.md` on real keyboards, then enable GitHub Pages.

## Known Issues
- Macros and QMK settings are read but not written; LZMA-compressed definitions (very old Vial) and VIA-only keyboards are not supported.
- Large `uid` precision loss remains a risk if code bypasses the shared UID-safe load/save helpers.

## Areas of High Caution
- **UID Matching**: If `uid` in `.vil` is changed, the keyboard firmware may reject the load.
- **Manual release verification**: Run `docs/manual-desktop-smoke-test.md` with a physical keyboard after desktop shell, backup, apply, or close/save changes.
