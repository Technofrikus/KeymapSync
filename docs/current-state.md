# Current State - KeymapSync

## Key Features
- **Online Sync**: Direct writing to Vial keyboards.
- **Offline Sync**: Batch processing of `.vil` files.
- **Visual KLE**: UI rendering of keyboard layouts.
- **Advanced Overrides**: Support for Tap-Dance, Combos, and Key-Overrides.

## Recently Changed / Hot Modules
- `gui-electron/renderer.js`: Recent UI additions (tabs, visualization).
- `gui-electron/generate_vial_keymaps.js`: Shared translation tables (de, fr, es, en), transformation logic, and `.vil` UID-safe persistence.
- `gui-electron/device-transport.js`: Vitaly device protocol, including discovery, snapshots, applying state, locking, and layout lookup.

## Large TODOs / Future Work
- [ ] Improved translation for more languages.
- [ ] Better validation for Tap-Dance/Combo loops.
- [ ] Multi-platform build automation refinement.

## Known Issues
- Vitaly can exit 0 for some failures; `device-transport.js` treats known fatal stderr output as an error.
- Large `uid` precision loss remains a risk if code bypasses the shared UID-safe load/save helpers.

## Areas of High Caution
- **UID Matching**: If `uid` in `.vil` is changed, the keyboard firmware may reject the load.
- **HID Communication**: Do not interrupt `vitaly` while it's "loading" state.
