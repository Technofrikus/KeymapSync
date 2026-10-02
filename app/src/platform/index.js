/*
 * Platform interface.
 *
 * The shared app never touches the file system or the keyboard directly; it
 * calls the platform object exported here. Each shell provides one adapter
 * (electron.js, tauri.js, web.js):
 *
 *   getDefaults()                      -> { config: grant }
 *   chooseConfig()                     -> { grant, config } | null (cancelled)
 *   loadConfig(grantId)                -> { grant, config }
 *   saveConfig(grantId, config)        -> { grant, displayPath }
 *   saveVilBackup({ suggestedName, state }) -> { displayPath } | null (cancelled)
 *   setUnsavedChanges(boolean)
 *   onSaveBeforeQuit(callback)         callback() -> Promise<{ ok, error? }>
 *   device.discover()                  -> Device[]
 *   device.snapshot(deviceId)          -> Keymap State
 *   device.apply(deviceId, state)
 *   device.lock(deviceId, locked)
 *   device.layout(deviceId)            -> string | null (diagnostic only)
 *   device.requestAccess()             optional: ask the user to pick a keyboard (web)
 *   device.unsupportedReason           optional: why keyboards cannot be used here (web)
 *   fetchKeyboardDefinition({ vendorId, productId, serialNumber })
 *                                      -> { ok, definition, layoutOptionsPacked } | { ok: false, error }
 *
 * A grant is an opaque { id, kind, displayPath } handle for a user-chosen
 * file; the app never sees or supplies raw paths.
 */
import createElectronPlatform from './electron.js';

// Electron's preload exposes `window.api`, Tauri exposes `window.__TAURI__`;
// anywhere else this is the web shell. Adapters other than Electron's are
// loaded on demand so each build stays lean.
async function detectPlatform() {
  if (globalThis.api) return createElectronPlatform(globalThis.api);
  if (globalThis.__TAURI__) {
    const [{ default: createTauriPlatform }, { default: defaultConfig }] = await Promise.all([
      import('./tauri.js'),
      import('../../../alpha_layers.json'),
    ]);
    return createTauriPlatform({ tauri: globalThis.__TAURI__, defaultConfig });
  }
  const [{ default: createWebPlatform }, { default: defaultConfig }] = await Promise.all([
    import('./web.js'),
    import('../../../alpha_layers.json'),
  ]);
  return createWebPlatform({ defaultConfig });
}

const platform = await detectPlatform();

export default platform;
