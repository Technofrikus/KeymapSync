/* What an editor field will send to the keyboard, for the context bar and
 * for marking invalid fields. Pure functions; no DOM. */
import { translateSymbol } from '../core/keymap-transform.js';
import { validKeycode } from '../core/config-validation.js';
import { charToKeycode, isValidKeycode, parseKeycodeString } from '../core/keycode-mapping.js';

const LANGUAGE_NAMES = { de: 'German', fr: 'French', es: 'Spanish', en: 'English' };
const OS_NAMES = { mac: 'Mac', win: 'Windows', linux: 'Linux' };

function targetLabel(target) {
  if (!target) return '';
  return `${LANGUAGE_NAMES[target.language] || target.language} · ${OS_NAMES[target.os] || target.os}`;
}

const knownKeycode = (code) => typeof code === 'string' && (isValidKeycode(code) || validKeycode(code));

/** A value in a layer column. Empty means the key is left as it is. */
function previewLayerValue(value, target) {
  const text = (value ?? '').trim();
  if (!text) return { empty: true, ok: true, code: '', message: 'Nothing: the key stays as it is on the keyboard' };
  if (/\s/u.test(text)) return { ok: false, code: '', message: 'Spaces are not allowed. Use Space for the space bar.' };
  const warnings = [];
  const code = translateSymbol(text, target, warnings);
  if (warnings.length) return { ok: false, code: '', message: `“${text}” has no key on a ${targetLabel(target)} keyboard` };
  if (!knownKeycode(code)) return { ok: false, code: '', message: `“${text}” is not a known key. Open Help for the list.` };
  return { ok: true, code, message: '' };
}

/** The base override of an alpha key, e.g. TD(Name). */
function previewBase(value, tapDanceNames = []) {
  const text = (value ?? '').trim();
  if (!text) return { empty: true, ok: true, code: '', message: 'Nothing: the letter stays as it is' };
  const td = text.match(/^TD\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)$/);
  if (td) {
    if (!tapDanceNames.includes(td[1])) return { ok: false, code: '', message: `There is no tap dance called ${td[1]}` };
    return { ok: true, code: text, message: '' };
  }
  if (!validKeycode(text, { allowLiteral: true })) return { ok: false, code: '', message: `“${text}” is not a valid keycode` };
  return { ok: true, code: text, message: '' };
}

/** Tap dance actions and combo results: converted to a keycode as typed. */
function previewKeycodeInput(value) {
  const text = (value ?? '').trim();
  if (!text) return { empty: true, ok: true, code: '', message: 'Nothing (KC_NO)' };
  const code = charToKeycode(text);
  if (!isValidKeycode(code)) return { ok: false, code: '', message: `“${text}” is not a known key. Open Help for the list.` };
  return { ok: true, code, message: '' };
}

/** Combo keys, separated by commas. */
function previewComboKeys(value) {
  const keys = parseKeycodeString(value ?? '');
  if (!keys.length) return { empty: true, ok: false, code: '', message: 'Enter 2 to 4 keys separated by commas' };
  if (keys.length > 4) return { ok: false, code: '', message: 'A combo can have at most 4 keys' };
  const bad = keys.find((key) => !isValidKeycode(key));
  if (bad) return { ok: false, code: '', message: `“${bad}” is not a known key` };
  return { ok: true, code: keys.join(' + '), message: '' };
}

export { targetLabel, previewLayerValue, previewBase, previewKeycodeInput, previewComboKeys };
