import assert from 'node:assert';
import { parseKeymapState, serializeKeymapState } from '../src/core/keymap-state.js';

const uid = '12345678901234567890';
const state = parseKeymapState(`{"uid": ${uid}, "layout": [[["KC_A"]]]}`);
assert.strictEqual(state.uid, uid);
const text = serializeKeymapState(state);
assert.match(text, new RegExp(`"uid": ${uid}`));
assert.deepStrictEqual(parseKeymapState(text), state);

console.log('Keymap state tests passed.');
