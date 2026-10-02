/*
 * End-to-end check of the web shell in Chromium against a simulated Vial
 * keyboard: connect, read, preview, write, back up.
 *
 *   npm run test:e2e        (builds the web app first)
 *
 * Needs a Chromium for playwright-core (PLAYWRIGHT_BROWSERS_PATH or
 * CHROMIUM_PATH); skips with a message when none is installed.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';
import { chromium } from 'playwright-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');
const testRoot = path.resolve(here, '..');

let browser;
try {
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
} catch (error) {
  console.log(`Skipping web end-to-end test: no Chromium available (${error.message.split('\n')[0]}).`);
  process.exit(0);
}

process.chdir(repoRoot); // vite.config.js paths are relative to the repo root
const server = await preview({ configFile: path.join(repoRoot, 'vite.config.js'), mode: 'web', preview: { port: 0, host: '127.0.0.1' }, logLevel: 'silent' });
const baseUrl = server.resolvedUrls.local[0];

try {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('dialog', (dialog) => dialog.accept());

  // Serve the simulator from the test folder and put it behind navigator.hid.
  await page.route('**/__sim/**', (route) => {
    const file = path.join(testRoot, new URL(route.request().url()).pathname.replace(/^\/__sim\//, ''));
    if (!file.startsWith(testRoot) || !fs.existsSync(file)) return route.fulfill({ status: 404 });
    return route.fulfill({ body: fs.readFileSync(file), contentType: 'text/javascript' });
  });
  await page.addInitScript(() => {
    delete window.showSaveFilePicker; // no native dialog in a headless run: use the download fallback
    const ready = import('/__sim/e2e/sim-entry.js').then((module) => module.hid);
    Object.defineProperty(Navigator.prototype, 'hid', {
      configurable: true,
      get: () => ({
        requestDevice: async (options) => (await ready).requestDevice(options),
        getDevices: async () => (await ready).getDevices(),
        addEventListener: (type, listener) => { ready.then((hid) => hid.addEventListener(type, listener)); },
      }),
    });
  });

  await page.goto(baseUrl);
  await page.click('#viewOnlineBtn');
  await page.waitForSelector('#connectDeviceBtn:not(.hidden)');
  assert.match(await page.textContent('#deviceList'), /Connect keyboard/);

  await page.click('#connectDeviceBtn');
  await page.waitForSelector('.device-card');
  assert.match(await page.textContent('.device-card'), /Simulated Keyboard/);

  await page.click('.device-card');
  await page.waitForFunction(() => document.getElementById('onlineStatus').textContent === 'Ready for sync.');
  assert.match(await page.textContent('#deviceCapabilities'), /Layout options/);
  const renderedKeys = await page.locator('#layoutGrid [class*="key"]').count();
  assert.ok(renderedKeys > 0, 'keyboard layout is drawn');

  await page.click('#previewOnlineSyncBtn');
  await page.waitForFunction(() => document.getElementById('onlineStatus').textContent === 'Preview ready.');
  const diffText = await page.textContent('#previewDiff');
  assert.match(diffText, /Keys \(\d+ changes\)/);

  const before = await page.evaluate(() => window.__sim.keyboard.exportState().keymap);
  await page.click('#runOnlineSyncBtn');
  await page.waitForFunction(() => /Sync completed|Error/.test(document.getElementById('onlineStatus').textContent));
  assert.equal(await page.textContent('#onlineStatus'), 'Sync completed successfully!');
  const after = await page.evaluate(() => window.__sim.keyboard.exportState().keymap);
  assert.notDeepEqual(after, before, 'keys were written to the keyboard');

  // A second preview finds nothing left to do.
  await page.click('#previewOnlineSyncBtn');
  await page.waitForFunction(() => document.getElementById('onlineStatus').textContent === 'Preview ready.');
  assert.match(await page.textContent('#previewDiff'), /No changes required/);

  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#downloadBackupBtn')]);
  assert.equal(download.suggestedFilename(), 'Simulated Keyboard_backup.vil');
  const backup = fs.readFileSync(await download.path(), 'utf8');
  assert.match(backup, /"uid": 17279655951921914625,/);

  assert.deepEqual(errors, []);
  console.log('Web end-to-end test passed.');
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
