const inputPath = document.getElementById('inputPath');
const outputPath = document.getElementById('outputPath');
const configPath = document.getElementById('configPath');
const pickInput = document.getElementById('pickInput');
const pickOutput = document.getElementById('pickOutput');
const pickConfig = document.getElementById('pickConfig');
const reloadConfig = document.getElementById('reloadConfig');
const saveConfig = document.getElementById('saveConfig');
const configStatus = document.getElementById('configStatus');
const runStatus = document.getElementById('runStatus');
const logOutput = document.getElementById('logOutput');
const clearLogs = document.getElementById('clearLogs');
const copyLogs = document.getElementById('copyLogs');
const saveBtn = document.getElementById('saveBtn');
const syncBtn = document.getElementById('syncBtn');
const settingsBtn = document.getElementById('settingsBtn');
const closeDrawer = document.getElementById('closeDrawer');
const drawer = document.getElementById('drawer');
const alphaTableBody = document.getElementById('alphaTableBody');
const helpPanel = document.getElementById('helpPanel');
const toggleHelp = document.getElementById('toggleHelp');
const gridAndHelp = document.getElementById('gridAndHelp');
const configPathLabel = document.getElementById('configPathLabel');
const inputPathLabel = document.getElementById('inputPathLabel');
const outputPathLabel = document.getElementById('outputPathLabel');
const tapdanceList = document.getElementById('tapdanceList');
const helpPanelResize = document.getElementById('helpPanelResize');
const layoutSelect = document.getElementById('layoutSelect');
const tapDanceTableBody = document.getElementById('tapDanceTableBody');
const comboTableBody = document.getElementById('comboTableBody');
const addTapDance = document.getElementById('addTapDance');
const addCombo = document.getElementById('addCombo');

let defaults = null;
let currentConfigPath = null;
let configObj = null;
let currentLayout = localStorage.getItem('keymapsync-layout') || 'qwerty';
let hasUnsavedChanges = false;
let lastSavedConfig = null;

// Layout definitions
const layouts = {
  qwerty: ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Z', 'X', 'C', 'V', 'B', 'N', 'M'],
  dvorak: ['P', 'Y', 'F', 'G', 'C', 'R', 'L', 'D', 'H', 'T', 'N', 'S', 'E', 'I', 'O', 'A', 'Q', 'J', 'K', 'X', 'B', 'M', 'W', 'V', 'Z'],
  colemak: ['Q', 'W', 'F', 'P', 'G', 'J', 'L', 'U', 'Y', ';', 'A', 'R', 'S', 'T', 'D', 'H', 'N', 'E', 'I', 'O', 'Z', 'X', 'C', 'V', 'B', 'K', 'M'],
  alphabetical: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']
};

// Categorize keys
function categorizeKeys(mappings) {
  const letters = [];
  const special = [];
  
  Object.entries(mappings).forEach(([key, val]) => {
    if (key.startsWith('_row')) return;
    if (/^[A-Z]$/.test(key)) {
      letters.push([key, val]);
    } else {
      special.push([key, val]);
    }
  });
  
  return { letters, special };
}

// Sort letters by layout
function sortLettersByLayout(letters, layout) {
  const layoutOrder = layouts[layout] || layouts.qwerty;
  const letterMap = new Map(letters);
  const sorted = [];
  const remaining = [];
  
  // Add letters in layout order
  layoutOrder.forEach(letter => {
    if (letterMap.has(letter)) {
      sorted.push([letter, letterMap.get(letter)]);
      letterMap.delete(letter);
    }
  });
  
  // Add any remaining letters (not in layout)
  letterMap.forEach((val, key) => {
    remaining.push([key, val]);
  });
  remaining.sort((a, b) => a[0].localeCompare(b[0]));
  
  return [...sorted, ...remaining];
}

function appendLog(text) {
  logOutput.textContent += text;
  logOutput.scrollTop = logOutput.scrollHeight;
}

function setStatus(el, message) {
  el.textContent = message;
  setTimeout(() => {
    if (el.textContent === message) el.textContent = '';
  }, 4000);
}

function toggleDrawer(show) {
  drawer.classList.toggle('visible', show);
}

function renderTapdanceHelp() {
  tapdanceList.innerHTML = '';
  const list = configObj?.tapDanceOverrides || [];
  if (!list.length) {
    tapdanceList.innerHTML = '<li>No Tap-Dance entries available.</li>';
    return;
  }
  list.forEach((td, idx) => {
    const li = document.createElement('li');
    const name = td.name || `TD${idx + 1}`;
    const tap = td.tap ? keycodeToChar(td.tap) : '';
    const hold = td.hold ? keycodeToChar(td.hold) : '';
    const doubleTap = td.doubleTap ? keycodeToChar(td.doubleTap) : '';
    const tapHold = td.tapHold ? keycodeToChar(td.tapHold) : '';
    let parts = [];
    if (tap) parts.push(`tap: ${tap}`);
    if (hold) parts.push(`hold: ${hold}`);
    if (doubleTap) parts.push(`double: ${doubleTap}`);
    if (tapHold) parts.push(`tap+hold: ${tapHold}`);
    const actions = parts.length > 0 ? parts.join(' | ') : 'no actions';
    li.textContent = `${name}: ${actions}`;
    tapdanceList.appendChild(li);
  });
}

function createTapDanceRow(td, index) {
  const row = document.createElement('tr');
  
  // Name cell
  const nameCell = document.createElement('td');
  nameCell.className = 'input-cell';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = td.name || '';
  nameInput.placeholder = 'e.g. H_GUIH';
  nameInput.addEventListener('input', (e) => {
    if (!configObj.tapDanceOverrides) configObj.tapDanceOverrides = [];
    configObj.tapDanceOverrides[index].name = e.target.value;
    markAsChanged();
  });
  nameCell.appendChild(nameInput);
  row.appendChild(nameCell);
  
  // Helper function to create a keycode input field with validation and conversion
  function createKeycodeInput(value, placeholder, tooltip, fieldName) {
    const cell = document.createElement('td');
    cell.className = 'input-cell';
    const input = document.createElement('input');
    input.type = 'text';
    
    // Display: convert keycode back to readable format
    input.value = value ? keycodeToChar(value) : '';
    input.placeholder = placeholder;
    input.title = tooltip;
    
    // Validate existing value on render
    if (value && typeof isValidKeycode === 'function') {
      const isValid = isValidKeycode(value);
      if (!isValid) {
        input.classList.add('invalid');
      }
    }
    
    input.addEventListener('input', (e) => {
      if (!configObj.tapDanceOverrides) configObj.tapDanceOverrides = [];
      const inputValue = e.target.value.trim();
      
      // Remove validation styling
      input.classList.remove('invalid');
      
      if (!inputValue) {
        configObj.tapDanceOverrides[index][fieldName] = '';
        markAsChanged();
        return;
      }
      
      // Convert to keycode
      if (typeof charToKeycode === 'function') {
        const keycode = charToKeycode(inputValue);
        configObj.tapDanceOverrides[index][fieldName] = keycode;
        markAsChanged();
        
        // Validate the converted keycode
        if (typeof isValidKeycode === 'function') {
          const isValid = isValidKeycode(keycode);
          if (!isValid) {
            input.classList.add('invalid');
          }
        }
      } else {
        // Fallback: use value as-is
        configObj.tapDanceOverrides[index][fieldName] = inputValue;
        markAsChanged();
      }
    });
    
    // Validate on blur (when user leaves the field)
    input.addEventListener('blur', (e) => {
      const inputValue = e.target.value.trim();
      if (!inputValue) return;
      
      if (typeof charToKeycode === 'function' && typeof isValidKeycode === 'function') {
        const keycode = charToKeycode(inputValue);
        const isValid = isValidKeycode(keycode);
        if (!isValid) {
          input.classList.add('invalid');
        } else {
          input.classList.remove('invalid');
        }
      }
    });
    
    cell.appendChild(input);
    return cell;
  }
  
  // Tap cell
  const tapCell = createKeycodeInput(
    td.tap || '',
    'e.g. H or KC_H',
    'Tap action: Enter a keycode (e.g. H, KC_H) or use Quantum Keycode format (e.g. Alt+Bksp). See Help panel for details.',
    'tap'
  );
  row.appendChild(tapCell);
  
  // Hold cell
  const holdCell = createKeycodeInput(
    td.hold || '',
    'e.g. Alt+H or LGUI(KC_H)',
    'Hold action: Enter a keycode (e.g. KC_H) or use Quantum Keycode format (e.g. Alt+H, Cmd+C). See Help panel for details.',
    'hold'
  );
  row.appendChild(holdCell);
  
  // Double Tap cell
  const doubleTapCell = createKeycodeInput(
    td.doubleTap || '',
    'e.g. NO or KC_NO',
    'Double tap action: Enter a keycode (e.g. NO, KC_NO) or use Quantum Keycode format. See Help panel for details.',
    'doubleTap'
  );
  row.appendChild(doubleTapCell);
  
  // Tap+Hold cell
  const tapHoldCell = createKeycodeInput(
    td.tapHold || '',
    'e.g. NO or KC_NO',
    'Tap+Hold action: Enter a keycode (e.g. NO, KC_NO) or use Quantum Keycode format. See Help panel for details.',
    'tapHold'
  );
  row.appendChild(tapHoldCell);
  
  // Delete button cell
  const deleteCell = document.createElement('td');
  deleteCell.className = 'action-cell';
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-button';
  deleteBtn.textContent = '🗑️';
  deleteBtn.title = 'Delete';
  deleteBtn.addEventListener('click', () => {
    if (!configObj.tapDanceOverrides) return;
    configObj.tapDanceOverrides.splice(index, 1);
    markAsChanged();
    renderTapDanceTable();
    renderTapdanceHelp();
  });
  deleteCell.appendChild(deleteBtn);
  row.appendChild(deleteCell);
  
  return row;
}

function renderTapDanceTable() {
  if (!tapDanceTableBody) return;
  tapDanceTableBody.innerHTML = '';
  
  if (!configObj.tapDanceOverrides) {
    configObj.tapDanceOverrides = [];
  }
  
  configObj.tapDanceOverrides.forEach((td, idx) => {
    tapDanceTableBody.appendChild(createTapDanceRow(td, idx));
  });
}

// Helper function to convert keycode back to readable character for display
function keycodeToChar(keycode) {
  if (!keycode || typeof keycode !== 'string') return '';
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
  
  // Check for modifier combinations (e.g., LALT(KC_BSPC) -> Alt+Bksp)
  const modifierMatch = trimmed.match(/^(LALT|RALT|LCTL|RCTL|LSFT|RSFT|LGUI|RGUI|LSA)\((.+)\)$/);
  if (modifierMatch) {
    const modifier = modifierMatch[1];
    const innerKey = modifierMatch[2];
    
    // Special handling for LSA modifier (Mac Small Step)
    if (modifier === 'LSA') {
      if (innerKey === 'KC__VOLUP') {
        return 'MacSSV+';
      }
      if (innerKey === 'KC__VOLDOWN') {
        return 'MacSSV-';
      }
      // For other LSA combinations, show as-is
      return `LSA(${innerKey})`;
    }
    
    // Convert modifier to readable name
    const modifierNames = {
      'LALT': 'Alt', 'RALT': 'RAlt',
      'LCTL': 'Ctrl', 'RCTL': 'RCtrl',
      'LSFT': 'Shift', 'RSFT': 'RShift',
      'LGUI': 'Cmd', 'RGUI': 'RCmd'
    };
    const modName = modifierNames[modifier] || modifier;
    
    // Recursively convert inner key
    const innerChar = keycodeToChar(innerKey);
    
    // If inner key is converted, combine them
    if (innerChar && innerChar !== innerKey) {
      return `${modName}+${innerChar}`;
    }
    // If inner key is still a keycode, just show the modifier
    return `${modName}+${innerKey}`;
  }
  
  // Extract letter from KC_A format
  const letterMatch = trimmed.match(/^KC_([A-Z])$/);
  if (letterMatch) return letterMatch[1];
  
  // Extract number from KC_1 format
  const numberMatch = trimmed.match(/^KC_([0-9])$/);
  if (numberMatch) return numberMatch[1];
  
  // Check reverse mapping for special keys
  const reverseMap = {
    'KC_SPC': 'SPACE', 'KC_ENT': 'ENTER', 'KC_TAB': 'TAB',
    'KC_ESC': 'ESC', 'KC_BSPC': 'Bksp', 'KC_DEL': 'DELETE',
    'KC_MINS': '-', 'KC_EQL': '=', 'KC_LBRC': '[', 'KC_RBRC': ']',
    'KC_BSLS': '\\', 'KC_SCLN': ';', 'KC_QUOT': "'", 'KC_GRV': '`',
    'KC_COMM': ',', 'KC_DOT': '.', 'KC_SLSH': '/',
    // Media keys
    'KC_MPLY': 'PLAY', 'KC_MSTP': 'STOP', 'KC_MNXT': 'NEXT',
    'KC_MPRV': 'PREVIOUS', 'KC_MFFD': 'FASTFORWARD', 'KC_MRWD': 'REWIND'
  };
  if (reverseMap[trimmed]) return reverseMap[trimmed];
  
  // If it's a complex keycode, return as-is
  return trimmed;
}

function createComboRow(combo, index) {
  const row = document.createElement('tr');
  
  // Keys cell (comma-separated input) - accepts characters, converts to keycodes
  const keysCell = document.createElement('td');
  keysCell.className = 'input-cell';
  const keysInput = document.createElement('input');
  keysInput.type = 'text';
  
  // Display: convert keycodes back to readable format
  const displayKeys = Array.isArray(combo.keys) 
    ? combo.keys.map(k => keycodeToChar(k)).join(', ')
    : '';
  keysInput.value = displayKeys;
  keysInput.placeholder = 'e.g. J, K or KC_J, KC_K';
  keysInput.title = 'Combo keys: Enter characters or keycodes separated by commas (e.g. "J, K" or "KC_J, KC_K"). See Help panel for all supported keycodes.';
  
  // Validate existing keys on render
  if (displayKeys && typeof validateKeycodes === 'function' && typeof parseKeycodeString === 'function') {
    const keys = parseKeycodeString(displayKeys);
    const isValid = validateKeycodes(keys);
    if (!isValid) {
      keysInput.classList.add('invalid');
    }
  }
  
  keysInput.addEventListener('input', (e) => {
    if (!configObj.comboOverrides) configObj.comboOverrides = [];
    const value = e.target.value.trim();
    
    // Remove validation styling
    keysInput.classList.remove('invalid');
    
    if (!value) {
      configObj.comboOverrides[index].keys = [];
      markAsChanged();
      return;
    }
    
    // Parse and convert to keycodes
    if (typeof parseKeycodeString === 'function') {
      const keys = parseKeycodeString(value);
      configObj.comboOverrides[index].keys = keys;
      markAsChanged();
      
      // Validate the converted keycodes
      if (typeof validateKeycodes === 'function') {
        const isValid = validateKeycodes(keys);
        if (!isValid) {
          keysInput.classList.add('invalid');
        }
      }
    } else {
      // Fallback: if function not loaded yet, just split by comma
      const keys = value.split(',').map(k => k.trim()).filter(k => k);
      configObj.comboOverrides[index].keys = keys;
      markAsChanged();
    }
  });
  
  // Validate on blur (when user leaves the field)
  keysInput.addEventListener('blur', (e) => {
    const value = e.target.value.trim();
    if (!value) return;
    
    if (typeof parseKeycodeString === 'function' && typeof validateKeycodes === 'function') {
      const keys = parseKeycodeString(value);
      const isValid = validateKeycodes(keys);
      if (!isValid) {
        keysInput.classList.add('invalid');
      } else {
        keysInput.classList.remove('invalid');
      }
    }
  });
  
  keysCell.appendChild(keysInput);
  row.appendChild(keysCell);
  
  // Result cell - also accepts characters
  const resultCell = document.createElement('td');
  resultCell.className = 'input-cell';
  const resultInput = document.createElement('input');
  resultInput.type = 'text';
  
  // Display: convert keycode back to readable format
  resultInput.value = combo.result ? keycodeToChar(combo.result) : '';
  resultInput.placeholder = 'e.g. ESC, KC_ESC, Alt+Bksp, or MO(1)';
  resultInput.title = 'Result keycode: Enter a keycode (e.g. ESC, KC_ESC), use Quantum Keycode format (e.g. Alt+Bksp), or Layer functions (e.g. MO(1), TG(2)). See Help panel for details.';
  
  // Validate existing result on render
  if (combo.result && typeof isValidKeycode === 'function') {
    const isValid = isValidKeycode(combo.result);
    if (!isValid) {
      resultInput.classList.add('invalid');
    }
  }
  
  resultInput.addEventListener('input', (e) => {
    if (!configObj.comboOverrides) configObj.comboOverrides = [];
    const value = e.target.value.trim();
    
    // Remove validation styling
    resultInput.classList.remove('invalid');
    
    if (!value) {
      configObj.comboOverrides[index].result = '';
      markAsChanged();
      return;
    }
    
      // Convert to keycode
      if (typeof charToKeycode === 'function') {
        const keycode = charToKeycode(value);
        configObj.comboOverrides[index].result = keycode;
        markAsChanged();
        
        // Validate the converted keycode
        if (typeof isValidKeycode === 'function') {
          const isValid = isValidKeycode(keycode);
          if (!isValid) {
            resultInput.classList.add('invalid');
          }
        }
      } else {
        // Fallback: use value as-is
        configObj.comboOverrides[index].result = value;
        markAsChanged();
      }
  });
  
  // Validate on blur (when user leaves the field)
  resultInput.addEventListener('blur', (e) => {
    const value = e.target.value.trim();
    if (!value) return;
    
    if (typeof charToKeycode === 'function' && typeof isValidKeycode === 'function') {
      const keycode = charToKeycode(value);
      const isValid = isValidKeycode(keycode);
      if (!isValid) {
        resultInput.classList.add('invalid');
      } else {
        resultInput.classList.remove('invalid');
      }
    }
  });
  
  resultCell.appendChild(resultInput);
  row.appendChild(resultCell);
  
  // Delete button cell
  const deleteCell = document.createElement('td');
  deleteCell.className = 'action-cell';
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-button';
  deleteBtn.textContent = '🗑️';
  deleteBtn.title = 'Delete';
  deleteBtn.addEventListener('click', () => {
    if (!configObj.comboOverrides) return;
    configObj.comboOverrides.splice(index, 1);
    markAsChanged();
    renderComboTable();
  });
  deleteCell.appendChild(deleteBtn);
  row.appendChild(deleteCell);
  
  return row;
}

function renderComboTable() {
  if (!comboTableBody) return;
  comboTableBody.innerHTML = '';
  
  if (!configObj.comboOverrides) {
    configObj.comboOverrides = [];
  }
  
  configObj.comboOverrides.forEach((combo, idx) => {
    comboTableBody.appendChild(createComboRow(combo, idx));
  });
}

function createKeyRow(key, val) {
  const row = document.createElement('tr');
  
  // Key cell
  const keyCell = document.createElement('td');
  keyCell.className = 'key-cell';
  keyCell.textContent = key;
  row.appendChild(keyCell);

    // Base cell
    const baseCell = document.createElement('td');
    baseCell.className = 'input-cell';
    const baseContainer = document.createElement('div');
    baseContainer.className = 'input-with-button';
    const baseInput = document.createElement('input');
    baseInput.type = 'text';
    // Display base value if it exists (could be string like "TD(H_GUIH)" or null)
    baseInput.value = val.base !== null && val.base !== undefined ? String(val.base) : '';
    baseInput.addEventListener('input', (e) => {
      const newValue = e.target.value.trim();
      configObj.alphaMappings[key].base = newValue || null;
      markAsChanged();
    });
    const baseAdd = document.createElement('button');
    baseAdd.type = 'button';
    baseAdd.className = 'tiny-button';
    baseAdd.textContent = '+';
    baseAdd.title = 'Select Tap-Dance';
    baseAdd.addEventListener('click', (e) => {
      e.stopPropagation();
      const list = configObj?.tapDanceOverrides || [];
      if (!list.length) return;
      const existing = document.body.querySelector('.td-dropdown');
      if (existing) existing.remove();
      const dropdown = document.createElement('div');
      dropdown.className = 'td-dropdown';
      dropdown.style.position = 'absolute';
      dropdown.style.zIndex = '1000';
      dropdown.style.background = '#1f2937';
      dropdown.style.border = '1px solid #334155';
      dropdown.style.borderRadius = '4px';
      dropdown.style.padding = '4px';
      dropdown.style.display = 'flex';
      dropdown.style.flexDirection = 'column';
      dropdown.style.gap = '2px';
      list.forEach((td, idx) => {
        const btn = document.createElement('button');
        const name = td.name || `TD${idx + 1}`;
        btn.textContent = name;
        btn.style.width = '100%';
        btn.style.textAlign = 'left';
        btn.style.padding = '4px 8px';
        btn.style.background = '#0f172a';
        btn.style.border = 'none';
        btn.style.borderRadius = '2px';
        btn.style.color = '#e5e7eb';
        btn.style.cursor = 'pointer';
        btn.style.fontSize = '12px';
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          baseInput.value = `TD(${name})`;
          configObj.alphaMappings[key].base = `TD(${name})`;
          markAsChanged();
          baseInput.dispatchEvent(new Event('input', { bubbles: true }));
          dropdown.remove();
        });
        btn.addEventListener('mouseenter', () => {
          btn.style.background = '#2563eb';
        });
        btn.addEventListener('mouseleave', () => {
          btn.style.background = '#0f172a';
        });
        dropdown.appendChild(btn);
      });
      const rect = baseAdd.getBoundingClientRect();
      dropdown.style.left = `${rect.left}px`;
      dropdown.style.top = `${rect.bottom + 2}px`;
      document.body.appendChild(dropdown);
      const closeOnClickOutside = (ev) => {
        if (!dropdown.contains(ev.target) && ev.target !== baseAdd) {
          dropdown.remove();
          document.removeEventListener('click', closeOnClickOutside);
        }
      };
      setTimeout(() => document.addEventListener('click', closeOnClickOutside), 0);
    });
    baseContainer.appendChild(baseInput);
    baseContainer.appendChild(baseAdd);
    baseCell.appendChild(baseContainer);
    row.appendChild(baseCell);

    // Layer 1 cell
    const l1Cell = document.createElement('td');
    l1Cell.className = 'input-cell';
    const l1Input = document.createElement('input');
    l1Input.type = 'text';
    l1Input.value = val.layer1 ?? '';
    l1Input.addEventListener('input', (e) => {
      configObj.alphaMappings[key].layer1 = e.target.value;
      markAsChanged();
    });
    l1Cell.appendChild(l1Input);
    row.appendChild(l1Cell);

    // Layer 2 cell
    const l2Cell = document.createElement('td');
    l2Cell.className = 'input-cell';
    const l2Input = document.createElement('input');
    l2Input.type = 'text';
    l2Input.value = val.layer2 ?? '';
    l2Input.addEventListener('input', (e) => {
      configObj.alphaMappings[key].layer2 = e.target.value;
      markAsChanged();
    });
    l2Cell.appendChild(l2Input);
    row.appendChild(l2Cell);

  return row;
}

function createCategoryHeader(label) {
  const row = document.createElement('tr');
  row.className = 'category-header';
  const cell = document.createElement('td');
  cell.colSpan = 4;
  cell.textContent = label;
  row.appendChild(cell);
  return row;
}

function renderGrid() {
  if (!configObj?.alphaMappings) return;
  alphaTableBody.innerHTML = '';

  const { letters, special } = categorizeKeys(configObj.alphaMappings);
  const sortedLetters = sortLettersByLayout(letters, currentLayout);

  // Render Letters category
  if (sortedLetters.length > 0) {
    alphaTableBody.appendChild(createCategoryHeader('Buchstaben'));
    sortedLetters.forEach(([key, val]) => {
      alphaTableBody.appendChild(createKeyRow(key, val));
    });
  }

  // Render Special characters category
  if (special.length > 0) {
    alphaTableBody.appendChild(createCategoryHeader('Sonderzeichen'));
    special.sort((a, b) => a[0].localeCompare(b[0]));
    special.forEach(([key, val]) => {
      alphaTableBody.appendChild(createKeyRow(key, val));
    });
  }
  
  // Render TapDance and Combos
  renderTapDanceTable();
  renderComboTable();
}

async function initDefaults() {
  defaults = await window.api.getDefaults();
  inputPath.value = defaults.input;
  outputPath.value = defaults.output;
  configPath.value = defaults.config;
  inputPathLabel.textContent = defaults.input;
  outputPathLabel.textContent = defaults.output;
  currentConfigPath = defaults.config;
  await loadConfig();
}

async function selectFolder(targetInput, labelEl) {
  const selected = await window.api.selectPath({ type: 'folder', defaultPath: targetInput.value });
  if (selected) {
    targetInput.value = selected;
    if (labelEl) labelEl.textContent = selected;
  }
}

async function selectFile(targetInput, labelEl) {
  const selected = await window.api.selectPath({ type: 'file', defaultPath: targetInput.value });
  if (selected) {
    targetInput.value = selected;
    currentConfigPath = selected;
    if (labelEl) labelEl.textContent = selected;
  }
}

async function loadConfig() {
  try {
    const data = await window.api.loadAlpha(currentConfigPath);
    configObj = JSON.parse(data.content);
    currentConfigPath = data.path;
    configPath.value = data.path;
    configPathLabel.textContent = data.path;
    renderGrid();
    renderTapdanceHelp();
    // Reset unsaved changes tracking
    lastSavedConfig = JSON.stringify(configObj, null, 2);
    hasUnsavedChanges = false;
    setStatus(configStatus, 'Config loaded');
  } catch (err) {
    setStatus(configStatus, `Error loading config: ${err.message}`);
  }
}

function markAsChanged() {
  // Check if there are actual changes
  if (checkForChanges()) {
    // Notify main process about unsaved changes
    if (window.api?.setUnsavedChanges) {
      window.api.setUnsavedChanges(true);
    }
  }
}

function checkForChanges() {
  if (!configObj) {
    hasUnsavedChanges = false;
    return false;
  }
  
  // If we haven't saved yet, mark as changed if configObj exists
  if (!lastSavedConfig) {
    hasUnsavedChanges = true;
    return true;
  }
  
  const currentConfig = JSON.stringify(configObj, null, 2);
  hasUnsavedChanges = currentConfig !== lastSavedConfig;
  return hasUnsavedChanges;
}

function validateCombos() {
  if (!configObj.comboOverrides || !Array.isArray(configObj.comboOverrides)) {
    return { valid: true, errors: [] };
  }
  
  const errors = [];
  
  configObj.comboOverrides.forEach((combo, index) => {
    // Validate keys
    if (Array.isArray(combo.keys)) {
      combo.keys.forEach((key, keyIndex) => {
        if (typeof validateKeycodes === 'function' && !isValidKeycode(key)) {
          errors.push(`Combo ${index + 1}: Ungültiger Keycode "${key}" in Keys (Position ${keyIndex + 1})`);
        }
      });
    }
    
    // Validate result
    if (combo.result) {
      if (typeof isValidKeycode === 'function' && !isValidKeycode(combo.result)) {
        errors.push(`Combo ${index + 1}: Ungültiger Keycode "${combo.result}" im Result-Feld`);
      }
    }
  });
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

async function saveConfigToFile() {
  try {
    // Validate combos before saving
    const validation = validateCombos();
    if (!validation.valid) {
      const errorMsg = validation.errors.join('; ');
      setStatus(configStatus, `Validierungsfehler: ${errorMsg}`);
      // Still allow saving, but show warning
      if (!confirm(`Es wurden ungültige Keycodes in den Combos gefunden:\n\n${validation.errors.join('\n')}\n\nTrotzdem speichern?`)) {
        return;
      }
    }
    
    const content = JSON.stringify(configObj, null, 2);
    await window.api.saveAlpha(currentConfigPath, content);
    // Mark as saved
    lastSavedConfig = content;
    hasUnsavedChanges = false;
    if (window.api?.setUnsavedChanges) {
      window.api.setUnsavedChanges(false);
    }
    setStatus(configStatus, validation.valid ? 'Config saved' : 'Config saved (mit Warnungen)');
  } catch (err) {
    setStatus(configStatus, `Error saving: ${err.message}`);
  }
}

async function runGenerator() {
  syncBtn.disabled = true;
  runStatus.textContent = 'Running...';
  appendLog(`\n--- Run started ${new Date().toLocaleString()} ---\n`);
  try {
    await saveConfigToFile();
    const result = await window.api.runGenerator({
      input: inputPath.value,
      output: outputPath.value,
      config: currentConfigPath
    });
    runStatus.textContent = `Done (exit ${result.code})`;
  } catch (err) {
    runStatus.textContent = `Error: ${err.message}`;
  } finally {
    syncBtn.disabled = false;
  }
}

pickInput.addEventListener('click', () => selectFolder(inputPath, inputPathLabel));
pickOutput.addEventListener('click', () => selectFolder(outputPath, outputPathLabel));
pickConfig.addEventListener('click', () => selectFile(configPath, configPathLabel));
reloadConfig.addEventListener('click', loadConfig);
saveConfig.addEventListener('click', saveConfigToFile);
saveBtn.addEventListener('click', saveConfigToFile);
syncBtn.addEventListener('click', runGenerator);
settingsBtn.addEventListener('click', () => toggleDrawer(true));
closeDrawer.addEventListener('click', () => toggleDrawer(false));
toggleHelp.addEventListener('click', () => {
  helpPanel.classList.toggle('collapsed');
  gridAndHelp.classList.toggle('collapsed', helpPanel.classList.contains('collapsed'));
  toggleHelp.textContent = helpPanel.classList.contains('collapsed') ? '▸ Help' : '▾ Help';
});

if (layoutSelect) {
  layoutSelect.value = currentLayout;
  layoutSelect.addEventListener('change', (e) => {
    currentLayout = e.target.value;
    localStorage.setItem('keymapsync-layout', currentLayout);
    renderGrid();
  });
}

if (addTapDance) {
  addTapDance.addEventListener('click', () => {
    if (!configObj.tapDanceOverrides) configObj.tapDanceOverrides = [];
    configObj.tapDanceOverrides.push({
      name: '',
      tap: '',
      hold: '',
      doubleTap: '',
      tapHold: ''
    });
    markAsChanged();
    renderTapDanceTable();
    renderTapdanceHelp();
  });
}

if (addCombo) {
  addCombo.addEventListener('click', () => {
    if (!configObj.comboOverrides) configObj.comboOverrides = [];
    configObj.comboOverrides.push({
      keys: [],
      result: ''
    });
    markAsChanged();
    renderComboTable();
  });
}

clearLogs.addEventListener('click', () => {
  logOutput.textContent = '';
});

copyLogs.addEventListener('click', async () => {
  await navigator.clipboard.writeText(logOutput.textContent);
  setStatus(runStatus, 'Logs copied');
});

window.api.onLog((data) => appendLog(data));

// Panel resize from left edge
if (helpPanelResize) {
  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  helpPanelResize.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = helpPanel.offsetWidth;
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
    e.preventDefault();
  });

  function handleResize(e) {
    if (!isResizing) return;
    const diff = startX - e.clientX; // Inverted because we resize from left
    const newWidth = Math.max(200, Math.min(600, startWidth + diff));
    helpPanel.style.width = `${newWidth}px`;
    gridAndHelp.style.gridTemplateColumns = `1fr ${newWidth}px`;
  }

  function stopResize() {
    isResizing = false;
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
  }
}

// Listen for save-before-quit message from main process
if (window.api?.onSaveBeforeQuit) {
  window.api.onSaveBeforeQuit(async () => {
    await saveConfigToFile();
  });
}

initDefaults();

