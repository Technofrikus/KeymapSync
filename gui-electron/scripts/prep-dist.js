const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function copyIfExists(from, to) {
  if (!fs.existsSync(from)) {
    throw new Error(`Required file missing: ${from}`);
  }
  fs.copyFileSync(from, to);
}

function main() {
  const guiRoot = path.resolve(__dirname, '..');
  const repoRoot = path.resolve(guiRoot, '..');
  const targetWindows = process.argv.includes('--win') || process.platform === 'win32';

  // Seed assets that must be present in the packaged app.
  copyIfExists(
    path.join(repoRoot, 'alpha_layers.json'),
    path.join(guiRoot, 'alpha_layers.json')
  );

  // Ensure vitaly exists for the current platform build.
  const fetchArgs = [path.join(guiRoot, 'scripts', 'fetch-vitaly.js')];
  if (targetWindows) fetchArgs.push('--win');
  execFileSync(process.execPath, fetchArgs, {
    stdio: 'inherit'
  });

  const vitalyName = targetWindows ? 'vitaly.exe' : 'vitaly';
  const vitalyPath = path.join(guiRoot, 'bin', vitalyName);
  if (!fs.existsSync(vitalyPath)) {
    throw new Error(`Required vitaly binary missing after fetch: ${vitalyPath}`);
  }
  if (process.platform !== 'win32') {
    // Ensure executable bit is present before packaging.
    fs.chmodSync(vitalyPath, 0o755);
  }
}

main();
