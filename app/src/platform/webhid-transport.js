/**
 * WebHID transport for the Vial raw HID interface.
 *
 * One request is in flight at a time: each 32-byte message is sent as an
 * output report and answered by one 32-byte input report. A request that gets
 * no answer within the timeout is sent again (like vial-gui's `hid_send`).
 * Device picking follows the VIA web app (the-via/app, GPL-3.0): filter on the
 * raw HID usage page/usage and open the device lazily.
 * @license GPL-3.0-or-later
 */
import { MSG_LEN, HID_USAGE_PAGE, HID_USAGE } from '../core/vial-definition.js';

const LAST_VIA_COMMAND = 0x14;
const RAW_HID_FILTER = { usagePage: HID_USAGE_PAGE, usage: HID_USAGE };

class HidTransportError extends Error {
  constructor(message, code = 'HID') {
    super(message);
    this.name = 'HidTransportError';
    this.code = code;
  }
}

/** True for the raw HID interface (other interfaces of the same keyboard are skipped). */
function isRawHidInterface(device) {
  return (device.collections || []).some((collection) => (
    collection.usagePage === HID_USAGE_PAGE && collection.usage === HID_USAGE
  ));
}

/**
 * @param {HIDDevice} device
 * @param {{ timeoutMs?: number, attempts?: number }} [options]
 */
function createHidTransport(device, { timeoutMs = 500, attempts = 5 } = {}) {
  let queue = Promise.resolve();
  let pending = null;

  const onInputReport = (event) => {
    if (!pending) return; // stray report (e.g. a late answer after a retry)
    const view = event.data;
    const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    // Core VIA commands echo their id (or answer 0xFF); anything else is a
    // late answer to an earlier, retried request. Vial (0xFE) and other
    // answers carry no id, so they cannot be checked.
    if (pending.echo !== undefined && bytes[0] !== pending.echo && bytes[0] !== 0xff) return;
    const response = new Uint8Array(MSG_LEN);
    response.set(bytes.subarray(0, MSG_LEN));
    const { resolve } = pending;
    pending = null;
    resolve(response);
  };

  async function ensureOpen() {
    if (!device.opened) await device.open();
    device.removeEventListener('inputreport', onInputReport);
    device.addEventListener('inputreport', onInputReport);
  }

  function waitForReport(commandId) {
    let timer;
    const promise = new Promise((resolve, reject) => {
      pending = { resolve, echo: commandId >= 0x01 && commandId <= LAST_VIA_COMMAND ? commandId : undefined };
      timer = setTimeout(() => {
        pending = null;
        reject(new HidTransportError('Keyboard did not answer in time.', 'TIMEOUT'));
      }, timeoutMs);
    });
    return promise.finally(() => clearTimeout(timer));
  }

  async function exchange(message) {
    const report = new Uint8Array(MSG_LEN);
    report.set(Array.from(message).slice(0, MSG_LEN));
    await ensureOpen();
    let lastError;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const answer = waitForReport(report[0]);
      try {
        await device.sendReport(0, report);
      } catch (error) {
        pending = null;
        answer.catch(() => {});
        throw new HidTransportError(`Could not send to the keyboard: ${error.message || error}`, 'SEND');
      }
      try {
        return await answer;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  /** Send one message and resolve with the 32-byte answer (requests are serialized). */
  function sendReceive(message) {
    const result = queue.then(() => exchange(message));
    queue = result.catch(() => {});
    return result;
  }

  async function close() {
    await queue;
    device.removeEventListener('inputreport', onInputReport);
    if (device.opened) await device.close();
  }

  return { device, sendReceive, close };
}

export { createHidTransport, isRawHidInterface, RAW_HID_FILTER, HidTransportError };
