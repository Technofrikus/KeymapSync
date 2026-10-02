/*
 * Platform interface.
 *
 * The shared app never touches the file system or the keyboard directly; it
 * calls the platform object exported here. Each shell provides one adapter:
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
 *   fetchKeyboardDefinition({ vendorId, productId, serialNumber })
 *                                      -> { ok, definition, layoutOptionsPacked } | { ok: false, error }
 *
 * A grant is an opaque { id, kind, displayPath } handle for a user-chosen
 * file; the app never sees or supplies raw paths.
 */
import createElectronPlatform from './electron.js';

function detectPlatform() {
  if (globalThis.api) return createElectronPlatform(globalThis.api);
  throw new Error('KeymapSync is running without a supported platform shell.');
}

const platform = detectPlatform();

export default platform;
