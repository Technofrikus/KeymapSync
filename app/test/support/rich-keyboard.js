/* Contents of the simulated keyboard used for the vitaly comparison: a bit of
 * everything (mod-taps, layer keys, custom and unnamed keycodes, encoders,
 * combos, tap dance, key overrides, alt repeat, macros, QMK settings).
 * Keycodes use the Vial protocol 6 numbering. */
function macroBytes() {
  const text = (value) => Array.from(new TextEncoder().encode(value));
  return [
    ...text('hello'), 0,
    1, 1, 0x04, 1, 4, 46, 2, 1, 5, 0x04, 0x02, 0, // tap A, delay 300ms, tap LSFT(A)
    1, 2, 0xe0, 1, 1, 0x06, 1, 3, 0xe0, 0, // down LCTL, tap C, up LCTL
    0, // fourth macro is empty
  ];
}

function richKeyboardOptions() {
  const rows = 2;
  const cols = 3;
  const keymap = new Array(4 * rows * cols).fill(0x0001);
  const set = (layer, row, col, code) => { keymap[(layer * rows + row) * cols + col] = code; };
  [[0x29, 0x04, 0x2216], [0x412c, 0x5222, 0x7c00]].forEach((row, r) => row.forEach((code, c) => set(0, r, c, code)));
  [[0x0001, 0x021e, 0x0000], [0x5700, 0x7e00, 0x7f42]].forEach((row, r) => row.forEach((code, c) => set(1, r, c, code)));
  set(2, 0, 0, 0x0f04); // HYPR(KC_A)
  set(2, 0, 1, 0x52a2); // OSM(MOD_LSFT)
  set(2, 1, 0, 0x5062); // LM(3, MOD_LSFT)
  const options = {
    keymap,
    layoutOptions: 1,
    settings: { 2: 300, 7: 200, 21: 0x0281 },
    macroBuffer: macroBytes(),
  };
  return options;
}

/** Fill the dynamic entries (they are not constructor options). */
function fillRichEntries(keyboard) {
  const { state } = keyboard;
  state.encoders[0][0] = [0x80, 0x81];
  state.encoders[1][0] = [0x01, 0x01];
  state.combos[0] = [0x04, 0x16, 0, 0, 0x29];
  state.combos[1] = [0x0d, 0x0e, 0x0f, 0, 0x0106];
  state.tapDances[0] = [0x04, 0xe0, 0x05, 0, 200];
  state.tapDances[1] = [0x2a, 0, 0, 0x0204, 175];
  state.keyOverrides[0] = Uint8Array.from([0x2a, 0x00, 0x4c, 0x00, 0xff, 0xff, 0x02, 0x00, 0x02, 0xc7]);
  state.altRepeats[0] = Uint8Array.from([0x04, 0x00, 0x05, 0x00, 0x01, 0x1b]);
  return keyboard;
}

export { richKeyboardOptions, fillRichEntries };
