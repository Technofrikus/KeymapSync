# KeymapSync — Vial keymap synchronisation across different keyboards and layouts

Single-source your alpha symbols/numbers (and optional base/tap-dance) and apply them across all Vial-enabled boards without hand-editing layouts.

**Project name:** KeymapSync

## Layout & folders
- `original/` — put your source `.vil` files here (one per board).
- `output/` — generated `.vil` files land here; originals stay untouched.
- `alpha_layers.json` — the mapping/config file you edit.
- `generate_vial_keymaps.js` — generator (no dependencies, Node 18+).

## Config: `alpha_layers.json`
- `target.language` / `target.os`: e.g., `"de"`, `"fr"`, `"es"`, `"en"` and `"mac"`/`"win"`/`"linux"`.
- `layers`: indices for `alpha`, `number`, `symbol` (or `symbols`). Defaults: alpha=0, number=1, symbol=2.
- `alphaMappings`: QWERTY-order entries. Each entry:
  - `layer1`: symbol for number layer index (or `"NO"` to clear, `"TRNS"` to make transparent).
  - `layer2`: symbol for symbol layer index (same `NO`/`TRNS` rules).
  - `base`: optional replacement for the alpha key itself (e.g., tap-dance code).
  - `aliases`: other keycodes that should be recognized as this letter (e.g., tap-dance identifiers).
  - `_row2`, `_row3` are visual spacers; leave them alone.
- Overrides:
  - `comboOverrides`, `tapDanceOverrides`, `keyOverrideOverrides`: arrays that replace the corresponding sections in the .vil output (shape matches Vial JSON). Example shapes are included as `*Example` fields for reference.

### About symbols
- If you provide a single character (e.g., `?`), the generator translates it to a plain QMK keycode expression for the selected language/OS.
- If you provide an explicit QMK expression (e.g., `LSFT(KC_MINUS)`), it is used verbatim.
- Use `"NO"` (case-insensitive) to set `KC_NO`, or `"TRNS"`/`"TRANSPARENT"` for `KC_TRNS`.

## Running (CLI)
From repo root (Node 18+):
```bash
node generate_vial_keymaps.js
```
Check `output/` for the updated `.vil` files. Flash or import via Vial as needed.

## GUI (Electron)
Located in `gui-electron/` (keeps CLI and GUI separated).
```bash
cd gui-electron
npm install   # installs Electron locally
npm start     # launches KeymapSync GUI
```
GUI features: run generator, edit `alpha_layers.json`, view logs. Defaults point to the repo root (`original/`, `output/`, `alpha_layers.json`).

**Online sync (write to keyboard)** uses the `vitaly` CLI. In development, the GUI uses `Reference only/vitaly-main/target/release/vitaly` **only if** that file matches your OS (macOS/Windows ignore a Linux ELF left over from a Docker build). Otherwise it runs `vitaly` from your **PATH**. Rebuild natively **on the same OS** as Electron (needs **Rust 1.88+** for `edition = "2024"`):
```bash
./scripts/build-vitaly.sh
```
Docker-only build (writes a **Linux** binary — CI/Linux only; on Mac the GUI will skip it and use `PATH`):
```bash
./scripts/build-vitaly-docker.sh
```
Remove pulled `rust:*` Docker images when you no longer need them (Docker must be running):
```bash
./scripts/cleanup-docker-rust-images.sh
```
**Stock vitaly** often exits with code `0` even when it prints `Error:` on stderr. The KeymapSync GUI treats that as failure by scanning stderr, so you do **not** need a patched vitaly for reliable success/error feedback. Use any official or prebuilt `vitaly` on your `PATH` if you prefer not to compile the copy under `Reference only/`.

## Tips
- If a symbol isn’t translating as desired, enter the exact QMK keycode expression in `alpha_layers.json`; it will be used verbatim.
- `_row2`/`_row3` are just visual separators for editing convenience.
- **Tap dance in Vial JSON** must be `TD(0)`, `TD(1)`, … (slot index). In `alpha_layers.json` you can write `TD(H_GUIH)` if `tapDanceOverrides` has `"name": "H_GUIH"` — the generator rewrites it to the correct index before writing to the keyboard.

