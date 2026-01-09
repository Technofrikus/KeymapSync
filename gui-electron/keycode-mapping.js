/**
 * Keycode mapping for converting characters to QMK keycodes
 * Used for Combo input fields to allow users to type characters instead of keycodes
 */

// Basic letter and number mappings (always the same)
const basicKeycodes = {
  // Letters A-Z
  'A': 'KC_A', 'B': 'KC_B', 'C': 'KC_C', 'D': 'KC_D', 'E': 'KC_E',
  'F': 'KC_F', 'G': 'KC_G', 'H': 'KC_H', 'I': 'KC_I', 'J': 'KC_J',
  'K': 'KC_K', 'L': 'KC_L', 'M': 'KC_M', 'N': 'KC_N', 'O': 'KC_O',
  'P': 'KC_P', 'Q': 'KC_Q', 'R': 'KC_R', 'S': 'KC_S', 'T': 'KC_T',
  'U': 'KC_U', 'V': 'KC_V', 'W': 'KC_W', 'X': 'KC_X', 'Y': 'KC_Y', 'Z': 'KC_Z',
  
  // Numbers 0-9
  '0': 'KC_0', '1': 'KC_1', '2': 'KC_2', '3': 'KC_3', '4': 'KC_4',
  '5': 'KC_5', '6': 'KC_6', '7': 'KC_7', '8': 'KC_8', '9': 'KC_9',
  
  // Common punctuation and symbols (basic QMK keycodes)
  'SPACE': 'KC_SPC', 'SPC': 'KC_SPC',
  'ENTER': 'KC_ENT', 'ENT': 'KC_ENT',
  'TAB': 'KC_TAB',
  'ESC': 'KC_ESC', 'ESCAPE': 'KC_ESC',
  'BACKSPACE': 'KC_BSPC', 'BSPC': 'KC_BSPC', 'BKSP': 'KC_BSPC',
  'DELETE': 'KC_DEL', 'DEL': 'KC_DEL',
  'UP': 'KC_UP',
  'DOWN': 'KC_DOWN',
  'LEFT': 'KC_LEFT',
  'RIGHT': 'KC_RIGHT',
  'HOME': 'KC_HOME',
  'END': 'KC_END',
  'PAGEUP': 'KC_PGUP', 'PGUP': 'KC_PGUP',
  'PAGEDOWN': 'KC_PGDN', 'PGDN': 'KC_PGDN',
  
  // Modifier keys
  'LCTRL': 'KC_LCTL', 'LCTL': 'KC_LCTL', 'CTRL': 'KC_LCTL',
  'LSHIFT': 'KC_LSFT', 'LSFT': 'KC_LSFT', 'SHIFT': 'KC_LSFT',
  'LALT': 'KC_LALT', 'ALT': 'KC_LALT',
  'LGUI': 'KC_LGUI', 'LSUPER': 'KC_LGUI', 'LCMD': 'KC_LGUI', 'LWIN': 'KC_LGUI',
  'RCTRL': 'KC_RCTL', 'RCTL': 'KC_RCTL',
  'RSHIFT': 'KC_RSFT', 'RSFT': 'KC_RSFT',
  'RALT': 'KC_RALT',
  'RGUI': 'KC_RGUI', 'RSUPER': 'KC_RGUI', 'RCMD': 'KC_RGUI', 'RWIN': 'KC_RGUI',
  
  // Function keys
  'F1': 'KC_F1', 'F2': 'KC_F2', 'F3': 'KC_F3', 'F4': 'KC_F4',
  'F5': 'KC_F5', 'F6': 'KC_F6', 'F7': 'KC_F7', 'F8': 'KC_F8',
  'F9': 'KC_F9', 'F10': 'KC_F10', 'F11': 'KC_F11', 'F12': 'KC_F12',
  'F13': 'KC_F13', 'F14': 'KC_F14', 'F15': 'KC_F15', 'F16': 'KC_F16',
  'F17': 'KC_F17', 'F18': 'KC_F18', 'F19': 'KC_F19', 'F20': 'KC_F20',
  'F21': 'KC_F21', 'F22': 'KC_F22', 'F23': 'KC_F23', 'F24': 'KC_F24',
  
  // Special characters (common QMK keycodes)
  'MINUS': 'KC_MINS', '-': 'KC_MINS',
  'EQUAL': 'KC_EQL', '=': 'KC_EQL',
  'LBRACKET': 'KC_LBRC', '[': 'KC_LBRC',
  'RBRACKET': 'KC_RBRC', ']': 'KC_RBRC',
  'BACKSLASH': 'KC_BSLS', '\\': 'KC_BSLS',
  'SEMICOLON': 'KC_SCLN', ';': 'KC_SCLN',
  'QUOTE': 'KC_QUOT', "'": 'KC_QUOT',
  'GRAVE': 'KC_GRV', '`': 'KC_GRV',
  'COMMA': 'KC_COMM', ',': 'KC_COMM',
  'DOT': 'KC_DOT', '.': 'KC_DOT',
  'SLASH': 'KC_SLSH', '/': 'KC_SLSH',
  
  // Additional common keys
  'CAPS': 'KC_CAPS', 'CAPSLOCK': 'KC_CAPS',
  'NUMLOCK': 'KC_NUM',
  'SCROLLLOCK': 'KC_SCRL',
  
  // Media keys
  'PLAY': 'KC_MPLY', 'MPLY': 'KC_MPLY',
  'PAUSE': 'KC_MPLY', // Same as play in QMK
  'STOP': 'KC_MSTP', 'MSTP': 'KC_MSTP',
  'NEXT': 'KC_MNXT', 'MNXT': 'KC_MNXT', 'NEXTTrack': 'KC_MNXT',
  'PREVIOUS': 'KC_MPRV', 'MPRV': 'KC_MPRV', 'PREV': 'KC_MPRV', 'PREVIOUSTRACK': 'KC_MPRV',
  'FASTFORWARD': 'KC_MFFD', 'MFFD': 'KC_MFFD', 'FFD': 'KC_MFFD',
  'REWIND': 'KC_MRWD', 'MRWD': 'KC_MRWD', 'RWD': 'KC_MRWD',
  
  // Mac-specific media keys
  'MACPLAY': 'KC_MPLY',
  'MACPAUSE': 'KC_MPLY',
  'MACNEXT': 'KC_MNXT',
  'MACPREVIOUS': 'KC_MPRV', 'MACPREV': 'KC_MPRV',
  
  // Custom Mac Small Step Volume keys
  'MACSSV+': 'LSA(KC__VOLUP)', 'MACSSVPLUS': 'LSA(KC__VOLUP)',
  'MACSSV-': 'LSA(KC__VOLDOWN)', 'MACSSVMINUS': 'LSA(KC__VOLDOWN)',
};

/**
 * Converts modifier names to QMK modifier keycodes
 * @param {string} modifier - Modifier name (e.g., "Alt", "Ctrl", "Shift", "Cmd")
 * @returns {string} QMK modifier code (e.g., "LALT", "LCTL", "LSFT", "LGUI")
 */
function modifierToKeycode(modifier) {
  const mod = modifier.trim().toUpperCase();
  const modifierMap = {
    'ALT': 'LALT',
    'CTRL': 'LCTL', 'CONTROL': 'LCTL',
    'SHIFT': 'LSFT',
    'CMD': 'LGUI', 'COMMAND': 'LGUI', 'WIN': 'LGUI', 'SUPER': 'LGUI',
    'RALT': 'RALT',
    'RCTRL': 'RCTL', 'RCONTROL': 'RCTL',
    'RSHIFT': 'RSFT',
    'RGUI': 'RGUI', 'RCMD': 'RGUI', 'RWIN': 'RGUI', 'RSUPER': 'RGUI'
  };
  return modifierMap[mod] || mod;
}

/**
 * Parses Quantum Keycode format (e.g., "Alt+Bksp" -> "LALT(KC_BSPC)")
 * @param {string} input - Quantum keycode string (e.g., "Alt+Bksp", "Ctrl+Shift+A")
 * @returns {string} QMK keycode format
 */
function parseQuantumKeycode(input) {
  if (!input || typeof input !== 'string') return input;
  
  // Split by + and reverse to build nested structure from inside out
  const parts = input.split('+').map(p => p.trim()).filter(p => p);
  if (parts.length < 2) return null; // Not a quantum keycode format
  
  // The last part is the key, everything before are modifiers
  const keyPart = parts[parts.length - 1];
  const modifiers = parts.slice(0, -1);
  
  // Convert the key part to KC_ format
  let keyCode = charToKeycode(keyPart);
  // If it's not already a KC_ format, try to convert it
  if (!keyCode.startsWith('KC_') && !keyCode.includes('(')) {
    // Try to find it in basicKeycodes
    const upperKey = keyPart.toUpperCase();
    if (basicKeycodes[upperKey]) {
      keyCode = basicKeycodes[upperKey];
    } else if (keyPart.length === 1) {
      // Single character
      if (/[A-Z0-9]/.test(keyPart)) {
        keyCode = `KC_${keyPart.toUpperCase()}`;
      } else if (/[a-z]/.test(keyPart)) {
        keyCode = `KC_${keyPart.toUpperCase()}`;
      }
    }
  }
  
  // Build nested modifier structure
  let result = keyCode;
  for (let i = modifiers.length - 1; i >= 0; i--) {
    const modCode = modifierToKeycode(modifiers[i]);
    result = `${modCode}(${result})`;
  }
  
  return result;
}

/**
 * Parses Layer function format (e.g., "MO(1)", "MO 1", "MO1" -> "MO(1)")
 * @param {string} input - Layer function string
 * @returns {string|null} QMK layer function format or null if not a layer function
 */
function parseLayerFunction(input) {
  if (!input || typeof input !== 'string') return null;
  
  const trimmed = input.trim().toUpperCase();
  
  // Layer function patterns: MO, TG, TO, TT, OSL
  const layerFuncMatch = trimmed.match(/^(MO|TG|TO|TT|OSL)\s*\(?\s*(\d+)\s*\)?$/);
  if (layerFuncMatch) {
    const func = layerFuncMatch[1];
    const layer = layerFuncMatch[2];
    return `${func}(${layer})`;
  }
  
  // Alternative format: MO1, TG2, etc.
  const altMatch = trimmed.match(/^(MO|TG|TO|TT|OSL)(\d+)$/);
  if (altMatch) {
    const func = altMatch[1];
    const layer = altMatch[2];
    return `${func}(${layer})`;
  }
  
  return null;
}

/**
 * Converts a character or keycode string to QMK keycode format
 * @param {string} input - Character or keycode string (e.g., "J", "KC_J", "SPACE", "Alt+Bksp", "MO(1)", "MacSSV+")
 * @returns {string} QMK keycode (e.g., "KC_J", "KC_SPC", "LALT(KC_BSPC)", "MO(1)", "LSA(KC__VOLUP)")
 */
function charToKeycode(input) {
  if (!input || typeof input !== 'string') return input;
  
  const trimmed = input.trim();
  const upperTrimmed = trimmed.toUpperCase();
  
  // Check for custom Mac Small Step Volume keys first (before other checks)
  if (upperTrimmed === 'MACSSV+' || upperTrimmed === 'MACSSVPLUS') {
    return 'LSA(KC__VOLUP)';
  }
  if (upperTrimmed === 'MACSSV-' || upperTrimmed === 'MACSSVMINUS') {
    return 'LSA(KC__VOLDOWN)';
  }
  
  // If it already looks like a keycode (starts with KC_ or is a known pattern), return as-is
  if (upperTrimmed.startsWith('KC_') || upperTrimmed.startsWith('LSFT(') || 
      upperTrimmed.startsWith('LCTL(') || upperTrimmed.startsWith('LALT(') ||
      upperTrimmed.startsWith('LGUI(') || upperTrimmed.startsWith('LSA(') ||
      upperTrimmed.startsWith('RSFT(') || upperTrimmed.startsWith('RCTL(') ||
      upperTrimmed.startsWith('RALT(') || upperTrimmed.startsWith('RGUI(') ||
      upperTrimmed.match(/^[A-Z]+\(/)) {
    return upperTrimmed;
  }
  
  // Check for Layer functions (MO, TG, TO, TT, OSL)
  const layerFunc = parseLayerFunction(trimmed);
  if (layerFunc) {
    return layerFunc;
  }
  
  // Check for Quantum Keycode format (Modifier+Key, e.g., "Alt+Bksp", "Ctrl+Shift+A")
  if (trimmed.includes('+')) {
    const quantum = parseQuantumKeycode(trimmed);
    if (quantum) return quantum;
  }
  
  // Check basic mappings
  if (basicKeycodes[upperTrimmed]) {
    return basicKeycodes[upperTrimmed];
  }
  
  // Single character: letter or number
  if (trimmed.length === 1) {
    if (/[A-Z]/.test(trimmed)) {
      return `KC_${trimmed}`;
    }
    if (/[0-9]/.test(trimmed)) {
      return `KC_${trimmed}`;
    }
    // Try lowercase too
    const lower = trimmed.toLowerCase();
    if (/[a-z]/.test(lower)) {
      return `KC_${lower.toUpperCase()}`;
    }
    // Check if it's in basicKeycodes (for symbols)
    if (basicKeycodes[lower]) {
      return basicKeycodes[lower];
    }
  }
  
  // If no match found, return original (user might have typed a valid keycode we don't recognize)
  return upperTrimmed;
}

/**
 * Converts a comma-separated string of characters/keycodes to an array of QMK keycodes
 * @param {string} input - Comma-separated string (e.g., "J, K" or "KC_J, KC_K")
 * @returns {string[]} Array of QMK keycodes
 */
function parseKeycodeString(input) {
  if (!input || typeof input !== 'string') return [];
  
  return input
    .split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0)
    .map(item => charToKeycode(item));
}

/**
 * Validates if a keycode string is a valid QMK keycode
 * @param {string} keycode - Keycode to validate (e.g., "KC_J", "LSFT(KC_A)")
 * @returns {boolean} True if the keycode appears to be valid
 */
function isValidKeycode(keycode) {
  if (!keycode || typeof keycode !== 'string') return false;
  
  const trimmed = keycode.trim();
  if (!trimmed) return false;
  
  // Check if it's a basic KC_* keycode (e.g., KC_A, KC_1, KC_ESC, KC_SPC)
  if (/^KC_[A-Z0-9_]+$/.test(trimmed)) {
    return true;
  }
  
  // Check if it's a modifier combination like LSFT(KC_A), LCTL(KC_B), LSA(KC__VOLUP), etc.
  if (/^(LSFT|RSFT|LCTL|RCTL|LALT|RALT|LGUI|RGUI|LSA)\(KC_[A-Z0-9_]+\)$/.test(trimmed)) {
    return true;
  }
  
  // Check if it's a complex nested modifier (e.g., LALT(LSFT(KC_7)))
  // This allows for nested modifiers up to 2 levels deep
  if (/^(LSFT|RSFT|LCTL|RCTL|LALT|RALT|LGUI|RGUI|LSA)\((LSFT|RSFT|LCTL|RCTL|LALT|RALT|LGUI|RGUI|LSA)\(KC_[A-Z0-9_]+\)\)$/.test(trimmed)) {
    return true;
  }
  
  // Check for deeper nesting (3+ levels) - allow any valid nested structure
  if (/^(LSFT|RSFT|LCTL|RCTL|LALT|RALT|LGUI|RGUI|LSA)\(.+\)$/.test(trimmed)) {
    // Recursively validate the inner part
    const innerMatch = trimmed.match(/^[A-Z]+\((.+)\)$/);
    if (innerMatch && isValidKeycode(innerMatch[1])) {
      return true;
    }
  }
  
  // Check if it's a special keycode like TD(...), USER(...), QK_*, etc.
  if (/^(TD|USER|QK_|DM_|MACRO)[A-Z0-9_]*\([^)]+\)$/.test(trimmed)) {
    return true;
  }
  
  // Check if it's a Layer function (MO, TG, TO, TT, OSL)
  if (/^(MO|TG|TO|TT|OSL)\(\d+\)$/.test(trimmed)) {
    return true;
  }
  
  // Check if it's a Quantum Keycode (QK_* format)
  if (/^QK_[A-Z0-9_]+$/.test(trimmed)) {
    return true;
  }
  
  // Check for NO and TRNS (transparent)
  if (/^(KC_NO|KC_TRNS|NO|TRNS)$/i.test(trimmed)) {
    return true;
  }
  
  // If it doesn't match any known pattern, check if it was in our mapping
  // This handles cases where the user typed something that should be converted
  const upper = trimmed.toUpperCase();
  if (basicKeycodes[upper]) {
    return true;
  }
  
  // Single character that would be converted to KC_* (letters and numbers)
  if (trimmed.length === 1) {
    if (/[A-Z0-9]/.test(trimmed)) {
      return true;
    }
    if (/[a-z]/.test(trimmed)) {
      return true;
    }
    // Single character symbols that are in our mapping
    if (basicKeycodes[trimmed]) {
      return true;
    }
  }
  
  // If it's a short string (2-10 chars) that's not a keycode pattern, it's likely invalid
  // But we allow it if it looks like it could be a valid keycode name
  if (trimmed.length > 1 && trimmed.length <= 10) {
    // Check if it's all uppercase letters/numbers/underscores (could be a keycode name)
    if (/^[A-Z0-9_]+$/.test(trimmed)) {
      // Could be a valid keycode name we don't know about, but likely invalid
      return false;
    }
  }
  
  return false;
}

/**
 * Validates an array of keycodes
 * @param {string[]} keycodes - Array of keycodes to validate
 * @returns {boolean} True if all keycodes are valid
 */
function validateKeycodes(keycodes) {
  if (!Array.isArray(keycodes)) return false;
  return keycodes.every(kc => isValidKeycode(kc));
}

// Make functions available globally for browser use
if (typeof window !== 'undefined') {
  window.charToKeycode = charToKeycode;
  window.parseKeycodeString = parseKeycodeString;
  window.isValidKeycode = isValidKeycode;
  window.validateKeycodes = validateKeycodes;
  window.basicKeycodes = basicKeycodes;
}

// Export for Node.js use (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { charToKeycode, parseKeycodeString, isValidKeycode, validateKeycodes, basicKeycodes };
}
