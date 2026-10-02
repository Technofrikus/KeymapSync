/* A Keymap State to write onto the rich simulated keyboard: changes in every
 * writable section, using both vitaly names and QMK aliases. */
import { parseKeymapState } from '../../src/core/keymap-state.js';

function richTarget(snapshotText) {
  const target = parseKeymapState(snapshotText);
  target.layout[0][0][0] = 'KC_Q';
  target.layout[0][0][1] = 'LSFT_T(KC_A)';
  target.layout[3] = target.layout[3].map((row) => row.map(() => 'KC_NO'));
  target.layout[1][1][2] = 'LT(2, KC_ENT)';
  target.encoder_layout[2][0] = ['KC_PGUP', 'KC_PGDN'];
  target.layout_options = 0;
  target.combo[2] = ['KC_X', 'KC_C', 'KC_NO', 'KC_NO', 'KC_V'];
  target.tap_dance[2] = ['KC_1', 'KC_2', 'KC_NO', 'KC_NO', 250];
  target.key_override[1] = {
    layers: 3, negative_mod_mask: 0, options: 128, replacement: 'KC_GRV', suppressed_mods: 2, trigger: 'KC_ESC', trigger_mods: 2,
  };
  target.alt_repeat_key[0] = { allowed_mods: 0, alt_keycode: 'KC_C', keycode: 'KC_A', options: 8 };
  return target;
}

export { richTarget };
