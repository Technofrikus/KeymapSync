/**
 * Vial keyboard definition protocol — adapted from pipette hid-service probe.
 *
 * Transport-independent: callers supply `sendReceive`, which writes one
 * 32-byte message to the keyboard's raw HID interface and resolves with the
 * 32-byte response, plus the decompressors for the definition blob. The
 * Electron shell backs this with node-hid; the web shell will use WebHID.
 * @license GPL-2.0-or-later
 */

const MSG_LEN = 32;
const HID_USAGE_PAGE = 0xff60;
const HID_USAGE = 0x61;

const CMD_VIA_GET_KEYBOARD_VALUE = 0x02;
const CMD_VIA_VIAL_PREFIX = 0xfe;
const CMD_VIAL_GET_KEYBOARD_ID = 0x00;
const CMD_VIAL_GET_SIZE = 0x01;
const CMD_VIAL_GET_DEFINITION = 0x02;
const VIA_LAYOUT_OPTIONS = 0x02;
const MAX_DEFINITION_SIZE = 2 * 1024 * 1024;

const XZ_MAGIC = [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00];

function padToMsgLen(data) {
  const padded = new Array(MSG_LEN).fill(0);
  for (let i = 0; i < Math.min(data.length, MSG_LEN); i++) padded[i] = data[i];
  return padded;
}

function readLE32(buf, offset) {
  return (buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24)) >>> 0;
}

function readBE32(buf, offset) {
  return ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>> 0;
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

/**
 * @param {(message: number[]) => Promise<ArrayLike<number>>} sendReceive
 * @param {{ xz: (data: Uint8Array) => Promise<string>, lzma: (data: Uint8Array) => Promise<string> }} decompress
 * @returns {Promise<{ ok: true, definition: object, layoutOptionsPacked: number } | { ok: false, error: string }>}
 */
async function readKeyboardDefinition(sendReceive, decompress) {
  const exchange = (data) => sendReceive(padToMsgLen(data));

  await exchange([CMD_VIA_VIAL_PREFIX, CMD_VIAL_GET_KEYBOARD_ID]);

  const sizeResp = await exchange([CMD_VIA_VIAL_PREFIX, CMD_VIAL_GET_SIZE]);
  const defSize = readLE32(sizeResp, 0);
  if (!defSize || defSize > MAX_DEFINITION_SIZE) {
    return { ok: false, error: 'Invalid definition size from device' };
  }

  const compressed = new Uint8Array(defSize);
  const blocks = Math.ceil(defSize / MSG_LEN);
  for (let block = 0; block < blocks; block++) {
    const pkt = new Array(MSG_LEN).fill(0);
    pkt[0] = CMD_VIA_VIAL_PREFIX;
    pkt[1] = CMD_VIAL_GET_DEFINITION;
    writeLE32(pkt, 2, block);
    const resp = await exchange(pkt);
    const copyLen = Math.min(MSG_LEN, defSize - block * MSG_LEN);
    for (let i = 0; i < copyLen; i++) compressed[block * MSG_LEN + i] = resp[i];
  }

  const jsonStr = hasXzMagic(compressed)
    ? await decompress.xz(compressed)
    : await decompress.lzma(compressed);
  if (!jsonStr) return { ok: false, error: 'Failed to decompress keyboard definition' };

  const definition = JSON.parse(jsonStr);

  let layoutOptionsPacked = 0;
  try {
    const layoutResp = await exchange([CMD_VIA_GET_KEYBOARD_VALUE, VIA_LAYOUT_OPTIONS]);
    layoutOptionsPacked = readBE32(layoutResp, 2);
  } catch {
    layoutOptionsPacked = 0;
  }

  return { ok: true, definition, layoutOptionsPacked };
}

export { readKeyboardDefinition, MSG_LEN, HID_USAGE_PAGE, HID_USAGE };
