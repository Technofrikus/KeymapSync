# Current State - KeymapSync

## Key Features
- **Online Sync**: Direct writing to Vial keyboards.
- **Offline Sync**: Batch processing of `.vil` files.
- **Visual KLE**: UI rendering of keyboard layouts.
- **Advanced Overrides**: Support for Tap-Dance, Combos, and Key-Overrides.

## Recently Changed / Hot Modules
- `gui-electron/renderer.js`: Recent UI additions (tabs, visualization).
- `generate_vial_keymaps.js`: Translation tables (de, fr, es, en) and mapping logic.

## Large TODOs / Future Work
- [ ] Improved translation for more languages.
- [ ] Better validation for Tap-Dance/Combo loops.
- [ ] Multi-platform build automation refinement.

## Known Issues
- `vitaly` exit code 0 behavior on some errors. (Checked by regex in `main.js`).
- Large `uid` precision loss if using standard `JSON.parse` (partially mitigated).

## Areas of High Caution
- **UID Matching**: If `uid` in `.vil` is changed, the keyboard firmware may reject the load.
- **HID Communication**: Do not interrupt `vitaly` while it's "loading" state.
