/**
 * node-hid backed transport for the shared Vial definition protocol.
 * @license GPL-2.0-or-later
 */

import { createRequire } from 'node:module';
import { readKeyboardDefinition, MSG_LEN, HID_USAGE_PAGE, HID_USAGE } from './core/vial-definition.js';

const require = createRequire(import.meta.url);

const HID_REPORT_ID = 0x00;
const HID_TIMEOUT_MS = 500;

function normalizeResponse(buf, len) {
  if (!buf) return new Array(len).fill(0);
  const arr = Array.from(buf);
  if (arr.length === len + 1 && arr[0] === HID_REPORT_ID) return arr.slice(1);
  return arr.slice(0, len);
}

function decompressLzma(lzma, data) {
  return new Promise((resolve, reject) => {
    lzma.decompress(Array.from(data), (result, err) => {
      if (err) reject(err);
      else if (typeof result === 'string') resolve(result);
      else if (result instanceof Uint8Array) resolve(new TextDecoder().decode(result));
      else resolve(String(result));
    });
  });
}

async function decompressXz(xzMod, data) {
  const input = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(data));
      controller.close();
    },
  });
  const text = await new Response(new xzMod.XzReadableStream(input)).arrayBuffer();
  return new TextDecoder().decode(text);
}

/**
 * @param {{ vendorId: number, productId: number, serialNumber?: string }} filter
 */
async function fetchKeyboardDefinition(filter) {
  let HID;
  let lzma;
  let xzDecompress;
  try {
    HID = require('node-hid');
    lzma = require('lzma');
    xzDecompress = require('xz-decompress');
  } catch {
    return {
      ok: false,
      error: 'Optional dependency missing: install node-hid, lzma, and xz-decompress in shells/electron for exact keyboard layouts.',
    };
  }

  const deviceInfo = HID.devices().find(
    (d) =>
      d.vendorId === filter.vendorId &&
      d.productId === filter.productId &&
      d.usagePage === HID_USAGE_PAGE &&
      d.usage === HID_USAGE &&
      (filter.serialNumber === undefined || filter.serialNumber === '' || (d.serialNumber ?? '') === filter.serialNumber),
  );
  if (!deviceInfo || !deviceInfo.path) {
    return { ok: false, error: 'HID device not found for definition fetch' };
  }

  const openAsync = HID.HIDAsync && HID.HIDAsync.open;
  if (!openAsync) return { ok: false, error: 'node-hid HIDAsync API not available' };

  const dev = await openAsync(deviceInfo.path);
  try {
    const sendReceive = async (message) => {
      await dev.write([HID_REPORT_ID, ...message]);
      return normalizeResponse(await dev.read(HID_TIMEOUT_MS), MSG_LEN);
    };
    return await readKeyboardDefinition(sendReceive, {
      xz: (data) => decompressXz(xzDecompress, data),
      lzma: (data) => decompressLzma(lzma, data),
    });
  } finally {
    try { await dev.close(); } catch { /* ignore */ }
  }
}

export { fetchKeyboardDefinition };
