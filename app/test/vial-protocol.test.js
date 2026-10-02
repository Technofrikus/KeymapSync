import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createVialKeyboard, decodeMacros, countEncoders } from '../src/core/vial-protocol.js';
import { parseKeymapState } from '../src/core/keymap-state.js';
import { decompressXz, decompressLzma } from '../src/platform/decompress.js';
import { createSimulatedKeyboard } from './support/simulated-vial-keyboard.js';
import { richKeyboardOptions, fillRichEntries } from './support/rich-keyboard.js';
import { richTarget } from './support/rich-keyboard-target.js';

const fixture = (name) => fs.readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const vitalySave = fixture('vitaly-save-simulated.vil');

function connect(simulator, options = {}) {
  const keyboard = createVialKeyboard(async (message) => simulator.handle(Uint8Array.from(message)), {
    decompress: { xz: decompressXz, lzma: decompressLzma },
    sleep: async () => {},
    ...options,
  });
  return keyboard;
}

const richSimulator = () => fillRichEntries(createSimulatedKeyboard(richKeyboardOptions()));

test('snapshot is identical to vitaly save on the same keyboard', async () => {
  const snapshot = await connect(richSimulator()).snapshot();
  // Same content and the same key order vitaly writes.
  assert.equal(JSON.stringify(snapshot), JSON.stringify(parseKeymapState(vitalySave)));
  assert.equal(snapshot.uid, '17279655951921914625');
});

test('capabilities match vitaly devices -c', async () => {
  const capabilities = await connect(richSimulator()).readCapabilities();
  assert.deepEqual(capabilities, {
    via_version: 9,
    vial_version: 6,
    companion_hid_version: 0,
    layer_count: 4,
    macro_count: 4,
    macro_buffer_size: 64,
    tap_dance_count: 4,
    combo_count: 4,
    key_override_count: 2,
    alt_repeat_key_count: 1,
    caps_word: true,
    layer_lock: false,
  });
});

test('apply ends in the same keyboard state as vitaly load, sending only changes', async () => {
  const simulator = richSimulator();
  simulator.state.locked = false; // vitaly refuses to load macros into a locked keyboard
  const summary = await connect(simulator).apply(richTarget(vitalySave));
  const expected = JSON.parse(fixture('vitaly-load-simulated.json'));
  const actual = simulator.exportState();
  // vitaly rewrites every key override and clears the unused option bit 6
  // on the way; we leave unchanged entries alone.
  const ignoreUnusedBit = (entries) => entries.map((entry) => [...entry.slice(0, 9), entry[9] & 0xbf]);
  assert.deepEqual(ignoreUnusedBit(actual.keyOverrides), ignoreUnusedBit(expected.keyOverrides));
  assert.deepEqual({ ...actual, keyOverrides: null }, { ...expected, keyOverrides: null });
  assert.deepEqual(summary, {
    layout_options: 1, key_override: 1, alt_repeat_key: 1, combo: 1, tap_dance: 1, encoder_layout: 2, layout: 9,
  });
  assert.equal(simulator.writes().length, 16);
});

test('round trip: apply then snapshot returns the target', async () => {
  const simulator = richSimulator();
  const keyboard = connect(simulator);
  const target = richTarget(vitalySave);
  await keyboard.apply(target);
  const after = await keyboard.snapshot();
  // Aliases come back in vitaly's canonical spelling.
  assert.equal(after.layout[0][0][1], 'MT(MOD_LSFT,KC_A)');
  assert.equal(after.layout[1][1][2], 'LT(2,KC_ENTER)');
  assert.deepEqual(after.encoder_layout[2][0], ['KC_PAGE_UP', 'KC_PAGE_DOWN']);
  assert.deepEqual(after.combo[2], ['KC_X', 'KC_C', 'KC_NO', 'KC_NO', 'KC_V']);
  assert.deepEqual(after.tap_dance[2], ['KC_1', 'KC_2', 'KC_NO', 'KC_NO', 250]);
  assert.equal(after.key_override[1].trigger, 'KC_ESCAPE');
  assert.equal(after.layout_options, 0);

  simulator.log.length = 0;
  await keyboard.apply(after);
  assert.equal(simulator.writes().length, 0, 'applying the current state writes nothing');
});

test('an invalid keycode anywhere stops the write before anything is sent', async () => {
  const simulator = richSimulator();
  const target = richTarget(vitalySave);
  target.combo[3] = ['KC_A', 'KC_NOT_A_KEY', 'KC_NO', 'KC_NO', 'KC_B'];
  await assert.rejects(connect(simulator).apply(target), (error) => error.code === 'INVALID_STATE' && /combo 3/.test(error.message));
  assert.equal(simulator.writes().length, 0);
});

test('macro and QMK setting changes are refused instead of silently dropped', async () => {
  const simulator = richSimulator();
  const target = parseKeymapState(vitalySave);
  target.macro[0] = [['text', 'bye']];
  await assert.rejects(connect(simulator).apply(target), { code: 'UNSUPPORTED' });
  const settings = parseKeymapState(vitalySave);
  settings.settings['7'] = 150;
  await assert.rejects(connect(simulator).apply(settings), { code: 'UNSUPPORTED' });
  assert.equal(simulator.writes().length, 0);
});

test('unchanged keycodes vitaly cannot parse back do not block a write', async () => {
  const simulator = richSimulator();
  simulator.setKey(3, 0, 0, 0x2004); // a mod-tap without mods: "MT(KC_NO,KC_A)"
  const keyboard = connect(simulator);
  const target = await keyboard.snapshot();
  assert.equal(target.layout[3][0][0], 'MT(KC_NO,KC_A)');
  target.layout[3][0][1] = 'KC_B';
  await keyboard.apply(target);
  assert.equal(simulator.key(3, 0, 1), 0x05);
  assert.equal(simulator.key(3, 0, 0), 0x2004);
});

test('numeric layout entries (Vial -1 placeholders) are left alone', async () => {
  const simulator = richSimulator();
  const target = parseKeymapState(vitalySave);
  target.layout[0][0][0] = -1;
  await connect(simulator).apply(target);
  assert.equal(simulator.writes().length, 0);
  assert.equal(simulator.key(0, 0, 0), 0x29);
});

test('bootloader key needs an unlocked keyboard; unlocking follows the hold-keys flow', async () => {
  const simulator = createSimulatedKeyboard();
  const keyboard = connect(simulator);
  const target = await keyboard.snapshot();
  target.layout[0][0][0] = 'QK_BOOT';
  await assert.rejects(keyboard.apply(target), { code: 'LOCKED' });
  assert.equal(simulator.writes().length, 0);

  const status = await keyboard.lockStatus();
  assert.deepEqual(status, { locked: true, unlockInProgress: false, unlockKeys: [[0, 0], [1, 2]] });

  simulator.state.holdingUnlockKeys = false;
  let clock = 0;
  const impatient = connect(simulator, { now: () => { clock += 1000; return clock; } });
  await assert.rejects(impatient.unlock({ timeoutMs: 3000 }), { code: 'UNLOCK_TIMEOUT' });

  simulator.state.holdingUnlockKeys = true;
  const progress = [];
  const unlocked = await keyboard.unlock({ onProgress: (event) => progress.push(event.remaining) });
  assert.equal(unlocked.locked, false);
  assert.deepEqual(progress, [4, 3, 2, 1, 0]);

  await keyboard.apply(target);
  assert.equal(simulator.key(0, 0, 0), 0x7c00);
  assert.equal((await keyboard.lock()).locked, true);
});

test('keyboards with VIA instead of Vial are refused with a clear message', async () => {
  const simulator = createSimulatedKeyboard();
  const handle = simulator.handle;
  const viaOnly = { handle: (message) => (message[0] === 0xfe ? Uint8Array.from([0xff, ...new Array(31).fill(0)]) : handle(message)) };
  await assert.rejects(connect(viaOnly).snapshot(), { code: 'NOT_VIAL' });
});

test('older keycode numbering (Vial protocol 5) is used when the keyboard reports it', async () => {
  const simulator = createSimulatedKeyboard({ vialProtocol: 5, bootKeycode: 0x5c00 });
  simulator.setKey(0, 0, 0, 0x5101); // MO(1) in the old numbering
  const keyboard = connect(simulator);
  const snapshot = await keyboard.snapshot();
  assert.equal(snapshot.vial_protocol, 5);
  assert.equal(snapshot.layout[0][0][0], 'MO(1)');
  snapshot.layout[0][0][1] = 'LSFT_T(KC_A)';
  await keyboard.apply(snapshot);
  assert.equal(simulator.key(0, 0, 1), 0x6204);
});

test('macro buffer decoding keeps inner empty slots and drops the empty tail', () => {
  const buffer = Uint8Array.from([0x68, 0x69, 0, 0, 1, 1, 4, 0, 0, 0]);
  const macros = decodeMacros(buffer, 4);
  assert.deepEqual(macros, [[{ op: 'text', value: 'hi' }], [], [{ op: 'tap', value: 4 }]]);
  assert.deepEqual(decodeMacros(new Uint8Array(8), 4), []);
  assert.throws(() => decodeMacros(Uint8Array.from([1, 9, 4, 0]), 1), /unknown command/);
});

test('encoders are counted like vitaly does', () => {
  assert.equal(countEncoders([['0,0', '0,0\n\n\n\n\n\n\n\n\ne', '1,0\n\n\n\n\n\n\n\n\ne', '1,1\n\n\n\n\n\n\n\n\ne']]), 2);
  assert.equal(countEncoders([[{ w: 2 }, '0,1']]), 0);
});
