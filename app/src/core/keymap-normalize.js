/**
 * Bring a transformed Keymap State into the form the keyboard reports, so a
 * preview only lists real changes:
 *
 * - keycode names are rewritten in the canonical spelling the keyboard's
 *   snapshot uses (`KC_BSPC` -> `KC_BACKSPACE`, `LSFT_T(KC_A)` -> `MT(MOD_LSFT,KC_A)`);
 * - combo / tap dance / key override / alt repeat lists are cut to the number
 *   of slots the keyboard has (extra entries can never be written).
 *
 * Unknown names are left untouched so writing them still fails loudly.
 */
import { keycodeToName, nameToKeycode } from './vial-keycodes.js';

function normalizeForKeyboard(current, target) {
  if (!target || typeof target !== 'object') return target;
  const version = current?.vial_protocol ?? 0;
  const canonical = (value) => {
    if (typeof value !== 'string') return value;
    try {
      return keycodeToName(nameToKeycode(value, version), version);
    } catch {
      return value;
    }
  };
  const deep = (value) => (Array.isArray(value) ? value.map(deep) : canonical(value));
  const slots = (section, entries) => {
    if (!Array.isArray(entries)) return entries;
    return Array.isArray(current?.[section]) ? entries.slice(0, current[section].length) : entries;
  };
  const result = { ...target };
  if (Array.isArray(target.layout)) result.layout = deep(target.layout);
  if (Array.isArray(target.encoder_layout)) result.encoder_layout = deep(target.encoder_layout);
  if (Array.isArray(target.combo)) result.combo = slots('combo', target.combo).map((entry) => (Array.isArray(entry) ? entry.map(canonical) : entry));
  if (Array.isArray(target.tap_dance)) {
    result.tap_dance = slots('tap_dance', target.tap_dance).map((entry) => (
      Array.isArray(entry) ? entry.map((value, index) => (index < 4 ? canonical(value) : value)) : entry
    ));
  }
  if (Array.isArray(target.key_override)) {
    result.key_override = slots('key_override', target.key_override).map((entry) => (
      entry && typeof entry === 'object'
        ? { ...entry, trigger: canonical(entry.trigger), replacement: canonical(entry.replacement) }
        : entry
    ));
  }
  if (Array.isArray(target.alt_repeat_key)) {
    result.alt_repeat_key = slots('alt_repeat_key', target.alt_repeat_key).map((entry) => (
      entry && typeof entry === 'object'
        ? { ...entry, keycode: canonical(entry.keycode), alt_keycode: canonical(entry.alt_keycode) }
        : entry
    ));
  }
  return result;
}

export { normalizeForKeyboard };
