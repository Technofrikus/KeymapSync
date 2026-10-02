/* Keymap editor workflow: configuration file controls, logs, and the
 * editor panels (see keymap-editor.js). */
import platform from '../platform/index.js';
import createConfigSession from './config-session.js';
import createKeymapEditor from './keymap-editor.js';
import { isTransparentKeycode } from './keymap-presentation.js';

const configPath = document.getElementById('configPath');
const pickConfig = document.getElementById('pickConfig');
const reloadConfig = document.getElementById('reloadConfig');
const saveConfig = document.getElementById('saveConfig');
const configStatus = document.getElementById('configStatus');
const runStatus = document.getElementById('runStatus');
const logOutput = document.getElementById('logOutput');
const clearLogs = document.getElementById('clearLogs');
const copyLogs = document.getElementById('copyLogs');
const saveBtn = document.getElementById('saveBtn');
const unsavedDot = document.getElementById('unsavedDot');
const helpBtn = document.getElementById('helpBtn');
const settingsBtn = document.getElementById('settingsBtn');
const closeDrawer = document.getElementById('closeDrawer');
const drawer = document.getElementById('drawer');

let configObj = null;
let renderedConfig = null;

// The session is the single owner of loaded configuration, grants, and dirty
// state. The editor edits the session's config object in place.
const configSession = createConfigSession({
  api: platform,
  confirm: (message) => window.confirm(message),
  onStatus: (message) => setStatus(configStatus, message),
  onChange: ({ config, grant, dirty }) => {
    configObj = config;
    if (configPath && grant) configPath.value = grant.displayPath || '';
    if (unsavedDot) unsavedDot.hidden = !dirty;
    if (saveBtn) saveBtn.title = dirty ? 'Save configuration file (unsaved changes)' : 'Save configuration file';
    // Re-render only when a different configuration was loaded, so typing
    // never rebuilds the field that has focus.
    if (configObj && configObj !== renderedConfig) {
      renderedConfig = configObj;
      keymapEditor.render();
    }
  },
});

const keymapEditor = createKeymapEditor({
  documentLike: document,
  getConfig: () => configObj,
  onChange: () => configSession.markChanged(),
  keycodeToChar,
  confirm: (message) => window.confirm(message),
});

function appendLog(text) {
  logOutput.textContent += text;
  logOutput.scrollTop = logOutput.scrollHeight;
}

function setStatus(el, message) {
  if (!el) return;
  el.textContent = message;
  setTimeout(() => {
    if (el.textContent === message) el.textContent = '';
  }, 4000);
}

function toggleDrawer(show) {
  drawer.classList.toggle('visible', show);
}

// Helper function to convert keycode back to readable character for display
function keycodeToChar(keycode) {
  if (keycode === null || keycode === undefined) return '';
  if (isTransparentKeycode(keycode)) return '▼';
  if (typeof keycode === 'number') return '';
  if (typeof keycode !== 'string') return '';
  const trimmed = keycode.trim();

  // Check for custom Mac Small Step Volume keys
  if (trimmed === 'LSA(KC__VOLUP)') {
    return 'MacSSV+';
  }
  if (trimmed === 'LSA(KC__VOLDOWN)') {
    return 'MacSSV-';
  }

  // Check for Layer functions (e.g., MO(1) -> MO(1), TG(2) -> TG(2))
  const layerMatch = trimmed.match(/^(MO|TG|TO|TT|OSL)\((\d+)\)$/);
  if (layerMatch) {
    const func = layerMatch[1];
    const layer = layerMatch[2];
    return `${func}(${layer})`;
  }

  // Check for Layer-Tap (e.g., LT(1, KC_A) -> L1+A)
  const ltMatch = trimmed.match(/^LT\((\d+)\s*,\s*(.+)\)$/);
  if (ltMatch) {
    const layer = ltMatch[1];
    const innerKey = ltMatch[2];
    const innerChar = keycodeToChar(innerKey);
    return `L${layer}+${innerChar}`;
  }

  // Check for modifier combinations (e.g., LALT(KC_BSPC) -> Alt+Bksp)
  const modifierMatch = trimmed.match(/^(LALT|RALT|LCTL|RCTL|LSFT|RSFT|LGUI|RGUI|LSA)\((.+)\)$/);
  if (modifierMatch) {
    const modifier = modifierMatch[1];
    const innerKey = modifierMatch[2];

    // Special handling for LSA modifier (Mac Small Step)
    if (modifier === 'LSA') {
      if (innerKey === 'KC__VOLUP') return 'MacSSV+';
      if (innerKey === 'KC__VOLDOWN') return 'MacSSV-';
    }

    // Convert modifier to readable name
    const modifierNames = {
      'LALT': 'Alt', 'RALT': 'RAlt',
      'LCTL': 'Ctrl', 'RCTL': 'RCtrl',
      'LSFT': 'Shift', 'RSFT': 'RShift',
      'LGUI': 'Cmd', 'RGUI': 'RCmd'
    };
    const modName = modifierNames[modifier] || modifier;
    const innerChar = keycodeToChar(innerKey);
    return `${modName}+${innerChar}`;
  }

  // Check for Mod-Tap (e.g., LCTL_T(KC_A) -> Ctrl+A)
  const modTapMatch = trimmed.match(/^(LALT_T|RALT_T|LCTL_T|RCTL_T|LSFT_T|RSFT_T|LGUI_T|RGUI_T|ALL_T|MEH_T)\((.+)\)$/);
  if (modTapMatch) {
    const modifier = modTapMatch[1].replace('_T', '');
    const innerKey = modTapMatch[2];
    const modifierNames = {
      'LALT': 'Alt', 'RALT': 'RAlt',
      'LCTL': 'Ctrl', 'RCTL': 'RCtrl',
      'LSFT': 'Shift', 'RSFT': 'RShift',
      'LGUI': 'Cmd', 'RGUI': 'RCmd',
      'ALL': 'All', 'MEH': 'Meh'
    };
    const modName = modifierNames[modifier] || modifier;
    const innerChar = keycodeToChar(innerKey);
    return `${modName}_T+${innerChar}`;
  }

  // Extract letter from KC_A format
  const letterMatch = trimmed.match(/^KC_([A-Z])$/);
  if (letterMatch) return letterMatch[1];

  // Extract number from KC_1 format
  const numberMatch = trimmed.match(/^KC_([0-9])$/);
  if (numberMatch) return numberMatch[1];

  // Check reverse mapping for special keys
  const reverseMap = {
    'KC_NO': '',
    'KC_TRNS': '▼',
    'KC_SPC': 'Space', 'KC_ENT': 'Enter', 'KC_TAB': 'Tab',
    'KC_ESC': 'Esc', 'KC_BSPC': 'Bksp', 'KC_DEL': 'Del',
    'KC_MINS': '-', 'KC_EQL': '=', 'KC_LBRC': '[', 'KC_RBRC': ']',
    'KC_BSLS': '\\', 'KC_SCLN': ';', 'KC_QUOT': "'", 'KC_GRV': '`',
    'KC_COMM': ',', 'KC_DOT': '.', 'KC_SLSH': '/',
    'KC_LSFT': 'LShift', 'KC_RSFT': 'RShift', 'KC_LCTL': 'LCtrl', 'KC_RCTL': 'RCtrl',
    'KC_LALT': 'LAlt', 'KC_RALT': 'RAlt', 'KC_LGUI': 'LGui', 'KC_RGUI': 'RGui',
    // Long names / aliases
    'KC_LEFT_SHIFT': 'LShift', 'KC_RIGHT_SHIFT': 'RShift',
    'KC_LEFT_CTRL': 'LCtrl', 'KC_RIGHT_CTRL': 'RCtrl',
    'KC_LEFT_ALT': 'LAlt', 'KC_RIGHT_ALT': 'RAlt',
    'KC_LEFT_GUI': 'LGui', 'KC_RIGHT_GUI': 'RGui',
    'KC_LSHIFT': 'LShift', 'KC_RSHIFT': 'RShift',
    'KC_LCTRL': 'LCtrl', 'KC_RCTRL': 'RCtrl',
    'KC_LALT': 'LAlt', 'KC_RALT': 'RAlt',
    'KC_LGUI': 'LGui', 'KC_RGUI': 'RGui',
    'KC_COMMA': ',', 'KC_PERIOD': '.', 'KC_SLASH': '/',
    'KC_MINUS': '-', 'KC_EQUAL': '=', 'KC_SEMICOLON': ';', 'KC_QUOTE': "'",
    'KC_GRAVE': '`', 'KC_BACKSLASH': '\\', 'KC_NONUS_BSLS': '#',
    'KC_LBRACKET': '[', 'KC_RBRACKET': ']',
    'KC_BSLASH': '\\', 'KC_SCOLON': ';', 'KC_BSPACE': 'Bksp',
    'KC_CAPSLOCK': 'Caps', 'KC_NUMLOCK': 'NumLk', 'KC_SCROLLLOCK': 'ScLk',
    'KC_PSCREEN': 'PrtSc', 'KC_DELETE': 'Del', 'KC_INSERT': 'Ins',
    'KC_ESCAPE': 'Esc', 'KC_SPACE': 'Space', 'KC_ENTER': 'Enter',
    'KC_BACKSPACE': 'Bksp',
    'KC_UP': '↑', 'KC_DOWN': '↓', 'KC_LEFT': '←', 'KC_RIGHT': '→',
    'KC_CAPS': 'Caps Lock',
    'KC_HOME': 'Home', 'KC_END': 'End', 'KC_PGUP': 'PgUp', 'KC_PGDN': 'PgDn',
    'KC_F1': 'F1', 'KC_F2': 'F2', 'KC_F3': 'F3', 'KC_F4': 'F4',
    'KC_F5': 'F5', 'KC_F6': 'F6', 'KC_F7': 'F7', 'KC_F8': 'F8', 'KC_F9': 'F9',
    'KC_F10': 'F10', 'KC_F11': 'F11', 'KC_F12': 'F12',
    // Punctuation
    'KC_LPRN': '(', 'KC_RPRN': ')', 'KC_LCBR': '{', 'KC_RCBR': '}',
    'KC_LABK': '<', 'KC_RABK': '>', 'KC_PERC': '%', 'KC_AMPR': '&',
    'KC_ASTR': '*', 'KC_PLUS': '+', 'KC_PIPE': '|', 'KC_TILD': '~',
    'KC_EXLM': '!', 'KC_AT': '@', 'KC_HASH': '#', 'KC_DLR': '$',
    'KC_CIRC': '^', 'KC_COLN': ':', 'KC_DQUO': '"', 'KC_QUES': '?',
    // Media and System
    'KC_MPLY': 'Play', 'KC_MSTP': 'Stop', 'KC_MNXT': 'Next',
    'KC_MPRV': 'Prev', 'KC_MFFD': 'Fwd', 'KC_MRWD': 'Rew', 'KC_MUTE': 'Mute', 'KC_VOLD': 'Vol-', 'KC_VOLU': 'Vol+',
    'KC_PWR': 'Pwr', 'KC_SLEP': 'Sleep', 'KC_WAKE': 'Wake',
    'KC_CALC': 'Calc', 'KC_MAIL': 'Mail', 'KC_MSEL': 'Media',
    'KC_MYCM': 'PC', 'KC_WSCH': 'Search', 'KC_WHOM': 'Home',
    'KC_WBAK': 'Back', 'KC_WFWD': 'Fwd', 'KC_WSTP': 'Stop',
    'KC_WREF': 'Refresh', 'KC_WFAV': 'Fav',
    // Special
    'KC_GESC': 'Esc/~', 'KC_LSPO': '(', 'KC_RSPC': ')',
    'KC_LCPO': '(', 'KC_RCPC': ')', 'KC_LAPO': '(', 'KC_RAPC': ')',
    'KC_SFTENT': 'Enter',
    'KC_MS_U': 'MsUp', 'KC_MS_D': 'MsDn', 'KC_MS_L': 'MsLt', 'KC_MS_R': 'MsRt',
    'KC_BTN1': 'Btn1', 'KC_BTN2': 'Btn2', 'KC_BTN3': 'Btn3',
    'KC_WH_U': 'WhUp', 'KC_WH_D': 'WhDn'
  };
  if (reverseMap[trimmed]) return reverseMap[trimmed];

  // If it's a complex keycode, return as-is
  return trimmed;
}

async function initDefaults() {
  try {
    const defaults = await platform.getDefaults();
    const display = (grant) => grant?.displayPath || grant?.path || grant || '';
    configPath.value = display(defaults.configGrant || defaults.config);
    await configSession.init(defaults);
  } catch (err) {
    appendLog(`Initialization error: ${err.message}\n`);
    setStatus(configStatus, `Error during initialization: ${err.message}`);
  }
}

async function selectFile() {
  const selected = await configSession.chooseConfig();
  if (selected?.cancelled) return;
  configPath.value = configSession.grant?.displayPath || '';
}

async function loadConfig() {
  try {
    const result = await configSession.reload();
    if (!result?.cancelled) setStatus(configStatus, 'Config loaded');
  } catch (err) {
    setStatus(configStatus, `Error loading config: ${err.message}`);
  }
}

async function saveConfigToFile() {
  const result = await configSession.save();
  if (!result.ok) {
    setStatus(configStatus, result.error);
    setStatus(runStatus, result.error);
    appendLog(`Save failed: ${result.error}\n`);
  } else {
    setStatus(runStatus, 'Saved');
  }
  return result;
}

pickConfig.addEventListener('click', selectFile);
reloadConfig.addEventListener('click', loadConfig);
saveConfig.addEventListener('click', saveConfigToFile);
saveBtn.addEventListener('click', saveConfigToFile);
helpBtn?.addEventListener('click', () => keymapEditor.openHelp(''));
settingsBtn.addEventListener('click', () => toggleDrawer(true));
closeDrawer.addEventListener('click', () => toggleDrawer(false));

clearLogs.addEventListener('click', () => {
  logOutput.textContent = '';
});

copyLogs.addEventListener('click', async () => {
  await navigator.clipboard.writeText(logOutput.textContent);
  setStatus(runStatus, 'Logs copied');
});

// Listen for save-before-quit requests from the platform shell
if (platform.onSaveBeforeQuit) {
  platform.onSaveBeforeQuit(async () => {
    return saveConfigToFile();
  });
}

export const editor = {
  get configSession() { return configSession; },
  keycodeToChar,
};

initDefaults();
