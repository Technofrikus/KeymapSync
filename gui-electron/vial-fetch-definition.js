/**
 * Fetch keyboard definition (KLE JSON) from a Vial HID device — adapted from pipette hid-service probe.
 * @license GPL-2.0-or-later
 */

const MSG_LEN = 32;
const HID_USAGE_PAGE = 0xff60;
const HID_USAGE = 0x61;
const HID_REPORT_ID = 0x00;
const HID_TIMEOUT_MS = 500;

const CMD_VIA_GET_KEYBOARD_VALUE = 0x02;
const CMD_VIA_VIAL_PREFIX = 0xfe;
const CMD_VIAL_GET_KEYBOARD_ID = 0x00;
const CMD_VIAL_GET_SIZE = 0x01;
const CMD_VIAL_GET_DEFINITION = 0x02;
const VIA_LAYOUT_OPTIONS = 0x02;

const XZ_MAGIC = Buffer.from([0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00]);

function padToMsgLen(data) {
  const padded = new Array(MSG_LEN).fill(0);
  for (let i = 0; i < Math.min(data.length, MSG_LEN); i++) padded[i] = data[i];
  return padded;
}

function normalizeResponse(buf, len) {
  if (!buf) return new Array(len).fill(0);
  const raw = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  const arr = Array.from(raw);
  if (arr.length === len + 1 && arr[0] === HID_REPORT_ID) return arr.slice(1);
  return arr.slice(0, len);
}

function readLE32(buf, offset) {
  return buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | ((buf[offset + 3] << 24) >>> 0);
}

function readBE32(buf, offset) {
  return ((buf[offset] << 24) >>> 0) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3];
}

function writeLE32(arr, offset, value) {
  arr[offset] = value & 0xff;
  arr[offset + 1] = (value >> 8) & 0xff;
  arr[offset + 2] = (value >> 16) & 0xff;
  arr[offset + 3] = (value >> 24) & 0xff;
}

function hasXzMagic(buf) {
  if (buf.length < XZ_MAGIC.length) return false;
  for (let i = 0; i < XZ_MAGIC.length; i++) if (buf[i] !== XZ_MAGIC[i]) return false;
  return true;
}

function decompressLzmaPromise(lzma, data) {
  return new Promise((resolve, reject) => {
    lzma.decompress(data, (result, err) => {
      if (err) reject(err);
      else {
        if (typeof result === 'string') resolve(result);
        else if (result instanceof Uint8Array) resolve(Buffer.from(result).toString('utf8'));
        else resolve(String(result));
      }
    });
  });
}

async function decompressXz(xzMod, buf) {
  const { XzReadableStream } = xzMod;
  const input = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(buf));
      controller.close();
    },
  });
  const stream = new XzReadableStream(input);
  const reader = stream.getReader();
  const chunks = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
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
  } catch (e) {
    return {
      ok: false,
      error: 'Optional dependency missing: install node-hid, lzma, and xz-decompress in gui-electron for exact keyboard layouts.',
    };
  }

  const devices = HID.devices();
  const deviceInfo = devices.find(
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
  if (!openAsync) {
    return { ok: false, error: 'node-hid HIDAsync API not available' };
  }

  const dev = await openAsync(deviceInfo.path);

  try {
    async function sendReceive(data) {
      const padded = padToMsgLen(data);
      await dev.write([HID_REPORT_ID, ...padded]);
      const resp = await dev.read(HID_TIMEOUT_MS);
      return normalizeResponse(resp, MSG_LEN);
    }

    const idResp = await sendReceive([CMD_VIA_VIAL_PREFIX, CMD_VIAL_GET_KEYBOARD_ID]);
    readLE32(idResp, 0);

    const sizeResp = await sendReceive([CMD_VIA_VIAL_PREFIX, CMD_VIAL_GET_SIZE]);
    const defSize = readLE32(sizeResp, 0);
    if (!defSize || defSize > 2 * 1024 * 1024) {
      return { ok: false, error: 'Invalid definition size from device' };
    }

    const compressedBuf = Buffer.alloc(defSize);
    const blocks = Math.ceil(defSize / MSG_LEN);
    for (let block = 0; block < blocks; block++) {
      const pkt = new Array(MSG_LEN).fill(0);
      pkt[0] = CMD_VIA_VIAL_PREFIX;
      pkt[1] = CMD_VIAL_GET_DEFINITION;
      writeLE32(pkt, 2, block);
      const resp = await sendReceive(pkt);
      const copyLen = Math.min(MSG_LEN, defSize - block * MSG_LEN);
      for (let i = 0; i < copyLen; i++) {
        compressedBuf[block * MSG_LEN + i] = resp[i];
      }
    }

    let jsonStr;
    if (hasXzMagic(compressedBuf)) {
      jsonStr = await decompressXz(xzDecompress, compressedBuf);
    } else {
      jsonStr = await decompressLzmaPromise(lzma, Array.from(compressedBuf));
    }

    if (!jsonStr) {
      return { ok: false, error: 'Failed to decompress keyboard definition' };
    }

    const definition = JSON.parse(jsonStr);

    let layoutOptionsPacked = 0;
    try {
      const layoutResp = await sendReceive([CMD_VIA_GET_KEYBOARD_VALUE, VIA_LAYOUT_OPTIONS]);
      layoutOptionsPacked = readBE32(layoutResp, 2);
    } catch {
      layoutOptionsPacked = 0;
    }

    return {
      ok: true,
      definition,
      layoutOptionsPacked,
    };
  } finally {
    try {
      await dev.close();
    } catch {
      /* ignore */
    }
  }
}

module.exports = { fetchKeyboardDefinition };
