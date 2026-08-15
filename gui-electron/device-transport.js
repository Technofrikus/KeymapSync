const defaultFs = require('fs');
const defaultPath = require('path');
const { spawn: defaultSpawn } = require('child_process');

/**
 * Device transport for the Vitaly CLI. This is the only module that knows
 * Vitaly's command grammar, text output, and temporary-file protocol.
 */
function createDeviceTransport({ runCommand, tempDir, fs = defaultFs, path = defaultPath }) {
  function withTemporaryVil(prefix, action) {
    const directory = fs.mkdtempSync(path.join(tempDir, `${prefix}-`));
    const filePath = path.join(directory, 'keymap.vil');
    return Promise.resolve()
      .then(() => action(filePath))
      .finally(() => fs.rmSync(directory, { recursive: true, force: true }));
  }

  return {
    async discover() {
      try {
        const { stdout } = await runCommand(['devices', '-c']);
        return parseVitalyDevices(stdout);
      } catch (err) {
        // Stock Vitaly can report this on stderr while returning exit code 0.
        if (/No matching devices|No devices found/i.test(err.message)) return [];
        throw err;
      }
    },

    snapshot(deviceId) {
      return withTemporaryVil('keymapsync-snapshot', async (filePath) => {
        await runCommand(['-i', String(deviceId), 'save', '-f', filePath]);
        return parseKeymapState(fs.readFileSync(filePath, 'utf8'));
      });
    },

    apply(deviceId, state) {
      return withTemporaryVil('keymapsync-apply', async (filePath) => {
        fs.writeFileSync(filePath, serializeKeymapState(state));
        return runCommand(['-i', String(deviceId), 'load', '-f', filePath]);
      });
    },

    async layout(deviceId) {
      try {
        const { stdout } = await runCommand(['-i', String(deviceId), 'layout']);
        return stdout;
      } catch {
        return null;
      }
    },

    lock(deviceId, locked) {
      return runCommand(['-i', String(deviceId), 'lock', locked ? '-l' : '-u']);
    },
  };
}

// JavaScript cannot precisely represent Vial's numeric UID values. Preserve it
// as a string while the state is in memory, then restore its numeric JSON form
// at the Vitaly persistence boundary.
function parseKeymapState(raw) {
  const state = JSON.parse(raw);
  const uidMatch = raw.match(/"uid"\s*:\s*([0-9]+)/);
  if (uidMatch) state.uid = uidMatch[1];
  return state;
}

function serializeKeymapState(state) {
  return JSON.stringify(state, null, 2).replace(
    /"uid"\s*:\s*"([0-9]+)"/,
    '"uid": $1',
  );
}

function createVitalyRunner({
  isDev,
  appDir,
  repoRoot,
  resourcesPath,
  vitalyName,
  fs = defaultFs,
  path = defaultPath,
  spawn = defaultSpawn,
  platform = process.platform,
  env = process.env,
}) {
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

  function runnableOnThisOS(filePath) {
    const kind = peekExecutableKind(filePath);
    if (platform === 'linux') return kind === 'elf' || kind === 'unknown';
    if (platform === 'darwin') return ['macho64', 'macho32', 'macho_fat', 'unknown'].includes(kind);
    if (platform === 'win32') return kind === 'pe' || kind === 'unknown';
    return true;
  }

  function resolvePath() {
    if (isDev) {
      const local = path.join(appDir, 'bin', vitalyName);
      const reference = path.join(repoRoot, 'Reference only', 'vitaly-main', 'target', 'release', vitalyName);
      if (fs.existsSync(local) && runnableOnThisOS(local)) return local;
      if (fs.existsSync(reference) && runnableOnThisOS(reference)) return reference;
      return vitalyName;
    }
    const candidates = [
      path.join(resourcesPath, 'bin', vitalyName),
      path.join(resourcesPath, vitalyName),
      path.join(resourcesPath, 'app.asar.unpacked', 'bin', vitalyName),
    ];
    return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
  }

  return (args) => new Promise((resolve, reject) => {
    const vitalyPath = resolvePath();
    const child = spawn(vitalyPath, args, { env: { ...env } });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });
    child.on('close', (code) => {
      const fatalStderr = /(^|\n)Error:/m.test(stderr) || /No matching devices found/i.test(stderr);
      if (code === 0 && !fatalStderr) return resolve({ code, stdout, stderr });
      if (code !== 0) return reject(new Error(`vitaly exited with code ${code}: ${stderr || stdout}`));
      return reject(new Error(`vitaly failed (legacy exit code): ${stderr || stdout}`));
    });
    child.on('error', (err) => {
      if (!isDev && err?.code === 'ENOENT') {
        const inspected = [
          path.join(resourcesPath, 'bin', vitalyName),
          path.join(resourcesPath, vitalyName),
          path.join(resourcesPath, 'app.asar.unpacked', 'bin', vitalyName),
        ];
        const status = inspected.map((p) => `${p} [${fs.existsSync(p) ? 'exists' : 'missing'}]`).join('; ');
        return reject(new Error(`Failed to start vitaly (${vitalyPath}): ${err.message}. Checked: ${status}`));
      }
      return reject(new Error(`Failed to start vitaly (${vitalyPath}): ${err.message}`));
    });
  });
}

function parseVitalyDevices(stdout) {
  const devices = [];
  for (const section of stdout.split(/\n\s*\n/)) {
    if (!section.trim() || !section.includes('Product name:')) continue;
    const device = { capabilities: {} };
    let inCapabilities = false;
    for (const line of section.split('\n').map((value) => value.trim())) {
      let match;
      if ((match = line.match(/^Product name: "(.+?)" id: (\d+),/))) {
        device.product_name = match[1];
        device.product_id = Number(match[2]);
        device.id = device.product_id;
      } else if ((match = line.match(/^Manufacturer name: "(.+?)", id: (\d+),/))) {
        device.manufacturer_name = match[1];
        device.vendor_id = Number(match[2]);
      } else if ((match = line.match(/^Release: (\d+), Serial: "(.*?)", Path: "(.+?)"/))) {
        device.release = Number(match[1]);
        device.serial_number = match[2];
        device.path = match[3];
      } else if (line.startsWith('Capabilities:')) {
        inCapabilities = true;
      } else if (inCapabilities && line.includes(':')) {
        const [key, value] = line.split(':').map((part) => part.trim());
        const numericValue = Number.parseInt(value, 10);
        const finalValue = Number.isNaN(numericValue) ? value === 'true' : numericValue;
        device.capabilities[key] = finalValue;
        if (key === 'layer_count') device.layers = finalValue;
        if (key === 'combo_count') device.has_combos = finalValue > 0;
        if (key === 'tap_dance_count') device.has_tap_dance = finalValue > 0;
      }
    }
    if (device.product_id !== undefined) devices.push(device);
  }
  return devices;
}

module.exports = {
  createDeviceTransport,
  createVitalyRunner,
  parseVitalyDevices,
  parseKeymapState,
  serializeKeymapState,
};
