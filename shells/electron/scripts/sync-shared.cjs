// Copies the shared core modules the Electron main process needs from
// `app/src/core/` into `shells/electron/core/`, and optionally builds the
// shared app into `shells/electron/renderer/`. Both folders are generated
// (git-ignored) so the shell can be packaged on its own.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const shellRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(shellRoot, '..', '..');
const sharedCore = path.join(repoRoot, 'app', 'src', 'core');
const MAIN_PROCESS_MODULES = ['config-validation.js', 'keymap-state.js', 'vial-definition.js'];

function syncCore() {
  const target = path.join(shellRoot, 'core');
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
  for (const file of MAIN_PROCESS_MODULES) {
    fs.copyFileSync(path.join(sharedCore, file), path.join(target, file));
  }
}

function buildRenderer() {
  execSync('npm run build:electron', { cwd: repoRoot, stdio: 'inherit' });
}

syncCore();
if (process.argv.includes('--renderer')) buildRenderer();
