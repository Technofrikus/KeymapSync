# Domain Model - KeymapSync

## Central Entities

| Entity | Description | Relationships |
| :--- | :--- | :--- |
| **Alpha Mapping** | Mapping of a base key (e.g. 'A') to symbols/numbers. | Part of `alpha_layers.json`. |
| **TapDance** | Advanced QMK function (Tap vs Hold). | Defined in `config` overrides. |
| **Combo** | Multiple keys pressed at once. | Defined in `config` overrides. |
| **Device** | A connected physical keyboard. | identified by Vendor/Product ID. |
| **Keymap State** | The full matrix/tap-dance/combo config of a keyboard. | JSON object (matches `.vil`). |

## Business Logic
- **Alpha Layer Sync**: Iterates over all keys on a "base" layer. If a key matches a character defined in `alphaMappings`, it sets its equivalents on Layer 1 (symbols) and Layer 2 (numbers).
- **Symbol Translation**: Translates symbols (e.g. `(`) into OS/Language specific keycodes (e.g. `LSFT(KC_8)` for German Mac).

## Data Flows
1. **Fetch**: Keyboard HID -> `vitaly` -> JSON State.
2. **Transform**: JSON State + `alphaMappings` -> Modified JSON State.
3. **Write**: Modified JSON State -> `vitaly` -> Keyboard HID.

## Lifecycle of a Sync
- `Searching` -> `Selected` -> `Previewing (Diffing)` -> `Confirming` -> `Applying`.

## Permissions
- Standard OS-level HID permissions required (macOS may require 'Input Monitoring').
