import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import createTauriPlatform from '../src/platform/tauri.js';
import { parseKeymapState } from '../src/core/keymap-state.js';
import { createSimulatedKeyboard } from './support/simulated-vial-keyboard.js';
import { richKeyboardOptions, fillRichEntries } from './support/rich-keyboard.js';

const defaultConfig = JSON.parse(fs.readFileSync(new URL('../../alpha_layers.json', import.meta.url), 'utf8'));
const vitalySave = fs.readFileSync(new URL('./fixtures/vitaly-save-simulated.vil', import.meta.url), 'utf8');

/** A stand-in for the Rust commands: a simulated keyboard, an in-memory disk and scripted dialogs. */
function setup({ answers = [] } = {}) {
  const simulator = fillRichEntries(createSimulatedKeyboard(richKeyboardOptions()));
  const disk = new Map();
  const calls = [];
  const dialogs = [];
  let closeHandler = null;
  let destroyed = false;
  const grants = new Map([['grant-1', '/data/alpha_layers.json']]);
  const grant = (id) => ({ id, kind: 'config', displayPath: grants.get(id) });

  const commands = {
    hid_list: () => [{ id: 'kbd-path', vendor_id: 0xfeed, product_id: 1, product_name: 'Simulated Keyboard', manufacturer_name: 'Sim', serial_number: '' }],
    hid_exchange: ({ id, message }) => {
      assert.equal(id, 'kbd-path');
      assert.equal(message.length, 32);
      return Array.from(simulator.handle(Uint8Array.from(message)));
    },
    app_defaults: () => ({ config: grant('grant-1') }),
    config_choose: () => (commands.pick ? { grant: (grants.set('grant-2', '/picked.json'), grant('grant-2')), text: commands.pick } : null),
    config_read: ({ grantId }) => ({ grant: grant(grantId), text: disk.get(grants.get(grantId)) ?? null }),
    config_write: ({ grantId, text }) => { disk.set(grants.get(grantId), text); return grant(grantId); },
    backup_save: ({ suggestedName, text }) => { disk.set(`/backups/${suggestedName}`, text); return `/backups/${suggestedName}`; },
  };
  const tauri = {
    core: { invoke: async (name, args) => { calls.push(name); return commands[name](args); } },
    window: { getCurrentWindow: () => ({ onCloseRequested: (handler) => { closeHandler = handler; }, destroy: async () => { destroyed = true; } }) },
    dialog: { message: async (text, options) => { dialogs.push({ text, ...options }); return answers.shift(); } },
  };
  const platform = createTauriPlatform({ tauri, defaultConfig, keyboardOptions: { sleep: async () => {} } });
  return {
    platform, commands, disk, calls, dialogs, simulator,
    close: async () => {
      const event = { prevented: false, preventDefault() { this.prevented = true; } };
      await closeHandler(event);
      return event;
    },
    get destroyed() { return destroyed; },
  };
}

test('keyboards: discover, snapshot and write go through the HID pass-through', async () => {
  const { platform } = setup();
  const [device] = await platform.device.discover();
  assert.equal(device.product_name, 'Simulated Keyboard');
  assert.equal(device.layers, 4);
  assert.equal(device.vendor_id, 0xfeed);
  const snapshot = await platform.device.snapshot(device.id);
  assert.deepEqual(snapshot, parseKeymapState(vitalySave));
  const [again] = await platform.device.discover();
  assert.equal(again.id, device.id, 'ids stay stable between refreshes');

  const changed = structuredClone(snapshot);
  changed.layout[0][0][0] = 'KC_Z';
  await platform.device.apply(device.id, changed);
  assert.equal((await platform.device.snapshot(device.id)).layout[0][0][0], 'KC_Z');
});

test('keyboards: the layout definition can be read', async () => {
  const { platform } = setup();
  const [device] = await platform.device.discover();
  const result = await platform.fetchKeyboardDefinition({ vendorId: device.vendor_id, productId: device.product_id });
  assert.equal(result.ok, true);
  assert.ok(result.definition.layouts);
  assert.equal((await platform.fetchKeyboardDefinition({ vendorId: 1, productId: 2 })).ok, false);
});

test('config: the bundled default is used until something is saved', async () => {
  const { platform, disk } = setup();
  const { config: grant } = await platform.getDefaults();
  assert.deepEqual((await platform.loadConfig(grant.id)).config, defaultConfig);
  const edited = structuredClone(defaultConfig);
  const saved = await platform.saveConfig(grant.id, edited);
  assert.equal(saved.displayPath, '/data/alpha_layers.json');
  assert.ok(disk.has('/data/alpha_layers.json'));
  assert.deepEqual((await platform.loadConfig(grant.id)).config, defaultConfig);
});

test('config: invalid files are refused', async () => {
  const { platform, commands, disk } = setup();
  const { config: grant } = await platform.getDefaults();
  commands.pick = '{"nonsense": true}';
  await assert.rejects(platform.chooseConfig());
  await assert.rejects(platform.saveConfig(grant.id, { nonsense: true }));
  assert.equal(disk.size, 0, 'nothing invalid is written');
  commands.pick = null;
  assert.equal(await platform.chooseConfig(), null);
});

test('backup: the .vil is written where the user chose, cancelling returns null', async () => {
  const { platform, disk, commands } = setup();
  const result = await platform.saveVilBackup({ suggestedName: 'a.vil', state: parseKeymapState(vitalySave) });
  assert.deepEqual(result, { displayPath: '/backups/a.vil' });
  assert.ok(disk.get('/backups/a.vil').length > 0);
  commands.backup_save = () => null;
  assert.equal(await platform.saveVilBackup({ suggestedName: 'a.vil', state: parseKeymapState(vitalySave) }), null);
  await assert.rejects(platform.saveVilBackup({ suggestedName: ' ', state: {} }), /filename/);
});

test('closing: no prompt without unsaved changes', async () => {
  const shell = setup();
  const event = await shell.close();
  assert.equal(event.prevented, false);
  assert.equal(shell.dialogs.length, 0);
});

test('closing: Save, Don\'t Save and Cancel', async () => {
  const save = setup({ answers: ['Save'] });
  let saved = 0;
  save.platform.onSaveBeforeQuit(async () => { saved += 1; return { ok: true }; });
  save.platform.setUnsavedChanges(true);
  assert.equal((await save.close()).prevented, true);
  assert.equal(saved, 1);
  assert.equal(save.destroyed, true);

  const discard = setup({ answers: ["Don't Save"] });
  discard.platform.setUnsavedChanges(true);
  await discard.close();
  assert.equal(discard.destroyed, true);

  const cancel = setup({ answers: ['Cancel'] });
  cancel.platform.setUnsavedChanges(true);
  await cancel.close();
  assert.equal(cancel.destroyed, false);
});

test('closing: a failed save keeps the window open and says why', async () => {
  const shell = setup({ answers: ['Save'] });
  shell.platform.onSaveBeforeQuit(async () => ({ ok: false, error: 'disk full' }));
  shell.platform.setUnsavedChanges(true);
  await shell.close();
  assert.equal(shell.destroyed, false);
  assert.match(shell.dialogs.at(-1).text, /disk full/);
});
