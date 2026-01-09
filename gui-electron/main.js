const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const isDev = !app.isPackaged;

// Enable hot reload in development
if (isDev) {
  try {
    // Find Electron binary path
    const electronModulePath = require.resolve('electron');
    const electronDir = path.dirname(electronModulePath);
    let electronPath;
    
    if (process.platform === 'darwin') {
      electronPath = path.join(electronDir, 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron');
    } else if (process.platform === 'win32') {
      electronPath = path.join(electronDir, 'dist', 'electron.exe');
    } else {
      electronPath = path.join(electronDir, 'dist', 'electron');
    }
    
    require('electron-reload')(__dirname, {
      electron: electronPath,
      hardResetMethod: 'exit'
    });
  } catch (err) {
    console.warn('electron-reload failed:', err.message);
  }
}
const projectRoot = path.resolve(__dirname, '..');
const defaultPaths = {
  config: path.join(projectRoot, 'alpha_layers.json'),
  input: path.join(projectRoot, 'original'),
  output: path.join(projectRoot, 'output'),
  script: path.join(projectRoot, 'generate_vial_keymaps.js')
};

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
  
  // Reset unsaved changes when window is created
  hasUnsavedChanges = false;
  
  // Handle window close to check for unsaved changes
  mainWindow.on('close', async (event) => {
    if (hasUnsavedChanges) {
      event.preventDefault();
      
      const response = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Save', 'Don\'t Save', 'Cancel'],
        defaultId: 0,
        cancelId: 2,
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Do you want to save them before closing?',
        detail: 'Your changes will be lost if you don\'t save them.'
      });
      
      if (response.response === 0) {
        // Save
        mainWindow.webContents.send('app:save-before-quit');
        // Wait for save to complete, then close
        setTimeout(() => {
          hasUnsavedChanges = false;
          mainWindow.destroy();
        }, 1000);
      } else if (response.response === 1) {
        // Don't save
        hasUnsavedChanges = false;
        mainWindow.destroy();
      }
      // If response is 2 (Cancel), do nothing - window won't close
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

let hasUnsavedChanges = false;

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('app:defaults', () => defaultPaths);

ipcMain.handle('app:setUnsavedChanges', (_event, hasChanges) => {
  hasUnsavedChanges = hasChanges;
});

ipcMain.handle('app:checkUnsavedChanges', () => {
  return hasUnsavedChanges;
});

ipcMain.handle('dialog:select', async (_event, opts) => {
  const properties = opts?.type === 'file' ? ['openFile'] : ['openDirectory'];
  const result = await dialog.showOpenDialog(mainWindow, {
    properties,
    defaultPath: opts?.defaultPath
  });
  if (result.canceled || !result.filePaths?.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('alpha:load', async (_event, filePath) => {
  const target = filePath || defaultPaths.config;
  const raw = fs.readFileSync(target, 'utf8');
  return { path: target, content: raw };
});

ipcMain.handle('alpha:save', async (_event, filePath, content) => {
  const target = filePath || defaultPaths.config;
  // Basic validation to avoid saving invalid JSON.
  JSON.parse(content);
  fs.writeFileSync(target, content, 'utf8');
  return { path: target };
});

ipcMain.handle('generator:run', async (_event, opts = {}) => {
  const script = defaultPaths.script;
  const cwd = projectRoot;
  const env = { ...process.env };
  const child = spawn('node', [script], { cwd, env });

  child.stdout.on('data', (data) => {
    mainWindow?.webContents.send('log:data', data.toString());
  });
  child.stderr.on('data', (data) => {
    mainWindow?.webContents.send('log:data', data.toString());
  });

  return new Promise((resolve, reject) => {
    child.on('error', (err) => {
      mainWindow?.webContents.send('log:data', `Error: ${err.message}`);
      reject(err);
    });
    child.on('close', (code) => {
      mainWindow?.webContents.send('log:data', `Process exited with code ${code}`);
      resolve({ code });
    });
  });
});

