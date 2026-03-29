const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getDefaults: () => ipcRenderer.invoke('app:defaults'),
  selectPath: (opts) => ipcRenderer.invoke('dialog:select', opts),
  savePath: (opts) => ipcRenderer.invoke('dialog:save', opts),
  loadAlpha: (filePath) => ipcRenderer.invoke('alpha:load', filePath),
  saveAlpha: (filePath, content) => ipcRenderer.invoke('alpha:save', filePath, content),
  runGenerator: (opts) => ipcRenderer.invoke('generator:run', opts),
  processConfig: (doc, config) => ipcRenderer.invoke('generator:process', doc, config),
  setUnsavedChanges: (hasChanges) => ipcRenderer.invoke('app:setUnsavedChanges', hasChanges),
  checkUnsavedChanges: () => ipcRenderer.invoke('app:checkUnsavedChanges'),
  onSaveBeforeQuit: (callback) => {
    ipcRenderer.on('app:save-before-quit', () => callback());
  },
  onLog: (callback) => {
    ipcRenderer.on('log:data', (_event, data) => callback(data));
  },
  clearLogListeners: () => ipcRenderer.removeAllListeners('log:data'),
  
  // Vitaly commands
  listDevices: () => ipcRenderer.invoke('vitaly:devices'),
  saveDeviceState: (deviceId) => ipcRenderer.invoke('vitaly:save', deviceId),
  applyDeviceState: (deviceId, type, data) => ipcRenderer.invoke('vitaly:apply', deviceId, type, data),
  lockDevice: (deviceId, state) => ipcRenderer.invoke('vitaly:lock', deviceId, state),
  getDeviceLayout: (deviceId) => ipcRenderer.invoke('vitaly:layout', deviceId),
  fetchKeyboardDefinition: (filter) => ipcRenderer.invoke('vial:fetchDefinition', filter)
});

