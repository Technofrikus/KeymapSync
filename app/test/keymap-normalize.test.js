import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeForKeyboard } from '../src/core/keymap-normalize.js';

const current = {
  vial_protocol: 6,
  layout: [[['KC_BACKSPACE']]],
  combo: [['KC_NO', 'KC_NO', 'KC_NO', 'KC_NO', 'KC_NO'], ['KC_NO', 'KC_NO', 'KC_NO', 'KC_NO', 'KC_NO']],
  tap_dance: [['KC_NO', 'KC_NO', 'KC_NO', 'KC_NO', 200]],
  key_override: [{ trigger: 'KC_NO', replacement: 'KC_NO', layers: 0 }],
};

test('names are written the way the keyboard reports them', () => {
  const target = normalizeForKeyboard(current, {
    ...current,
    layout: [[['KC_BSPC', 'LSFT_T(KC_A)', -1, 'KC_UNKNOWN']]],
    combo: [['KC_J', 'KC_K', 'KC_NO', 'KC_NO', 'KC_BSPC']],
    tap_dance: [['KC_ENT', 'KC_NO', 'KC_NO', 'KC_NO', 200]],
    key_override: [{ trigger: 'KC_ESC', replacement: 'KC_GRV', layers: 1 }],
    uid: '123',
  });
  assert.deepEqual(target.layout, [[['KC_BACKSPACE', 'MT(MOD_LSFT,KC_A)', -1, 'KC_UNKNOWN']]]);
  assert.deepEqual(target.combo, [['KC_J', 'KC_K', 'KC_NO', 'KC_NO', 'KC_BACKSPACE']]);
  assert.deepEqual(target.tap_dance, [['KC_ENTER', 'KC_NO', 'KC_NO', 'KC_NO', 200]]);
  assert.deepEqual(target.key_override, [{ trigger: 'KC_ESCAPE', replacement: 'KC_GRAVE', layers: 1 }]);
  assert.equal(target.uid, '123');
});

test('entries beyond the keyboard\'s slots are dropped', () => {
  const extra = ['KC_A', 'KC_B', 'KC_NO', 'KC_NO', 'KC_C'];
  const target = normalizeForKeyboard(current, { combo: [extra, extra, extra], tap_dance: [] });
  assert.equal(target.combo.length, 2);
  assert.deepEqual(target.tap_dance, []);
  assert.equal(normalizeForKeyboard({}, { combo: [extra, extra, extra] }).combo.length, 3);
});
