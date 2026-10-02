# KeymapSync

**Rule-based Vial keymap sync** for multiple keyboards: you define one JSON rule set (per-key layer assignments, language/OS translation context, and optional combo / tap-dance / key-override rules). The app applies those rules to each connected keyboard so symbol and number layers stay aligned with your alpha keys—without hand-editing every layout.

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
| **Electron GUI** | Visual editor for alpha table, combos, and tap dances; schema-validated configuration; configurable paths; logs; unsaved-change guard. |
| **Layout sorting** | Editor can order keys as QWERTY, Dvorak, Colemak, or alphabetical—cosmetic only; rules are still keyed by letter. |
| **Online sync** | Talk to a connected Vial keyboard over USB via [vitaly](https://github.com/bskaplou/vitaly): list devices, dump live JSON, merge preview, write back, optional EEPROM lock. stderr is interpreted so failures surface even when vitaly exits 0. |
| **Keyboard geometry** | Fetch compressed KLE-style definitions from the device (Vial HID) to preview layouts and place keys visually in the online flow. |

## Repository layout

| Path | Role |
|------|------|
| `alpha_layers.json` | Rule configuration (edit this or use the GUI). |
| `app/` | Shared app (screens, rules, validation), built with Vite and used by every shell. |
| `app/src/core/alpha-layers.schema.json` | Machine-readable configuration schema used alongside semantic validation. |
| `shells/electron/` | Electron desktop shell (`npm install`, `npm start`). |
| `docs/platform-plan.md` | Roadmap: shared app with web (WebHID) and Tauri desktop shells. |
| `docs/manual-electron-smoke-test.md` | Release checklist for backup, physical key overrides, selective apply, and close/save behavior. |

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

## Development

Requires Node 22+.

```bash
npm install                 # repo root: shared app + Vite
npm test                    # shared app tests

cd shells/electron
npm install
npm test                    # Electron shell tests
npm start                   # builds the shared app, then starts Electron
```

**Views**

1. **Keymap** — Edit the rule tables, pick physical layout ordering, save `alpha_layers.json`.
2. **Online sync** — Select a device, preview merged layout, apply to the keyboard, optionally lock.

Filesystem choices are represented in the renderer by opaque, window-scoped grants. Actual paths and file operations remain in Electron's main process.

**Packaged builds** (in `shells/electron`, see `package.json`): `npm run dist`, `npm run dist:mac`, `npm run dist:win`. Each build first builds the shared app and stages the seed configuration and matching vitaly binary.

### vitaly (online sync)

The app resolves the vitaly binary in this order (development): `shells/electron/bin/vitaly` (or `.exe`), then a matching-OS build under `Reference only/vitaly-main/target/release/`, then `vitaly` on `PATH`. Production bundles ship vitaly under `resources/bin/`.

Fetch a release binary into `shells/electron/bin/`:

```bash
cd shells/electron
npm run fetch-vitaly
```

Build from source on the same OS you run Electron (Rust toolchain required for the vitaly project). You can also use `scripts/build-vitaly.sh` or `scripts/build-vitaly-docker.sh` when targeting Linux.

**Note:** Identical USB product IDs can make device selection ambiguous; disconnect extras or rely on vitaly’s ordering when multiple boards match.

## Tips

- If a character does not translate as expected, put the exact QMK expression in the JSON; it wins over the language tables.
- Combo / tap-dance / key-override shapes must stay compatible with your firmware’s Vial feature limits.

## Release and Distribution Pipeline (GitHub Actions)

This repository uses a tag-triggered GitHub Actions workflow to build desktop artifacts for macOS and Windows.

### 1) One-time setup (GitHub secrets)

In your GitHub repository, add these secrets before creating a signed macOS release:

- `APPLE_CERT_P12_BASE64` - Base64-encoded Developer ID Application certificate (`.p12`)
- `APPLE_CERT_PASSWORD` - Password used when exporting the `.p12`
- `APPLE_ID` - Your Apple ID email
- `APPLE_APP_SPECIFIC_PASSWORD` - App-specific password from Apple ID settings
- `APPLE_TEAM_ID` - Apple Developer Team ID

Windows signing is optional. If you do not configure Windows signing, CI can still produce unsigned `.exe`/installer artifacts.

### 2) Create a release tag

Create and push a semantic version tag (for example `v0.2.0`) from your local repo:

```bash
git tag v0.2.0
git push origin v0.2.0
```

This tag push triggers the workflow in `.github/workflows/gui-electron-release.yml`.

### 3) What the workflow does

- **macOS runner (`macos-latest`)**
  - Installs dependencies at the repo root and in `shells/electron/`, runs tests
  - Runs `npm run dist:mac`
  - Signs the app with your Developer ID certificate
  - Submits for notarization and staples the ticket (when Apple credentials are configured)
  - Uploads macOS artifacts (`dmg`, `zip`)

- **Windows runner (`windows-latest`)**
  - Installs dependencies at the repo root and in `shells/electron/`, runs tests
  - Runs `npm run dist:win`
  - Builds native Windows artifacts on Windows (required for native modules such as `node-hid`)
  - Uploads Windows artifacts (`nsis`, `zip`)

- **Release job (`ubuntu-latest`, tags only)**
  - Downloads both artifact bundles
  - Creates/updates the GitHub Release for the tag
  - Attaches macOS and Windows files to that release

### 4) Download artifacts / release files

After the workflow finishes:

1. Open the workflow run in GitHub Actions.
2. Download uploaded artifacts directly, or open the tag's GitHub Release.
3. Share the generated installers/archives from the release assets.

### 5) Why Windows is built on GitHub (not on macOS)

Cross-compiling Electron apps with native Node modules from macOS to Windows is unreliable and often unsupported by `node-gyp`. The recommended approach is exactly what this pipeline does: build each platform on its native GitHub-hosted runner.

## License

KeymapSync is licensed under the GNU General Public License v3.0 or later. See `LICENSE`.
