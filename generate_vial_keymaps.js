#!/usr/bin/env node

/**
 * Vial/VIA .vil generator
 * - Reads mapping from alpha_layers.json
 * - Applies per-letter symbol/number layers (layer1/layer2) across keyboards
 * - Optionally replaces alpha keys with tap-dance or other codes via `base`
 * - Optionally overrides combos, tap_dance, key_override sections
 * - Emits updated .vil files to ./output
 *
 * No external dependencies. Node 18+ required for built-in fetch.
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const INPUT_DIR = path.join(ROOT, 'original');
const OUTPUT_DIR = path.join(ROOT, 'output');
const CONFIG_PATH = path.join(ROOT, 'alpha_layers.json');

// Debug mode logging configuration (required by session instructions)
const DEBUG_ENDPOINT = 'http://127.0.0.1:7242/ingest/11c4fe57-fdbc-4bf5-9977-45148f0b7e47';
const DEBUG_SESSION = 'debug-session';

function loadJsonWithUid(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const uidMatch = raw.match(/"uid"\s*:\s*([0-9]+)/);
  const uidLiteral = uidMatch ? uidMatch[1] : null;
  const parsed = JSON.parse(raw);
  return { doc: parsed, uidLiteral };
}

function saveJsonWithUid(filePath, data, uidLiteral) {
  const json = JSON.stringify(data, null, 2);
  if (uidLiteral) {
    const replaced = json.replace(/"uid"\s*:\s*"?[0-9A-Za-z]+"?/, `"uid": ${uidLiteral}`);
    fs.writeFileSync(filePath, replaced);
  } else {
    fs.writeFileSync(filePath, json);
  }
}

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

// Translation tables for plain KC_* output (no locale-specific keycodes)
// Language codes: de, fr, es, en; OS codes: mac, win, linux
const translationTables = {
  // German
  'de-mac': {
    '?': 'LSFT(KC_MINS)',
    '/': 'LSFT(KC_7)',
    '(': 'LSFT(KC_8)',
    ')': 'LSFT(KC_9)',
    '=': 'LSFT(KC_0)',
    '+': 'KC_RBRC',
    '*': 'LSFT(KC_RBRC)',
    '-': 'KC_SLSH',
    '_': 'LSFT(KC_SLSH)',
    '[': 'LALT(KC_5)',
    ']': 'LALT(KC_6)',
    '{': 'LALT(KC_8)',
    '}': 'LALT(KC_9)',
    '^': 'KC_GRV',
    '°': 'LSFT(KC_GRV)',
    '$': 'LSFT(KC_4)',
    '%': 'LSFT(KC_5)',
    '&': 'LSFT(KC_6)',
    '"': 'LSFT(KC_2)',
    '!': 'LSFT(KC_1)',
    '<': 'KC_NUBS',
    '>': 'LSFT(KC_NUBS)',
    '`': 'LSFT(KC_EQL)',
    "'": 'LSFT(KC_NONUS_HASH)',
    '§': 'LSFT(KC_3)',
    'ü': 'KC_LBRC',
    'ö': 'KC_SCLN',
    'ä': 'KC_QUOT',
    'ß': 'KC_MINS',
    '@': 'LALT(KC_L)',
    '#': 'KC_NONUS_HASH',
    '\\': 'LALT(LSFT(KC_7))',
    '|': 'LALT(KC_7)',
    '~': 'LALT(KC_N)',
    '.': 'KC_DOT',
    ',': 'KC_COMM'
  },
  'de-win': {
    '?': 'LSFT(KC_MINS)',
    '/': 'KC_SLSH',
    '(': 'LSFT(KC_8)',
    ')': 'LSFT(KC_9)',
    '=': 'LSFT(KC_0)',
    '+': 'KC_RBRC',
    '*': 'LSFT(KC_RBRC)',
    '-': 'KC_MINS',
    '_': 'LSFT(KC_MINS)',
    '[': 'RALT(KC_8)',
    ']': 'RALT(KC_9)',
    '{': 'RALT(LSFT(KC_8))',
    '}': 'RALT(LSFT(KC_9))',
    '^': 'KC_GRV',
    '°': 'LSFT(KC_GRV)',
    '$': 'LSFT(KC_4)',
    '%': 'LSFT(KC_5)',
    '&': 'LSFT(KC_6)',
    '"': 'LSFT(KC_2)',
    '!': 'LSFT(KC_1)',
    '<': 'KC_NUBS',
    '>': 'LSFT(KC_NUBS)',
    '`': 'RALT(KC_GRV)',
    "'": 'KC_QUOT',
    'ü': 'KC_LBRC',
    'ö': 'KC_SCLN',
    'ä': 'KC_QUOT', // adjust if your layout maps ä differently
    'ß': 'KC_MINS',
    '@': 'RALT(KC_Q)',
    '#': 'RALT(KC_3)',
    '\\': 'RALT(KC_MINS)',
    '|': 'RALT(LSFT(KC_7))',
    '~': 'RALT(KC_N)',
    '.': 'KC_DOT',
    ',': 'KC_COMM',
    '§': 'LSFT(KC_3)'
  },
  'de-linux': {
    '?': 'LSFT(KC_MINS)',
    '/': 'KC_SLSH',
    '(': 'LSFT(KC_8)',
    ')': 'LSFT(KC_9)',
    '=': 'LSFT(KC_0)',
    '+': 'KC_RBRC',
    '*': 'LSFT(KC_RBRC)',
    '-': 'KC_MINS',
    '_': 'LSFT(KC_MINS)',
    '[': 'RALT(KC_8)',
    ']': 'RALT(KC_9)',
    '{': 'RALT(LSFT(KC_8))',
    '}': 'RALT(LSFT(KC_9))',
    '^': 'KC_GRV',
    '°': 'LSFT(KC_GRV)',
    '$': 'LSFT(KC_4)',
    '%': 'LSFT(KC_5)',
    '&': 'LSFT(KC_6)',
    '"': 'LSFT(KC_2)',
    '!': 'LSFT(KC_1)',
    '<': 'KC_NUBS',
    '>': 'LSFT(KC_NUBS)',
    '`': 'RALT(KC_GRV)',
    "'": 'KC_QUOT',
    'ü': 'KC_LBRC',
    'ö': 'KC_SCLN',
    'ä': 'KC_QUOT',
    'ß': 'KC_MINS',
    '@': 'RALT(KC_Q)',
    '#': 'RALT(KC_3)',
    '\\': 'RALT(KC_MINS)',
    '|': 'RALT(LSFT(KC_7))',
    '~': 'RALT(KC_N)',
    '.': 'KC_DOT',
    ',': 'KC_COMM',
    '§': 'LSFT(KC_3)'
  },

  // French (AZERTY)
  'fr-mac': {
    '?': 'LSFT(KC_COMM)',
    '/': 'KC_SLSH',
    '!': 'LSFT(KC_1)',
    '@': 'LALT(KC_G)',
    '#': 'LALT(KC_3)',
    '(': 'LSFT(KC_5)',
    ')': 'LSFT(KC_MINS)',
    '[': 'LALT(KC_5)',
    ']': 'LALT(KC_MINS)',
    '{': 'LALT(LSFT(KC_5))',
    '}': 'LALT(LSFT(KC_MINS))',
    '~': 'LALT(KC_N)',
    '|': 'LALT(LSFT(KC_L))',
    '\\': 'LALT(KC_L)',
    '$': 'LSFT(KC_4)',
    '%': 'KC_QUOT',
    '&': 'KC_1',
    '-': 'KC_MINS',
    '_': 'LSFT(KC_8)', // on AZERTY mac, _ via shift-8
    '+': 'LSFT(KC_EQL)',
    '=': 'KC_EQL',
    '<': 'KC_BSLS',
    '>': 'LSFT(KC_BSLS)',
    '.': 'KC_DOT',
    ',': 'KC_COMM',
    '^': 'KC_CIRC',
    '°': 'LSFT(KC_BSLS)',
    '§': 'LSFT(KC_SEMICOLON)'
  },
  'fr-win': {
    '?': 'LSFT(KC_COMM)',
    '/': 'KC_SLSH',
    '!': 'LSFT(KC_1)',
    '@': 'RALT(KC_0)',
    '#': 'RALT(KC_3)',
    '(': 'LSFT(KC_5)',
    ')': 'LSFT(KC_MINS)',
    '[': 'RALT(KC_5)',
    ']': 'RALT(KC_MINS)',
    '{': 'RALT(LSFT(KC_5))',
    '}': 'RALT(LSFT(KC_MINS))',
    '~': 'RALT(KC_2)',
    '|': 'RALT(LSFT(KC_6))',
    '\\': 'RALT(KC_8)',
    '$': 'LSFT(KC_4)',
    '%': 'KC_QUOT',
    '&': 'KC_1',
    '-': 'KC_MINS',
    '_': 'LSFT(KC_8)',
    '+': 'LSFT(KC_EQL)',
    '=': 'KC_EQL',
    '<': 'KC_BSLS',
    '>': 'LSFT(KC_BSLS)',
    '.': 'KC_DOT',
    ',': 'KC_COMM',
    '^': 'KC_CIRC',
    '°': 'LSFT(KC_BSLS)',
    '§': 'LSFT(KC_SEMICOLON)'
  },
  'fr-linux': {
    '?': 'LSFT(KC_COMM)',
    '/': 'KC_SLSH',
    '!': 'LSFT(KC_1)',
    '@': 'RALT(KC_0)',
    '#': 'RALT(KC_3)',
    '(': 'LSFT(KC_5)',
    ')': 'LSFT(KC_MINS)',
    '[': 'RALT(KC_5)',
    ']': 'RALT(KC_MINS)',
    '{': 'RALT(LSFT(KC_5))',
    '}': 'RALT(LSFT(KC_MINS))',
    '~': 'RALT(KC_2)',
    '|': 'RALT(LSFT(KC_6))',
    '\\': 'RALT(KC_8)',
    '$': 'LSFT(KC_4)',
    '%': 'KC_QUOT',
    '&': 'KC_1',
    '-': 'KC_MINS',
    '_': 'LSFT(KC_8)',
    '+': 'LSFT(KC_EQL)',
    '=': 'KC_EQL',
    '<': 'KC_BSLS',
    '>': 'LSFT(KC_BSLS)',
    '.': 'KC_DOT',
    ',': 'KC_COMM',
    '^': 'KC_CIRC',
    '°': 'LSFT(KC_BSLS)',
    '§': 'LSFT(KC_SEMICOLON)'
  },

  // Spanish
  'es-mac': {
    '?': 'LSFT(KC_MINS)',
    '¡': 'KC_EQL',
    '¿': 'KC_MINS',
    '@': 'LALT(KC_Q)',
    '~': 'LALT(KC_4)',
    '[': 'LALT(KC_LBRC)',
    ']': 'LALT(KC_RBRC)',
    '{': 'LALT(LSFT(KC_LBRC))',
    '}': 'LALT(LSFT(KC_RBRC))',
    '\\': 'LALT(KC_GRAVE)',
    '|': 'LALT(LSFT(KC_GRAVE))',
    '$': 'LSFT(KC_4)',
    '%': 'LSFT(KC_5)',
    '&': 'LSFT(KC_6)',
    '!': 'LSFT(KC_1)',
    '+': 'KC_PLUS',
    '*': 'LSFT(KC_PLUS)',
    '-': 'KC_MINS',
    '_': 'LSFT(KC_MINS)',
    '=': 'KC_EQL',
    '<': 'KC_NUBS',
    '>': 'LSFT(KC_NUBS)',
    '.': 'KC_DOT',
    ',': 'KC_COMM',
    '^': 'RALT(KC_6)',
    '°': 'RALT(LSFT(KC_1))',
    '§': 'RALT(LSFT(KC_3))'
  },
  'es-win': {
    '?': 'LSFT(KC_MINS)',
    '¡': 'KC_EQL',
    '¿': 'KC_MINS',
    '@': 'RALT(KC_Q)',
    '~': 'RALT(KC_4)',
    '[': 'RALT(KC_LBRC)',
    ']': 'RALT(KC_RBRC)',
    '{': 'RALT(LSFT(KC_LBRC))',
    '}': 'RALT(LSFT(KC_RBRC))',
    '\\': 'RALT(KC_GRAVE)',
    '|': 'RALT(LSFT(KC_GRAVE))',
    '$': 'LSFT(KC_4)',
    '%': 'LSFT(KC_5)',
    '&': 'LSFT(KC_6)',
    '!': 'LSFT(KC_1)',
    '+': 'KC_PLUS',
    '*': 'LSFT(KC_PLUS)',
    '-': 'KC_MINS',
    '_': 'LSFT(KC_MINS)',
    '=': 'KC_EQL',
    '<': 'KC_NUBS',
    '>': 'LSFT(KC_NUBS)',
    '.': 'KC_DOT',
    ',': 'KC_COMM',
    '^': 'RALT(KC_6)',
    '°': 'RALT(LSFT(KC_1))',
    '§': 'RALT(LSFT(KC_3))'
  },
  'es-linux': {
    '?': 'LSFT(KC_MINS)',
    '¡': 'KC_EQL',
    '¿': 'KC_MINS',
    '@': 'RALT(KC_Q)',
    '~': 'RALT(KC_4)',
    '[': 'RALT(KC_LBRC)',
    ']': 'RALT(KC_RBRC)',
    '{': 'RALT(LSFT(KC_LBRC))',
    '}': 'RALT(LSFT(KC_RBRC))',
    '\\': 'RALT(KC_GRAVE)',
    '|': 'RALT(LSFT(KC_GRAVE))',
    '$': 'LSFT(KC_4)',
    '%': 'LSFT(KC_5)',
    '&': 'LSFT(KC_6)',
    '!': 'LSFT(KC_1)',
    '+': 'KC_PLUS',
    '*': 'LSFT(KC_PLUS)',
    '-': 'KC_MINS',
    '_': 'LSFT(KC_MINS)',
    '=': 'KC_EQL',
    '<': 'KC_NUBS',
    '>': 'LSFT(KC_NUBS)',
    '.': 'KC_DOT',
    ',': 'KC_COMM',
    '^': 'RALT(KC_6)',
    '°': 'RALT(LSFT(KC_1))',
    '§': 'RALT(LSFT(KC_3))'
  },

  // English (US)
  'en-mac': {
    '?': 'LSFT(KC_SLSH)',
    '/': 'KC_SLSH',
    '-': 'KC_MINS',
    '=': 'KC_EQL',
    '+': 'LSFT(KC_EQL)',
    '_': 'LSFT(KC_MINS)',
    '[': 'KC_LBRC',
    ']': 'KC_RBRC',
    '{': 'LSFT(KC_LBRC)',
    '}': 'LSFT(KC_RBRC)',
    '\\': 'KC_BSLS',
    '|': 'LSFT(KC_BSLS)',
    '~': 'LSFT(KC_GRAVE)',
    '@': 'LSFT(KC_2)',
    '#': 'LSFT(KC_3)',
    '^': 'LSFT(KC_6)',
    '$': 'LSFT(KC_4)',
    '%': 'LSFT(KC_5)',
    '&': 'LSFT(KC_7)',
    '!': 'LSFT(KC_1)',
    '(': 'LSFT(KC_9)',
    ')': 'LSFT(KC_0)',
    '<': 'KC_COMM',
    '>': 'KC_DOT',
    '.': 'KC_DOT',
    ',': 'KC_COMM',
    '`': 'KC_GRV',
    "'": 'KC_QUOT',
    '°': 'LSFT(KC_GRV)',
    '§': 'LSFT(KC_6)'
  },
  'en-win': {
    '?': 'LSFT(KC_SLSH)',
    '/': 'KC_SLSH',
    '-': 'KC_MINS',
    '=': 'KC_EQL',
    '+': 'LSFT(KC_EQL)',
    '_': 'LSFT(KC_MINS)',
    '[': 'KC_LBRC',
    ']': 'KC_RBRC',
    '{': 'LSFT(KC_LBRC)',
    '}': 'LSFT(KC_RBRC)',
    '\\': 'KC_BSLS',
    '|': 'LSFT(KC_BSLS)',
    '~': 'LSFT(KC_GRV)',
    '@': 'LSFT(KC_2)',
    '#': 'LSFT(KC_3)',
    '^': 'LSFT(KC_6)',
    '$': 'LSFT(KC_4)',
    '%': 'LSFT(KC_5)',
    '&': 'LSFT(KC_7)',
    '!': 'LSFT(KC_1)',
    '(': 'LSFT(KC_9)',
    ')': 'LSFT(KC_0)',
    '<': 'KC_COMM',
    '>': 'KC_DOT',
    '.': 'KC_DOT',
    ',': 'KC_COMM',
    '`': 'KC_GRV',
    "'": 'KC_QUOT',
    '°': 'LSFT(KC_GRV)',
    '§': 'LSFT(KC_6)'
  },
  'en-linux': {
    '?': 'LSFT(KC_SLSH)',
    '/': 'KC_SLSH',
    '-': 'KC_MINS',
    '=': 'KC_EQL',
    '+': 'LSFT(KC_EQL)',
    '_': 'LSFT(KC_MINS)',
    '[': 'KC_LBRC',
    ']': 'KC_RBRC',
    '{': 'LSFT(KC_LBRC)',
    '}': 'LSFT(KC_RBRC)',
    '\\': 'KC_BSLS',
    '|': 'LSFT(KC_BSLS)',
    '~': 'LSFT(KC_GRV)',
    '@': 'LSFT(KC_2)',
    '#': 'LSFT(KC_3)',
    '^': 'LSFT(KC_6)',
    '$': 'LSFT(KC_4)',
    '%': 'LSFT(KC_5)',
    '&': 'LSFT(KC_7)',
    '!': 'LSFT(KC_1)',
    '(': 'LSFT(KC_9)',
    ')': 'LSFT(KC_0)',
    '<': 'KC_COMM',
    '>': 'KC_DOT',
    '.': 'KC_DOT',
    ',': 'KC_COMM',
    '`': 'KC_GRV',
    "'": 'KC_QUOT',
    '°': 'LSFT(KC_GRV)',
    '§': 'LSFT(KC_6)'
  }
};

function targetKey(target) {
  const language = (target.language || '').toLowerCase();
  const os = (target.os || '').toLowerCase();
  return `${language}-${os}`;
}

function translateSymbol(value, target, warnings) {
  if (!value) return null;
  const upper = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (upper === 'NO') return 'KC_NO';
  if (upper === 'TRNS' || upper === 'TRANSPARENT') return 'KC_TRNS';
  // If caller already provided a keycode expression, trust it.
  if (typeof value === 'string' && (value.includes('KC_') || /\b[A-Z0-9_]+\(/.test(value))) {
    return value;
  }
  const single = value.length === 1 ? value : null;
  const table = translationTables[targetKey(target)] || {};
  if (single) {
    // Numbers
    if (/[0-9]/.test(single)) return `KC_${single}`;
    // Letters
    if (/[A-Za-z]/.test(single)) return `KC_${single.toUpperCase()}`;
    // Punctuation lookup
    if (table[single]) return table[single];
  }
  if (warnings && single) {
    warnings.push(single);
  }
  // Fallback: return raw string to avoid breaking output; user can override.
  return value;
}

function buildAliasMap(alphaMappings) {
  const aliasMap = new Map();
  Object.entries(alphaMappings).forEach(([letter, def]) => {
    (def.aliases || []).forEach((alias) => aliasMap.set(alias, letter));
    // Default aliases for non-alpha symbols commonly used on base layer.
    if (letter === '.') {
      aliasMap.set('KC_DOT', letter);
    }
    if (letter === ',') {
      aliasMap.set('KC_COMM', letter);
      aliasMap.set('KC_COMMA', letter);
    }
    if (letter === '-') aliasMap.set('KC_MINS', letter);
  });
  return aliasMap;
}

function extractAlphaFromKey(key, aliasMap, tapDance) {
  if (!key || typeof key !== 'string') return null;
  if (aliasMap.has(key)) return aliasMap.get(key);
  const direct = key.match(/^KC_([A-Z])$/);
  if (direct) return direct[1];
  const wrapped = key.match(/\(KC_([A-Z])\)/);
  if (wrapped) return wrapped[1];
  const td = key.match(/^TD\((\d+)\)$/);
  if (td && Array.isArray(tapDance)) {
    const idx = Number(td[1]);
    const entry = tapDance[idx];
    if (Array.isArray(entry) && entry.length > 0) {
      const base = entry[0];
      const tdDirect = base && base.match(/^KC_([A-Z])$/);
      if (tdDirect) return tdDirect[1];
      const tdWrapped = base && base.match(/\(KC_([A-Z])\)/);
      if (tdWrapped) return tdWrapped[1];
    }
  }
  return null;
}

function cloneLayerShape(layer) {
  return layer.map((row) => row.map(() => 'KC_TRNS'));
}

function ensureLayer(layout, idx) {
  while (layout.length <= idx) {
    const template = layout[0] ? cloneLayerShape(layout[0]) : [];
    layout.push(template);
  }
}

function mergeArrayOverride(targetArr, overrideArr) {
  if (!Array.isArray(overrideArr) || overrideArr.length === 0) return targetArr;
  const len = Math.max(targetArr.length, overrideArr.length);
  const result = new Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = overrideArr[i] !== undefined ? overrideArr[i] : (targetArr[i] !== undefined ? targetArr[i] : []);
  }
  return result;
}

async function logDebug(hypothesisId, location, message, data, runId) {
  // #region agent log
  fetch(DEBUG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: DEBUG_SESSION,
      runId: runId || 'gen-run',
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now()
    })
  }).catch(() => {});
  // #endregion
}

function applyAlphaMappings(doc, config, runId) {
  const { alphaMappings, layers, target } = config;
  const aliasMap = buildAliasMap(alphaMappings);
  const alphaLayerIdx = layers.alpha ?? 0;
  // Map layer1/2 strictly by their numeric indices: 1 stays 1, 2 stays 2.
  const symbolLayerIdx = layers.symbol ?? layers.symbols ?? 1; // layer2 content goes here
  const numberLayerIdx = layers.number ?? layers.numbers ?? 2; // layer1 content goes here

  ensureLayer(doc.layout, symbolLayerIdx);
  ensureLayer(doc.layout, numberLayerIdx);

  let replaced = 0;
  let fallbackSymbol = 0;
  let fallbackNumber = 0;
  const missingSymbols = new Set();

  const alphaLayer = doc.layout[alphaLayerIdx];
  const symbolLayer = doc.layout[symbolLayerIdx];
  const numberLayer = doc.layout[numberLayerIdx];

  for (let r = 0; r < alphaLayer.length; r++) {
    for (let c = 0; c < alphaLayer[r].length; c++) {
      const key = alphaLayer[r][c];
      const letter = extractAlphaFromKey(key, aliasMap, doc.tap_dance);
      if (!letter) continue;
      const mapping = alphaMappings[letter];
      if (!mapping) continue;

      const warnList = [];
      const layer1Code = translateSymbol(mapping.layer1, target, warnList);
      const layer2Code = translateSymbol(mapping.layer2, target, warnList);
      warnList.forEach((s) => missingSymbols.add(s));

      if (mapping.base) {
        alphaLayer[r][c] = mapping.base;
      }
      if (layer1Code) {
        numberLayer[r][c] = layer1Code;
      } else {
        fallbackSymbol++;
      }
      if (layer2Code) {
        symbolLayer[r][c] = layer2Code;
      } else {
        fallbackNumber++;
      }
      replaced++;
    }
  }

  logDebug('H1-detection', 'generate_vial_keymaps.js:132', 'Alpha replacements summary', {
    replaced,
    fallbackSymbol,
    fallbackNumber
  }, runId);

  if (missingSymbols.size > 0) {
    console.warn(`[vial-gen] Untranslated symbols (check config or add explicit keycodes): ${Array.from(missingSymbols).join(', ')}`);
  }
}

function applyOverrides(doc, config, runId) {
  const { comboOverrides, tapDanceOverrides, keyOverrideOverrides } = config;
  if (comboOverrides && comboOverrides.length) {
    const before = doc.combo ? doc.combo.length : 0;
    const merged = mergeArrayOverride(doc.combo || [], comboOverrides);
    const dedup = [];
    const seen = new Set();
    merged.forEach((entry) => {
      const key = JSON.stringify(entry);
      if (!seen.has(key)) {
        seen.add(key);
        dedup.push(entry);
      }
    });
    doc.combo = dedup;
    logDebug('H3-combos', 'generate_vial_keymaps.js:148', 'Applied combo overrides', {
      before,
      after: doc.combo.length
    }, runId);
  }
  if (tapDanceOverrides && tapDanceOverrides.length) {
    const before = doc.tap_dance ? doc.tap_dance.length : 0;
    const merged = mergeArrayOverride(doc.tap_dance || [], tapDanceOverrides);
    const dedup = [];
    const seen = new Set();
    merged.forEach((entry) => {
      const key = JSON.stringify(entry);
      if (!seen.has(key)) {
        seen.add(key);
        dedup.push(entry);
      }
    });
    doc.tap_dance = dedup;
    logDebug('H3-tapdance', 'generate_vial_keymaps.js:156', 'Applied tap-dance overrides', {
      before,
      after: doc.tap_dance.length
    }, runId);
  }
  if (keyOverrideOverrides && keyOverrideOverrides.length) {
    const before = doc.key_override ? doc.key_override.length : 0;
    const merged = mergeArrayOverride(doc.key_override || [], keyOverrideOverrides);
    const dedup = [];
    const seen = new Set();
    merged.forEach((entry) => {
      const key = JSON.stringify(entry);
      if (!seen.has(key)) {
        seen.add(key);
        dedup.push(entry);
      }
    });
    doc.key_override = dedup;
    logDebug('H3-keyoverride', 'generate_vial_keymaps.js:164', 'Applied key-override overrides', {
      before,
      after: doc.key_override.length
    }, runId);
  }
}

async function main() {
  const runId = `gen-run-${Date.now()}`;
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`Config not found at ${CONFIG_PATH}`);
    process.exit(1);
  }
  ensureOutputDir();
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

  const files = fs.readdirSync(INPUT_DIR).filter((f) => f.endsWith('.vil'));
  await logDebug('H0-config', 'generate_vial_keymaps.js:179', 'Loaded configuration', {
    files: files.length,
    target: config.target,
    mappingCount: Object.keys(config.alphaMappings || {}).length
  }, runId);

  for (const file of files) {
    const inputPath = path.join(INPUT_DIR, file);
    const parsed = loadJsonWithUid(inputPath);
    const doc = parsed.doc;
    const uidLiteral = parsed.uidLiteral;
    applyAlphaMappings(doc, config, runId);
    applyOverrides(doc, config, runId);
    const { name, ext } = path.parse(file);
    const outputPath = path.join(OUTPUT_DIR, `${name}_edited${ext}`);
    saveJsonWithUid(outputPath, doc, uidLiteral);
    await logDebug('H2-file', 'generate_vial_keymaps.js:193', 'Processed file', {
      file,
      outputPath
    }, runId);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  translateSymbol,
  extractAlphaFromKey,
  buildAliasMap,
  targetKey
};

