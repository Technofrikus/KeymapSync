/*
 * Tauri adapter for the platform interface (see index.js).
 *
 * Keyboard: the Rust side only passes raw 32-byte HID messages through; the
 * shared Vial protocol (the same code the web version uses) runs here.
 * Files: native dialogs and file access are Rust commands. The app only ever
 * sees opaque grants, never paths it chose itself.
 * @license GPL-3.0-or-later
 */
import { createVialKeyboard } from '../core/vial-protocol.js';
import { parseConfig, assertValidConfig } from '../core/config-validation.js';
import { serializeKeymapState } from '../core/keymap-state.js';
import { MSG_LEN } from '../core/vial-definition.js';
import { decompressXz, decompressLzma } from './decompress.js';

const SAVE = 'Save';
const DONT_SAVE = "Don't Save";
const CANCEL = 'Cancel';

/**
 * @param {{ tauri: object, defaultConfig: object, keyboardOptions?: object }} options
 *   `tauri` is `window.__TAURI__` (needs `withGlobalTauri`).
 */
export default function createTauriPlatform({ tauri, defaultConfig, keyboardOptions }) {
  const invoke = tauri.core.invoke;

  // ---- configuration files ------------------------------------------------
  let defaultGrantId = null;

  async function readConfig(grantId) {
    const result = await invoke('config_read', { grantId });
    if (result.text == null) {
      // Nothing saved yet: start from the configuration bundled with the app.
      if (grantId === defaultGrantId) return { grant: result.grant, config: structuredClone(defaultConfig) };
      throw new Error(`Could not read ${result.grant.displayPath}.`);
    }
    return { grant: result.grant, config: parseConfig(result.text, result.grant.displayPath) };
  }

  // ---- unsaved changes ----------------------------------------------------
  let unsaved = false;
  let saveBeforeQuit = null;
  let closing = false;

  async function guardClose(event) {
    if (!unsaved || closing) return;
    event.preventDefault();
    closing = true;
    try {
      const answer = await tauri.dialog.message(
        'You have unsaved changes. Do you want to save them before closing?\n\nYour changes will be lost if you don\'t save them.',
        { title: 'Unsaved Changes', kind: 'warning', buttons: { yes: SAVE, no: DONT_SAVE, cancel: CANCEL } },
      );
      if (answer === DONT_SAVE) {
        await tauri.window.getCurrentWindow().destroy();
        return;
      }
      if (answer !== SAVE) return;
      let result;
      try {
        result = saveBeforeQuit ? await saveBeforeQuit() : { ok: true };
      } catch (error) {
        result = { ok: false, error: error.message || String(error) };
      }
      if (result?.ok) {
        await tauri.window.getCurrentWindow().destroy();
      } else {
        await tauri.dialog.message(
          result?.error || 'The configuration could not be saved. The window will remain open.',
          { title: 'Changes Not Saved', kind: 'error' },
        );
      }
    } finally {
      closing = false;
    }
  }
  tauri.window.getCurrentWindow().onCloseRequested(guardClose);

  // ---- keyboards ----------------------------------------------------------
  const connections = new Map(); // numeric id -> { id, path, info, keyboard }
  const idsByPath = new Map();
  let nextDevice = 1;

  function connectionFor(info) {
    let id = idsByPath.get(info.id);
    if (!id) {
      id = nextDevice;
      nextDevice += 1;
      idsByPath.set(info.id, id);
    }
    if (!connections.has(id)) {
      let queue = Promise.resolve();
      const sendReceive = (message) => {
        const bytes = Array.from(message).slice(0, MSG_LEN);
        const result = queue.then(async () => new Uint8Array(await invoke('hid_exchange', { id: info.id, message: bytes })));
        queue = result.catch(() => {});
        return result;
      };
      const keyboard = createVialKeyboard(sendReceive, {
        decompress: { xz: decompressXz, lzma: decompressLzma },
        ...keyboardOptions,
      });
      connections.set(id, { id, info, keyboard });
    }
    return connections.get(id);
  }

  function connection(deviceId) {
    const entry = connections.get(Number(deviceId));
    if (!entry) throw new Error('This keyboard is no longer connected. Click Refresh.');
    return entry;
  }

  async function describe(entry) {
    const { info } = entry;
    const description = {
      id: entry.id,
      product_name: info.product_name || `Keyboard ${info.vendor_id.toString(16).padStart(4, '0')}:${info.product_id.toString(16).padStart(4, '0')}`,
      manufacturer_name: info.manufacturer_name,
      vendor_id: info.vendor_id,
      product_id: info.product_id,
      serial_number: info.serial_number,
      capabilities: {},
    };
    try {
      description.capabilities = await entry.keyboard.readCapabilities();
    } catch (error) {
      description.error = error.message || String(error);
    }
    description.layers = description.capabilities.layer_count ?? 0;
    description.has_combos = (description.capabilities.combo_count ?? 0) > 0;
    description.has_tap_dance = (description.capabilities.tap_dance_count ?? 0) > 0;
    return description;
  }

  const device = {
    async discover() {
      const found = await invoke('hid_list');
      const present = new Set(found.map((info) => idsByPath.get(info.id)));
      for (const id of [...connections.keys()]) if (!present.has(id)) connections.delete(id);
      const described = [];
      for (const info of found) described.push(await describe(connectionFor(info)));
      return described;
    },
    snapshot: async (deviceId) => connection(deviceId).keyboard.snapshot(),
    apply: async (deviceId, state) => connection(deviceId).keyboard.apply(state),
    lockStatus: async (deviceId) => connection(deviceId).keyboard.lockStatus(),
    async lock(deviceId, locked, lockOptions = {}) {
      const { keyboard } = connection(deviceId);
      return locked ? keyboard.lock() : keyboard.unlock(lockOptions);
    },
    // vitaly's text layout dump has no equivalent; it is diagnostic only.
    layout: async () => null,
  };

  return {
    name: 'tauri',

    async getDefaults() {
      const defaults = await invoke('app_defaults');
      defaultGrantId = defaults.config.id;
      return defaults;
    },

    async chooseConfig() {
      const picked = await invoke('config_choose');
      if (!picked) return null;
      return { grant: picked.grant, config: parseConfig(picked.text, picked.grant.displayPath) };
    },

    loadConfig: (grantId) => readConfig(grantId),

    async saveConfig(grantId, config) {
      const grant = await invoke('config_read', { grantId }).then((result) => result.grant);
      const text = JSON.stringify(assertValidConfig(config, grant.displayPath), null, 2);
      const written = await invoke('config_write', { grantId, text });
      return { grant: written, displayPath: written.displayPath };
    },

    async saveVilBackup({ suggestedName, state } = {}) {
      if (typeof suggestedName !== 'string' || !suggestedName.trim()) throw new Error('A backup filename is required.');
      if (!state || typeof state !== 'object') throw new Error('A valid keymap state is required.');
      const displayPath = await invoke('backup_save', { suggestedName, text: serializeKeymapState(state) });
      return displayPath ? { displayPath } : null;
    },

    setUnsavedChanges(hasChanges) {
      unsaved = Boolean(hasChanges);
    },

    onSaveBeforeQuit(callback) {
      saveBeforeQuit = callback;
    },

    device,

    async fetchKeyboardDefinition(filter = {}) {
      try {
        const entry = filter.deviceId != null
          ? connection(filter.deviceId)
          : [...connections.values()].find((candidate) => (
            candidate.info.vendor_id === filter.vendorId && candidate.info.product_id === filter.productId
          ));
        if (!entry) return { ok: false, error: 'Keyboard not found for definition fetch' };
        const definition = await entry.keyboard.readDefinition();
        const layoutOptionsPacked = definition?.layouts?.labels ? await entry.keyboard.readLayoutOptions() : 0;
        return { ok: true, definition, layoutOptionsPacked };
      } catch (error) {
        return { ok: false, error: error.message || String(error) };
      }
    },
  };
}
