const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const generator = require('./generate_vial_keymaps.js');
const { fetchKeyboardDefinition } = require('./vial-fetch-definition.js');
const { createDeviceTransport, createVitalyRunner, serializeKeymapState } = require('./device-transport.js');
const { createFileAuthority, FileAuthorityError } = require('./file-authority.js');
const configValidator = require('./config-validation.js');

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
let hasUnsavedChanges = false;
let closePending = false;
let allowWindowClose = false;
const pendingSaveRequests = new Map();
const fileAuthority = createFileAuthority();

function parseAndValidateConfig(raw, source = 'configuration') {
  const validator = configValidator;
  if (typeof raw === 'string' && typeof validator.parseConfig === 'function') return validator.parseConfig(raw, source);
  const config = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (typeof validator.assertValidConfig === 'function') {
    validator.assertValidConfig(config, source);
  } else if (typeof validator.validateConfig === 'function') {
    const result = validator.validateConfig(config);
    if (!result?.valid) {
      const details = (result.issues || result.errors || []).map((issue) => issue.message || String(issue)).join('; ');
      throw new Error(`Invalid ${source}${details ? `: ${details}` : '.'}`);
    }
  }
  return config;
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value;
}

function ipcWindow(event) {
  const sender = event?.sender;
  if (!sender || !mainWindow || sender.id !== mainWindow.webContents.id || sender.isDestroyed?.()) {
    throw new FileAuthorityError('IPC sender is not the active application window.', 'UNTRUSTED_SENDER');
  }
  // Renderer code must run in the top-level isolated world, never in a child
  // frame that happened to navigate under our window.
  if (event.senderFrame && event.sender.mainFrame && event.senderFrame !== event.sender.mainFrame) {
    throw new FileAuthorityError('IPC is only available to the main frame.', 'UNTRUSTED_FRAME');
  }
  if (event.senderFrame?.url && !event.senderFrame.url.startsWith('file://')) {
    throw new FileAuthorityError('IPC is only available to the packaged application page.', 'UNTRUSTED_ORIGIN');
  }
  return sender;
}

function ownerFor(event) {
  return ipcWindow(event).id;
}

function windowFor(event) {
  ipcWindow(event);
  return BrowserWindow.fromWebContents(event.sender) || mainWindow;
}

function writeFileAtomic(target, content) {
  const temporary = `${target}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
  try {
    fs.writeFileSync(temporary, content, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporary, target);
  } finally {
    try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch { /* preserve original error */ }
  }
}

function requestRendererSave(window) {
  const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pendingSaveRequests.delete(requestId);
      resolve({ ok: false, error: 'Saving did not receive a response from the editor.' });
    }, 30000);
    pendingSaveRequests.set(requestId, (result) => {
      clearTimeout(timeout);
      resolve(result || { ok: false, error: 'Saving failed without a result.' });
    });
    window.webContents.send('app:save-before-quit', requestId);
  });
}

function createWindow() {
  allowWindowClose = false;
  closePending = false;
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    title: "",
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 10, y: 10 },
    icon: path.join(__dirname, 'KSiconReal.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  const windowOwnerId = mainWindow.webContents.id;

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
  
  // Reset unsaved changes when window is created
  hasUnsavedChanges = false;
  
  // Handle window close to check for unsaved changes
  mainWindow.on('close', async (event) => {
    if (allowWindowClose || !hasUnsavedChanges) return;
    event.preventDefault();
    if (closePending) return;
    closePending = true;
      
    try {
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
        const saveResult = await requestRendererSave(mainWindow);
        if (saveResult.ok) {
          hasUnsavedChanges = false;
          allowWindowClose = true;
          mainWindow.close();
        } else {
          await dialog.showMessageBox(mainWindow, {
            type: 'error',
            title: 'Changes Not Saved',
            message: saveResult.error || 'The configuration could not be saved. The window will remain open.',
          });
        }
      } else if (response.response === 1) {
        hasUnsavedChanges = false;
        allowWindowClose = true;
        mainWindow.close();
      }
    } finally {
      closePending = false;
    }
  });

  mainWindow.on('closed', () => {
    // Capabilities are session-scoped. A later window must not inherit paths
    // selected by a previous renderer, even if Electron reuses its id.
    fileAuthority.revokeOwner(windowOwnerId);
    mainWindow = null;
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('app:defaults', (event) => {
  const owner = ownerFor(event);
  // Each workflow may initialize independently. Keep previously issued
  // grants alive for the lifetime of the window so one workflow cannot
  // invalidate another workflow's active configuration grant.
  return {
    config: fileAuthority.register(defaultPaths.config, {
      owner, kind: 'config', operations: ['read', 'write']
    }),
    input: fileAuthority.register(defaultPaths.input, {
      owner, kind: 'input', operations: ['read']
    }),
    output: fileAuthority.register(defaultPaths.output, {
      owner, kind: 'output', operations: ['write']
    }),
  };
});

ipcMain.handle('app:setUnsavedChanges', (event, hasChanges) => {
  ipcWindow(event);
  if (typeof hasChanges !== 'boolean') throw new TypeError('hasChanges must be a boolean.');
  hasUnsavedChanges = hasChanges;
});

ipcMain.on('app:save-before-quit-result', (event, requestId, result) => {
  try { ipcWindow(event); } catch { return; }
  if (typeof requestId !== 'string' || !result || typeof result !== 'object') return;
  const resolve = pendingSaveRequests.get(requestId);
  if (!resolve) return;
  pendingSaveRequests.delete(requestId);
  resolve(result);
});

ipcMain.handle('device:discover', (event) => { ipcWindow(event); return deviceTransport.discover(); });
ipcMain.handle('device:snapshot', (event, deviceId) => { ipcWindow(event); return deviceTransport.snapshot(deviceId); });
ipcMain.handle('device:apply', (event, deviceId, state) => { ipcWindow(event); return deviceTransport.apply(deviceId, state); });
ipcMain.handle('device:lock', (event, deviceId, locked) => { ipcWindow(event); return deviceTransport.lock(deviceId, locked); });
ipcMain.handle('device:layout', (event, deviceId) => { ipcWindow(event); return deviceTransport.layout(deviceId); });

ipcMain.handle('vial:fetchDefinition', async (event, filter) => {
  ipcWindow(event);
  if (filter !== undefined) assertPlainObject(filter, 'filter');
  try {
    return await fetchKeyboardDefinition(filter || {});
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

ipcMain.handle('app:checkUnsavedChanges', (event) => {
  ipcWindow(event);
  return hasUnsavedChanges;
});

ipcMain.handle('config:choose', async (event) => {
  const owner = ownerFor(event);
  const win = windowFor(event);
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [{ name: 'JSON configuration', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePaths?.length) return null;
  const target = result.filePaths[0];
  let config;
  try {
    config = parseAndValidateConfig(fs.readFileSync(target, 'utf8'), target);
  } catch (err) {
    throw new Error(`Could not load configuration at ${target}: ${err.message}`);
  }
  return {
    grant: fileAuthority.register(target, { owner, kind: 'config', operations: ['read', 'write'] }),
    config,
  };
});

ipcMain.handle('config:load', async (event, grantId) => {
  const owner = ownerFor(event);
  const grant = fileAuthority.resolve(grantId, { owner, kind: 'config', operation: 'read' });
  try {
    return {
      grant: fileAuthority.publicGrant(grant),
      config: parseAndValidateConfig(fs.readFileSync(grant.path, 'utf8'), grant.path),
    };
  } catch (err) {
    throw new Error(`Could not load configuration at ${grant.path}: ${err.message}`);
  }
});

ipcMain.handle('config:save', async (event, grantId, config) => {
  const owner = ownerFor(event);
  const grant = fileAuthority.resolve(grantId, { owner, kind: 'config', operation: 'write' });
  const value = parseAndValidateConfig(config, grant.path);
  writeFileAtomic(grant.path, JSON.stringify(value, null, 2));
  return { grant: fileAuthority.publicGrant(grant), displayPath: grant.path };
});

ipcMain.handle('directory:choose', async (event, payload = {}) => {
  const owner = ownerFor(event);
  const opts = assertPlainObject(payload, 'directory selection');
  if (!['input', 'output'].includes(opts.kind)) throw new FileAuthorityError('Directory kind must be input or output.', 'INVALID_KIND');
  let defaultPath;
  if (opts.currentGrantId !== undefined) {
    defaultPath = fileAuthority.resolve(opts.currentGrantId, { owner, kind: opts.kind }).path;
  }
  const result = await dialog.showOpenDialog(windowFor(event), {
    properties: ['openDirectory'],
    defaultPath,
  });
  if (result.canceled || !result.filePaths?.length) return null;
  return fileAuthority.register(result.filePaths[0], {
    owner, kind: opts.kind, operations: opts.kind === 'input' ? ['read'] : ['write']
  });
});

ipcMain.handle('vial:saveBackup', async (event, payload = {}) => {
  ownerFor(event);
  const opts = assertPlainObject(payload, 'backup');
  if (typeof opts.suggestedName !== 'string' || !opts.suggestedName.trim()) throw new Error('A backup filename is required.');
  if (!opts.state || typeof opts.state !== 'object' || Array.isArray(opts.state)) throw new Error('A valid keymap state is required.');
  const result = await dialog.showSaveDialog(windowFor(event), {
    // A basename prevents a renderer from smuggling an arbitrary destination
    // into the dialog's initial location. The user still chooses the final path.
    defaultPath: path.basename(opts.suggestedName),
    filters: [{ name: 'Vial Layout', extensions: ['vil'] }],
  });
  if (result.canceled || !result.filePath) return null;
  writeFileAtomic(result.filePath, serializeKeymapState(opts.state));
  return { displayPath: result.filePath };
});

ipcMain.handle('generator:process', async (event, doc, config) => {
  ipcWindow(event);
  assertPlainObject(config, 'config');
  parseAndValidateConfig(config, 'configuration');
  return generator.transformKeymapState(doc, config);
});

ipcMain.handle('generator:run', async (event, opts = {}) => {
  const owner = ownerFor(event);
  const payload = assertPlainObject(opts, 'generator options');
  const configGrant = fileAuthority.resolve(payload.configGrant, { owner, kind: 'config', operation: 'read' });
  const inputGrant = fileAuthority.resolve(payload.inputGrant, { owner, kind: 'input', operation: 'read' });
  const outputGrant = fileAuthority.resolve(payload.outputGrant, { owner, kind: 'output', operation: 'write' });
  const log = (msg) => event.sender.send('log:data', `${msg}\n`);

  try {
    log('Starting generator internally...');
    const config = parseAndValidateConfig(fs.readFileSync(configGrant.path, 'utf8'), configGrant.path);
    if (!fs.existsSync(outputGrant.path)) fs.mkdirSync(outputGrant.path, { recursive: true });
    const { results, warnings } = await generator.transformVilDirectory({
      inputDir: inputGrant.path,
      outputDir: outputGrant.path,
      config,
    });
    log(`Processed ${results.length} file(s).`);
    results.forEach(({ inputPath, outputPath }) => log(`Processed: ${path.basename(inputPath)} -> ${path.basename(outputPath)}`));
    warnings.forEach((warning) => log(`Warning: untranslated symbol ${warning}`));
    log('Generator finished successfully.');
    return { code: 0 };
  } catch (err) {
    log(`Error: ${err.message}`);
    return { code: 1, error: err.message };
  }
});
