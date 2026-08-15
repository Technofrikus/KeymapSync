const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getDefaults: () => ipcRenderer.invoke('app:defaults'),
  selectPath: (opts) => ipcRenderer.invoke('dialog:select', opts),
  savePath: (opts) => ipcRenderer.invoke('dialog:save', opts),
  loadAlpha: (filePath) => ipcRenderer.invoke('alpha:load', filePath),
  saveAlpha: (filePath, content) => ipcRenderer.invoke('alpha:save', filePath, content),
  saveVilBackup: (filePath, state) => ipcRenderer.invoke('vial:saveBackup', filePath, state),
  runGenerator: (opts) => ipcRenderer.invoke('generator:run', opts),
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
  onLog: (callback) => {
    ipcRenderer.on('log:data', (_event, data) => callback(data));
  },
  clearLogListeners: () => ipcRenderer.removeAllListeners('log:data'),
  
  device: {
    discover: () => ipcRenderer.invoke('device:discover'),
    snapshot: (deviceId) => ipcRenderer.invoke('device:snapshot', deviceId),
    apply: (deviceId, state) => ipcRenderer.invoke('device:apply', deviceId, state),
    lock: (deviceId, locked) => ipcRenderer.invoke('device:lock', deviceId, locked),
    layout: (deviceId) => ipcRenderer.invoke('device:layout', deviceId),
  },
  fetchKeyboardDefinition: (filter) => ipcRenderer.invoke('vial:fetchDefinition', filter)
});
