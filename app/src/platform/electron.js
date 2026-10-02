/* Electron adapter: the preload script already exposes the platform
 * interface on `window.api`, backed by IPC to the main process. */
export default function createElectronPlatform(bridge) {
  return {
    name: 'electron',
    getDefaults: () => bridge.getDefaults(),
    chooseConfig: () => bridge.chooseConfig(),
    loadConfig: (grantId) => bridge.loadConfig(grantId),
    saveConfig: (grantId, config) => bridge.saveConfig(grantId, config),
    saveVilBackup: (payload) => bridge.saveVilBackup(payload),
    setUnsavedChanges: (hasChanges) => bridge.setUnsavedChanges(hasChanges),
    onSaveBeforeQuit: (callback) => bridge.onSaveBeforeQuit(callback),
    device: bridge.device,
    fetchKeyboardDefinition: (filter) => bridge.fetchKeyboardDefinition(filter),
  };
}
