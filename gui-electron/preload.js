const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getDefaults: () => ipcRenderer.invoke('app:defaults'),
  chooseConfig: () => ipcRenderer.invoke('config:choose'),
  loadConfig: (grantId) => ipcRenderer.invoke('config:load', grantId),
  saveConfig: (grantId, config) => ipcRenderer.invoke('config:save', grantId, config),
  saveVilBackup: (payload) => ipcRenderer.invoke('vial:saveBackup', payload),
  processConfig: (doc, config) => ipcRenderer.invoke('generator:process', doc, config),
  setUnsavedChanges: (hasChanges) => ipcRenderer.invoke('app:setUnsavedChanges', hasChanges),
  checkUnsavedChanges: () => ipcRenderer.invoke('app:checkUnsavedChanges'),
  onSaveBeforeQuit: (callback) => {
    ipcRenderer.on('app:save-before-quit', async (_event, requestId) => {
      try {
        const result = await callback();
        ipcRenderer.send('app:save-before-quit-result', requestId, result);
      } catch (err) {
        ipcRenderer.send('app:save-before-quit-result', requestId, {
          ok: false,
          error: err.message || String(err),
        });
      }
    });
  },
  
  device: {
    discover: () => ipcRenderer.invoke('device:discover'),
    snapshot: (deviceId) => ipcRenderer.invoke('device:snapshot', deviceId),
    apply: (deviceId, state) => ipcRenderer.invoke('device:apply', deviceId, state),
    lock: (deviceId, locked) => ipcRenderer.invoke('device:lock', deviceId, locked),
    layout: (deviceId) => ipcRenderer.invoke('device:layout', deviceId),
  },
  fetchKeyboardDefinition: (filter) => ipcRenderer.invoke('vial:fetchDefinition', filter)
});
