# KeymapSync web app — physical-keyboard smoke test

The web shell was built and tested against a simulated keyboard and recorded
vitaly output only. Run this checklist on real keyboards before publishing the
site, and again after changes to `app/src/core/vial-protocol.js`,
`app/src/platform/webhid-transport.js` or `app/src/platform/web.js`. Record
OS, browser version, keyboard model, Vial firmware/protocol version and the
result of each section.

## Preconditions

- Chrome or Edge on macOS, Windows or Linux. On Linux, the user needs access to
  the keyboard's `hidraw` device (same udev rule Vial needs).
- `npm run build:web && npm run preview:web`, then open the printed
  `http://localhost:…` address (localhost counts as secure; any other host needs HTTPS).
- vitaly on the same machine for the comparison steps, and Vial to restore.
- Close Vial / vial.rocks / VIA first: only one program can use the keyboard at a time.

## Browser support

1. Open the site in Firefox or Safari: the Keymap editor works; Online Sync says
   the browser cannot connect to keyboards.
2. Open it over plain `http://` on a non-localhost address: Online Sync asks for https.

## Connect and read (compare with vitaly)

1. Online Sync → **Connect keyboard…** → pick the keyboard. It appears with the
   right name, layer count and Combos/TapDance tags.
2. Select it: the layout drawing matches the keyboard (including layout options).
3. **Download Current Config (.vil)**.
4. Close the browser tab, then run `vitaly save -f vitaly.vil` for the same keyboard.
5. Compare: `diff <(jq -S . web.vil) <(jq -S . vitaly.vil)` (jq 1.7+ keeps the
   `uid` digits exact). Expect no differences, except that `macro` keeps empty
   slots between macros where vitaly stops at the first empty one.

## Write

1. Preview with a configuration that changes a few keys, a combo, a tap dance
   and a key override. The preview lists only real changes (no `KC_BSPC → KC_BACKSPACE`-style renames).
2. Apply. Then preview again: "No changes required".
3. `vitaly save` again and confirm only the previewed sections changed; macros,
   QMK settings and untouched entries are unchanged.
4. Type on the keyboard in a plain-text editor: changed keys, combos, tap dance
   and the key override behave as expected.

## Stale preview, unplug, unlock

1. Preview, change one key in Vial, close Vial, press Apply: KeymapSync refuses
   and asks for a new preview.
2. Unplug the keyboard while it is selected, press Refresh: it disappears; plug
   it back in and press Refresh (no new permission prompt): it is back.
3. Configure a key to `QK_BOOT` (locked keyboard), Apply: KeymapSync asks to
   unlock, names the keys to hold, counts down, then writes. Lock again with Vial.

## Configuration and leaving the page

1. Edit a mapping and press Save, reload the page: the change is still there
   (browser storage).
2. Settings → Pick… a JSON file, edit, Save: Chrome/Edge write the file back
   (other browsers download a copy).
3. Edit without saving and close the tab: the browser asks to confirm.

## Restore

Restore the backup from the first section with Vial and check the keyboard is
back to its starting state.
