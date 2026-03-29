const assert = require('assert');
const {
  translateSymbol,
  extractAlphaFromKey,
  buildAliasMap,
  targetKey,
  replaceTapDanceNamesInString,
  buildTapDanceNameToIndex,
  processConfig
} = require('./generate_vial_keymaps');

function runTests() {
  const target = { language: 'de', os: 'mac' };
  assert.strictEqual(targetKey(target), 'de-mac');

  assert.strictEqual(translateSymbol('?', target, []), 'LSFT(KC_MINS)');
  assert.strictEqual(translateSymbol('7', target, []), 'KC_7');
  assert.strictEqual(translateSymbol('a', target, []), 'KC_A');
  assert.strictEqual(translateSymbol('KC_ESC', target, []), 'KC_ESC');
  assert.strictEqual(translateSymbol('NO', target, []), 'KC_NO');
  assert.strictEqual(translateSymbol('TrNs', target, []), 'KC_TRNS');

  const aliasMap = buildAliasMap({ H: { aliases: ['TD(H_GUIH)'] } });
  assert.strictEqual(extractAlphaFromKey('KC_H', aliasMap), 'H');
  assert.strictEqual(extractAlphaFromKey('TD(H_GUIH)', aliasMap), 'H');
  assert.strictEqual(extractAlphaFromKey('KC_Q', aliasMap), 'Q');

  const m = buildTapDanceNameToIndex({
    tapDanceOverrides: [{ name: 'H_GUIH', tap: 'KC_H', hold: 'LGUI(KC_H)' }]
  });
  assert.strictEqual(replaceTapDanceNamesInString('TD(H_GUIH)', m), 'TD(0)');
  assert.strictEqual(replaceTapDanceNamesInString('TD(0)', m), 'TD(0)');
  assert.strictEqual(replaceTapDanceNamesInString('MT(MOD_LGUI,KC_H)', m), 'MT(MOD_LGUI,KC_H)');

  const doc = {
    layout: [[['TD(H_GUIH)', 'KC_TRNS']]],
    tap_dance: [['KC_H', 'LGUI(KC_H)', 'KC_NO', 'KC_NO', 200]],
    combo: []
  };
  processConfig(doc, {
    target: { language: 'de', os: 'mac' },
    layers: { alpha: 0, symbol: 1, number: 2 },
    alphaMappings: {},
    tapDanceOverrides: [{ name: 'H_GUIH', tap: 'KC_H', hold: 'LGUI(KC_H)' }]
  });
  assert.strictEqual(doc.layout[0][0][0], 'TD(0)');

  console.log('All tests passed.');
}

if (require.main === module) {
  runTests();
}

