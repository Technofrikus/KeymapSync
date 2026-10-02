/**
 * QMK keycode <-> name conversion for the Vial protocol, matching vitaly.
 *
 * Vial protocol 6 (and VIA-only keyboards, protocol 0) use the QMK keycode
 * numbering introduced in 2022; older Vial firmware (protocol < 6) uses the
 * previous numbering. Names follow vitaly exactly (e.g. `MT(MOD_LSFT,KC_A)`,
 * `LT(1,KC_SPACE)`) so the web and desktop shells produce identical Keymap
 * State. Parsing also accepts the common QMK aliases (`LSFT_T(KC_A)`, `KC_ENT`).
 *
 * Ported from vitaly's `src/keycodes*.rs` (https://github.com/bskaplou/vitaly,
 * MIT License, Copyright (c) 2025 Boris Kaplunovsky).
 */
import { V5_NAMES, V5_ALIASES, V6_NAMES, V6_ALIASES } from './vial-keycode-tables.js';

function buildTables(names, aliases) {
  const codeToName = new Map(names);
  const nameToCode = new Map(names.map(([code, name]) => [name, code]));
  Object.entries(aliases).forEach(([name, code]) => nameToCode.set(name, code));
  return { codeToName, nameToCode };
}

const TABLES = {
  5: buildTables(V5_NAMES, V5_ALIASES),
  6: buildTables(V6_NAMES, V6_ALIASES),
};

// One-shot modifier encodings (5-bit, bit 4 = right hand).
const MOD_LCTL = 0x01;
const MOD_LSFT = 0x02;
const MOD_LALT = 0x04;
const MOD_LGUI = 0x08;
const MOD_RCTL = 0x11;
const MOD_RSFT = 0x12;
const MOD_RALT = 0x14;
const MOD_RGUI = 0x18;

// Modifier wrappers such as LSFT(kc): high byte -> name. LCG/RCG exist only in v6.
const WRAPPERS = [
  [0x01, 'LCTL'], [0x02, 'LSFT'], [0x04, 'LALT'], [0x08, 'LGUI'],
  [0x11, 'RCTL'], [0x12, 'RSFT'], [0x14, 'RALT'], [0x18, 'RGUI'],
  [0x0f, 'HYPR'], [0x07, 'MEH'], [0x0d, 'LCAG'], [0x0a, 'LSG'], [0x0c, 'LAG'],
  [0x1a, 'RSG'], [0x1c, 'RAG'], [0x09, 'LCG', 6], [0x05, 'LCA'], [0x06, 'LSA'],
  [0x16, 'RSA'], [0x13, 'RCS'], [0x19, 'RCG', 6],
];

const WRAPPER_NAMES = {
  QK_LCTL: 0x01, LCTL: 0x01, C: 0x01,
  QK_LSFT: 0x02, LSFT: 0x02, S: 0x02,
  QK_LALT: 0x04, LALT: 0x04, LOPT: 0x04, A: 0x04,
  QK_LGUI: 0x08, LGUI: 0x08, LCMD: 0x08, LWIN: 0x08, G: 0x08,
  QK_RCTL: 0x11, RCTL: 0x11,
  QK_RSFT: 0x12, RSFT: 0x12,
  QK_RALT: 0x14, RALT: 0x14, ALGR: 0x14, ROPT: 0x14,
  QK_RGUI: 0x18, RGUI: 0x18, RCMD: 0x18, RWIN: 0x18,
  HYPR: 0x0f, MEH: 0x07, LCAG: 0x0d,
  LSG: 0x0a, SGUI: 0x0a, SCMD: 0x0a, SWIN: 0x0a,
  LAG: 0x0c, RSG: 0x1a, RAG: 0x1c, LCA: 0x05, LSA: 0x06,
  RSA: 0x16, SAGR: 0x16, RCS: 0x13,
};
const V6_ONLY_WRAPPER_NAMES = { LCG: 0x09, RCG: 0x19 };

const MOD_TAP_NAMES = {
  LCTL_T: MOD_LCTL, CTL_T: MOD_LCTL,
  RCTL_T: MOD_RCTL,
  LSFT_T: MOD_LSFT, SFT_T: MOD_LSFT,
  RSFT_T: MOD_RSFT,
  LALT_T: MOD_LALT, ALT_T: MOD_LALT, LOPT_T: MOD_LALT, OPT_T: MOD_LALT,
  RALT_T: MOD_RALT, ROPT_T: MOD_RALT, ALGR_T: MOD_RALT,
  LGUI_T: MOD_LGUI, GUI_T: MOD_LGUI, LCMD_T: MOD_LGUI, CMD_T: MOD_LGUI, LWIN_T: MOD_LGUI, WIN_T: MOD_LGUI,
  RGUI_T: MOD_RGUI, RCMD_T: MOD_RGUI, RWIN_T: MOD_RGUI,
  C_S_T: MOD_LCTL | MOD_LSFT,
  MEH_T: MOD_LCTL | MOD_LSFT | MOD_LALT,
  LCAG_T: MOD_LCTL | MOD_LALT | MOD_LGUI,
  RCAG_T: MOD_RCTL | MOD_RALT | MOD_RGUI,
  HYPR_T: MOD_LCTL | MOD_LSFT | MOD_LALT | MOD_LGUI, ALL_T: MOD_LCTL | MOD_LSFT | MOD_LALT | MOD_LGUI,
  LSG_T: MOD_LSFT | MOD_LGUI, SGUI_T: MOD_LSFT | MOD_LGUI, SCMD_T: MOD_LSFT | MOD_LGUI, SWIN_T: MOD_LSFT | MOD_LGUI,
  LAG_T: MOD_LALT | MOD_LGUI,
  RSG_T: MOD_RSFT | MOD_RGUI,
  RAG_T: MOD_RALT | MOD_RGUI,
  LCA_T: MOD_LCTL | MOD_LALT,
  LSA_T: MOD_LSFT | MOD_LALT,
  RSA_T: MOD_RSFT | MOD_RALT, SAGR_T: MOD_RSFT | MOD_RALT,
  RCS_T: MOD_RCTL | MOD_RSFT,
};

// Number spaces that changed between the two keycode versions.
const LAYOUT = {
  5: {
    modTap: 0x6000,
    layerMod: 0x5900,
    layers: { TO: 0x5000, MO: 0x5100, DF: 0x5200, TG: 0x5300, OSL: 0x5400, TT: 0x5800 },
    oneShotMod: 0x5500,
  },
  6: {
    modTap: 0x2000,
    layerMod: 0x5000,
    layers: { TO: 0x5200, MO: 0x5220, DF: 0x5240, PDF: 0x52e0, TG: 0x5260, OSL: 0x5280, TT: 0x52c0 },
    oneShotMod: 0x52a0,
  },
};

class KeycodeError extends Error {}

/** Keycode tables to use for a keyboard's Vial protocol version. */
function keycodeVersion(vialProtocol) {
  return vialProtocol === 6 || vialProtocol === 0 ? 6 : 5;
}

function modToName(mods) {
  const parts = [];
  const pick = (right, left, rightName, leftName) => {
    if ((mods & right) === right) parts.push(rightName);
    else if ((mods & left) === left) parts.push(leftName);
  };
  pick(MOD_RCTL, MOD_LCTL, 'MOD_RCTL', 'MOD_LCTL');
  pick(MOD_RSFT, MOD_LSFT, 'MOD_RSFT', 'MOD_LSFT');
  pick(MOD_RALT, MOD_LALT, 'MOD_RALT', 'MOD_LALT');
  pick(MOD_RGUI, MOD_LGUI, 'MOD_RGUI', 'MOD_LGUI');
  return parts.length ? parts.join('|') : 'KC_NO';
}

function nameToMod(text) {
  let mods = 0;
  for (const part of text.split('|')) {
    switch (part) {
      case 'MOD_LCTL': case 'LCTL': case 'CTL': case 'C': mods |= MOD_LCTL; break;
      case 'MOD_LSFT': case 'LSFT': case 'SFT': case 'S': mods |= MOD_LSFT; break;
      case 'MOD_LALT': case 'LALT': case 'ALT': case 'A': mods |= MOD_LALT; break;
      case 'MOD_LGUI': case 'LGUI': case 'GUI': case 'G': mods |= MOD_LGUI; break;
      case 'MOD_RCTL': case 'RCTL': mods |= MOD_RCTL; break;
      case 'MOD_RSFT': case 'RSFT': mods |= MOD_RSFT; break;
      case 'MOD_RALT': case 'RALT': mods |= MOD_RALT; break;
      case 'MOD_RGUI': case 'RGUI': mods |= MOD_RGUI; break;
      default: throw new KeycodeError(`can't parse mod ${part}`);
    }
  }
  return mods;
}

function parseNumber(text, what) {
  if (!/^\+?\d+$/.test(text) || Number(text) > 0xffff) {
    throw new KeycodeError(`can't parse ${what} ${text} should be num`);
  }
  return Number(text);
}

function splitPair(text, what) {
  const comma = text.indexOf(',');
  if (comma < 0) throw new KeycodeError(`${what} should have strictly two arguments ${JSON.stringify(text)} doesn't match`);
  return [text.slice(0, comma), text.slice(comma + 1)];
}

/**
 * Keycode number -> name, exactly as vitaly writes it into a `.vil` file.
 * @param {number} keycode 16-bit keycode
 * @param {number} vialProtocol keyboard's Vial protocol version
 */
function keycodeToName(keycode, vialProtocol) {
  const version = keycodeVersion(vialProtocol);
  const layout = LAYOUT[version];
  const code = keycode & 0xffff;
  const high = code >> 8;
  const inner = () => keycodeToName(code & 0xff, vialProtocol);

  const wrapper = WRAPPERS.find(([prefix, , onlyIn]) => prefix === high && (!onlyIn || onlyIn === version));
  if (wrapper) return `${wrapper[1]}(${inner()})`;

  for (const [name, base] of Object.entries(layout.layers)) {
    if (code >= base && code <= base + 0x1f) return `${name}(${code & 0x1f})`;
  }
  if (code >= layout.layerMod && code <= layout.layerMod + 0x1ff) {
    return `LM(${(code >> 5) & 0xf},${modToName(code & 0x1f)})`;
  }
  if (code >= layout.oneShotMod && code <= layout.oneShotMod + 0x1f) return `OSM(${modToName(code & 0x1f)})`;
  if (code >= 0x4000 && code <= 0x4fff) return `LT(${(code >> 8) & 0xf},${inner()})`;
  if (code >= layout.modTap && code <= layout.modTap + 0x1fff) {
    return `MT(${modToName((code >> 8) & 0x1f)},${inner()})`;
  }
  if (code >= 0x5700 && code <= 0x57ff) return `TD(${code & 0xff})`;

  const name = TABLES[version].codeToName.get(code);
  return name ?? `0x${code.toString(16).padStart(2, '0')}`;
}

/**
 * Keycode name -> number. Accepts vitaly names, QMK aliases and `0x` hex.
 * Throws for unknown names so a bad Keymap State is never written.
 * @param {string} name
 * @param {number} vialProtocol keyboard's Vial protocol version
 */
function nameToKeycode(name, vialProtocol) {
  const version = keycodeVersion(vialProtocol);
  const layout = LAYOUT[version];
  const text = String(name).replace(/ /g, '');
  if (text.startsWith('0x')) {
    const value = Number.parseInt(text.slice(2), 16);
    if (!/^[0-9a-fA-F]+$/.test(text.slice(2)) || value > 0xffff) throw new KeycodeError(`can't parse hex keycode ${name}`);
    return value;
  }
  const open = text.indexOf('(');
  if (open < 0) {
    const value = TABLES[version].nameToCode.get(text);
    if (value === undefined) throw new KeycodeError(`can't find key ${text}`);
    return value;
  }

  const left = text.slice(0, open);
  const right = text.slice(open + 1, -1);
  const keycode = (value) => nameToKeycode(value, vialProtocol);
  const wrapper = WRAPPER_NAMES[left] ?? (version === 6 ? V6_ONLY_WRAPPER_NAMES[left] : undefined);
  if (wrapper !== undefined) return ((wrapper << 8) | keycode(right)) & 0xffff;
  if (left in layout.layers) return layout.layers[left] | (parseNumber(right, 'layer') & 0x1f);
  if (left in MOD_TAP_NAMES) return layout.modTap | ((MOD_TAP_NAMES[left] & 0x1f) << 8) | (keycode(right) & 0xff);
  if (left === 'OSM') return layout.oneShotMod | (nameToMod(right) & 0x1f);
  if (left === 'LM') {
    const [layer, mods] = splitPair(right, 'LM');
    return layout.layerMod | ((parseNumber(layer, 'layer') & 0xf) << 5) | (nameToMod(mods) & 0x1f);
  }
  if (left === 'MT') {
    const [mods, key] = splitPair(right, 'MT');
    return layout.modTap | ((nameToMod(mods) & 0x1f) << 8) | (keycode(key) & 0xff);
  }
  if (left === 'LT') {
    const [layer, key] = splitPair(right, 'LT');
    return 0x4000 | ((parseNumber(layer, 'layer') & 0x0f) << 8) | (keycode(key) & 0xff);
  }
  const shortLayerTap = left.match(/^LT([1-9]|1[0-5])$/);
  if (shortLayerTap) return 0x4000 | (Number(shortLayerTap[1]) << 8) | (keycode(right) & 0xff);
  if (left === 'TD') return 0x5700 | (parseNumber(right, 'argument') & 0xff);
  throw new KeycodeError(`can't find macro ${left}`);
}

export { keycodeToName, nameToKeycode, keycodeVersion, KeycodeError };
