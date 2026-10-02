import { defineConfig } from 'vite';

// One shared app (`app/`), built once per shell. `--mode electron` writes the
// renderer into the Electron shell; later modes add the web and Tauri builds.
const outDirs = {
  electron: '../shells/electron/renderer',
};

export default defineConfig(({ mode }) => ({
  root: 'app',
  // Relative asset URLs so the build also loads from file:// (Electron).
  base: './',
  build: {
    outDir: outDirs[mode] || '../dist/app',
    emptyOutDir: true,
  },
}));
