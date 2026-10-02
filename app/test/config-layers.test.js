import assert from 'node:assert';
import test from 'node:test';
import { getExtraLayers, nextLayerId, nextLayerIndex, upgradeConfig } from '../src/core/config-layers.js';
import { validateConfig } from '../src/core/config-validation.js';
import { transformKeymapState } from '../src/core/keymap-transform.js';
import { groupKeys } from '../src/ui/key-order.js';
import { previewLayerValue, previewBase } from '../src/ui/field-preview.js';

const target = { language: 'de', os: 'mac' };

function legacyConfig() {
  return {
    target,
    layers: { alpha: 0, symbol: 1, number: 2 },
    alphaMappings: { A: { layer1: 'ä', layer2: '1' }, '.': { layer1: '', layer2: '' } },
  };
}

function threeLayerConfig() {
  return {
    target,
    layers: {
      alpha: 0,
      extra: [
        { id: 'layer1', name: 'Symbols', index: 1 },
        { id: 'layer2', name: 'Numbers', index: 2 },
        { id: 'layer3', name: 'Navigation', index: 3 },
      ],
    },
    alphaMappings: { A: { layer1: 'ä', layer2: '1', layer3: 'Left' }, B: { layer3: 'Alt+Bksp' } },
  };
}

test('legacy symbol/number layers read as two extra layers', () => {
  assert.deepStrictEqual(getExtraLayers(legacyConfig()), [
    { id: 'layer1', name: 'Symbols', index: 1 },
    { id: 'layer2', name: 'Numbers', index: 2 },
  ]);
});

test('upgrading a legacy config keeps every value and is idempotent', () => {
  const legacy = legacyConfig();
  const upgraded = upgradeConfig(legacy);
  assert.deepStrictEqual(upgraded.layers, { alpha: 0, extra: getExtraLayers(legacy) });
  assert.deepStrictEqual(upgraded.alphaMappings.A, { layer1: 'ä', layer2: '1' });
  // "" and NO both clear the key; the editor uses an empty field for "unchanged".
  assert.deepStrictEqual(upgraded.alphaMappings['.'], { layer1: 'NO', layer2: 'NO' });
  assert.strictEqual(validateConfig(upgraded).valid, true);
  assert.strictEqual(upgradeConfig(upgraded), upgraded);
  assert.deepStrictEqual(legacy.layers, { alpha: 0, symbol: 1, number: 2 }, 'input is not modified');

  const doc = { layout: [[['KC_A', 'KC_DOT']], [['KC_TRNS', 'KC_TRNS']], [['KC_TRNS', 'KC_TRNS']]] };
  assert.deepStrictEqual(transformKeymapState(doc, upgraded).state, transformKeymapState(doc, legacy).state);
});

test('new layer ids and indices skip the ones in use', () => {
  const extra = [{ id: 'layer1', index: 1 }, { id: 'layer3', index: 2 }];
  assert.strictEqual(nextLayerId(extra), 'layer2');
  assert.strictEqual(nextLayerIndex(0, extra), 3);
});

test('three extra layers validate and write to their own keyboard layers', () => {
  const config = threeLayerConfig();
  assert.deepStrictEqual(validateConfig(config).issues, []);
  const doc = { layout: [[['KC_A', 'KC_B']], [['KC_TRNS', 'KC_TRNS']], [['KC_TRNS', 'KC_TRNS']], [['KC_TRNS', 'KC_TRNS']]] };
  const { state, missingLayers } = transformKeymapState(doc, config);
  assert.deepStrictEqual(state.layout[1][0], ['KC_QUOT', 'KC_TRNS']);
  assert.deepStrictEqual(state.layout[2][0], ['KC_1', 'KC_TRNS']);
  assert.deepStrictEqual(state.layout[3][0], ['KC_LEFT', 'LALT(KC_BSPC)']);
  assert.deepStrictEqual(missingLayers, []);
});

test('a layer beyond the keyboard is reported, an empty one is not touched', () => {
  const config = threeLayerConfig();
  config.layers.extra.push({ id: 'layer4', name: 'Empty', index: 5 });
  const doc = { layout: [[['KC_A', 'KC_B']], [['KC_TRNS', 'KC_TRNS']], [['KC_TRNS', 'KC_TRNS']]] };
  const { state, missingLayers } = transformKeymapState(doc, config);
  assert.deepStrictEqual(missingLayers.map((layer) => [layer.name, layer.index, layer.keyboardLayerCount]), [['Navigation', 3, 3]]);
  assert.strictEqual(state.layout.length, 4);
});

test('layer validation rejects unknown fields, duplicate indices and bad values', () => {
  const unknown = threeLayerConfig();
  unknown.alphaMappings.A.layer9 = 'x';
  assert.ok(validateConfig(unknown).issues.some((issue) => issue.path === 'alphaMappings.A.layer9'));

  const duplicate = threeLayerConfig();
  duplicate.layers.extra[2].index = 1;
  assert.ok(validateConfig(duplicate).issues.some((issue) => issue.path === 'layers.extra[2].index'));

  const mixed = threeLayerConfig();
  mixed.layers.symbol = 1;
  assert.ok(validateConfig(mixed).issues.some((issue) => issue.path === 'layers.symbol'));

  const bad = threeLayerConfig();
  bad.alphaMappings.A.layer3 = 'hello';
  assert.ok(validateConfig(bad).issues.some((issue) => issue.path === 'alphaMappings.A.layer3'));
});

test('key order groups keys by row for every layout', () => {
  const keys = ['A', 'R', 'S', 'T', 'Q', 'W', 'F', 'Z', ',', '-', '_x'];
  assert.deepStrictEqual(groupKeys(keys, 'colemak'), [
    { name: 'Top row', keys: ['Q', 'W', 'F'] },
    { name: 'Home row', keys: ['A', 'R', 'S', 'T'] },
    { name: 'Bottom row', keys: ['Z', ',', '-'] },
    { name: 'Other keys', keys: ['_x'] },
  ]);
  assert.deepStrictEqual(groupKeys(['S', 'A', 'Z'], 'alphabetical').map((group) => group.keys), [['A'], ['S', 'Z']]);
});

test('field previews show the keycode or explain the problem', () => {
  assert.deepStrictEqual(previewLayerValue('ä', target), { ok: true, code: 'KC_QUOT', message: '' });
  assert.strictEqual(previewLayerValue('Alt+Bksp', target).code, 'LALT(KC_BSPC)');
  assert.strictEqual(previewLayerValue('', target).empty, true);
  assert.strictEqual(previewLayerValue('€', target).ok, false);
  assert.strictEqual(previewBase('TD(Missing)', ['H_GUIH']).ok, false);
  assert.strictEqual(previewBase('TD(H_GUIH)', ['H_GUIH']).ok, true);
});
