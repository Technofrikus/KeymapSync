const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const generator = require('./generate_vial_keymaps.js');
const { fetchKeyboardDefinition } = require('./vial-fetch-definition.js');

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

// In packaged app, __dirname is inside asar or resources
// In development, it's gui-electron/
const projectRoot = isDev 
  ? path.resolve(__dirname, '..') 
  : path.join(process.resourcesPath, 'app'); // Standard electron-builder path for extra files

const defaultPaths = {
  config: path.join(projectRoot, 'alpha_layers.json'),
  input: path.join(projectRoot, 'original'),
  output: path.join(projectRoot, 'output'),
  script: path.join(__dirname, 'generate_vial_keymaps.js'),
  vitaly: process.platform === 'win32' ? 'vitaly.exe' : 'vitaly'
};

/** First bytes of the executable — avoid using a Linux ELF from Docker builds on macOS/Windows (spawn error -8). */
function peekExecutableKind(filePath) {
  try {
    const buf = Buffer.alloc(8);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buf, 0, 8, 0);
    fs.closeSync(fd);
    if (buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46) return 'elf';
    if (buf[0] === 0xcf && buf[1] === 0xfa && buf[2] === 0xed && buf[3] === 0xfe) return 'macho64';
    if (buf[0] === 0xce && buf[1] === 0xfa && buf[2] === 0xed && buf[3] === 0xfe) return 'macho32';
    if (buf[0] === 0xca && buf[1] === 0xfe && buf[2] === 0xba && buf[3] === 0xbe) return 'macho_fat';
    if (buf[0] === 0x4d && buf[1] === 0x5a) return 'pe';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

function isBundledVitalyRunnableOnThisOS(refPath) {
  const kind = peekExecutableKind(refPath);
  if (process.platform === 'linux') {
    return kind === 'elf' || kind === 'unknown';
  }
  if (process.platform === 'darwin') {
    return kind === 'macho64' || kind === 'macho32' || kind === 'macho_fat' || kind === 'unknown';
  }
  if (process.platform === 'win32') {
    return kind === 'pe' || kind === 'unknown';
  }
  return true;
}

// Helper to run vitaly commands
async function runVitaly(args) {
  let vitalyPath;
  if (isDev) {
    // 1. Prefer locally fetched vitaly in gui-electron/bin/
    const localBinPath = path.join(__dirname, 'bin', defaultPaths.vitaly);
    // 2. Fallback to Reference only/ (if manually built)
    const refPath = path.join(projectRoot, 'Reference only', 'vitaly-main', 'target', 'release', defaultPaths.vitaly);
    
    if (fs.existsSync(localBinPath) && isBundledVitalyRunnableOnThisOS(localBinPath)) {
      vitalyPath = localBinPath;
    } else if (fs.existsSync(refPath) && isBundledVitalyRunnableOnThisOS(refPath)) {
      vitalyPath = refPath;
    } else {
      // 3. Fallback to system PATH
      vitalyPath = defaultPaths.vitaly;
    }
  } else {
    // In production, vitaly should be in the app's resources/bin (from extraResources)
    vitalyPath = path.join(process.resourcesPath, 'bin', defaultPaths.vitaly);
  }
  
  return new Promise((resolve, reject) => {
    const child = spawn(vitalyPath, args, { env: { ...process.env } });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    child.on('close', (code) => {
      // Older vitaly builds always exited 0 even when printing "Error:" to stderr.
      const stderrLooksFatal =
        /(^|\n)Error:/m.test(stderr) || /No matching devices found/i.test(stderr);
      if (code === 0 && !stderrLooksFatal) {
        resolve({ code, stdout, stderr });
      } else if (code !== 0) {
        reject(new Error(`vitaly exited with code ${code}: ${stderr || stdout}`));
      } else {
        reject(new Error(`vitaly failed (legacy exit code): ${stderr || stdout}`));
      }
    });
    
    child.on('error', (err) => {
      reject(new Error(`Failed to start vitaly (${vitalyPath}): ${err.message}`));
    });
  });
}

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

// Helper to parse vitaly devices output since it doesn't support --json
function parseVitalyDevices(stdout) {
  const devices = [];
  const sections = stdout.split(/\n\s*\n/);
  
  for (const section of sections) {
    if (!section.trim() || !section.includes('Product name:')) continue;
    
    const device = { capabilities: {} };
    const lines = section.split('\n').map(l => l.trim());
    let inCapabilities = false;
    
    for (const line of lines) {
      if (line.startsWith('Product name:')) {
        const match = line.match(/Product name: "(.+?)" id: (\d+),/);
        if (match) {
          device.product_name = match[1];
          device.product_id = parseInt(match[2]);
          device.id = device.product_id;
        }
      } else if (line.startsWith('Manufacturer name:')) {
        const match = line.match(/Manufacturer name: "(.+?)", id: (\d+),/);
        if (match) {
          device.manufacturer_name = match[1];
          device.vendor_id = parseInt(match[2]);
        }
      } else if (line.startsWith('Release:')) {
        const match = line.match(/Release: (\d+), Serial: "(.*?)", Path: "(.+?)"/);
        if (match) {
          device.release = parseInt(match[1]);
          device.serial_number = match[2];
          device.path = match[3];
        }
      } else if (line.startsWith('Capabilities:')) {
        inCapabilities = true;
      } else if (inCapabilities && line.includes(':')) {
        const [key, value] = line.split(':').map(s => s.trim());
        const numValue = parseInt(value);
        const finalValue = isNaN(numValue) ? (value === 'true') : numValue;
        device.capabilities[key] = finalValue;
        
        // Map to keys expected by renderer.js
        if (key === 'layer_count') device.layers = finalValue;
        if (key === 'combo_count') device.has_combos = finalValue > 0;
        if (key === 'tap_dance_count') device.has_tap_dance = finalValue > 0;
      }
    }
    
    if (device.product_id !== undefined) {
      devices.push(device);
    }
  }
  
  return devices;
}

ipcMain.handle('vitaly:devices', async () => {
  try {
    const { stdout } = await runVitaly(['devices', '-c']);
    return parseVitalyDevices(stdout);
  } catch (err) {
    // Stock vitaly prints "No matching devices found" on stderr (often with exit 0).
    if (/No matching devices|No devices found/i.test(err.message)) return [];
    throw err;
  }
});

ipcMain.handle('vitaly:save', async (_event, deviceId) => {
  // vitaly -i <id> save -f <file>
  const tmpFile = path.join(app.getPath('temp'), `vial_backup_${Date.now()}.vil`);
  await runVitaly(['-i', String(deviceId), 'save', '-f', tmpFile]);
  const content = fs.readFileSync(tmpFile, 'utf8');
  return JSON.parse(content);
});

ipcMain.handle('vitaly:apply', async (_event, deviceId, type, data) => {
  // type can be 'keys', 'combos', 'tapdance', or 'load' (full file)
  const tmpFile = path.join(app.getPath('temp'), `vial_apply_${Date.now()}.vil`);
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2));
  
  // vitaly -i <id> load -f <file>
  return await runVitaly(['-i', String(deviceId), 'load', '-f', tmpFile]);
});

ipcMain.handle('vitaly:lock', async (_event, deviceId, state) => {
  // vitaly -i <id> lock [-l|-u]
  const arg = state ? '-l' : '-u';
  return await runVitaly(['-i', String(deviceId), 'lock', arg]);
});

ipcMain.handle('vitaly:layout', async (_event, deviceId) => {
  try {
    const { stdout } = await runVitaly(['-i', String(deviceId), 'layout']);
    return stdout;
  } catch (err) {
    return null;
  }
});

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
  return generator.processConfig(doc, config);
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
    
    if (!fs.existsSync(defaultPaths.input)) {
      fs.mkdirSync(defaultPaths.input, { recursive: true });
    }
    if (!fs.existsSync(defaultPaths.output)) {
      fs.mkdirSync(defaultPaths.output, { recursive: true });
    }

    const config = JSON.parse(fs.readFileSync(defaultPaths.config, 'utf8'));
    const files = fs.readdirSync(defaultPaths.input).filter((f) => f.endsWith('.vil'));
    
    log(`Found ${files.length} files in ${defaultPaths.input}`);
    
    for (const file of files) {
      const inputPath = path.join(defaultPaths.input, file);
      const raw = fs.readFileSync(inputPath, 'utf8');
      const uidMatch = raw.match(/"uid"\s*:\s*([0-9]+)/);
      const uidLiteral = uidMatch ? uidMatch[1] : null;
      const doc = JSON.parse(raw);
      
      generator.applyAlphaMappings(doc, config);
      generator.applyOverrides(doc, config);
      
      const { name, ext } = path.parse(file);
      const outputPath = path.join(defaultPaths.output, `${name}_edited${ext}`);
      
      const json = JSON.stringify(doc, null, 2);
      if (uidLiteral) {
        const replaced = json.replace(/"uid"\s*:\s*"?[0-9A-Za-z]+"?/, `"uid": ${uidLiteral}`);
        fs.writeFileSync(outputPath, replaced);
      } else {
        fs.writeFileSync(outputPath, json);
      }
      
      log(`Processed: ${file} -> ${path.basename(outputPath)}`);
    }
    
    log('Generator finished successfully.');
    return { code: 0 };
  } catch (err) {
    log(`Error: ${err.message}`);
    return { code: 1, error: err.message };
  }
});

