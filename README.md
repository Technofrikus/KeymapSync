# KeymapSync

**Rule-based Vial keymap sync** for multiple keyboards: you define one JSON rule set (per-key layer assignments, language/OS translation context, and optional combo / tap-dance / key-override rules). The tool applies those rules to each board’s `.vil` layout so symbol and number layers stay aligned with your alpha keys—without hand-editing every file.

## How the rules work

- **Alpha detection**: For each key on the alpha layer, the generator resolves which letter (or alias) it represents, using `alphaMappings` and optional `aliases` (e.g. tap-dance codes).
- **Layer targets**: `layers.alpha`, `layers.symbol`, and `layers.number` choose which layout indices are updated. Each mapping’s **`layer1`** value is written to the **symbol** layer; **`layer2`** to the **number** layer.
- **Translation rules**: Single-character entries are turned into QMK keycodes using built-in tables for `target.language` × `target.os` (e.g. `de` + `mac`). Raw QMK expressions (e.g. `LSFT(KC_MINUS)`) are passed through unchanged. `NO`, `TRNS` / `TRANSPARENT` are normalized to `KC_NO` / `KC_TRNS`.
- **Structural overrides**: `comboOverrides`, `tapDanceOverrides`, and `keyOverrideOverrides` replace or extend the corresponding Vial arrays with merge semantics.
- **Tap-dance names**: You can use `TD(MyName)` in mappings when `tapDanceOverrides` defines `"name": "MyName"`; the generator resolves names to `TD(0)`, `TD(1)`, … before writing or syncing.

Optional `mappingsVersion` in the config is reserved for future format evolution.

## What you get

| Capability | Description |
|------------|-------------|
| **Batch `.vil` generation** | Read every `.vil` in `original/`, apply rules, write `*_edited.vil` to `output/` (originals unchanged). |
| **CLI** | `node generate_vial_keymaps.js` from repo root (Node 18+). No npm dependencies for the generator. |
| **Electron GUI** | Visual editor for alpha table, combos, and tap dances; configurable paths; logs; unsaved-change guard. |
| **Layout sorting** | Editor can order keys as QWERTY, Dvorak, Colemak, or alphabetical—cosmetic only; rules are still keyed by letter. |
| **Offline sync** | Run the same generation as the CLI from the app with chosen input/output folders. |
| **Online sync** | Talk to a connected Vial keyboard over USB via [vitaly](https://github.com/bskaplou/vitaly): list devices, dump live JSON, merge preview, write back, optional EEPROM lock. stderr is interpreted so failures surface even when vitaly exits 0. |
| **Keyboard geometry** | Fetch compressed KLE-style definitions from the device (Vial HID) to preview layouts and place keys visually in the online flow. |

## Repository layout

| Path | Role |
|------|------|
| `alpha_layers.json` | Rule configuration (edit this or use the GUI). |
| `original/` | Source `.vil` files (one per keyboard). |
| `output/` | Generated `*_edited.vil` files. |
| `generate_vial_keymaps.js` | Generator engine (also copied into `gui-electron/` for packaging). |
| `generate_vial_keymaps.test.js` | Lightweight regression checks: `node generate_vial_keymaps.test.js` |
| `gui-electron/` | Electron app (`npm install`, `npm start`). |

## `alpha_layers.json`

- **`target`**: `language` (`de`, `fr`, `es`, `en`, …) and `os` (`mac`, `win`, `linux`).
- **`layers`**: Indices for `alpha`, `symbol`, `number` (aliases `symbols` / `numbers` accepted).
- **`alphaMappings`**: Keys are letters or row spacers (`_row2`, `_row3`). Each entry may include:
  - `layer1` → symbol layer keycode
  - `layer2` → number layer keycode
  - `base` → optional replacement on the alpha layer (e.g. tap dance)
  - `aliases` → extra keycodes that count as this letter for matching
- **`comboOverrides`**: Objects with `keys` (up to four) and `result`; converted to Vial’s five-element combo rows.
- **`tapDanceOverrides`**: Objects with `name`, `tap`, `hold`, optional `doubleTap`, `tapHold`, `term`; merged into `tap_dance`.
- **`keyOverrideOverrides`**: Objects merged into `key_override` with `trigger` / `replacement` translation where applicable.
- **`*Example` keys**: Reference shapes only; not applied unless copied into the live `*Overrides` arrays.

## Command line

From the repository root:

```bash
node generate_vial_keymaps.js
```

Check `output/` for updated files; import in Vial or use online sync from the GUI.

## GUI (`gui-electron/`)

```bash
cd gui-electron
npm install
npm start
```

**Views**

1. **Keymap** — Edit the rule tables, pick physical layout ordering, save `alpha_layers.json`.
2. **Offline sync** — Generate `.vil` files from configured folders.
3. **Online sync** — Select a device, preview merged layout, apply to the keyboard, optionally lock.

**Packaged builds** (see `package.json`): `npm run dist`, `npm run dist:mac`, `npm run dist:win` (Windows build runs `fetch-vitaly` first).

### vitaly (online sync)

The app resolves the vitaly binary in this order (development): `gui-electron/bin/vitaly` (or `.exe`), then a matching-OS build under `Reference only/vitaly-main/target/release/`, then `vitaly` on `PATH`. Production bundles ship vitaly under `resources/bin/`.

Fetch a release binary into `gui-electron/bin/`:

```bash
cd gui-electron
npm run fetch-vitaly
```

Build from source on the same OS you run Electron (Rust toolchain required for the vitaly project). You can also use `scripts/build-vitaly.sh` or `scripts/build-vitaly-docker.sh` when targeting Linux.

**Note:** Identical USB product IDs can make device selection ambiguous; disconnect extras or rely on vitaly’s ordering when multiple boards match.

## Tips

- If a character does not translate as expected, put the exact QMK expression in the JSON; it wins over the language tables.
- Combo / tap-dance / key-override shapes must stay compatible with your firmware’s Vial feature limits.
