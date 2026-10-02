/* Loaded into the page by web-e2e.mjs: one simulated Vial keyboard behind a
 * fake `navigator.hid`. `window.__sim` gives the test access to it. */
import { createSimulatedKeyboard, createSimulatedHidDevice, createSimulatedHid } from '../support/simulated-vial-keyboard.js';
import { richKeyboardOptions, fillRichEntries } from '../support/rich-keyboard.js';

const keyboard = fillRichEntries(createSimulatedKeyboard(richKeyboardOptions()));
const device = createSimulatedHidDevice(keyboard);
const hid = createSimulatedHid([device]);
window.__sim = { keyboard, device, hid };
export { hid };
