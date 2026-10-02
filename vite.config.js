import { defineConfig } from 'vite';

// One shared app (`app/`), built once per shell. `--mode web` writes the
// static web site (WebHID) into `dist/web`, and `--mode tauri` writes the
// Tauri desktop build into `dist/tauri`.
const outDirs = {
  web: '../dist/web',
  tauri: '../dist/tauri',
};

export default defineConfig(({ mode }) => ({
  root: 'app',
  // Relative asset URLs so the build also loads from a local file or app shell.
  base: './',
  build: {
    outDir: outDirs[mode] || '../dist/app',
    emptyOutDir: true,
  },
}));
