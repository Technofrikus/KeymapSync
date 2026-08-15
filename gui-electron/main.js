const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const generator = require('./generate_vial_keymaps.js');
const { fetchKeyboardDefinition } = require('./vial-fetch-definition.js');
const { createDeviceTransport, createVitalyRunner } = require('./device-transport.js');

app.setName('KeymapSync');

const isDev = !app.isPackaged;

// Enable hot reload in development
if (isDev) {
  try {
    // This is the running Electron binary on every platform. Deriving it from
    // the `electron` package assumes a particular package layout and can point
    // electron-reload at a path that does not exist.
    const electronPath = process.execPath;

    require('electron-reload')(__dirname, {
      electron: electronPath,
      hardResetMethod: 'exit'
    });
  } catch (err) {
    console.warn('electron-reload failed:', err.message);
  }
}

// In development, project files live one level above `gui-electron/`.
// In production, we cannot rely on repo-relative files existing next to the app bundle,
// so defaults live in the user's data directory, seeded from bundled assets on first run.
const repoRoot = path.resolve(__dirname, '..');
const userDataRoot = app.getPath('userData');

const defaultPaths = (() => {
  const vitaly = process.platform === 'win32' ? 'vitaly.exe' : 'vitaly';

  if (isDev) {
    return {
      config: path.join(repoRoot, 'alpha_layers.json'),
      input: path.join(repoRoot, 'original'),
      output: path.join(repoRoot, 'output'),
      script: path.join(__dirname, 'generate_vial_keymaps.js'),
      vitaly
    };
  }

  // Keep all user-modifiable files out of the app bundle.
  const appDataDir = path.join(userDataRoot, 'KeymapSync');
  return {
    config: path.join(appDataDir, 'alpha_layers.json'),
    input: path.join(appDataDir, 'original'),
    output: path.join(appDataDir, 'output'),
    script: path.join(__dirname, 'generate_vial_keymaps.js'),
    vitaly
  };
})();

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function ensureSeedConfig() {
  if (isDev) return;

  const targetDir = path.dirname(defaultPaths.config);
  ensureDir(targetDir);

  if (fs.existsSync(defaultPaths.config)) return;

  // `alpha_layers.json` is bundled into the app (copied in `predist`).
  const bundled = path.join(__dirname, 'alpha_layers.json');
  if (!fs.existsSync(bundled)) {
    throw new Error(
      `Bundled default config missing (${bundled}). Build is misconfigured (alpha_layers.json not packaged).`
    );
  }
  fs.copyFileSync(bundled, defaultPaths.config);
}

function ensureDefaultFolders() {
  if (isDev) return;
  ensureDir(defaultPaths.input);
  ensureDir(defaultPaths.output);
}

ensureSeedConfig();
ensureDefaultFolders();

const deviceTransport = createDeviceTransport({
  runCommand: createVitalyRunner({
    isDev,
    appDir: __dirname,
    repoRoot,
    resourcesPath: process.resourcesPath,
    vitalyName: defaultPaths.vitaly,
  }),
  tempDir: app.getPath('temp'),
});

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    title: "",
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 10, y: 10 },
    icon: path.join(__dirname, 'KSiconReal.png'),
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
  if (process.platform === 'darwin') {
    app.dock.setIcon(path.join(__dirname, 'KSiconReal.png'));
  }
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

ipcMain.handle('device:discover', () => deviceTransport.discover());
ipcMain.handle('device:snapshot', (_event, deviceId) => deviceTransport.snapshot(deviceId));
ipcMain.handle('device:apply', (_event, deviceId, state) => deviceTransport.apply(deviceId, state));
ipcMain.handle('device:lock', (_event, deviceId, locked) => deviceTransport.lock(deviceId, locked));
ipcMain.handle('device:layout', (_event, deviceId) => deviceTransport.layout(deviceId));

ipcMain.handle('vial:fetchDefinition', async (_event, filter) => {
  try {
    return await fetchKeyboardDefinition(filter || {});
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
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

ipcMain.handle('dialog:save', async (_event, opts) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: opts?.defaultPath,
    filters: opts?.filters
  });
  if (result.canceled) return null;
  return result.filePath;
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

ipcMain.handle('generator:process', async (_event, doc, config) => {
  return generator.transformKeymapState(doc, config);
});

ipcMain.handle('generator:run', async (_event, opts = {}) => {
  const log = (msg) => {
    mainWindow?.webContents.send('log:data', msg + '\n');
  };

  try {
    log('Starting generator internally...');
    // We can call generator.main() but it uses hardcoded paths.
    // Let's use the logic from generator.main but with our paths.
    
    if (!fs.existsSync(defaultPaths.config)) {
      throw new Error(`Config not found at ${defaultPaths.config}`);
    }
    
    if (!fs.existsSync(defaultPaths.input)) fs.mkdirSync(defaultPaths.input, { recursive: true });
    const config = JSON.parse(fs.readFileSync(defaultPaths.config, 'utf8'));
    const { results, warnings } = await generator.transformVilDirectory({
      inputDir: opts.input || defaultPaths.input,
      outputDir: opts.output || defaultPaths.output,
      config
    });

    log(`Processed ${results.length} file(s).`);
    results.forEach(({ inputPath, outputPath }) => {
      log(`Processed: ${path.basename(inputPath)} -> ${path.basename(outputPath)}`);
    });
    warnings.forEach((warning) => log(`Warning: untranslated symbol ${warning}`));
    
    log('Generator finished successfully.');
    return { code: 0 };
  } catch (err) {
    log(`Error: ${err.message}`);
    return { code: 1, error: err.message };
  }
});
