/**
 * Keymap State (`.vil`) text format helpers.
 *
 * JavaScript cannot precisely represent Vial's numeric UID values. Preserve it
 * as a string while the state is in memory, then restore its numeric JSON form
 * whenever the state is written back out (device transport or backup file).
 */

function parseKeymapState(raw) {
  const state = JSON.parse(raw);
  const uidMatch = raw.match(/"uid"\s*:\s*([0-9]+)/);
  if (uidMatch) state.uid = uidMatch[1];
  return state;
}

function serializeKeymapState(state) {
  return JSON.stringify(state, null, 2).replace(
    /"uid"\s*:\s*"([0-9]+)"/,
    '"uid": $1',
  );
}

export { parseKeymapState, serializeKeymapState };
