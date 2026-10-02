/*
 * Web adapter for the platform interface (see index.js).
 *
 * Keyboard: WebHID + the shared Vial protocol (Chrome/Edge only, HTTPS).
 * Config: the default configuration lives in browser storage; "Pick…" opens a
 * file (with the File System Access API the file can be saved back, otherwise
 * saving downloads a copy). Backups are downloaded as `.vil`.
 * @license GPL-3.0-or-later
 */
import { createVialKeyboard } from '../core/vial-protocol.js';
import { parseConfig, assertValidConfig } from '../core/config-validation.js';
import { serializeKeymapState } from '../core/keymap-state.js';
import { createHidTransport, isRawHidInterface, RAW_HID_FILTER } from './webhid-transport.js';
import { decompressXz, decompressLzma } from './decompress.js';

const UNSUPPORTED_MESSAGE = 'This browser cannot connect to keyboards. Use Chrome or Edge on a desktop computer, '
  + 'or the KeymapSync desktop app. You can still edit your configuration here.';
const INSECURE_MESSAGE = 'Keyboard access needs a secure page. Open KeymapSync over https:// (or http://localhost).';
const STORAGE_KEY = 'keymapsync.config';
const DEFAULT_GRANT = Object.freeze({ id: 'browser', kind: 'config', displayPath: 'Saved in this browser' });

function hexId(value) {
  return value.toString(16).padStart(4, '0');
}

/**
 * @param {{
 *   hid?: HID | null, defaultConfig: object, storage?: Storage | null,
 *   windowLike?: Window, documentLike?: Document, isSecureContext?: boolean,
 *   keyboardOptions?: object,
 * }} options
 */
export default function createWebPlatform(options) {
  const windowLike = options.windowLike ?? globalThis.window;
  const documentLike = options.documentLike ?? globalThis.document;
  const hid = options.hid === undefined ? globalThis.navigator?.hid ?? null : options.hid;
  const storage = options.storage === undefined ? safeStorage(windowLike) : options.storage;
  const secure = options.isSecureContext ?? windowLike?.isSecureContext ?? true;
  const unsupportedReason = !hid ? UNSUPPORTED_MESSAGE : !secure ? INSECURE_MESSAGE : null;

  // ---- configuration files ------------------------------------------------
  const grants = new Map([[DEFAULT_GRANT.id, { grant: DEFAULT_GRANT }]]);
  let nextGrant = 1;

  function readStoredConfig() {
    const text = storage?.getItem(STORAGE_KEY);
    if (!text) return structuredClone(options.defaultConfig);
    return parseConfig(text, 'browser storage');
  }

  function resolveGrant(grantId) {
    const entry = grants.get(grantId);
    if (!entry) throw new Error('This configuration is no longer available. Please pick the file again.');
    return entry;
  }

  async function pickFile() {
    if (typeof windowLike?.showOpenFilePicker === 'function') {
      try {
        const [handle] = await windowLike.showOpenFilePicker({
          types: [{ description: 'JSON configuration', accept: { 'application/json': ['.json'] } }],
        });
        return { handle, file: await handle.getFile() };
      } catch (error) {
        if (error?.name === 'AbortError') return null;
        throw error;
      }
    }
    return new Promise((resolve) => {
      const input = documentLike.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.addEventListener('change', () => resolve(input.files?.[0] ? { file: input.files[0] } : null));
      input.addEventListener('cancel', () => resolve(null));
      input.click();
    });
  }

  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = documentLike.createElement('a');
    link.href = url;
    link.download = name;
    documentLike.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function saveAs(suggestedName, text, description, extension, type) {
    if (typeof windowLike?.showSaveFilePicker === 'function') {
      try {
        const handle = await windowLike.showSaveFilePicker({
          suggestedName,
          types: [{ description, accept: { [type]: [extension] } }],
        });
        await writeHandle(handle, text);
        return { displayPath: handle.name };
      } catch (error) {
        if (error?.name === 'AbortError') return null;
        throw error;
      }
    }
    download(suggestedName, text, type);
    return { displayPath: suggestedName };
  }

  async function writeHandle(handle, text) {
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
  }

  // ---- unsaved changes ----------------------------------------------------
  let unsaved = false;
  windowLike?.addEventListener?.('beforeunload', (event) => {
    if (!unsaved) return;
    event.preventDefault();
    event.returnValue = '';
  });

  // ---- keyboards ----------------------------------------------------------
  const connections = new Map(); // id -> { device, transport, keyboard }
  const deviceIds = new WeakMap();
  let nextDevice = 1;

  function connectionFor(device) {
    let id = deviceIds.get(device);
    if (!id) {
      id = nextDevice;
      nextDevice += 1;
      deviceIds.set(device, id);
    }
    if (!connections.has(id)) {
      const transport = createHidTransport(device, options.transportOptions);
      const keyboard = createVialKeyboard(transport.sendReceive, {
        decompress: { xz: decompressXz, lzma: decompressLzma },
        ...options.keyboardOptions,
      });
      connections.set(id, { id, device, transport, keyboard });
    }
    return connections.get(id);
  }

  function connection(deviceId) {
    const entry = connections.get(Number(deviceId));
    if (!entry) throw new Error('This keyboard is no longer connected. Click Refresh.');
    return entry;
  }

  hid?.addEventListener?.('disconnect', (event) => {
    const id = deviceIds.get(event.device);
    const entry = id && connections.get(id);
    if (!entry) return;
    connections.delete(id);
    entry.transport.close().catch(() => {});
  });

  function assertSupported() {
    if (unsupportedReason) throw new Error(unsupportedReason);
  }

  async function describe(entry) {
    const { device } = entry;
    const info = {
      id: entry.id,
      product_name: device.productName || `Keyboard ${hexId(device.vendorId)}:${hexId(device.productId)}`,
      manufacturer_name: '',
      vendor_id: device.vendorId,
      product_id: device.productId,
      serial_number: '',
      capabilities: {},
    };
    try {
      info.capabilities = await entry.keyboard.readCapabilities();
    } catch (error) {
      info.error = error.message || String(error);
    }
    info.layers = info.capabilities.layer_count ?? 0;
    info.has_combos = (info.capabilities.combo_count ?? 0) > 0;
    info.has_tap_dance = (info.capabilities.tap_dance_count ?? 0) > 0;
    return info;
  }

  const device = {
    unsupportedReason,

    /** Ask the user to pick a keyboard (needs a click). Resolves with how many were granted. */
    async requestAccess() {
      assertSupported();
      const picked = await hid.requestDevice({ filters: [RAW_HID_FILTER] });
      return picked.filter(isRawHidInterface).length;
    },

    async discover() {
      assertSupported();
      const devices = (await hid.getDevices()).filter(isRawHidInterface);
      const described = [];
      for (const hidDevice of devices) described.push(await describe(connectionFor(hidDevice)));
      return described;
    },

    snapshot: async (deviceId) => connection(deviceId).keyboard.snapshot(),
    apply: async (deviceId, state) => connection(deviceId).keyboard.apply(state),
    lockStatus: async (deviceId) => connection(deviceId).keyboard.lockStatus(),
    async lock(deviceId, locked, lockOptions = {}) {
      const { keyboard } = connection(deviceId);
      return locked ? keyboard.lock() : keyboard.unlock(lockOptions);
    },
    // vitaly's text layout dump has no web equivalent; it is diagnostic only.
    layout: async () => null,
  };

  return {
    name: 'web',

    async getDefaults() {
      return { config: DEFAULT_GRANT };
    },

    async chooseConfig() {
      const picked = await pickFile();
      if (!picked) return null;
      const config = parseConfig(await picked.file.text(), picked.file.name);
      const grant = { id: `file-${nextGrant}`, kind: 'config', displayPath: picked.file.name };
      nextGrant += 1;
      grants.set(grant.id, { grant, handle: picked.handle, file: picked.file });
      return { grant, config };
    },

    async loadConfig(grantId) {
      const entry = resolveGrant(grantId);
      if (entry.grant === DEFAULT_GRANT) return { grant: DEFAULT_GRANT, config: readStoredConfig() };
      const file = entry.handle ? await entry.handle.getFile() : entry.file;
      return { grant: entry.grant, config: parseConfig(await file.text(), entry.grant.displayPath) };
    },

    async saveConfig(grantId, config) {
      const entry = resolveGrant(grantId);
      const text = JSON.stringify(assertValidConfig(config, entry.grant.displayPath), null, 2);
      if (entry.grant === DEFAULT_GRANT) {
        if (!storage) throw new Error('This browser does not allow saving. Use Pick… to work with a file instead.');
        storage.setItem(STORAGE_KEY, text);
      } else if (entry.handle?.createWritable) {
        await writeHandle(entry.handle, text);
      } else {
        // Without the File System Access API a file cannot be overwritten: download it.
        download(entry.grant.displayPath, text, 'application/json');
      }
      return { grant: entry.grant, displayPath: entry.grant.displayPath };
    },

    async saveVilBackup({ suggestedName, state } = {}) {
      if (typeof suggestedName !== 'string' || !suggestedName.trim()) throw new Error('A backup filename is required.');
      if (!state || typeof state !== 'object') throw new Error('A valid keymap state is required.');
      return saveAs(suggestedName.replace(/[\\/]/g, '_'), serializeKeymapState(state), 'Vial Layout', '.vil', 'application/octet-stream');
    },

    setUnsavedChanges(hasChanges) {
      unsaved = Boolean(hasChanges);
    },

    // A page cannot hold the tab open for an asynchronous save; `beforeunload` warns instead.
    onSaveBeforeQuit() {},

    device,

    async fetchKeyboardDefinition(filter = {}) {
      try {
        assertSupported();
        const entry = filter.deviceId != null
          ? connection(filter.deviceId)
          : [...connections.values()].find((candidate) => (
            candidate.device.vendorId === filter.vendorId && candidate.device.productId === filter.productId
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

function safeStorage(windowLike) {
  try {
    return windowLike?.localStorage ?? null;
  } catch {
    return null;
  }
}

export { UNSUPPORTED_MESSAGE, STORAGE_KEY };
