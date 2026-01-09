const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getDefaults: () => ipcRenderer.invoke('app:defaults'),
  selectPath: (opts) => ipcRenderer.invoke('dialog:select', opts),
  loadAlpha: (filePath) => ipcRenderer.invoke('alpha:load', filePath),
  saveAlpha: (filePath, content) => ipcRenderer.invoke('alpha:save', filePath, content),
  runGenerator: (opts) => ipcRenderer.invoke('generator:run', opts),
  setUnsavedChanges: (hasChanges) => ipcRenderer.invoke('app:setUnsavedChanges', hasChanges),
  checkUnsavedChanges: () => ipcRenderer.invoke('app:checkUnsavedChanges'),
  onSaveBeforeQuit: (callback) => {
    ipcRenderer.on('app:save-before-quit', () => callback());
  },
  onLog: (callback) => {
    ipcRenderer.on('log:data', (_event, data) => callback(data));
  },
  clearLogListeners: () => ipcRenderer.removeAllListeners('log:data')
});

