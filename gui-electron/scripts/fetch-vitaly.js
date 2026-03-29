const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const VITALY_VERSION = '0.1.32';
const REPO = 'bskaplou/vitaly';

const BIN_DIR = path.join(__dirname, '..', 'bin');

const ASSETS = {
  'darwin-arm64': {
    url: `https://github.com/${REPO}/releases/download/v${VITALY_VERSION}/vitaly-aarch64-apple-darwin.tar.xz`,
    filename: 'vitaly-aarch64-apple-darwin.tar.xz',
    binary: 'vitaly'
  },
  'darwin-x64': {
    url: `https://github.com/${REPO}/releases/download/v${VITALY_VERSION}/vitaly-x86_64-apple-darwin.tar.xz`,
    filename: 'vitaly-x86_64-apple-darwin.tar.xz',
    binary: 'vitaly'
  },
  'win32-x64': {
    url: `https://github.com/${REPO}/releases/download/v${VITALY_VERSION}/vitaly-x86_64-pc-windows-msvc.zip`,
    filename: 'vitaly-x86_64-pc-windows-msvc.zip',
    binary: 'vitaly.exe'
  }
};

/** Upstream archives put macOS/Linux binaries in a versioned folder; Windows zip has vitaly.exe at top level. */
function stageBinaryIntoBinDir(binDir, binaryName) {
  const target = path.join(binDir, binaryName);
  if (fs.existsSync(target)) {
    return target;
  }
  const entries = fs.readdirSync(binDir, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const nested = path.join(binDir, e.name, binaryName);
    if (fs.existsSync(nested)) {
      fs.copyFileSync(nested, target);
      if (process.platform !== 'win32') {
        try {
          fs.chmodSync(target, 0o755);
        } catch {
          /* ignore */
        }
      }
      try {
        fs.rmSync(path.join(binDir, e.name), { recursive: true, force: true });
      } catch {
        /* ignore */
      }
      return target;
    }
  }
  throw new Error(
    `Could not find ${binaryName} under ${binDir} after extract (expected top-level or one subfolder).`
  );
}

async function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        download(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function main() {
  if (!fs.existsSync(BIN_DIR)) {
    fs.mkdirSync(BIN_DIR, { recursive: true });
  }

  // Determine current platform (native fetch default)
  let platformKey = `${process.platform}-${process.arch}`;
  if (process.platform === 'darwin' && process.arch === 'x64') platformKey = 'darwin-x64';
  if (process.platform === 'darwin' && process.arch === 'arm64') platformKey = 'darwin-arm64';
  if (process.platform === 'win32') platformKey = 'win32-x64';

  /** Cross-build: on macOS/Linux you must fetch Windows exe explicitly — upstream only ships x64 Windows. */
  let assetsToDownload;
  if (process.argv.includes('--all')) {
    assetsToDownload = Object.keys(ASSETS);
  } else if (process.argv.includes('--win')) {
    assetsToDownload = ['win32-x64'];
  } else {
    assetsToDownload = [platformKey];
  }

  for (const key of assetsToDownload) {
    const asset = ASSETS[key];
    if (!asset) {
      console.warn(`No prebuilt binary for platform: ${key}`);
      continue;
    }

    const dest = path.join(BIN_DIR, asset.filename);
    const already = path.join(BIN_DIR, asset.binary);
    if (!fs.existsSync(already)) {
      try {
        stageBinaryIntoBinDir(BIN_DIR, asset.binary);
        console.log(`Staged from existing extract: ${already}`);
      } catch {
        /* need download */
      }
    }
    if (fs.existsSync(already) && !process.argv.includes('--force')) {
      console.log(`Skip download: ${already} exists (use --force to replace)`);
      continue;
    }

    console.log(`Downloading vitaly v${VITALY_VERSION} for ${key}...`);
    await download(asset.url, dest);

    console.log(`Extracting ${asset.filename}...`);
    if (asset.filename.endsWith('.tar.xz')) {
      execSync(`tar -xJf "${dest}" -C "${BIN_DIR}"`, { stdio: 'inherit' });
    } else if (asset.filename.endsWith('.zip')) {
      // Use powershell on windows if available, or just skip if on unix
      if (process.platform === 'win32') {
        execSync(`powershell -Command "Expand-Archive -Path '${dest}' -DestinationPath '${BIN_DIR}' -Force"`, { stdio: 'inherit' });
      } else {
        execSync(`unzip -o "${dest}" -d "${BIN_DIR}"`, { stdio: 'inherit' });
      }
    }

    // Clean up archive
    fs.unlinkSync(dest);

    const staged = stageBinaryIntoBinDir(BIN_DIR, asset.binary);
    console.log(`Staged: ${staged}`);
  }
}

main().catch(console.error);
