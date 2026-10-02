/**
 * Vial keyboard protocol: read and write a Keymap State over raw HID.
 *
 * Transport-independent like `vial-definition.js`: callers supply
 * `sendReceive(message)`, which writes one message (at most 32 bytes, padded
 * here) and resolves with the keyboard's 32-byte response. The web shell backs
 * it with WebHID.
 *
 * Produces and consumes the same Keymap State JSON as vitaly's `save`/`load`
 * commands, so the rest of the app does not care which shell talks to the
 * keyboard. Writing only sends what differs from the keyboard, and only the
 * sections KeymapSync edits (keys, encoders, layout options, combos, tap
 * dance, key overrides, alt repeat keys); macros and QMK settings are read for
 * backups but never written.
 *
 * Protocol references: vial-gui `protocol/*.py` (https://github.com/vial-kb/vial-gui,
 * GPL-2.0-or-later) and vitaly `src/protocol*.rs` (https://github.com/bskaplou/vitaly,
 * MIT License, Copyright (c) 2025 Boris Kaplunovsky).
 * @license GPL-3.0-or-later
 */
import { readKeyboardDefinition, MSG_LEN } from './vial-definition.js';
import { keycodeToName, nameToKeycode } from './vial-keycodes.js';

const CMD_VIA_GET_PROTOCOL_VERSION = 0x01;
const CMD_VIA_GET_KEYBOARD_VALUE = 0x02;
const CMD_VIA_SET_KEYBOARD_VALUE = 0x03;
const CMD_VIA_SET_KEYCODE = 0x05;
const CMD_VIA_MACRO_GET_COUNT = 0x0c;
const CMD_VIA_MACRO_GET_BUFFER_SIZE = 0x0d;
const CMD_VIA_MACRO_GET_BUFFER = 0x0e;
const CMD_VIA_GET_LAYER_COUNT = 0x11;
const CMD_VIA_KEYMAP_GET_BUFFER = 0x12;
const CMD_VIA_VIAL_PREFIX = 0xfe;
const VIA_UNHANDLED = 0xff;
const VIA_LAYOUT_OPTIONS = 0x02;

const HID_LAYERS_IN = 0x88;
const HID_LAYERS_GET_VERSION = 0x00;
const HID_LAYERS_OUT_VERSION = 0x91;

const CMD_VIAL_GET_KEYBOARD_ID = 0x00;
const CMD_VIAL_GET_ENCODER = 0x03;
const CMD_VIAL_SET_ENCODER = 0x04;
const CMD_VIAL_GET_UNLOCK_STATUS = 0x05;
const CMD_VIAL_UNLOCK_START = 0x06;
const CMD_VIAL_UNLOCK_POLL = 0x07;
const CMD_VIAL_LOCK = 0x08;
const CMD_VIAL_QMK_SETTINGS_QUERY = 0x09;
const CMD_VIAL_QMK_SETTINGS_GET = 0x0a;
const CMD_VIAL_DYNAMIC_ENTRY_OP = 0x0d;

const DYNAMIC_GET_NUMBER_OF_ENTRIES = 0x00;
const DYNAMIC_TAP_DANCE_GET = 0x01;
const DYNAMIC_TAP_DANCE_SET = 0x02;
const DYNAMIC_COMBO_GET = 0x03;
const DYNAMIC_COMBO_SET = 0x04;
const DYNAMIC_KEY_OVERRIDE_GET = 0x05;
const DYNAMIC_KEY_OVERRIDE_SET = 0x06;
const DYNAMIC_ALT_REPEAT_KEY_GET = 0x07;
const DYNAMIC_ALT_REPEAT_KEY_SET = 0x08;

const VIAL_PROTOCOL_DYNAMIC = 4;
const VIAL_PROTOCOL_QMK_SETTINGS = 4;
const BUFFER_FETCH_CHUNK = 28;

// Byte width of each QMK setting (qsid), from vial-gui/vitaly `qmk_settings.json`.
const QMK_SETTING_WIDTHS = {
  1: 1, 2: 2, 3: 1, 4: 2, 5: 1, 6: 2, 7: 2, 8: 1, 9: 2, 10: 2, 11: 2, 12: 2, 13: 2, 14: 2,
  15: 2, 16: 2, 17: 2, 18: 2, 19: 2, 20: 1, 21: 4, 22: 1, 23: 1, 24: 1, 25: 2, 26: 1, 27: 2,
};

// Macro byte codes (QMK send_string plus Vial's 2-byte keycode extension).
const SS_QMK_PREFIX = 1;
const SS_TAP_CODE = 1;
const SS_DOWN_CODE = 2;
const SS_UP_CODE = 3;
const SS_DELAY_CODE = 4;
const VIAL_MACRO_EXT_TAP = 5;
const VIAL_MACRO_EXT_DOWN = 6;
const VIAL_MACRO_EXT_UP = 7;

const KEY_OVERRIDE_OPTION_BITS = 0xbf; // bit 6 is unused
const ALT_REPEAT_OPTION_BITS = 0x0f;

class VialProtocolError extends Error {
  constructor(message, code = 'PROTOCOL') {
    super(message);
    this.name = 'VialProtocolError';
    this.code = code;
  }
}

const le16 = (data, offset) => data[offset] | (data[offset + 1] << 8);
const be16 = (data, offset) => (data[offset] << 8) | data[offset + 1];
const le32 = (data, offset) => (le16(data, offset) | (le16(data, offset + 2) << 16)) >>> 0;
const be32 = (data, offset) => ((be16(data, offset) << 16) | be16(data, offset + 2)) >>> 0;
const lo = (value) => value & 0xff;
const hi = (value) => (value >> 8) & 0xff;

/** Number of rotary encoders declared in a KLE keymap (vitaly's rule). */
function countEncoders(keymap) {
  let count = 0;
  for (const row of Array.isArray(keymap) ? keymap : []) {
    for (const item of Array.isArray(row) ? row : []) {
      if (typeof item !== 'string') continue;
      const parts = item.split('\n');
      if (parts.length <= 9 || !parts[9].startsWith('e')) continue;
      const [index, direction] = parts[0].split(',');
      if (direction === '0' && /^\d+$/.test(index)) count = Math.max(count, Number(index) + 1);
    }
  }
  return count;
}

/** Split a raw macro buffer into macros of { op, value } steps. */
function decodeMacros(buffer, count) {
  const macros = [];
  let start = 0;
  for (let i = 0; i < buffer.length && macros.length < count; i += 1) {
    if (buffer[i] !== 0) continue;
    macros.push(decodeMacro(buffer.subarray(start, i), macros.length));
    start = i + 1;
  }
  // vitaly stops at the first empty macro; we keep inner empty slots so no
  // macro is lost from a backup, but drop the empty tail just like vitaly.
  while (macros.length && macros[macros.length - 1].length === 0) macros.pop();
  return macros;
}

function decodeMacro(data, index) {
  const steps = [];
  const text = new TextDecoder('utf-8', { fatal: true });
  let i = 0;
  while (i < data.length) {
    if (data[i] !== SS_QMK_PREFIX) {
      let end = i;
      while (end < data.length && data[end] !== SS_QMK_PREFIX) end += 1;
      steps.push({ op: 'text', value: text.decode(data.subarray(i, end)) });
      i = end;
      continue;
    }
    const command = data[i + 1];
    if (command === SS_TAP_CODE || command === SS_DOWN_CODE || command === SS_UP_CODE) {
      if (i + 2 >= data.length) throw new VialProtocolError(`Macro ${index} is truncated.`);
      steps.push({ op: { 1: 'tap', 2: 'down', 3: 'up' }[command], value: data[i + 2] });
      i += 3;
    } else if ([SS_DELAY_CODE, VIAL_MACRO_EXT_TAP, VIAL_MACRO_EXT_DOWN, VIAL_MACRO_EXT_UP].includes(command)) {
      if (i + 3 >= data.length) throw new VialProtocolError(`Macro ${index} is truncated.`);
      const [arg1, arg2] = [data[i + 2], data[i + 3]];
      if (command === SS_DELAY_CODE) {
        steps.push({ op: 'delay', value: (arg2 - 1) * 255 + (arg1 - 1) });
      } else {
        let keycode = arg1 | (arg2 << 8);
        if (keycode > 0xff00) keycode = (keycode & 0xff) << 8;
        steps.push({ op: { 5: 'tap', 6: 'down', 7: 'up' }[command], value: keycode });
      }
      i += 4;
    } else {
      throw new VialProtocolError(`Macro ${index} has unknown command ${command}.`);
    }
  }
  return steps;
}

function macrosToJson(macros, vialProtocol) {
  return macros.map((steps) => steps.map(({ op, value }) => {
    if (op === 'text' || op === 'delay') return [op, value];
    return [op, keycodeToName(value, vialProtocol)];
  }));
}

/**
 * @param {(message: number[]) => Promise<ArrayLike<number>>} sendReceive
 * @param {{ decompress?: object, sleep?: (ms: number) => Promise<void>, now?: () => number }} [options]
 */
function createVialKeyboard(sendReceive, options = {}) {
  const sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const now = options.now || (() => Date.now());
  let definitionPromise = null;

  async function command(...bytes) {
    if (bytes.length > MSG_LEN) throw new VialProtocolError('Message is longer than 32 bytes.');
    const message = new Array(MSG_LEN).fill(0);
    bytes.forEach((byte, i) => { message[i] = byte & 0xff; });
    const response = await sendReceive(message);
    if (!response || response.length < MSG_LEN) throw new VialProtocolError('Short response from keyboard.');
    return Uint8Array.from(Array.from(response).slice(0, MSG_LEN));
  }

  async function handled(...bytes) {
    const response = await command(...bytes);
    if (response[0] === VIA_UNHANDLED) {
      throw new VialProtocolError(`Keyboard does not support command 0x${bytes[0].toString(16)}.`, 'UNHANDLED');
    }
    return response;
  }

  /** Same fields as `vitaly devices -c`. */
  async function readCapabilities() {
    const viaVersion = (await command(CMD_VIA_GET_PROTOCOL_VERSION))[2];
    const id = await command(CMD_VIA_VIAL_PREFIX, CMD_VIAL_GET_KEYBOARD_ID);
    const vialVersion = id[0] === VIA_UNHANDLED ? 0 : le32(id, 0);
    const layersVersion = await command(HID_LAYERS_IN, HID_LAYERS_GET_VERSION);
    const layers = viaVersion === 0 ? null : await command(CMD_VIA_GET_LAYER_COUNT);
    const macroCount = await command(CMD_VIA_MACRO_GET_COUNT);
    const macroSize = await command(CMD_VIA_MACRO_GET_BUFFER_SIZE);
    const capabilities = {
      via_version: viaVersion,
      vial_version: vialVersion,
      companion_hid_version: layersVersion[0] === HID_LAYERS_OUT_VERSION ? layersVersion[1] : 0,
      layer_count: layers && layers[0] !== VIA_UNHANDLED ? layers[1] : 0,
      macro_count: macroCount[0] !== VIA_UNHANDLED ? macroCount[1] : 0,
      macro_buffer_size: macroSize[0] !== VIA_UNHANDLED ? be16(macroSize, 1) : 0,
      tap_dance_count: 0,
      combo_count: 0,
      key_override_count: 0,
      alt_repeat_key_count: 0,
      caps_word: false,
      layer_lock: false,
    };
    if (vialVersion < VIAL_PROTOCOL_DYNAMIC) return capabilities;
    const counts = await handled(CMD_VIA_VIAL_PREFIX, CMD_VIAL_DYNAMIC_ENTRY_OP, DYNAMIC_GET_NUMBER_OF_ENTRIES);
    return {
      ...capabilities,
      tap_dance_count: counts[0],
      combo_count: counts[1],
      key_override_count: counts[2],
      alt_repeat_key_count: counts[3],
      caps_word: (counts[31] & 1) !== 0,
      layer_lock: (counts[31] & 2) !== 0,
    };
  }

  /** Keyboard UID as a decimal string (it does not fit a JS number). */
  async function readUid() {
    const data = await command(CMD_VIA_VIAL_PREFIX, CMD_VIAL_GET_KEYBOARD_ID);
    let uid = 0n;
    for (let i = 11; i >= 4; i -= 1) uid = (uid << 8n) | BigInt(data[i]);
    return uid.toString();
  }

  /** The keyboard's compressed vial.json; read once per connection. */
  function readDefinition() {
    if (!definitionPromise) {
      if (!options.decompress) throw new VialProtocolError('No decompressor available for the keyboard definition.');
      definitionPromise = readKeyboardDefinition((message) => sendReceive(message), options.decompress)
        .then((result) => {
          if (!result.ok) throw new VialProtocolError(result.error);
          return result.definition;
        });
      definitionPromise.catch(() => { definitionPromise = null; });
    }
    return definitionPromise;
  }

  async function readLayoutOptions() {
    return be32(await handled(CMD_VIA_GET_KEYBOARD_VALUE, VIA_LAYOUT_OPTIONS), 2);
  }

  async function readKeymapBuffer(size) {
    const keys = new Uint8Array(size);
    for (let offset = 0; offset < size; offset += BUFFER_FETCH_CHUNK) {
      const length = Math.min(size - offset, BUFFER_FETCH_CHUNK);
      const data = await handled(CMD_VIA_KEYMAP_GET_BUFFER, hi(offset), lo(offset), length);
      keys.set(data.subarray(4, 4 + length), offset);
    }
    return keys;
  }

  async function readDynamic(type, count, decode) {
    const entries = [];
    for (let index = 0; index < count; index += 1) {
      entries.push(decode(await handled(CMD_VIA_VIAL_PREFIX, CMD_VIAL_DYNAMIC_ENTRY_OP, type, index)));
    }
    return entries;
  }

  async function readMacroBuffer(count, size) {
    const buffer = new Uint8Array(size);
    let zeros = 0;
    for (let offset = 0; offset < size && zeros < count; offset += BUFFER_FETCH_CHUNK) {
      const length = Math.min(size - offset, BUFFER_FETCH_CHUNK);
      const data = await handled(CMD_VIA_MACRO_GET_BUFFER, hi(offset), lo(offset), length);
      const chunk = data.subarray(4, 4 + length);
      buffer.set(chunk, offset);
      zeros += chunk.filter((byte) => byte === 0).length;
    }
    return buffer;
  }

  async function readQmkSettings() {
    const supported = new Set();
    let cursor = 0;
    for (let guard = 0; guard < 0x10000; guard += 1) {
      const data = await command(CMD_VIA_VIAL_PREFIX, CMD_VIAL_QMK_SETTINGS_QUERY, lo(cursor), hi(cursor));
      let done = false;
      let next = cursor;
      for (let i = 0; i < MSG_LEN / 2; i += 1) {
        const qsid = le16(data, i * 2);
        if (qsid === 0xffff) { done = true; break; }
        supported.add(qsid);
        next = Math.max(next, qsid);
      }
      if (done) break;
      if (next === cursor) throw new VialProtocolError('QMK settings query did not advance.');
      cursor = next;
    }
    const settings = {};
    for (const qsid of [...supported].sort((a, b) => a - b)) {
      const width = QMK_SETTING_WIDTHS[qsid];
      if (!width) continue;
      const data = await command(CMD_VIA_VIAL_PREFIX, CMD_VIAL_QMK_SETTINGS_GET, lo(qsid), hi(qsid));
      if (data[0] !== 0) throw new VialProtocolError(`Reading QMK setting ${qsid} failed.`);
      settings[qsid] = width === 1 ? data[1] : width === 2 ? le16(data, 1) : le32(data, 1);
    }
    return settings;
  }

  /** Everything the keyboard holds, as numbers (no names yet). */
  async function readRaw() {
    const capabilities = await readCapabilities();
    if (capabilities.vial_version === 0) {
      throw new VialProtocolError('This keyboard uses VIA, not Vial. KeymapSync needs Vial firmware.', 'NOT_VIAL');
    }
    const definition = await readDefinition();
    const rows = definition?.matrix?.rows;
    const cols = definition?.matrix?.cols;
    if (!Number.isInteger(rows) || !Number.isInteger(cols)) throw new VialProtocolError('Keyboard definition has no matrix size.');
    const layers = capabilities.layer_count;
    const encoderCount = countEncoders(definition?.layouts?.keymap);
    const uid = await readUid();

    const encoders = [];
    for (let layer = 0; layer < layers; layer += 1) {
      const row = [];
      for (let index = 0; index < encoderCount; index += 1) {
        const data = await command(CMD_VIA_VIAL_PREFIX, CMD_VIAL_GET_ENCODER, layer, index);
        row.push([be16(data, 0), be16(data, 2)]);
      }
      encoders.push(row);
    }

    const buffer = await readKeymapBuffer(layers * rows * cols * 2);
    const keys = [];
    for (let layer = 0; layer < layers; layer += 1) {
      keys.push(Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (__, col) => (
        be16(buffer, ((layer * rows + row) * cols + col) * 2)
      ))));
    }

    const combos = await readDynamic(DYNAMIC_COMBO_GET, capabilities.combo_count, (d) => [1, 3, 5, 7, 9].map((i) => le16(d, i)));
    const tapDances = await readDynamic(DYNAMIC_TAP_DANCE_GET, capabilities.tap_dance_count, (d) => [1, 3, 5, 7, 9].map((i) => le16(d, i)));
    const macroBuffer = await readMacroBuffer(capabilities.macro_count, capabilities.macro_buffer_size);
    const keyOverrides = await readDynamic(DYNAMIC_KEY_OVERRIDE_GET, capabilities.key_override_count, (d) => ({
      trigger: le16(d, 1),
      replacement: le16(d, 3),
      layers: le16(d, 5),
      trigger_mods: d[7],
      negative_mod_mask: d[8],
      suppressed_mods: d[9],
      options: d[10] & KEY_OVERRIDE_OPTION_BITS,
    }));
    const altRepeats = await readDynamic(DYNAMIC_ALT_REPEAT_KEY_GET, capabilities.alt_repeat_key_count, (d) => ({
      keycode: le16(d, 1),
      alt_keycode: le16(d, 3),
      allowed_mods: d[5],
      options: d[6] & ALT_REPEAT_OPTION_BITS,
    }));
    const settings = capabilities.vial_version >= VIAL_PROTOCOL_QMK_SETTINGS ? await readQmkSettings() : {};
    const layoutOptions = definition?.layouts?.labels == null ? -1 : await readLayoutOptions();

    return {
      capabilities, definition, rows, cols, uid, keys, encoders, combos, tapDances,
      macros: decodeMacros(macroBuffer, capabilities.macro_count), keyOverrides, altRepeats, settings, layoutOptions,
    };
  }

  function rawToState(raw) {
    const version = raw.capabilities.vial_version;
    const name = (keycode) => keycodeToName(keycode, version);
    // Keys in the same (alphabetical) order vitaly writes them.
    const state = {};
    if (raw.altRepeats.length) {
      state.alt_repeat_key = raw.altRepeats.map((entry) => ({
        allowed_mods: entry.allowed_mods,
        alt_keycode: name(entry.alt_keycode),
        keycode: name(entry.keycode),
        options: entry.options,
      }));
    }
    if (raw.combos.length) state.combo = raw.combos.map((entry) => entry.map(name));
    state.encoder_layout = raw.encoders.map((layer) => layer.map((pair) => pair.map(name)));
    if (raw.keyOverrides.length) {
      state.key_override = raw.keyOverrides.map((entry) => ({
        layers: entry.layers,
        negative_mod_mask: entry.negative_mod_mask,
        options: entry.options,
        replacement: name(entry.replacement),
        suppressed_mods: entry.suppressed_mods,
        trigger: name(entry.trigger),
        trigger_mods: entry.trigger_mods,
      }));
    }
    state.layout = raw.keys.map((layer) => layer.map((row) => row.map(name)));
    state.layout_options = raw.layoutOptions;
    state.macro = macrosToJson(raw.macros, version);
    if (Object.keys(raw.settings).length) state.settings = { ...raw.settings };
    if (raw.tapDances.length) state.tap_dance = raw.tapDances.map((entry) => [...entry.slice(0, 4).map(name), entry[4]]);
    state.uid = raw.uid;
    state.version = 1;
    state.via_protocol = raw.capabilities.via_version;
    if (version > 0) state.vial_protocol = version;
    return state;
  }

  /** Read the full Keymap State (same JSON as `vitaly save`). */
  async function snapshot() {
    return rawToState(await readRaw());
  }

  /**
   * Work out every write needed to turn the keyboard into `target`.
   * Validates the whole target first; nothing is sent from here.
   */
  function planWrites(raw, target) {
    const version = raw.capabilities.vial_version;
    // An unchanged name is never parsed: vitaly prints a few odd keycodes
    // (e.g. `MT(KC_NO,KC_A)`) that it cannot read back, and those must not
    // block writing the rest of the keyboard.
    const code = (value, where, currentCode) => {
      if (currentCode !== undefined && value === keycodeToName(currentCode, version)) return currentCode;
      try {
        return nameToKeycode(value, version);
      } catch (error) {
        throw new VialProtocolError(`${where}: ${error.message}`, 'INVALID_STATE');
      }
    };
    const integer = (value, max, where) => {
      if (!Number.isInteger(value) || value < 0 || value > max) {
        throw new VialProtocolError(`${where}: expected a number from 0 to ${max}.`, 'INVALID_STATE');
      }
      return value;
    };
    const list = (value, where) => {
      if (value === undefined) return null;
      if (!Array.isArray(value)) throw new VialProtocolError(`${where} must be an array.`, 'INVALID_STATE');
      return value;
    };
    const writes = [];
    const current = rawToState(raw);
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

    // Never silently drop a change to something this shell does not write.
    if (target.macro !== undefined && !same(target.macro, current.macro)) {
      throw new VialProtocolError('Writing macros is not supported in the web version.', 'UNSUPPORTED');
    }
    if (target.settings !== undefined && !same(target.settings, current.settings || {})) {
      throw new VialProtocolError('Writing QMK settings is not supported in the web version.', 'UNSUPPORTED');
    }

    if (Number.isInteger(target.layout_options) && target.layout_options !== -1 && raw.layoutOptions !== -1
      && (target.layout_options >>> 0) !== raw.layoutOptions) {
      const options = target.layout_options >>> 0;
      writes.push({
        kind: 'layout_options',
        message: [CMD_VIA_SET_KEYBOARD_VALUE, VIA_LAYOUT_OPTIONS, (options >>> 24) & 0xff, (options >>> 16) & 0xff, hi(options), lo(options)],
        keycodes: [],
      });
    }

    (list(target.key_override, 'key_override') || []).slice(0, raw.keyOverrides.length).forEach((entry, index) => {
      const where = `key_override ${index}`;
      if (!entry || typeof entry !== 'object') throw new VialProtocolError(`${where} must be an object.`, 'INVALID_STATE');
      const next = {
        trigger: code(entry.trigger ?? 'KC_NO', where, raw.keyOverrides[index].trigger),
        replacement: code(entry.replacement ?? 'KC_NO', where, raw.keyOverrides[index].replacement),
        layers: integer(entry.layers ?? 0, 0xffff, where),
        trigger_mods: integer(entry.trigger_mods ?? 0, 0xff, where),
        negative_mod_mask: integer(entry.negative_mod_mask ?? 0, 0xff, where),
        suppressed_mods: integer(entry.suppressed_mods ?? 0, 0xff, where),
        options: integer(entry.options ?? 0, 0xff, where) & KEY_OVERRIDE_OPTION_BITS,
      };
      if (same(next, raw.keyOverrides[index])) return;
      writes.push({
        kind: 'key_override',
        message: [CMD_VIA_VIAL_PREFIX, CMD_VIAL_DYNAMIC_ENTRY_OP, DYNAMIC_KEY_OVERRIDE_SET, index,
          lo(next.trigger), hi(next.trigger), lo(next.replacement), hi(next.replacement), lo(next.layers), hi(next.layers),
          next.trigger_mods, next.negative_mod_mask, next.suppressed_mods, next.options],
        keycodes: [next.replacement],
      });
    });

    (list(target.alt_repeat_key, 'alt_repeat_key') || []).slice(0, raw.altRepeats.length).forEach((entry, index) => {
      const where = `alt_repeat_key ${index}`;
      if (!entry || typeof entry !== 'object') throw new VialProtocolError(`${where} must be an object.`, 'INVALID_STATE');
      const next = {
        keycode: code(entry.keycode ?? 'KC_NO', where, raw.altRepeats[index].keycode),
        alt_keycode: code(entry.alt_keycode ?? 'KC_NO', where, raw.altRepeats[index].alt_keycode),
        allowed_mods: integer(entry.allowed_mods ?? 0, 0xff, where),
        options: integer(entry.options ?? 0, 0xff, where) & ALT_REPEAT_OPTION_BITS,
      };
      if (same(next, raw.altRepeats[index])) return;
      writes.push({
        kind: 'alt_repeat_key',
        message: [CMD_VIA_VIAL_PREFIX, CMD_VIAL_DYNAMIC_ENTRY_OP, DYNAMIC_ALT_REPEAT_KEY_SET, index,
          lo(next.keycode), hi(next.keycode), lo(next.alt_keycode), hi(next.alt_keycode), next.allowed_mods, next.options],
        keycodes: [next.keycode, next.alt_keycode],
      });
    });

    const fiveWords = (section, rawEntries, type, lastIsNumber) => {
      (list(target[section], section) || []).slice(0, rawEntries.length).forEach((entry, index) => {
        const where = `${section} ${index}`;
        if (!Array.isArray(entry) || entry.length > 5) throw new VialProtocolError(`${where} must be an array of 5 values.`, 'INVALID_STATE');
        const next = [0, 1, 2, 3, 4].map((i) => (
          lastIsNumber && i === 4 ? integer(entry[4] ?? 0, 0xffff, where) : code(entry[i] ?? 'KC_NO', where, rawEntries[index][i])
        ));
        if (same(next, rawEntries[index])) return;
        writes.push({
          kind: section,
          message: [CMD_VIA_VIAL_PREFIX, CMD_VIAL_DYNAMIC_ENTRY_OP, type, index, ...next.flatMap((value) => [lo(value), hi(value)])],
          keycodes: lastIsNumber ? next.slice(0, 4) : next,
        });
      });
    };
    fiveWords('combo', raw.combos, DYNAMIC_COMBO_SET, false);
    fiveWords('tap_dance', raw.tapDances, DYNAMIC_TAP_DANCE_SET, true);

    (list(target.encoder_layout, 'encoder_layout') || []).slice(0, raw.encoders.length).forEach((layer, layerIndex) => {
      (list(layer, `encoder_layout ${layerIndex}`) || []).slice(0, raw.encoders[layerIndex].length).forEach((pair, index) => {
        const where = `encoder ${index} on layer ${layerIndex}`;
        if (!Array.isArray(pair) || pair.length !== 2) throw new VialProtocolError(`${where} must have two values.`, 'INVALID_STATE');
        pair.forEach((value, direction) => {
          const next = code(value, where, raw.encoders[layerIndex][index][direction]);
          if (next === raw.encoders[layerIndex][index][direction]) return;
          writes.push({
            kind: 'encoder_layout',
            message: [CMD_VIA_VIAL_PREFIX, CMD_VIAL_SET_ENCODER, layerIndex, index, direction, hi(next), lo(next)],
            keycodes: [next],
          });
        });
      });
    });

    (list(target.layout, 'layout') || []).slice(0, raw.keys.length).forEach((layer, layerIndex) => {
      (list(layer, `layout ${layerIndex}`) || []).slice(0, raw.rows).forEach((row, rowIndex) => {
        (list(row, `layout ${layerIndex}/${rowIndex}`) || []).slice(0, raw.cols).forEach((value, colIndex) => {
          // Numbers mark matrix positions without a key (Vial writes -1); leave them alone.
          if (typeof value === 'number') return;
          const next = code(value, `key L${layerIndex} R${rowIndex} C${colIndex}`, raw.keys[layerIndex][rowIndex][colIndex]);
          if (next === raw.keys[layerIndex][rowIndex][colIndex]) return;
          writes.push({
            kind: 'layout',
            message: [CMD_VIA_SET_KEYCODE, layerIndex, rowIndex, colIndex, hi(next), lo(next)],
            keycodes: [next],
          });
        });
      });
    });
    return writes;
  }

  async function lockStatus() {
    const data = await command(CMD_VIA_VIAL_PREFIX, CMD_VIAL_GET_UNLOCK_STATUS);
    const unlockKeys = [];
    for (let i = 0; i < 15; i += 1) {
      const [row, col] = [data[2 + i * 2], data[3 + i * 2]];
      if (row !== 255 && col !== 255) unlockKeys.push([row, col]);
    }
    return { locked: data[0] === 0, unlockInProgress: data[1] === 1, unlockKeys };
  }

  /**
   * Write `target` to the keyboard. Only differences are sent. Resolves with
   * the number of writes per section.
   */
  async function apply(target) {
    if (!target || typeof target !== 'object' || Array.isArray(target)) {
      throw new VialProtocolError('Keymap State must be an object.', 'INVALID_STATE');
    }
    const raw = await readRaw();
    const writes = planWrites(raw, target);
    const boot = nameToKeycode('QK_BOOT', raw.capabilities.vial_version);
    // Vial firmware refuses bootloader keys while locked; say so instead of failing silently.
    if (writes.some((write) => write.keycodes.includes(boot)) && (await lockStatus()).locked) {
      throw new VialProtocolError('The keyboard is locked. Unlock it before assigning the bootloader key (QK_BOOT).', 'LOCKED');
    }
    const summary = {};
    for (const write of writes) {
      const response = await command(...write.message);
      if (response[0] === VIA_UNHANDLED) throw new VialProtocolError(`The keyboard rejected a ${write.kind} change.`, 'UNHANDLED');
      summary[write.kind] = (summary[write.kind] || 0) + 1;
    }
    return summary;
  }

  /** Hold the keyboard's unlock keys until it reports unlocked. */
  async function unlock({ onProgress = () => {}, pollMs = 100, timeoutMs = 60000 } = {}) {
    let status = await lockStatus();
    if (!status.locked) return status;
    if (!status.unlockInProgress) await command(CMD_VIA_VIAL_PREFIX, CMD_VIAL_UNLOCK_START);
    const started = now();
    for (;;) {
      await sleep(pollMs);
      const data = await command(CMD_VIA_VIAL_PREFIX, CMD_VIAL_UNLOCK_POLL);
      onProgress({ unlocked: data[0] === 1, remaining: data[2], unlockKeys: status.unlockKeys });
      if (data[0] === 1) break;
      if (now() - started > timeoutMs) throw new VialProtocolError('Unlocking timed out. Hold all highlighted keys together.', 'UNLOCK_TIMEOUT');
    }
    status = await lockStatus();
    return status;
  }

  async function lock() {
    await command(CMD_VIA_VIAL_PREFIX, CMD_VIAL_LOCK);
    return lockStatus();
  }

  return {
    readCapabilities, readUid, readDefinition, readLayoutOptions, snapshot, apply, lockStatus, unlock, lock,
  };
}

export { createVialKeyboard, countEncoders, decodeMacros, VialProtocolError };
