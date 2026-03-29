# KeymapSync — Vial keymap synchronisation across different keyboards and layouts

Single-source your alpha symbols/numbers (and optional base/tap-dance) and apply them across all Vial-enabled boards without hand-editing layouts.

**Project name:** KeymapSync

## What you can do

- **Generate `.vil` files** from one `alpha_layers.json` for every board in `original/`.
- **Edit and run** the generator from the **Electron GUI** (logs, config editor, paths to repo root).
- **Program the keyboard directly** (no manual Vial import for that step): the GUI’s **Online sync** talks to your board over USB using the **[vitaly](https://github.com/bskaplou/vitaly)** CLI — list devices, read the live keymap, merge your KeymapSync preview, and **write** the result to the keyboard (with optional lock afterward).

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
npm install   # installs Electron locally — do not commit node_modules (see below)
npm start     # launches KeymapSync GUI
```
GUI features: run generator, edit `alpha_layers.json`, view logs. Defaults point to the repo root (`original/`, `output/`, `alpha_layers.json`).

### Online sync — direct programming with Vitaly

The **Online sync** view uses **vitaly** to speak the Vial protocol over HID: discover boards, **save** current JSON from the device, **apply** a merged layout/combos/tap-dance payload, optionally **lock** EEPROM, and fetch layout metadata for previews.

**How the app finds `vitaly` (development):**
1. `gui-electron/bin/vitaly` (or `vitaly.exe` on Windows) — e.g. after `npm run fetch-vitaly`.
2. `Reference only/vitaly-main/target/release/vitaly` **only if** the file’s format matches your OS (macOS/Windows will **not** use a Linux ELF left over from a Docker build — that caused `spawn` “Unknown system error -8”).
3. Otherwise the **`vitaly` on your `PATH`**.

**Fetch a release binary into `gui-electron/bin/`** (matches your current OS/arch where supported):
```bash
cd gui-electron
npm run fetch-vitaly
```
For Windows packaging, `npm run dist:win` runs fetch first. Adjust `VITALY_VERSION` in `gui-electron/scripts/fetch-vitaly.js` if you need another release.

**Build from source** (same machine/OS as you run Electron; needs **Rust 1.88+** for `edition = "2024"`):
```bash
./scripts/build-vitaly.sh
```
Docker-only build (produces a **Linux** binary — fine for Linux/CI; on Mac the GUI skips it and uses `PATH` or `gui-electron/bin/`):
```bash
./scripts/build-vitaly-docker.sh
```
Remove pulled `rust:*` Docker images when you no longer need them (Docker must be running):
```bash
./scripts/cleanup-docker-rust-images.sh
```

**Success vs failure:** stock **vitaly** often exits with code `0` even when it prints `Error:` on stderr. KeymapSync treats stderr patterns (`Error:`, “No matching devices…”) as failure so you get reliable feedback **without** patching vitaly.

**Multi-keyboard note:** targeting uses vitaly’s **product id** (`-i`). If several identical boards share the same PID, disconnect extras or use whichever device vitaly picks first.

## Tips
- If a symbol isn’t translating as desired, enter the exact QMK keycode expression in `alpha_layers.json`; it will be used verbatim.
- `_row2`/`_row3` are just visual separators for editing convenience.
- **Tap dance in Vial JSON** must be `TD(0)`, `TD(1)`, … (slot index). In `alpha_layers.json` you can write `TD(H_GUIH)` if `tapDanceOverrides` has `"name": "H_GUIH"` — the generator rewrites it to the correct index before sending data to vitaly.

## Pushing to GitHub — large files / `node_modules`

**Do not commit `gui-electron/node_modules`.** It contains the **Electron** download (hundreds of MB; `Electron Framework` alone exceeds GitHub’s **100 MB** per-file limit), so pushes fail with `GH001: Large files detected`.

**Fix if you already committed it:**
1. Ensure `.gitignore` contains `node_modules/` and `gui-electron/node_modules/` (this repo does).
2. Remove the folder from Git’s index only (keeps files on disk):
   ```bash
   git rm -r --cached gui-electron/node_modules
   ```
3. Commit and push:
   ```bash
   git commit -m "chore: stop tracking gui-electron/node_modules"
   git push
   ```
4. Collaborators and CI run `cd gui-electron && npm install` to restore dependencies.

**If `git push` still fails with GH001** after the `git rm --cached` commit, older commits on the branch still contain the Electron binary in history. Remove that path from **all** commits, then force-push (coordinate with anyone else using the repo):

```bash
# pip install git-filter-repo  # or brew install git-filter-repo
git filter-repo --path gui-electron/node_modules --invert-paths --force
git push --force-with-lease origin main   # adjust branch name
```

**If the bad commit is already on GitHub** and you only need to fix `main`, the same filter (or BFG Repo-Cleaner) applies; then force-push.

**Git LFS** is for assets you intentionally version (models, binaries); it is **not** the right tool for `node_modules` — keep dependencies out of git and reinstall from `package-lock.json`.
