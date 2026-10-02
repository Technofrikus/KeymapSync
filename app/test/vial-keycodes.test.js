import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { keycodeToName, nameToKeycode, keycodeVersion } from '../src/core/vial-keycodes.js';

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/vitaly-keycodes.json', import.meta.url), 'utf8'));

test('keycode names match vitaly for protocol 5 and 6', () => {
  for (const version of [5, 6]) {
    for (const [hex, name] of Object.entries(fixture.names[version])) {
      assert.equal(keycodeToName(Number.parseInt(hex, 16), version), name, `v${version} 0x${hex}`);
    }
  }
});

test('keycode parsing matches vitaly, including aliases and rejected names', () => {
  for (const version of [5, 6]) {
    for (const [name, expected] of Object.entries(fixture.codes[version])) {
      let actual;
      try {
        actual = nameToKeycode(name, version).toString(16).padStart(4, '0');
      } catch {
        actual = 'ERR';
      }
      assert.equal(actual, expected, `v${version} ${JSON.stringify(name)}`);
    }
  }
});

test('vitaly unit-test cases', () => {
  assert.equal(keycodeToName(0x7228, 5), 'MT(MOD_RSFT,KC_ENTER)');
  assert.equal(keycodeToName(0x3228, 6), 'MT(MOD_RSFT,KC_ENTER)');
  assert.equal(keycodeToName(0x770a, 6), 'QK_MACRO_10');
  assert.equal(keycodeToName(0x5101, 5), 'MO(1)');
  assert.equal(nameToKeycode('MO(1)', 6), 0x5221);
  assert.equal(nameToKeycode('TO(2)', 5), 0x5002);
  assert.equal(nameToKeycode('LT(3, KC_1)', 6), nameToKeycode('LT3(KC_1)', 6));
  assert.equal(nameToKeycode('KC_LEFT_SHIFT', 5), 0xe1);
});

test('protocol version picks the keycode numbering', () => {
  assert.equal(keycodeVersion(6), 6);
  assert.equal(keycodeVersion(0), 6); // VIA-only keyboards
  assert.equal(keycodeVersion(5), 5);
  assert.equal(keycodeVersion(1), 5);
  assert.equal(keycodeToName(0x1234, 6), 'RSFT(KC_QUOTE)');
  assert.equal(keycodeToName(0x1203, 6), 'RSFT(0x03)');
  assert.equal(keycodeToName(0x0003, 6), '0x03');
});
