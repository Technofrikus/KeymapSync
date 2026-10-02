/*
 * A simulated Vial keyboard for tests: answers the raw HID commands the way
 * Vial firmware does (vial-qmk `quantum/via.c` and `quantum/vial.c`), and a
 * fake WebHID device / `navigator.hid` around it. Plain ES module without
 * Node APIs, so the same simulator runs in Node tests and in the browser.
 */
import { DEFINITION_XZ_BASE64 } from './test-keyboard-definition.js';

const MSG_LEN = 32;
const UNHANDLED = 0xff;

function base64ToBytes(text) {
  const binary = atob(text);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

const be16 = (data, i) => (data[i] << 8) | data[i + 1];
const le16 = (data, i) => data[i] | (data[i + 1] << 8);
const putBe16 = (data, i, value) => { data[i] = (value >> 8) & 0xff; data[i + 1] = value & 0xff; };
const putLe16 = (data, i, value) => { data[i] = value & 0xff; data[i + 1] = (value >> 8) & 0xff; };

/**
 * @param {object} [options] Initial keyboard contents; every field optional.
 */
function createSimulatedKeyboard(options = {}) {
  const rows = options.rows ?? 2;
  const cols = options.cols ?? 3;
  const layers = options.layers ?? 4;
  const encoderCount = options.encoderCount ?? 1;
  const bootKeycode = options.bootKeycode ?? 0x7c00; // QK_BOOT, keycode v6
  const state = {
    viaProtocol: options.viaProtocol ?? 9,
    vialProtocol: options.vialProtocol ?? 6,
    uid: options.uid ?? [0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef],
    definition: options.definition ?? base64ToBytes(DEFINITION_XZ_BASE64),
    keymap: new Uint16Array(layers * rows * cols),
    encoders: Array.from({ length: layers }, () => Array.from({ length: encoderCount }, () => [0, 0])),
    layoutOptions: options.layoutOptions ?? 0,
    combos: Array.from({ length: options.comboCount ?? 4 }, () => [0, 0, 0, 0, 0]),
    tapDances: Array.from({ length: options.tapDanceCount ?? 4 }, () => [0, 0, 0, 0, 200]),
    keyOverrides: Array.from({ length: options.keyOverrideCount ?? 2 }, () => new Uint8Array(10)),
    altRepeats: Array.from({ length: options.altRepeatCount ?? 1 }, () => new Uint8Array(6)),
    macroCount: options.macroCount ?? 4,
    macroBuffer: new Uint8Array(options.macroBufferSize ?? 64),
    settings: new Map(Object.entries(options.settings ?? { 2: 300, 7: 200, 21: 0x81 }).map(([k, v]) => [Number(k), v])),
    settingWidths: { 2: 2, 7: 2, 21: 4 },
    locked: options.locked ?? true,
    unlockKeys: options.unlockKeys ?? [[0, 0], [1, 2]],
    unlockInProgress: false,
    unlockCounter: 0,
    holdingUnlockKeys: true,
  };
  if (options.keymap) state.keymap.set(options.keymap);
  if (options.macroBuffer) state.macroBuffer.set(options.macroBuffer);
  const log = [];

  const keymapBytes = () => {
    const bytes = new Uint8Array(state.keymap.length * 2);
    state.keymap.forEach((code, i) => putBe16(bytes, i * 2, code));
    return bytes;
  };
  // Vial refuses the bootloader key while locked.
  const allowed = (code) => !(state.locked && code === bootKeycode);

  function handleVial(data) {
    switch (data[1]) {
      case 0x00: { // get keyboard id
        new DataView(data.buffer).setUint32(0, state.vialProtocol, true);
        data.set(state.uid, 4);
        return;
      }
      case 0x01: new DataView(data.buffer).setUint32(0, state.definition.length, true); return;
      case 0x02: { // get definition block
        const block = new DataView(data.buffer).getUint32(2, true);
        data.fill(0);
        data.set(state.definition.subarray(block * MSG_LEN, (block + 1) * MSG_LEN));
        return;
      }
      case 0x03: { // get encoder
        const [cw, ccw] = state.encoders[data[2]]?.[data[3]] ?? [0, 0];
        putBe16(data, 0, cw);
        putBe16(data, 2, ccw);
        return;
      }
      case 0x04: { // set encoder
        const code = be16(data, 5);
        if (allowed(code)) state.encoders[data[2]][data[3]][data[4]] = code;
        return;
      }
      case 0x05: { // unlock status
        data.fill(0xff, 2);
        data[0] = state.locked ? 0 : 1;
        data[1] = state.unlockInProgress ? 1 : 0;
        state.unlockKeys.forEach(([row, col], i) => { data[2 + i * 2] = row; data[3 + i * 2] = col; });
        return;
      }
      case 0x06: state.unlockInProgress = true; state.unlockCounter = 5; return;
      case 0x07: { // unlock poll: counts down while the keys are held
        if (state.unlockInProgress) {
          state.unlockCounter = state.holdingUnlockKeys ? state.unlockCounter - 1 : 5;
          if (state.unlockCounter <= 0) { state.locked = false; state.unlockInProgress = false; }
        }
        data[0] = state.locked ? 0 : 1;
        data[1] = state.unlockInProgress ? 1 : 0;
        data[2] = Math.max(state.unlockCounter, 0);
        return;
      }
      case 0x08: state.locked = true; return;
      case 0x09: { // QMK settings query: ids above the cursor, 0xFFFF terminated
        const cursor = le16(data, 2);
        const ids = [...state.settings.keys()].filter((id) => id > cursor).sort((a, b) => a - b);
        for (let i = 0; i < 16; i += 1) putLe16(data, i * 2, ids[i] ?? 0xffff);
        return;
      }
      case 0x0a: { // QMK settings get
        const qsid = le16(data, 2);
        if (!state.settings.has(qsid)) { data[0] = 1; return; }
        data[0] = 0;
        new DataView(data.buffer).setUint32(1, state.settings.get(qsid), true);
        return;
      }
      case 0x0b: { // QMK settings set
        const qsid = le16(data, 2);
        if (!state.settings.has(qsid)) { data[0] = 1; return; }
        state.settings.set(qsid, new DataView(data.buffer).getUint32(4, true));
        data[0] = 0;
        return;
      }
      case 0x0d: return handleDynamic(data);
      default: data[0] = UNHANDLED;
    }
  }

  function handleDynamic(data) {
    const index = data[3];
    const words = (entry) => { data[0] = 0; entry.forEach((value, i) => putLe16(data, 1 + i * 2, value)); };
    const setWords = (list) => {
      if (!list[index]) { data[0] = UNHANDLED; return; }
      const next = [0, 1, 2, 3, 4].map((i) => le16(data, 4 + i * 2));
      list[index] = next.map((code, i) => (allowed(code) ? code : list[index][i]));
      data[0] = 0;
    };
    switch (data[2]) {
      case 0x00:
        data[0] = state.tapDances.length;
        data[1] = state.combos.length;
        data[2] = state.keyOverrides.length;
        data[3] = state.altRepeats.length;
        data[31] = 0x01; // caps word
        return;
      case 0x01: return state.tapDances[index] ? words(state.tapDances[index]) : (data[0] = UNHANDLED);
      case 0x02: return setWords(state.tapDances);
      case 0x03: return state.combos[index] ? words(state.combos[index]) : (data[0] = UNHANDLED);
      case 0x04: return setWords(state.combos);
      case 0x05:
        if (!state.keyOverrides[index]) { data[0] = UNHANDLED; return; }
        data[0] = 0;
        data.set(state.keyOverrides[index], 1);
        return;
      case 0x06:
        if (!state.keyOverrides[index]) { data[0] = UNHANDLED; return; }
        state.keyOverrides[index] = data.slice(4, 14);
        data[0] = 0;
        return;
      case 0x07:
        if (!state.altRepeats[index]) { data[0] = UNHANDLED; return; }
        data[0] = 0;
        data.set(state.altRepeats[index], 1);
        return;
      case 0x08:
        if (!state.altRepeats[index]) { data[0] = UNHANDLED; return; }
        state.altRepeats[index] = data.slice(4, 10);
        data[0] = 0;
        return;
      default: data[0] = UNHANDLED;
    }
  }

  /** One raw HID exchange: 32 bytes in, 32 bytes out. */
  function handle(message) {
    const data = new Uint8Array(MSG_LEN);
    data.set(Array.from(message).slice(0, MSG_LEN));
    log.push(Array.from(data));
    switch (data[0]) {
      case 0x01: putBe16(data, 1, state.viaProtocol); break;
      case 0x02:
        if (data[1] === 0x02) new DataView(data.buffer).setUint32(2, state.layoutOptions, false);
        else data[0] = UNHANDLED;
        break;
      case 0x03:
        if (data[1] === 0x02) state.layoutOptions = new DataView(data.buffer).getUint32(2, false);
        else data[0] = UNHANDLED;
        break;
      case 0x05: {
        const [layer, row, col] = [data[1], data[2], data[3]];
        const code = be16(data, 4);
        if (layer < layers && row < rows && col < cols && allowed(code)) state.keymap[(layer * rows + row) * cols + col] = code;
        break;
      }
      case 0x0c: data[1] = state.macroCount; break;
      case 0x0d: putBe16(data, 1, state.macroBuffer.length); break;
      case 0x0e: {
        const offset = be16(data, 1);
        data.set(state.macroBuffer.subarray(offset, offset + Math.min(data[3], 28)), 4);
        break;
      }
      case 0x0f: { // macro set buffer: Vial only accepts it while unlocked
        const offset = be16(data, 1);
        if (!state.locked) state.macroBuffer.set(data.subarray(4, 4 + Math.min(data[3], 28)).subarray(0, state.macroBuffer.length - offset), offset);
        break;
      }
      case 0x11: data[1] = layers; break;
      case 0x12: {
        const offset = be16(data, 1);
        data.set(keymapBytes().subarray(offset, offset + Math.min(data[3], 28)), 4);
        break;
      }
      case 0xfe: handleVial(data); break;
      default: data[0] = UNHANDLED;
    }
    return data;
  }

  /** Plain JSON copy of everything stored on the keyboard. */
  function exportState() {
    return {
      keymap: Array.from(state.keymap),
      encoders: structuredClone(state.encoders),
      layoutOptions: state.layoutOptions,
      combos: structuredClone(state.combos),
      tapDances: structuredClone(state.tapDances),
      keyOverrides: state.keyOverrides.map((entry) => Array.from(entry)),
      altRepeats: state.altRepeats.map((entry) => Array.from(entry)),
      macroBuffer: Array.from(state.macroBuffer),
      settings: Object.fromEntries(state.settings),
      locked: state.locked,
    };
  }

  function importState(saved) {
    state.keymap.set(saved.keymap);
    state.encoders = structuredClone(saved.encoders);
    state.layoutOptions = saved.layoutOptions;
    state.combos = structuredClone(saved.combos);
    state.tapDances = structuredClone(saved.tapDances);
    state.keyOverrides = saved.keyOverrides.map((entry) => Uint8Array.from(entry));
    state.altRepeats = saved.altRepeats.map((entry) => Uint8Array.from(entry));
    state.macroBuffer.set(saved.macroBuffer);
    state.settings = new Map(Object.entries(saved.settings).map(([k, v]) => [Number(k), v]));
    state.locked = saved.locked;
  }

  return {
    handle,
    state,
    log,
    exportState,
    importState,
    rows,
    cols,
    layers,
    key: (layer, row, col) => state.keymap[(layer * rows + row) * cols + col],
    setKey: (layer, row, col, code) => { state.keymap[(layer * rows + row) * cols + col] = code; },
    /** Messages that change the keyboard (everything else only reads). */
    writes: () => log.filter((m) => [0x03, 0x05, 0x0f].includes(m[0])
      || (m[0] === 0xfe && ([0x04, 0x0b].includes(m[1]) || (m[1] === 0x0d && [0x02, 0x04, 0x06, 0x08].includes(m[2]))))),
  };
}

/** A WebHID `HIDDevice` backed by a simulated keyboard. */
function createSimulatedHidDevice(keyboard, options = {}) {
  const listeners = new Set();
  let dropReports = options.dropReports ?? 0;
  const device = {
    productName: options.productName ?? 'Simulated Keyboard',
    vendorId: options.vendorId ?? 0xfeed,
    productId: options.productId ?? 0x0001,
    collections: options.collections ?? [{ usagePage: 0xff60, usage: 0x61 }],
    opened: false,
    sentReports: 0,
    async open() { device.opened = true; },
    async close() { device.opened = false; },
    addEventListener(type, listener) { if (type === 'inputreport') listeners.add(listener); },
    removeEventListener(type, listener) { if (type === 'inputreport') listeners.delete(listener); },
    async sendReport(reportId, data) {
      if (!device.opened) throw new Error('device is not open');
      if (reportId !== 0) throw new Error('raw HID uses report id 0');
      device.sentReports += 1;
      const response = keyboard.handle(new Uint8Array(data.buffer ?? data, data.byteOffset ?? 0, data.byteLength ?? data.length));
      if (dropReports > 0) { dropReports -= 1; return; }
      setTimeout(() => {
        const event = { device, reportId: 0, data: new DataView(response.buffer) };
        listeners.forEach((listener) => listener(event));
      }, 0);
    },
  };
  return device;
}

/** A `navigator.hid` stand-in: `requestDevice` grants every matching device. */
function createSimulatedHid(devices) {
  const granted = new Set();
  const listeners = new Map();
  const matches = (device, filters = []) => !filters.length || filters.some((filter) => device.collections.some((c) => (
    (filter.usagePage === undefined || c.usagePage === filter.usagePage) && (filter.usage === undefined || c.usage === filter.usage)
  )));
  return {
    requestCalls: 0,
    async requestDevice({ filters } = {}) {
      this.requestCalls += 1;
      const picked = devices.filter((device) => matches(device, filters));
      picked.forEach((device) => granted.add(device));
      return picked;
    },
    async getDevices() { return devices.filter((device) => granted.has(device)); },
    addEventListener(type, listener) { listeners.set(type, [...(listeners.get(type) || []), listener]); },
    disconnect(device) {
      devices.splice(devices.indexOf(device), 1);
      granted.delete(device);
      (listeners.get('disconnect') || []).forEach((listener) => listener({ device }));
    },
  };
}

export { createSimulatedKeyboard, createSimulatedHidDevice, createSimulatedHid };
