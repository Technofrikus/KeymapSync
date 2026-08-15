const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  translateSymbol,
  extractAlphaFromKey,
  buildAliasMap,
  targetKey,
  replaceTapDanceNamesInString,
  buildTapDanceNameToIndex,
  processConfig,
  transformKeymapState,
  transformVilFile
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
  const processed = processConfig(doc, {
    target: { language: 'de', os: 'mac' },
    layers: { alpha: 0, symbol: 1, number: 2 },
    alphaMappings: {},
    tapDanceOverrides: [{ name: 'H_GUIH', tap: 'KC_H', hold: 'LGUI(KC_H)' }]
  });
  assert.strictEqual(doc.layout[0][0][0], 'TD(H_GUIH)');
  assert.strictEqual(processed.layout[0][0][0], 'TD(0)');

  const warningResult = transformKeymapState(
    { layout: [[['KC_A']]] },
    {
      target: { language: 'en', os: 'mac' },
      layers: { alpha: 0, symbol: 1, number: 2 },
      alphaMappings: { A: { layer1: '☃', layer2: '1' } }
    }
  );
  assert.deepStrictEqual(warningResult.warnings, ['☃']);
  assert.strictEqual(warningResult.state.layout[1][0][0], '☃');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'keymapsync-test-'));
  try {
    const inputPath = path.join(tempDir, 'input.vil');
    const outputDir = path.join(tempDir, 'output');
    const uid = '12345678901234567890';
    fs.mkdirSync(outputDir);
    fs.writeFileSync(inputPath, `{\n  "uid": ${uid},\n  "layout": [[ ["KC_A"] ]]\n}`);

    const fileResult = transformVilFile({
      inputPath,
      outputDir,
      config: {
        target: { language: 'en', os: 'mac' },
        layers: { alpha: 0, symbol: 1, number: 2 },
        alphaMappings: { A: { layer1: '!', layer2: '1' } }
      }
    });
    assert.strictEqual(path.basename(fileResult.outputPath), 'input_edited.vil');
    assert.match(fs.readFileSync(fileResult.outputPath, 'utf8'), new RegExp(`"uid": ${uid}`));
    assert.match(fs.readFileSync(inputPath, 'utf8'), new RegExp(`"uid": ${uid}`));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  console.log('All tests passed.');
}

if (require.main === module) {
  runTests();
}
