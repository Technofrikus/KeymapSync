const assert = require('assert');
const {
  translateSymbol,
  extractAlphaFromKey,
  buildAliasMap,
  targetKey
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

  console.log('All tests passed.');
}

if (require.main === module) {
  runTests();
}

