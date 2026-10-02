import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import createWebPlatform, { STORAGE_KEY } from '../src/platform/web.js';
import { createHidTransport } from '../src/platform/webhid-transport.js';
import { parseKeymapState } from '../src/core/keymap-state.js';
import { createSimulatedKeyboard, createSimulatedHidDevice, createSimulatedHid } from './support/simulated-vial-keyboard.js';
import { richKeyboardOptions, fillRichEntries } from './support/rich-keyboard.js';
import { DEFINITION } from './support/test-keyboard-definition.js';

const defaultConfig = JSON.parse(fs.readFileSync(new URL('../../alpha_layers.json', import.meta.url), 'utf8'));
const vitalySave = fs.readFileSync(new URL('./fixtures/vitaly-save-simulated.vil', import.meta.url), 'utf8');

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
}

function fakeWindow() {
  const listeners = {};
  return {
    isSecureContext: true,
    addEventListener: (type, listener) => { listeners[type] = listener; },
    fire: (type, event) => listeners[type]?.(event),
  };
}

function fakeDocument() {
  const clicked = [];
  return {
    clicked,
    body: { appendChild() {} },
    createElement: () => ({ click() { clicked.push({ name: this.download, href: this.href }); }, remove() {} }),
  };
}

function setup({ keyboards = [richKeyboardOptions()], deviceOptions = {} } = {}) {
  const simulators = keyboards.map((options) => fillRichEntries(createSimulatedKeyboard(options)));
  const devices = simulators.map((simulator) => createSimulatedHidDevice(simulator, deviceOptions));
  const hid = createSimulatedHid(devices);
  const windowLike = fakeWindow();
  const documentLike = fakeDocument();
  const storage = memoryStorage();
  const platform = createWebPlatform({
    hid, defaultConfig, storage, windowLike, documentLike, keyboardOptions: { sleep: async () => {} },
  });
  return { platform, hid, simulators, devices, windowLike, documentLike, storage };
}

test('transport: answers are matched to requests, dropped answers are retried', async () => {
  const simulator = createSimulatedKeyboard();
  const device = createSimulatedHidDevice(simulator, { dropReports: 1 });
  const transport = createHidTransport(device, { timeoutMs: 20 });
  // Requests sent together are still answered in order, one at a time.
  const [version, layers] = await Promise.all([transport.sendReceive([0x01]), transport.sendReceive([0x11])]);
  assert.equal(version[2], 9);
  assert.equal(layers[1], 4);
  assert.equal(device.sentReports, 3, 'the first request was sent twice');
  await transport.close();
  assert.equal(device.opened, false);
});

test('transport: a keyboard that never answers fails with a timeout', async () => {
  const device = createSimulatedHidDevice(createSimulatedKeyboard(), { dropReports: 10 });
  const transport = createHidTransport(device, { timeoutMs: 5, attempts: 3 });
  await assert.rejects(transport.sendReceive([0x01]), { code: 'TIMEOUT' });
  assert.equal(device.sentReports, 3);
});

test('transport: a late answer to a retried VIA request is not taken for the next one', async () => {
  const listeners = [];
  const device = {
    opened: true,
    addEventListener: (type, listener) => listeners.push(listener),
    removeEventListener: () => {},
    async sendReport(id, data) {
      // Answer with a stale report first, then the real one.
      const stale = new Uint8Array(32); stale[0] = 0x12;
      const real = Uint8Array.from(data); real[1] = 0x42;
      setTimeout(() => listeners.forEach((l) => l({ data: new DataView(stale.buffer) })), 0);
      setTimeout(() => listeners.forEach((l) => l({ data: new DataView(real.buffer) })), 1);
    },
  };
  const response = await createHidTransport(device).sendReceive([0x11]);
  assert.equal(response[0], 0x11);
  assert.equal(response[1], 0x42);
});

test('no WebHID: the app still runs and explains why keyboards are unavailable', async () => {
  const platform = createWebPlatform({ hid: null, defaultConfig, storage: memoryStorage(), windowLike: fakeWindow(), documentLike: fakeDocument() });
  assert.match(platform.device.unsupportedReason, /Chrome or Edge/);
  await assert.rejects(platform.device.discover(), /Chrome or Edge/);
  const definition = await platform.fetchKeyboardDefinition({ deviceId: 1 });
  assert.equal(definition.ok, false);
  const insecure = createWebPlatform({ hid: createSimulatedHid([]), isSecureContext: false, defaultConfig, storage: null, windowLike: fakeWindow() });
  assert.match(insecure.device.unsupportedReason, /https/);
});

test('keyboards appear after the user grants access, with vitaly-style device info', async () => {
  const { platform, hid } = setup();
  assert.deepEqual(await platform.device.discover(), [], 'nothing is visible before the user picks a keyboard');
  assert.equal(await platform.device.requestAccess(), 1);
  assert.equal(hid.requestCalls, 1);
  const [device] = await platform.device.discover();
  assert.equal(device.product_name, 'Simulated Keyboard');
  assert.equal(device.vendor_id, 0xfeed);
  assert.equal(device.product_id, 0x0001);
  assert.equal(device.layers, 4);
  assert.equal(device.has_combos, true);
  assert.equal(device.has_tap_dance, true);
  assert.equal(device.capabilities.vial_version, 6);
  const again = await platform.device.discover();
  assert.equal(again[0].id, device.id, 'ids stay stable between refreshes');
});

test('other interfaces of the same keyboard are skipped', async () => {
  const { platform } = setup({ deviceOptions: { collections: [{ usagePage: 0x01, usage: 0x06 }] } });
  assert.equal(await platform.device.requestAccess(), 0);
  assert.deepEqual(await platform.device.discover(), []);
});

test('snapshot, definition and apply through the platform interface', async () => {
  const { platform, simulators } = setup();
  await platform.device.requestAccess();
  const [device] = await platform.device.discover();
  const snapshot = await platform.device.snapshot(device.id);
  assert.deepEqual(snapshot, parseKeymapState(vitalySave));

  const definition = await platform.fetchKeyboardDefinition({ deviceId: device.id, vendorId: device.vendor_id, productId: device.product_id });
  assert.deepEqual(definition, { ok: true, definition: DEFINITION, layoutOptionsPacked: 1 });
  const byIds = await platform.fetchKeyboardDefinition({ vendorId: 0xfeed, productId: 0x0001, serialNumber: '' });
  assert.equal(byIds.ok, true);

  snapshot.layout[2][1][1] = 'KC_Z';
  await platform.device.apply(device.id, snapshot);
  assert.equal(simulators[0].key(2, 1, 1), 0x1d);
  assert.equal(await platform.device.layout(device.id), null);
});

test('lock and unlock through the platform interface', async () => {
  const { platform } = setup();
  await platform.device.requestAccess();
  const [device] = await platform.device.discover();
  assert.equal((await platform.device.lockStatus(device.id)).locked, true);
  const progress = [];
  await platform.device.lock(device.id, false, { onProgress: ({ remaining }) => progress.push(remaining), pollMs: 0 });
  assert.equal(progress.at(-1), 0);
  assert.equal((await platform.device.lockStatus(device.id)).locked, false);
  await platform.device.lock(device.id, true);
  assert.equal((await platform.device.lockStatus(device.id)).locked, true);
});

test('an unplugged keyboard is forgotten', async () => {
  const { platform, hid, devices } = setup();
  await platform.device.requestAccess();
  const [device] = await platform.device.discover();
  await platform.device.snapshot(device.id);
  hid.disconnect(devices[0]);
  await assert.rejects(platform.device.snapshot(device.id), /no longer connected/);
  assert.deepEqual(await platform.device.discover(), []);
});

test('configuration is kept in browser storage', async () => {
  const { platform, storage } = setup();
  const { config: grant } = await platform.getDefaults();
  const loaded = await platform.loadConfig(grant.id);
  assert.deepEqual(loaded.config, defaultConfig, 'first visit starts from the bundled default');
  const changed = structuredClone(defaultConfig);
  changed.alphaMappings = { ...changed.alphaMappings };
  await platform.saveConfig(grant.id, changed);
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), changed);
  assert.deepEqual((await platform.loadConfig(grant.id)).config, changed);
  await assert.rejects(platform.saveConfig(grant.id, { nonsense: true }), /Invalid configuration/);
  await assert.rejects(platform.loadConfig('file-99'), /pick the file again/);
});

test('picked files are saved back with the File System Access API', async () => {
  const { platform, windowLike } = setup();
  const written = [];
  const handle = {
    name: 'mine.json',
    getFile: async () => ({ name: 'mine.json', text: async () => JSON.stringify(defaultConfig) }),
    createWritable: async () => ({ write: async (text) => written.push(text), close: async () => {} }),
  };
  windowLike.showOpenFilePicker = async () => [handle];
  const picked = await platform.chooseConfig();
  assert.equal(picked.grant.displayPath, 'mine.json');
  assert.deepEqual(picked.config, defaultConfig);
  await platform.saveConfig(picked.grant.id, picked.config);
  assert.deepEqual(JSON.parse(written[0]), defaultConfig);

  windowLike.showOpenFilePicker = async () => { const error = new Error('cancel'); error.name = 'AbortError'; throw error; };
  assert.equal(await platform.chooseConfig(), null);
});

test('backups are downloaded when no save picker exists', async () => {
  const { platform, documentLike } = setup();
  globalThis.URL.createObjectURL ??= () => 'blob:x';
  globalThis.URL.revokeObjectURL ??= () => {};
  const result = await platform.saveVilBackup({ suggestedName: 'a/b.vil', state: parseKeymapState(vitalySave) });
  assert.deepEqual(result, { displayPath: 'a_b.vil' });
  assert.equal(documentLike.clicked[0].name, 'a_b.vil');
});

test('leaving the page with unsaved changes asks first', () => {
  const { platform, windowLike } = setup();
  const event = { preventDefault() { this.prevented = true; } };
  windowLike.fire('beforeunload', event);
  assert.equal(event.prevented, undefined);
  platform.setUnsavedChanges(true);
  windowLike.fire('beforeunload', event);
  assert.equal(event.prevented, true);
});
