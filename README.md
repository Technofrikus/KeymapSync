# KeymapSync

**Rule-based Vial keymap sync** for multiple keyboards: you define one JSON rule set (per-key layer assignments, language/OS translation context, and optional combo / tap-dance / key-override rules). The app applies those rules to each connected keyboard so your symbol, number and other layers stay aligned with your alpha keys—without hand-editing every layout.

## How the rules work

- **Alpha detection**: For each key on the alpha layer, the generator resolves which letter (or alias) it represents, using `alphaMappings` and optional `aliases` (e.g. tap-dance codes).
- **Layer targets**: `layers.alpha` is the layer with your letters. `layers.extra` lists any number of extra layers (default: Symbols, Numbers, Navigation); each has an `id`, a `name` and the keyboard layer `index` it writes to. A mapping’s value under a layer’s `id` (e.g. `layer3`) is written to that layer. An empty or missing value leaves the key unchanged.
- **Translation rules**: Single-character entries are turned into QMK keycodes using built-in tables for `target.language` × `target.os` (e.g. `de` + `mac`). Key names and shortcuts such as `Left`, `Bksp`, `Alt+Bksp` or `MO1` are accepted too. Raw QMK expressions (e.g. `LSFT(KC_MINUS)`) are passed through unchanged. `NO`, `TRNS` / `TRANSPARENT` are normalized to `KC_NO` / `KC_TRNS`.
- **Structural overrides**: `comboOverrides`, `tapDanceOverrides`, and `keyOverrideOverrides` replace or extend the corresponding Vial arrays with merge semantics.
- **Tap-dance names**: You can use `TD(MyName)` in mappings when `tapDanceOverrides` defines `"name": "MyName"`; the generator resolves names to `TD(0)`, `TD(1)`, … before writing or syncing.

Optional `mappingsVersion` in the config is reserved for future format evolution.

## What you get

| Capability | Description |
|------------|-------------|
| **Web app** | The same app in Chrome or Edge, no install: talks to the keyboard directly over WebHID. Configuration is kept in the browser or in a file you pick. |
| **Desktop app** | Small Tauri app with the same visual editor for alpha table, combos, and tap dances; schema-validated configuration; configurable paths; logs; unsaved-change guard. |
| **Layout sorting** | Editor can order keys as QWERTY, Dvorak, Colemak, or alphabetical—cosmetic only; rules are still keyed by letter. |
| **Online sync** | Talk to a connected Vial keyboard over USB: list devices, dump live JSON, merge preview, write back. Both the web and desktop apps speak the Vial protocol themselves. |
| **Keyboard geometry** | Fetch compressed KLE-style definitions from the device (Vial HID) to preview layouts and place keys visually in the online flow. |

## Repository layout

| Path | Role |
|------|------|
| `alpha_layers.json` | Rule configuration (edit this or use the GUI). |
| `app/` | Shared app (screens, rules, validation), built with Vite and used by every shell. |
| `app/src/core/alpha-layers.schema.json` | Machine-readable configuration schema used alongside semantic validation. |
| `app/src/platform/web.js` | Web shell (WebHID); built with `npm run build:web` into `dist/web/`. |
| `shells/tauri/` | Small Tauri desktop shell (`npm install`, `npm run tauri dev` / `npm run tauri build`; needs Rust). |
| `docs/archive/platform-plan.md` | Archived (done) plan for the move to a shared web + Tauri app. |
| `docs/manual-desktop-smoke-test.md` | Release checklist for backup, physical key overrides, selective apply, and close/save behavior. |
| `docs/manual-web-smoke-test.md` | Checklist for the web app on a physical keyboard, including a comparison with vitaly output. |

## `alpha_layers.json`

- **`target`**: `language` (`de`, `fr`, `es`, `en`, …) and `os` (`mac`, `win`, `linux`).
- **`layers`**: `alpha` index plus `extra`, a list of `{ "id": "layer1", "name": "Symbols", "index": 1 }` entries (up to 16). Older files with `symbol` / `number` (aliases `symbols` / `numbers`) still load; the editor saves them in the new form.
- **`alphaMappings`**: Keys are letters or row spacers (`_row2`, `_row3`). Each entry may include:
  - `layer1`, `layer2`, … → the value for the extra layer with that `id`
  - `base` → optional replacement on the alpha layer (e.g. tap dance)
  - `aliases` → extra keycodes that count as this letter for matching
- **`comboOverrides`**: Objects with `keys` (up to four) and `result`; converted to Vial’s five-element combo rows.
- **`tapDanceOverrides`**: Objects with `name`, `tap`, `hold`, optional `doubleTap`, `tapHold`, `term`; merged into `tap_dance`.
- **`keyOverrideOverrides`**: Objects merged into `key_override` with `trigger` / `replacement` translation where applicable.
- **`*Example` keys**: Reference shapes only; not applied unless copied into the live `*Overrides` arrays.

## Development

Requires Node 22+.

```bash
npm install                 # repo root: shared app + Vite
npm test                    # shared app tests
npm run dev                 # web app with hot reload (open in Chrome/Edge)
npm run build:web           # static web app in dist/web/ (serve over HTTPS)
npm run test:e2e            # web app in Chromium against a simulated keyboard
npm run tauri dev           # desktop app with hot reload (needs Rust)
npm run tauri build         # desktop installer
```

**Views**

1. **Keymap** — Tabs for Keys, Tap Dance and Combos. On Keys, add, rename or remove layers, and edit them as a table or on a keyboard picture, ordered as QWERTY, Dvorak, Colemak or alphabetically. Suggestions and the bar at the bottom show what each field sends; **? Help** (or the `?` key) opens the searchable keycode reference. Save writes `alpha_layers.json`.
2. **Online sync** — Select a device, preview merged layout, apply to the keyboard. In the web app, **Connect keyboard…** asks the browser for access first.

### Web app

Runs in Chrome and Edge (WebHID); Firefox and Safari can edit the configuration but not connect keyboards. Keyboard access needs HTTPS (or `localhost`). The GitHub workflow `.github/workflows/web.yml` tests every push and publishes `master` to GitHub Pages once Pages is enabled (Settings → Pages → Source: GitHub Actions). The web app reads everything a backup needs, but only writes keys, encoders, layout options, combos, tap dance, key overrides and alt repeat keys; Vial keyboards only (not VIA-only firmware).

### Desktop app

A small Tauri app (`shells/tauri/`) loads the same shared app. Rust only passes raw HID messages and opens native file dialogs; file choices reach the app as opaque grants, never raw paths.

## Tips

- If a character does not translate as expected, put the exact QMK expression in the JSON; it wins over the language tables.
- Combo / tap-dance / key-override shapes must stay compatible with your firmware’s Vial feature limits.

## Release pipeline (GitHub Actions)

Pushing a version tag (for example `v0.2.0`) runs `.github/workflows/tauri-release.yml`. It builds installers for macOS (universal), Windows and Linux and attaches them to a draft GitHub release. Signing runs only when these secrets exist: `APPLE_CERT_P12_BASE64`, `APPLE_CERT_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`. Without them the installers are unsigned. A manual run attaches the installers to the run page instead.

```bash
git tag v0.2.0
git push origin v0.2.0
```

## License

KeymapSync is licensed under the GNU General Public License v3.0 or later. See `LICENSE`.

### Credits

The web app's keyboard code builds on these open-source projects:

- [vial-gui](https://github.com/vial-kb/vial-gui) (GPL-2.0-or-later) — reference for the Vial protocol (keymap, dynamic entries, unlock).
- [VIA app](https://github.com/the-via/app) (GPL-3.0) — reference for WebHID device picking.
- [vitaly](https://github.com/bskaplou/vitaly) (MIT, © 2025 Boris Kaplunovsky) — keycode name tables (`app/src/core/vial-keycode-tables.js`) and the Keymap State format.
- pipette — reference for reading the keyboard definition.
- [xz-decompress](https://github.com/httptoolkit/xz-decompress) (MIT) — decompressing the keyboard definition in the browser.
