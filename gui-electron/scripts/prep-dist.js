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

  // Seed assets that must be present in the packaged app.
  copyIfExists(
    path.join(repoRoot, 'alpha_layers.json'),
    path.join(guiRoot, 'alpha_layers.json')
  );

  // Ensure vitaly exists for the current platform build.
  execFileSync(process.execPath, [path.join(guiRoot, 'scripts', 'fetch-vitaly.js')], {
    stdio: 'inherit'
  });
}

main();

