/* Keycode reference shown in the help drawer and the typing suggestions.
 * Each entry: label (what the user types), desc, code (what QMK receives),
 * and optional aliases (other accepted spellings; also searched). */

const REFERENCE = [
  ['Basics', [
    { label: 'NO', desc: 'Key does nothing', code: 'KC_NO' },
    { label: 'TRNS', desc: 'Use the key from the layer below', code: 'KC_TRNS', aliases: ['TRANSPARENT'] },
  ]],
  ['Shortcuts', [
    { label: 'Alt+Bksp', desc: 'Delete word', code: 'LALT(KC_BSPC)' },
    { label: 'Cmd+C', desc: 'Copy', code: 'LGUI(KC_C)' },
    { label: 'Cmd+V', desc: 'Paste', code: 'LGUI(KC_V)' },
    { label: 'Ctrl+Shift+A', desc: 'Several modifiers at once', code: 'LCTL(LSFT(KC_A))' },
    { label: 'RAlt+E', desc: 'Right-side modifier', code: 'RALT(KC_E)' },
  ]],
  ['Layer keys', [
    { label: 'MO(1)', desc: 'Layer 1 while held', code: 'MO(1)', aliases: ['MO1'] },
    { label: 'TG(2)', desc: 'Toggle layer 2 on or off', code: 'TG(2)', aliases: ['TG2'] },
    { label: 'TO(3)', desc: 'Switch to layer 3', code: 'TO(3)', aliases: ['TO3'] },
    { label: 'TT(1)', desc: 'Tap toggles, hold is momentary', code: 'TT(1)', aliases: ['TT1'] },
    { label: 'OSL(2)', desc: 'Layer 2 for the next key only', code: 'OSL(2)', aliases: ['OSL2'] },
  ]],
  ['Editing', [
    { label: 'Space', desc: 'Space bar', code: 'KC_SPC', aliases: ['SPC'] },
    { label: 'Enter', desc: 'Return', code: 'KC_ENT', aliases: ['ENT'] },
    { label: 'Tab', desc: 'Tab', code: 'KC_TAB' },
    { label: 'Esc', desc: 'Escape', code: 'KC_ESC', aliases: ['Escape'] },
    { label: 'Bksp', desc: 'Backspace', code: 'KC_BSPC', aliases: ['Backspace', 'BSPC'] },
    { label: 'Del', desc: 'Forward delete', code: 'KC_DEL', aliases: ['Delete'] },
  ]],
  ['Navigation', [
    { label: 'Up', desc: 'Arrow up', code: 'KC_UP' },
    { label: 'Down', desc: 'Arrow down', code: 'KC_DOWN' },
    { label: 'Left', desc: 'Arrow left', code: 'KC_LEFT' },
    { label: 'Right', desc: 'Arrow right', code: 'KC_RIGHT' },
    { label: 'Home', desc: 'Start of line', code: 'KC_HOME' },
    { label: 'End', desc: 'End of line', code: 'KC_END' },
    { label: 'PgUp', desc: 'Page up', code: 'KC_PGUP', aliases: ['PageUp'] },
    { label: 'PgDn', desc: 'Page down', code: 'KC_PGDN', aliases: ['PageDown'] },
  ]],
  ['Modifiers', [
    { label: 'Ctrl', desc: 'Left control', code: 'KC_LCTL', aliases: ['LCtrl', 'LCTL'] },
    { label: 'Shift', desc: 'Left shift', code: 'KC_LSFT', aliases: ['LShift', 'LSFT'] },
    { label: 'Alt', desc: 'Left alt / option', code: 'KC_LALT', aliases: ['LAlt', 'Option'] },
    { label: 'Cmd', desc: 'Command / Windows / Super', code: 'KC_LGUI', aliases: ['Win', 'Super', 'LGUI'] },
    { label: 'RCtrl', desc: 'Right control', code: 'KC_RCTL' },
    { label: 'RShift', desc: 'Right shift', code: 'KC_RSFT' },
    { label: 'RAlt', desc: 'Right alt / option', code: 'KC_RALT' },
    { label: 'RCmd', desc: 'Right command / Windows', code: 'KC_RGUI', aliases: ['RGUI', 'RWin'] },
  ]],
  ['Function keys', [
    { label: 'F1', desc: 'Function keys F1 to F24', code: 'KC_F1', aliases: ['F2', 'F12', 'F24'] },
  ]],
  ['Media', [
    { label: 'Play', desc: 'Play / pause', code: 'KC_MPLY', aliases: ['Pause', 'MPLY'] },
    { label: 'Stop', desc: 'Stop', code: 'KC_MSTP' },
    { label: 'Next', desc: 'Next track', code: 'KC_MNXT' },
    { label: 'Prev', desc: 'Previous track', code: 'KC_MPRV', aliases: ['Previous'] },
    { label: 'FFD', desc: 'Fast forward', code: 'KC_MFFD', aliases: ['FastForward'] },
    { label: 'RWD', desc: 'Rewind', code: 'KC_MRWD', aliases: ['Rewind'] },
    { label: 'MacSSV+', desc: 'Volume up in small steps (Mac)', code: 'LSA(KC__VOLUP)', aliases: ['volume'] },
    { label: 'MacSSV-', desc: 'Volume down in small steps (Mac)', code: 'LSA(KC__VOLDOWN)', aliases: ['volume'] },
  ]],
  ['Locks', [
    { label: 'Caps', desc: 'Caps lock', code: 'KC_CAPS', aliases: ['CapsLock'] },
    { label: 'NumLock', desc: 'Num lock', code: 'KC_NUM' },
    { label: 'ScrollLock', desc: 'Scroll lock', code: 'KC_SCRL' },
  ]],
];

/** Reference grouped by category, with the config's tap dances appended. */
function referenceGroups(tapDances = []) {
  const groups = REFERENCE.map(([category, entries]) => ({ category, entries }));
  const named = tapDances.filter((td) => td?.name);
  if (named.length) {
    groups.push({
      category: 'Tap dances',
      entries: named.map((td) => ({ label: `TD(${td.name})`, desc: 'Tap dance from the Tap Dance tab', code: `TD(${td.name})` })),
    });
  }
  return groups;
}

function matches(entry, category, query) {
  if (!query) return true;
  const haystack = [entry.label, entry.desc, entry.code, category, ...(entry.aliases || [])].join(' ').toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
}

/** Groups filtered by a free-text query; empty groups are dropped. */
function searchReference(query, tapDances = []) {
  return referenceGroups(tapDances)
    .map(({ category, entries }) => ({ category, entries: entries.filter((entry) => matches(entry, category, query)) }))
    .filter((group) => group.entries.length);
}

export { referenceGroups, searchReference };
