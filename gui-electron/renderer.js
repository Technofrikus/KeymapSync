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
const settingsBtn = document.getElementById('settingsBtn');
const closeDrawer = document.getElementById('closeDrawer');
const drawer = document.getElementById('drawer');
const alphaTableBody = document.getElementById('alphaTableBody');

// Navigation elements
const viewKeymapBtn = document.getElementById('viewKeymapBtn');
const viewOfflineBtn = document.getElementById('viewOfflineBtn');
const viewOnlineBtn = document.getElementById('viewOnlineBtn');
const keymapView = document.getElementById('keymapView');
const offlineView = document.getElementById('offlineView');
const onlineView = document.getElementById('onlineView');

// Offline Sync elements
const offlineInputPath = document.getElementById('offlineInputPath');
const offlineOutputPath = document.getElementById('offlineOutputPath');
const runOfflineSyncBtn = document.getElementById('runOfflineSyncBtn');
const offlineStatus = document.getElementById('offlineStatus');

// Online Sync elements
const refreshDevicesBtn = document.getElementById('refreshDevicesBtn');
const deviceList = document.getElementById('deviceList');
const onlineSyncPanel = document.getElementById('onlineSyncPanel');
const selectedDeviceName = document.getElementById('selectedDeviceName');
const deviceCapabilities = document.getElementById('deviceCapabilities');
const previewOnlineSyncBtn = document.getElementById('previewOnlineSyncBtn');
const runOnlineSyncBtn = document.getElementById('runOnlineSyncBtn');
const previewDiff = document.getElementById('previewDiff');
const syncPreview = document.getElementById('syncPreview');
const onlineStatus = document.getElementById('onlineStatus');
const layoutVisualization = document.getElementById('layoutVisualization');
const layoutGrid = document.getElementById('layoutGrid');
const previewLayouts = document.getElementById('previewLayouts');

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
  if (!el) return;
  el.textContent = message;
  setTimeout(() => {
    if (el.textContent === message) el.textContent = '';
  }, 4000);
}

function switchView(viewId) {
  // Update buttons
  viewKeymapBtn.classList.toggle('active', viewId === 'keymap');
  viewOfflineBtn.classList.toggle('active', viewId === 'offline');
  viewOnlineBtn.classList.toggle('active', viewId === 'online');

  // Update views
  keymapView.classList.toggle('visible', viewId === 'keymap');
  offlineView.classList.toggle('visible', viewId === 'offline');
  onlineView.classList.toggle('visible', viewId === 'online');
  
  if (viewId === 'online' && !selectedDevice) {
    refreshDevices();
  }
}

viewKeymapBtn.addEventListener('click', () => switchView('keymap'));
viewOfflineBtn.addEventListener('click', () => switchView('offline'));
viewOnlineBtn.addEventListener('click', () => switchView('online'));

let selectedDevice = null;
let currentDeviceState = null;
let targetDeviceState = null;
/** @type {{ keys: any[], labels: any, layoutOptionsMap: Map<number, number>, summary: string } | null} */
let keyboardLayoutGeometry = null;
const keymapPresentation = window.KeymapPresentation;
const getMatrixCell = keymapPresentation.getMatrixCell;
const isTransparentKeycode = keymapPresentation.isTransparentKeycode;

function clearElement(element) {
  element.replaceChildren();
}

function appendTextElement(parent, tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  parent.appendChild(element);
  return element;
}

function renderEmptyState(parent, message, className = 'empty-state') {
  clearElement(parent);
  appendTextElement(parent, 'div', className, message);
}

function renderKeyboardLayout(state, targetEl, layerIdx = 0, targetState = null) {
  keymapPresentation.render({
    state,
    target: targetEl,
    layer: layerIdx,
    targetState,
    geometry: keyboardLayoutGeometry,
    keycodeToLabel: keycodeToChar,
  });
}

async function refreshDevices() {
  renderEmptyState(deviceList, 'Searching for keyboards...');
  onlineSyncPanel.classList.add('hidden');
  layoutVisualization.classList.add('hidden');
  selectedDevice = null;
  keyboardLayoutGeometry = null;

  try {
    const devices = await window.api.device.discover();
    
    if (!devices || devices.length === 0) {
      renderEmptyState(deviceList, 'No Vial keyboards found.');
      return;
    }
    
    // Sort devices alphabetically by product_name
    devices.sort((a, b) => {
      const nameA = (a.product_name || 'Unknown Keyboard').toLowerCase();
      const nameB = (b.product_name || 'Unknown Keyboard').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    
    clearElement(deviceList);
    devices.forEach(dev => {
      const card = document.createElement('div');
      card.className = 'device-card';
      const id = `${dev.vendor_id}:${dev.product_id}`;
      appendTextElement(card, 'div', 'device-name', dev.product_name || 'Unknown Keyboard');
      appendTextElement(card, 'div', 'device-meta', `ID: ${id} | SN: ${dev.serial_number || 'N/A'}`);
      card.addEventListener('click', () => selectDevice(dev, card));
      deviceList.appendChild(card);
    });
  } catch (err) {
    renderEmptyState(deviceList, `Error during search: ${err.message}`);
  }
}

async function selectDevice(device, cardEl) {
  selectedDevice = device;
  document.querySelectorAll('.device-card').forEach(c => c.classList.remove('selected'));
  cardEl.classList.add('selected');
  
  selectedDeviceName.textContent = device.product_name || 'Unknown Keyboard';
  onlineSyncPanel.classList.remove('hidden');
  syncPreview.classList.add('hidden');
  runOnlineSyncBtn.classList.add('hidden');
  previewOnlineSyncBtn.classList.remove('hidden');
  layoutVisualization.classList.add('hidden');
  
  // Update capabilities tags
  clearElement(deviceCapabilities);
  appendTextElement(deviceCapabilities, 'span', 'cap-tag supported', `Keys (${device.layers || 0} Layers)`);
  appendTextElement(deviceCapabilities, 'span', `cap-tag ${device.has_combos ? 'supported' : ''}`, 'Combos');
  appendTextElement(deviceCapabilities, 'span', `cap-tag ${device.has_tap_dance ? 'supported' : ''}`, 'TapDance');
  
  // Disable options if not supported
  const syncCombos = document.getElementById('syncCombos');
  const syncTapDance = document.getElementById('syncTapDance');
  
  if (syncCombos) {
    syncCombos.disabled = !device.has_combos;
    syncCombos.checked = device.has_combos;
  }
  if (syncTapDance) {
    syncTapDance.disabled = !device.has_tap_dance;
    syncTapDance.checked = device.has_tap_dance;
  }

  keyboardLayoutGeometry = null;
  onlineStatus.textContent = 'Loading keyboard layout and options...';
  try {
    currentDeviceState = await window.api.device.snapshot(selectedDevice.id);

    let layoutInfo = '';
    try {
      if (window.api && window.api.device && typeof window.api.device.layout === 'function') {
        const raw = await window.api.device.layout(selectedDevice.id);
        if (raw && String(raw).trim()) layoutInfo = String(raw).trim();
      }
    } catch {
      /* optional */
    }

    const defRes =
      window.api && typeof window.api.fetchKeyboardDefinition === 'function'
        ? await window.api.fetchKeyboardDefinition({
            vendorId: device.vendor_id,
            productId: device.product_id,
            serialNumber: device.serial_number || '',
          })
        : { ok: false, error: 'fetchKeyboardDefinition not available (reload app after update)' };

    if (defRes && defRes.ok && defRes.definition && defRes.definition.layouts && defRes.definition.layouts.keymap) {
      const packed = keymapPresentation.resolvePackedLayoutOptions(currentDeviceState, defRes.layoutOptionsPacked);
      keyboardLayoutGeometry = keymapPresentation.prepare(defRes.definition, packed);
      const debugInfo = keyboardLayoutGeometry
        ? keymapPresentation.formatLayoutOptionsDebug(
            keyboardLayoutGeometry.labels,
            keyboardLayoutGeometry.packedLayoutOptions,
            keyboardLayoutGeometry.decodedLayoutOptions,
            keyboardLayoutGeometry.layoutOptionsMap,
          )
        : '';
      const appendInfo = (className, label, value) => {
        const info = document.createElement('div');
        info.className = className;
        appendTextElement(info, 'span', 'label', label);
        appendTextElement(info, 'span', 'value', value);
        deviceCapabilities.appendChild(info);
      };
      appendInfo('layout-options-info', 'Layout options (saved on keyboard):', (keyboardLayoutGeometry && keyboardLayoutGeometry.summary) || 'Default');
      appendInfo('layout-options-info subtle', 'Layout debug:', debugInfo);
      if (keyboardLayoutGeometry && keyboardLayoutGeometry.fallbackApplied) {
        appendInfo('layout-options-info subtle', 'KLE:', 'Using layout option 0 for each layout group (fallback — saved layout_options may not have matched this definition).');
      }
    } else if (defRes && defRes.error) {
      const info = document.createElement('div');
      info.className = 'layout-options-info warn';
      appendTextElement(info, 'span', 'label', 'KLE geometry:');
      appendTextElement(info, 'span', 'value', `${defRes.error} — using matrix view.`);
      deviceCapabilities.appendChild(info);
    }

    if (layoutInfo) {
      const info = document.createElement('div');
      info.className = 'layout-options-info subtle';
      appendTextElement(info, 'span', 'label', 'vitaly layout:');
      appendTextElement(info, 'span', 'value', layoutInfo);
      deviceCapabilities.appendChild(info);
    }

    renderKeyboardLayout(currentDeviceState, layoutGrid);
    layoutVisualization.classList.remove('hidden');
    onlineStatus.textContent = 'Ready for sync.';
  } catch (err) {
    onlineStatus.textContent = `Error loading layout: ${err.message}`;
  }
}

async function previewOnlineSync() {
  if (!selectedDevice) return;
  
  previewOnlineSyncBtn.disabled = true;
  onlineStatus.textContent = 'Reading keyboard configuration...';
  syncPreview.classList.add('hidden');
  clearElement(previewLayouts);
  
  try {
    // 1. Read current state
    currentDeviceState = await window.api.device.snapshot(selectedDevice.id);
    
    // 2. Transform without mutating the state read from the keyboard.
    const transformation = await window.api.processConfig(currentDeviceState, configObj);
    targetDeviceState = transformation.state;
    transformation.warnings.forEach((warning) => appendLog(`Warning: untranslated symbol ${warning}\n`));
    
    // 3. Compare and show diff
    const diff = calculateDiff(currentDeviceState, targetDeviceState);
    renderDiff(diff);
    
    // 4. Show visual layout diffs
    const layersWithChanges = new Set();
    diff.keys.forEach(d => {
      if (typeof d.layerIdx !== 'undefined') {
        layersWithChanges.add(d.layerIdx);
      }
    });
    
    if (layersWithChanges.size > 0) {
      const sortedLayers = Array.from(layersWithChanges).sort((a, b) => a - b);
      sortedLayers.forEach(idx => {
        const layerSection = document.createElement('div');
        layerSection.className = 'preview-layer-section';
        appendTextElement(layerSection, 'h4', '', `Layer ${idx}`);
        const gridContainer = document.createElement('div');
        gridContainer.className = 'layout-grid';
        renderKeyboardLayout(currentDeviceState, gridContainer, idx, targetDeviceState);
        layerSection.appendChild(gridContainer);
        previewLayouts.appendChild(layerSection);
      });
    }
    
    syncPreview.classList.remove('hidden');
    runOnlineSyncBtn.classList.remove('hidden');
    onlineStatus.textContent = 'Preview ready.';
  } catch (err) {
    onlineStatus.textContent = `Error: ${err.message}`;
  } finally {
    previewOnlineSyncBtn.disabled = false;
  }
}

function calculateDiff(current, target) {
  const diffs = {
    keys: [],
    combos: [],
    tapdance: [],
    keyOverrides: []
  };
  
  // Compare Keys (layers) - Use target layout length to catch new layers
  const maxLayers = Math.max(current.layout.length, target.layout.length);
  for (let lIdx = 0; lIdx < maxLayers; lIdx++) {
    const currentLayer = current.layout[lIdx] || [];
    const targetLayer = target.layout[lIdx] || [];
    
    const maxRows = Math.max(currentLayer.length, targetLayer.length);
    for (let rIdx = 0; rIdx < maxRows; rIdx++) {
      const currentRow = currentLayer[rIdx] || [];
      const targetRow = targetLayer[rIdx] || [];
      
      const maxCols = Math.max(currentRow.length, targetRow.length);
      for (let cIdx = 0; cIdx < maxCols; cIdx++) {
        const currentKey = getMatrixCell(currentRow, cIdx);
        const targetKey = getMatrixCell(targetRow, cIdx);

        if (currentKey !== targetKey) {
          diffs.keys.push({
            layerIdx: lIdx,
            loc: `L${lIdx} R${rIdx} C${cIdx}`,
            from: currentKey,
            to: targetKey
          });
        }
      }
    }
  }
  
  // Compare Combos
  if (current.combo || target.combo) {
    const currCombos = current.combo || [];
    const targetCombos = target.combo || [];
    const maxLen = Math.max(currCombos.length, targetCombos.length);
    for (let i = 0; i < maxLen; i++) {
      const c = JSON.stringify(currCombos[i]);
      const t = JSON.stringify(targetCombos[i]);
      if (c !== t) {
        // Handle array format [k1, k2, k3, k4, result]
        const formatCombo = (combo) => {
          if (!combo || !Array.isArray(combo)) return 'Empty';
          const keys = combo.slice(0, 4).filter(k => k && k !== 'KC_NO')
                            .map(k => keycodeToChar(k));
          const result = keycodeToChar(combo[4]);
          return `${keys.join('+')} -> ${result}`;
        };
        
        diffs.combos.push({
          idx: i,
          from: formatCombo(currCombos[i]),
          to: formatCombo(targetCombos[i])
        });
      }
    }
  }

  // Compare TapDance
  if (current.tap_dance || target.tap_dance) {
    const currTD = current.tap_dance || [];
    const targetTD = target.tap_dance || [];
    const maxLen = Math.max(currTD.length, targetTD.length);
    for (let i = 0; i < maxLen; i++) {
      const c = JSON.stringify(currTD[i]);
      const t = JSON.stringify(targetTD[i]);
      if (c !== t) {
        const formatTD = (td) => {
          if (!td || !Array.isArray(td)) return 'Empty';
          // Vial TD format: [tap, hold, doubleTap, tapHold, term]
          const actions = td.slice(0, 4).map(k => k === 'KC_NO' ? null : keycodeToChar(k)).filter(k => k);
          return actions.length > 0 ? actions.join(' | ') : 'No actions';
        };
        
        diffs.tapdance.push({
          idx: i,
          from: formatTD(currTD[i]),
          to: formatTD(targetTD[i])
        });
      }
    }
  }

  // Compare key overrides. These are Vial objects, so preserve their full
  // JSON representation in the preview instead of guessing a display format.
  if (current.key_override || target.key_override) {
    const currentOverrides = current.key_override || [];
    const targetOverrides = target.key_override || [];
    const maxLen = Math.max(currentOverrides.length, targetOverrides.length);
    for (let i = 0; i < maxLen; i++) {
      const from = currentOverrides[i];
      const to = targetOverrides[i];
      if (JSON.stringify(from) !== JSON.stringify(to)) {
        diffs.keyOverrides.push({
          idx: i,
          from: from ? JSON.stringify(from) : 'Empty',
          to: to ? JSON.stringify(to) : 'Empty',
        });
      }
    }
  }
  
  return diffs;
}

function renderDiff(diff) {
  clearElement(previewDiff);

  if (diff.keys.length === 0 && diff.combos.length === 0 && diff.tapdance.length === 0 && diff.keyOverrides.length === 0) {
    appendTextElement(previewDiff, 'div', 'no-changes', 'No changes required. Keyboard is already up to date.');
    return;
  }

  const panel = document.createElement('div');
  panel.className = 'diff-panel';

  const details = document.createElement('details');
  details.className = 'diff-details';
  const summary = document.createElement('summary');
  summary.className = 'diff-summary-sticky';
  summary.textContent = `Detailed list (${diff.keys.length + diff.combos.length + diff.tapdance.length + diff.keyOverrides.length} changes) — click to expand/collapse`;
  details.appendChild(summary);

  const content = document.createElement('div');
  content.className = 'diff-content diff-content-scroll';

  const pre = document.createElement('pre');
  const appendSection = (title, entries, formatter) => {
    if (!entries.length) return;
    appendTextElement(pre, 'strong', '', `${title} (${entries.length} changes):`);
    pre.appendChild(document.createTextNode('\n'));
    entries.forEach((entry) => {
      const { location, from, to } = formatter(entry);
      appendTextElement(pre, 'span', 'diff-loc', `${location}:`);
      pre.appendChild(document.createTextNode(' '));
      appendTextElement(pre, 'span', 'diff-old', from);
      pre.appendChild(document.createTextNode(' -> '));
      appendTextElement(pre, 'span', 'diff-new', to);
      pre.appendChild(document.createTextNode('\n'));
    });
    pre.appendChild(document.createTextNode('\n'));
  };
  appendSection('Keys', diff.keys, (d) => ({ location: d.loc, from: keycodeToChar(d.from), to: keycodeToChar(d.to) }));
  appendSection('Combos', diff.combos, (d) => ({ location: `Slot ${d.idx}`, from: d.from, to: d.to }));
  appendSection('TapDance', diff.tapdance, (d) => ({ location: `Slot ${d.idx}`, from: d.from, to: d.to }));
  appendSection('Key Overrides', diff.keyOverrides, (d) => ({ location: `Slot ${d.idx}`, from: d.from, to: d.to }));
  content.appendChild(pre);
  details.appendChild(content);
  panel.appendChild(details);
  previewDiff.appendChild(panel);
}

const downloadBackupBtn = document.getElementById('downloadBackupBtn');

refreshDevicesBtn.addEventListener('click', refreshDevices);
previewOnlineSyncBtn.addEventListener('click', previewOnlineSync);

async function downloadBackup() {
  if (!currentDeviceState) {
    onlineStatus.textContent = 'Please load preview first to read configuration.';
    return;
  }
  
  try {
    const defaultName = `${selectedDevice.product_name.replace(/\s+/g, '_')}_backup.vil`;
    const filePath = await window.api.savePath({
      defaultPath: defaultName,
      filters: [{ name: 'Vial Layout', extensions: ['vil'] }]
    });
    
    if (filePath) {
      await window.api.saveVilBackup(filePath, currentDeviceState);
      onlineStatus.textContent = `Backup saved: ${filePath}`;
    }
  } catch (err) {
    onlineStatus.textContent = `Error saving backup: ${err.message}`;
  }
}

downloadBackupBtn.addEventListener('click', downloadBackup);

async function runOnlineSync() {
  if (!selectedDevice || !targetDeviceState) return;
  
  if (!confirm('Do you want to write these changes to the keyboard now?')) return;
  
  runOnlineSyncBtn.disabled = true;
  onlineStatus.textContent = 'Writing configuration...';
  
  try {
    // Re-read and transform the current device state immediately before writing,
    // so unrelated firmware settings are retained and the target is not stale.
    currentDeviceState = await window.api.device.snapshot(selectedDevice.id);
    const transformation = await window.api.processConfig(currentDeviceState, configObj);
    const freshTargetDeviceState = transformation.state;

    const selectedSections = [
      ['layout', document.getElementById('syncBaseKeys').checked],
      ['combo', document.getElementById('syncCombos').checked],
      ['tap_dance', document.getElementById('syncTapDance').checked],
      ['key_override', document.getElementById('syncKeyOverrides').checked],
    ];
    const changedSincePreview = selectedSections.some(([section, selected]) => (
      selected && JSON.stringify(targetDeviceState[section]) !== JSON.stringify(freshTargetDeviceState[section])
    ));
    if (changedSincePreview) {
      onlineStatus.textContent = 'The keyboard changed since the preview. Please preview again before applying.';
      return;
    }

    // 1. Prepare data based on options
    const finalDoc = JSON.parse(JSON.stringify(currentDeviceState));
    
    if (document.getElementById('syncBaseKeys').checked) {
      finalDoc.layout = freshTargetDeviceState.layout;
    }
    if (document.getElementById('syncCombos').checked) {
      finalDoc.combo = freshTargetDeviceState.combo;
    }
    if (document.getElementById('syncTapDance').checked) {
      finalDoc.tap_dance = freshTargetDeviceState.tap_dance;
    }
    if (document.getElementById('syncKeyOverrides').checked) {
      finalDoc.key_override = freshTargetDeviceState.key_override;
    }
    
    // 2. Apply
    await window.api.device.apply(selectedDevice.id, finalDoc);
    
    onlineStatus.textContent = 'Sync completed successfully!';
    runOnlineSyncBtn.classList.add('hidden');
    syncPreview.classList.add('hidden');
  } catch (err) {
    onlineStatus.textContent = `Error writing: ${err.message}`;
  } finally {
    runOnlineSyncBtn.disabled = false;
  }
}

runOnlineSyncBtn.addEventListener('click', runOnlineSync);

async function runOfflineSync() {
  runOfflineSyncBtn.disabled = true;
  offlineStatus.textContent = 'Sync in progress...';
  appendLog(`\n--- Offline Sync started ${new Date().toLocaleString()} ---\n`);
  try {
    const saveResult = await saveConfigToFile();
    if (!saveResult.ok) throw new Error(saveResult.error || 'Configuration was not saved.');
    const result = await window.api.runGenerator({
      input: inputPath.value,
      output: outputPath.value,
      config: currentConfigPath
    });
    offlineStatus.textContent = `Finished (Exit Code: ${result.code})`;
    appendLog(`Generator finished with code ${result.code}\n`);
  } catch (err) {
    offlineStatus.textContent = `Error: ${err.message}`;
    appendLog(`Error: ${err.message}\n`);
  } finally {
    runOfflineSyncBtn.disabled = false;
  }
}

runOfflineSyncBtn.addEventListener('click', runOfflineSync);

function toggleDrawer(show) {
  drawer.classList.toggle('visible', show);
}

function renderTapdanceHelp() {
  clearElement(tapdanceList);
  const list = configObj?.tapDanceOverrides || [];
  if (!list.length) {
    appendTextElement(tapdanceList, 'li', '', 'No Tap-Dance entries available.');
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
  clearElement(tapDanceTableBody);
  
  if (!configObj.tapDanceOverrides) {
    configObj.tapDanceOverrides = [];
  }
  
  configObj.tapDanceOverrides.forEach((td, idx) => {
    tapDanceTableBody.appendChild(createTapDanceRow(td, idx));
  });
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
  clearElement(comboTableBody);
  
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
  clearElement(alphaTableBody);

  const { letters, special } = categorizeKeys(configObj.alphaMappings);
  const sortedLetters = sortLettersByLayout(letters, currentLayout);

  // Render Letters category
  if (sortedLetters.length > 0) {
    alphaTableBody.appendChild(createCategoryHeader('Letters'));
    sortedLetters.forEach(([key, val]) => {
      alphaTableBody.appendChild(createKeyRow(key, val));
    });
  }

  // Render Special characters category
  if (special.length > 0) {
    alphaTableBody.appendChild(createCategoryHeader('Special Characters'));
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
  try {
    defaults = await window.api.getDefaults();
    inputPath.value = defaults.input;
    outputPath.value = defaults.output;
    configPath.value = defaults.config;
    inputPathLabel.textContent = defaults.input;
    outputPathLabel.textContent = defaults.output;
    
    // Also update offline sync paths
    if (offlineInputPath) offlineInputPath.textContent = defaults.input;
    if (offlineOutputPath) offlineOutputPath.textContent = defaults.output;
    
    currentConfigPath = defaults.config;
    await loadConfig();
  } catch (err) {
    appendLog(`Initialization error: ${err.message}\n`);
    setStatus(configStatus, `Error during initialization: ${err.message}`);
  }
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
    window.api?.setUnsavedChanges(false);
    setStatus(configStatus, 'Config loaded');
  } catch (err) {
    setStatus(configStatus, `Error loading config: ${err.message}`);
  }
}

function markAsChanged() {
  const changed = checkForChanges();
  window.api?.setUnsavedChanges(changed);
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
          errors.push(`Combo ${index + 1}: Invalid keycode "${key}" in Keys (Position ${keyIndex + 1})`);
        }
      });
    }
    
    // Validate result
    if (combo.result) {
      if (typeof isValidKeycode === 'function' && !isValidKeycode(combo.result)) {
        errors.push(`Combo ${index + 1}: Invalid keycode "${combo.result}" in Result field`);
      }
    }
  });
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

async function saveConfigToFile() {
  if (!configObj || !currentConfigPath) {
    const error = 'No configuration is loaded.';
    setStatus(configStatus, error);
    return { ok: false, error };
  }
  try {
    // Validate combos before saving
    const validation = validateCombos();
    if (!validation.valid) {
      const errorMsg = validation.errors.join('; ');
      setStatus(configStatus, `Validation error: ${errorMsg}`);
      // Still allow saving, but show warning
      if (!confirm(`Invalid keycodes found in combos:\n\n${validation.errors.join('\n')}\n\nSave anyway?`)) {
        return { ok: false, cancelled: true, error: 'Saving was cancelled after validation.' };
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
    setStatus(configStatus, validation.valid ? 'Config saved' : 'Config saved (with warnings)');
    return { ok: true };
  } catch (err) {
    setStatus(configStatus, `Error saving: ${err.message}`);
    return { ok: false, error: err.message || String(err) };
  }
}

pickInput.addEventListener('click', () => selectFolder(inputPath, inputPathLabel));
pickOutput.addEventListener('click', () => selectFolder(outputPath, outputPathLabel));
pickConfig.addEventListener('click', () => selectFile(configPath, configPathLabel));
reloadConfig.addEventListener('click', loadConfig);
saveConfig.addEventListener('click', saveConfigToFile);
saveBtn.addEventListener('click', saveConfigToFile);
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
    return saveConfigToFile();
  });
}

initDefaults();
