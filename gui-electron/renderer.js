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

function escapeHtml(s) {
  if (s == null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Same as pipette DisplayKeyboard: 1u = 4 grid cells; each cell is KLE_CELL_PX wide/tall */
const KLE_GRID_SCALE = 4;
const KLE_CELL_PX = 8;

/** KLE bounding box for stepped keys (grid placement). */
function computeSteppedKeyInfo(w, h, x2, y2, w2, h2) {
  if (x2 === 0 && y2 === 0 && w2 === w && h2 === h) return undefined;
  const left = Math.min(0, x2);
  const top = Math.min(0, y2);
  const spanW = Math.max(w, x2 + w2) - left;
  const spanH = Math.max(h, y2 + h2) - top;
  return { left, top, width: spanW, height: spanH };
}

/** Same condition as pipette KeyWidget — two physical rects for ISO / stepped keys. */
function hasSteppedGeometry(k) {
  return (
    k.width2 !== k.width ||
    k.height2 !== k.height ||
    k.x2 !== 0 ||
    k.y2 !== 0
  );
}

/**
 * SVG path for union of primary + secondary rect (pipette KeyWidget / rect-union), or ''.
 */
function buildPipetteUnionPath(kleKey) {
  const ru = typeof window !== 'undefined' ? window.kleRectUnion : null;
  if (!hasSteppedGeometry(kleKey) || !ru) return '';
  const S = KLE_GRID_SCALE * KLE_CELL_PX;
  const KEY_SIZE_RATIO = 3.2;
  const KEY_SPACING_RATIO = 0.2;
  const spacing = (S * KEY_SPACING_RATIO) / (KEY_SIZE_RATIO + KEY_SPACING_RATIO);
  const KEY_ROUNDNESS = 0.08;
  const SHADOW_SIDE_PADDING = 0.1;
  const KEY_FACE_INSET = (S * SHADOW_SIDE_PADDING) / (KEY_SIZE_RATIO + KEY_SPACING_RATIO);

  const gx = S * kleKey.x;
  const gy = S * kleKey.y;
  const gw = S * kleKey.width - spacing;
  const gh = S * kleKey.height - spacing;
  const gx2 = gx + S * kleKey.x2;
  const gy2 = gy + S * kleKey.y2;
  const gw2 = S * kleKey.width2 - spacing;
  const gh2 = S * kleKey.height2 - spacing;
  const corner = S * KEY_ROUNDNESS;

  return ru.computeUnionPath(gx, gy, gw, gh, gx2, gy2, gw2, gh2, corner, KEY_FACE_INSET);
}

function steppedUnionViewBox(kleKey) {
  const S = KLE_GRID_SCALE * KLE_CELL_PX;
  const KEY_SIZE_RATIO = 3.2;
  const KEY_SPACING_RATIO = 0.2;
  const spacing = (S * KEY_SPACING_RATIO) / (KEY_SIZE_RATIO + KEY_SPACING_RATIO);
  const gx = S * kleKey.x;
  const gy = S * kleKey.y;
  const gw = S * kleKey.width - spacing;
  const gh = S * kleKey.height - spacing;
  const gx2 = gx + S * kleKey.x2;
  const gy2 = gy + S * kleKey.y2;
  const gw2 = S * kleKey.width2 - spacing;
  const gh2 = S * kleKey.height2 - spacing;
  const minPx = Math.min(gx, gx2);
  const minPy = Math.min(gy, gy2);
  const maxPx = Math.max(gx + gw, gx2 + gw2);
  const maxPy = Math.max(gy + gh, gy2 + gh2);
  return { minPx, minPy, w: maxPx - minPx, h: maxPy - minPy };
}

/**
 * QMK/Vial: transparent can be -1, numeric 0x01 (1), or KC_TRNS / aliases.
 * KC_NO must stay distinct (empty keycap).
 */
function isTransparentKeycode(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'number') {
    if (v === -1) return true;
    if (v === 1) return true; // QMK basic KC_TRNS
    return false;
  }
  if (typeof v !== 'string') return false;
  const s = v.trim();
  if (!s) return false;
  const u = s.toUpperCase();
  if (u === 'KC_NO' || u === 'NO') return false;
  if (
    u === 'KC_TRNS' ||
    u === 'KC_TRANSPARENT' ||
    u === 'TRNS' ||
    u === 'TRANSPARENT' ||
    u === '_______' ||
    u === 'XXXXXXX'
  ) {
    return true;
  }
  return false;
}

/**
 * Bit-packed layout options from the connected keyboard (HID) are authoritative for which KLE
 * variant (split space, thumbs, etc.) is active. Vitaly save JSON may be stale or use -1 — prefer HID.
 */
function resolvePackedLayoutOptions(deviceState, hidPacked) {
  if (typeof hidPacked === 'number' && hidPacked >= 0) return hidPacked >>> 0;
  const raw =
    deviceState &&
    (typeof deviceState.layout_options === 'number'
      ? deviceState.layout_options
      : typeof deviceState.layoutOptions === 'number'
        ? deviceState.layoutOptions
        : NaN);
  if (Number.isFinite(raw) && raw >= 0) return raw >>> 0;
  return 0;
}

function countKleNonDecalKeys(keys) {
  const hasMatrixPos = (key) => {
    const l0 = key.labels && key.labels[0];
    return l0 != null && String(l0).includes(',');
  };
  return keys.filter((key) => !key.decal || hasMatrixPos(key)).length;
}

/**
 * Single matrix cell: Vial JSON uses -1 for transparent; undefined = TRNS.
 */
function getMatrixCell(row, col) {
  if (!row) return 'KC_TRNS';
  const v = row[col];
  if (v === undefined) return 'KC_TRNS';
  if (v === null || v === -1 || v === '-1') return 'KC_TRNS';
  if (isTransparentKeycode(v)) return 'KC_TRNS';
  return v;
}

function getKeycodeAt(state, layerIdx, row, col) {
  const layer = state && state.layout && state.layout[layerIdx];
  if (!layer) return null;
  if (!layer[row]) return null;
  return getMatrixCell(layer[row], col);
}

async function refreshDevices() {
  deviceList.innerHTML = '<div class="empty-state">Searching for keyboards...</div>';
  onlineSyncPanel.classList.add('hidden');
  layoutVisualization.classList.add('hidden');
  selectedDevice = null;
  keyboardLayoutGeometry = null;

  try {
    const devices = await window.api.listDevices();
    
    if (!devices || devices.length === 0) {
      deviceList.innerHTML = '<div class="empty-state">No Vial keyboards found.</div>';
      return;
    }
    
    // Sort devices alphabetically by product_name
    devices.sort((a, b) => {
      const nameA = (a.product_name || 'Unknown Keyboard').toLowerCase();
      const nameB = (b.product_name || 'Unknown Keyboard').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    
    deviceList.innerHTML = '';
    devices.forEach(dev => {
      const card = document.createElement('div');
      card.className = 'device-card';
      const id = `${dev.vendor_id}:${dev.product_id}`;
      card.innerHTML = `
        <div class="device-name">${dev.product_name || 'Unknown Keyboard'}</div>
        <div class="device-meta">ID: ${id} | SN: ${dev.serial_number || 'N/A'}</div>
      `;
      card.addEventListener('click', () => selectDevice(dev, card));
      deviceList.appendChild(card);
    });
  } catch (err) {
    deviceList.innerHTML = `<div class="empty-state">Error during search: ${err.message}</div>`;
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
  deviceCapabilities.innerHTML = `
    <span class="cap-tag supported">Keys (${device.layers || 0} Layers)</span>
    <span class="cap-tag ${device.has_combos ? 'supported' : ''}">Combos</span>
    <span class="cap-tag ${device.has_tap_dance ? 'supported' : ''}">TapDance</span>
  `;
  
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
    currentDeviceState = await window.api.saveDeviceState(selectedDevice.id);

    let layoutInfo = '';
    try {
      if (window.api && typeof window.api.getDeviceLayout === 'function') {
        const raw = await window.api.getDeviceLayout(selectedDevice.id);
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
      const labels = defRes.definition.layouts.labels || [];
      const packed = resolvePackedLayoutOptions(currentDeviceState, defRes.layoutOptionsPacked);
      const decodedLayoutOptions = decodeLayoutOptions(packed, labels);
      const rawKleKeys = parseKle(defRes.definition.layouts.keymap).keys;
      // Empty decode + empty Map skips filtering and shows every layoutOption at once (exploded).
      let layoutOptionsMap =
        decodedLayoutOptions.size > 0 ? decodedLayoutOptions : buildLayoutOptionsDefaultMap(rawKleKeys);
      let kleKeys = repositionLayoutKeys(rawKleKeys, layoutOptionsMap);
      kleKeys = filterVisibleKeys(kleKeys, layoutOptionsMap);
      let effectiveLayoutOptions = layoutOptionsMap;
      const rawNd = countKleNonDecalKeys(rawKleKeys);
      const visNd = countKleNonDecalKeys(kleKeys);
      let kleLayoutRelaxed = false;
      // Only override when we could not decode any bits from labels (stale JSON, missing labels).
      // If HID gave a valid decode, do not reset to option 0 — that can hide thumb/space variants.
      if (
        decodedLayoutOptions.size === 0 &&
        rawNd >= 16 &&
        visNd < Math.max(12, rawNd * 0.42)
      ) {
        const fallbackMap = buildLayoutOptionsDefaultMap(rawKleKeys);
        kleKeys = repositionLayoutKeys(rawKleKeys, fallbackMap);
        kleKeys = filterVisibleKeys(kleKeys, fallbackMap);
        effectiveLayoutOptions = fallbackMap;
        kleLayoutRelaxed = true;
      }
      const summary =
        formatLayoutOptionsSummary(labels, decodedLayoutOptions.size ? decodedLayoutOptions : layoutOptionsMap) ||
        (decodedLayoutOptions.size === 0 && Number.isFinite(packed) ? `raw ${packed}` : '');
      keyboardLayoutGeometry = { keys: kleKeys, labels, layoutOptionsMap: effectiveLayoutOptions, summary };
      deviceCapabilities.innerHTML += `
        <div class="layout-options-info">
          <span class="label">Layout options (saved on keyboard):</span>
          <span class="value">${escapeHtml(summary || 'Default')}</span>
        </div>
        ${
          kleLayoutRelaxed
            ? `<div class="layout-options-info subtle"><span class="label">KLE:</span> <span class="value">Using layout option 0 for each layout group (fallback — saved layout_options may not have matched this definition).</span></div>`
            : ''
        }
      `;
    } else if (defRes && defRes.error) {
      deviceCapabilities.innerHTML += `
        <div class="layout-options-info warn">
          <span class="label">KLE geometry:</span>
          <span class="value">${escapeHtml(defRes.error)} — using matrix view.</span>
        </div>
      `;
    }

    if (layoutInfo) {
      deviceCapabilities.innerHTML += `
        <div class="layout-options-info subtle">
          <span class="label">vitaly layout:</span>
          <span class="value">${escapeHtml(layoutInfo)}</span>
        </div>
      `;
    }

    renderKeyboardLayout(currentDeviceState, layoutGrid);
    layoutVisualization.classList.remove('hidden');
    onlineStatus.textContent = 'Ready for sync.';
  } catch (err) {
    onlineStatus.textContent = `Error loading layout: ${err.message}`;
  }
}

function renderKeyboardLayout(state, targetEl, layerIdx = 0, targetState = null) {
  const layerExists = (state && state.layout && state.layout[layerIdx]) || (targetState && targetState.layout && targetState.layout[layerIdx]);
  if (!layerExists) {
    targetEl.innerHTML = '<div class="empty-state">No layout data for this layer.</div>';
    return;
  }
  if (keyboardLayoutGeometry && keyboardLayoutGeometry.keys && keyboardLayoutGeometry.keys.length) {
    renderKleKeyboardLayout(state, targetEl, layerIdx, targetState, keyboardLayoutGeometry);
    return;
  }
  renderMatrixFallbackLayout(state, targetEl, layerIdx, targetState);
}

function renderKleKeyboardLayout(state, targetEl, layerIdx, targetState, geom) {
  targetEl.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'keyboard-layout-container kle-keyboard-wrap';

  const grid = document.createElement('div');
  grid.className = 'kle-inline-grid';

  let maxCol = 0;
  let maxRow = 0;
  const placements = [];

  for (const kleKey of geom.keys) {
    if (kleKey.encoderIdx >= 0) {
      const col = Math.round(kleKey.x * KLE_GRID_SCALE);
      const row = Math.round(kleKey.y * KLE_GRID_SCALE);
      const colSpan = Math.max(1, Math.round(kleKey.width * KLE_GRID_SCALE));
      const rowSpan = Math.max(1, Math.round(kleKey.height * KLE_GRID_SCALE));
      maxCol = Math.max(maxCol, col + colSpan);
      maxRow = Math.max(maxRow, row + rowSpan);
      placements.push({ kleKey, row, col, rowSpan, colSpan, encoder: true });
      continue;
    }
    const stepped = computeSteppedKeyInfo(
      kleKey.width,
      kleKey.height,
      kleKey.x2,
      kleKey.y2,
      kleKey.width2,
      kleKey.height2,
    );
    const originX = kleKey.x + (stepped ? stepped.left : 0);
    const originY = kleKey.y + (stepped ? stepped.top : 0);
    const spanW = stepped ? stepped.width : kleKey.width;
    const spanH = stepped ? stepped.height : kleKey.height;
    const col = Math.round(originX * KLE_GRID_SCALE);
    const row = Math.round(originY * KLE_GRID_SCALE);
    const colSpan = Math.max(1, Math.round(spanW * KLE_GRID_SCALE));
    const rowSpan = Math.max(1, Math.round(spanH * KLE_GRID_SCALE));
    maxCol = Math.max(maxCol, col + colSpan);
    maxRow = Math.max(maxRow, row + rowSpan);
    placements.push({ kleKey, row, col, rowSpan, colSpan, encoder: false });
  }

  if (!placements.length || maxCol < 1 || maxRow < 1) {
    targetEl.innerHTML = '<div class="empty-state">No KLE geometry to display.</div>';
    return;
  }

  // Fixed pixel tracks (pipette: repeat(totalCols, 8px)) — avoids stretched/distorted keys from 1fr
  grid.style.gridTemplateColumns = `repeat(${maxCol}, ${KLE_CELL_PX}px)`;
  grid.style.gridTemplateRows = `repeat(${maxRow}, ${KLE_CELL_PX}px)`;

  for (const p of placements) {
    const keyEl = document.createElement('div');
    keyEl.style.gridColumn = `${p.col + 1} / span ${p.colSpan}`;
    keyEl.style.gridRow = `${p.row + 1} / span ${p.rowSpan}`;

    if (p.encoder) {
      keyEl.className = 'layout-key kle-key encoder-key';
      keyEl.textContent = '⟳';
      keyEl.title = 'Encoder';
      grid.appendChild(keyEl);
      continue;
    }

    const unionPath = buildPipetteUnionPath(p.kleKey);
    let face = keyEl;
    if (unionPath) {
      keyEl.className = 'kle-key-slot kle-stepped';
      const vb = steppedUnionViewBox(p.kleKey);
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', `${vb.minPx} ${vb.minPy} ${vb.w} ${vb.h}`);
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.classList.add('kle-key-svg');
      const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pathEl.setAttribute('d', unionPath);
      pathEl.classList.add('kle-key-path');
      svg.appendChild(pathEl);
      keyEl.appendChild(svg);
      face = document.createElement('div');
      face.className = 'kle-key-face-overlay';
      keyEl.appendChild(face);
    } else {
      keyEl.className = 'layout-key kle-key';
    }

    const r = p.kleKey.row;
    const col = p.kleKey.col;
    const currentKey = getKeycodeAt(state, layerIdx, r, col);
    const targetKey = targetState ? getKeycodeAt(targetState, layerIdx, r, col) : null;
    // Preview: show what is stored on the device now; target only drives diff highlighting
    const displayKey =
      currentKey !== null && currentKey !== undefined ? currentKey : targetKey;
    const isChanged =
      currentKey !== null &&
      currentKey !== undefined &&
      targetKey !== null &&
      targetKey !== undefined &&
      currentKey !== targetKey;
    const isNew =
      (currentKey === null || currentKey === undefined) &&
      targetKey !== null &&
      targetKey !== undefined;

    if (isChanged || isNew) {
      keyEl.classList.add('changed');
    }

    if (displayKey === null || displayKey === undefined || displayKey === 'KC_NO') {
      face.classList.add('empty');
      face.textContent = '';
      face.title = displayKey === 'KC_NO' ? 'KC_NO' : '';
      if (isChanged || isNew) {
        const curL = currentKey && currentKey !== 'KC_NO' ? keycodeToChar(String(currentKey)) : '—';
        const tgtL = targetKey && targetKey !== 'KC_NO' ? keycodeToChar(String(targetKey)) : '—';
        face.innerHTML = `<span class="old-label">${curL}</span><span class="arrow">→</span><span class="new-label">${tgtL}</span>`;
        face.title = `Original: ${currentKey ?? '—'}\nNew: ${targetKey ?? '—'}`;
        face.classList.remove('empty');
      }
    } else if (isTransparentKeycode(displayKey)) {
      face.classList.add('transparent-key');
      face.textContent = '▼';
      face.title = 'Transparent';
      if (isChanged || isNew) {
        const curL = currentKey && !isTransparentKeycode(currentKey) ? keycodeToChar(String(currentKey)) : '▼';
        const tgtL = targetKey && !isTransparentKeycode(targetKey) ? keycodeToChar(String(targetKey)) : '▼';
        face.innerHTML = `<span class="old-label">${curL}</span><span class="arrow">→</span><span class="new-label">${tgtL}</span>`;
        face.title = `Original: ${currentKey ?? '—'}\nNew: ${targetKey ?? '—'}`;
      }
    } else {
      const label = keycodeToChar(displayKey);
      face.textContent = label;
      face.title = String(displayKey);

      if (isChanged || isNew) {
        const currentLabel = currentKey ? keycodeToChar(currentKey) : 'Empty';
        const targetLabel = keycodeToChar(targetKey);
        face.title = `Original: ${currentKey || 'Empty'}\nNew: ${targetKey}`;
        face.innerHTML = `<span class="old-label">${currentLabel}</span><span class="arrow">→</span><span class="new-label">${targetLabel}</span>`;
      }
    }
    grid.appendChild(keyEl);
  }

  wrap.appendChild(grid);
  targetEl.appendChild(wrap);
}

function renderMatrixFallbackLayout(state, targetEl, layerIdx = 0, targetState = null) {
  const baseState = targetState && targetState.layout && targetState.layout[layerIdx] ? targetState : state;
  if (!baseState || !baseState.layout || !baseState.layout[layerIdx]) {
    targetEl.innerHTML = '<div class="empty-state">No layout data for this layer.</div>';
    return;
  }
  targetEl.innerHTML = '';

  const layer = baseState.layout[layerIdx];

  const layoutContainer = document.createElement('div');
  layoutContainer.className = 'keyboard-layout-container';

  const numRows = layer.length;
  const numCols = Math.max(...layer.map((r) => r.length));

  for (let rIdx = 0; rIdx < numRows; rIdx++) {
    const rowEl = document.createElement('div');
    rowEl.className = `layout-row row-${rIdx}`;

    if (numRows >= 4) {
      if (rIdx === 1) rowEl.classList.add('stagger-0-25');
      if (rIdx === 2) rowEl.classList.add('stagger-0-5');
      if (rIdx === 3) rowEl.classList.add('stagger-0-75');
    }

    for (let cIdx = 0; cIdx < numCols; cIdx++) {
      const currentKey = getKeycodeAt(state, layerIdx, rIdx, cIdx);
      const targetKey = targetState ? getKeycodeAt(targetState, layerIdx, rIdx, cIdx) : null;

      const displayKey =
        currentKey !== null && currentKey !== undefined ? currentKey : targetKey;
      const isChanged =
        currentKey !== null &&
        currentKey !== undefined &&
        targetKey !== null &&
        targetKey !== undefined &&
        currentKey !== targetKey;
      const isNew =
        (currentKey === null || currentKey === undefined) &&
        targetKey !== null &&
        targetKey !== undefined;

      const keyEl = document.createElement('div');
      keyEl.className = 'layout-key';

      if (displayKey === null || displayKey === undefined || displayKey === 'KC_NO') {
        keyEl.classList.add('empty');
        keyEl.textContent = '';
        if (isChanged || isNew) {
          keyEl.classList.add('changed');
          const curL = currentKey && currentKey !== 'KC_NO' ? keycodeToChar(String(currentKey)) : '—';
          const tgtL = targetKey && targetKey !== 'KC_NO' ? keycodeToChar(String(targetKey)) : '—';
          keyEl.innerHTML = `<span class="old-label">${curL}</span><span class="arrow">→</span><span class="new-label">${tgtL}</span>`;
          keyEl.title = `Original: ${currentKey ?? '—'}\nNew: ${targetKey ?? '—'}`;
          keyEl.classList.remove('empty');
        }
      } else if (isTransparentKeycode(displayKey)) {
        keyEl.classList.add('transparent-key');
        keyEl.textContent = '▼';
        keyEl.title = 'Transparent';
        if (isChanged || isNew) {
          keyEl.classList.add('changed');
          const curL = currentKey && !isTransparentKeycode(currentKey) ? keycodeToChar(String(currentKey)) : '▼';
          const tgtL = targetKey && !isTransparentKeycode(targetKey) ? keycodeToChar(String(targetKey)) : '▼';
          keyEl.innerHTML = `<span class="old-label">${curL}</span><span class="arrow">→</span><span class="new-label">${tgtL}</span>`;
        }
      } else {
        const label = keycodeToChar(displayKey);
        keyEl.textContent = label;
        keyEl.title = displayKey;

        if (isChanged || isNew) {
          keyEl.classList.add('changed');
          const currentLabel = currentKey ? keycodeToChar(currentKey) : 'Empty';
          const targetLabel = keycodeToChar(targetKey);
          keyEl.title = `Original: ${currentKey || 'Empty'}\nNew: ${targetKey}`;
          keyEl.innerHTML = `<span class="old-label">${currentLabel}</span><span class="arrow">→</span><span class="new-label">${targetLabel}</span>`;
        }

        const upperLabel = label.toUpperCase();
        if (upperLabel === 'ENTER' || upperLabel === 'SHIFT' || upperLabel === 'LSHIFT' || upperLabel === 'RSHIFT') {
          keyEl.classList.add('key-1-75u');
        } else if (upperLabel === 'SPACE' || displayKey === 'KC_SPC') {
          keyEl.classList.add('key-2u');
        } else if (
          upperLabel === 'TAB' ||
          upperLabel === 'CTRL' ||
          upperLabel === 'LCTRL' ||
          upperLabel === 'RCTRL' ||
          upperLabel === 'ALT' ||
          upperLabel === 'LALT'
        ) {
          keyEl.classList.add('key-1-25u');
        } else if (upperLabel === 'BKSP' || upperLabel === 'BACKSPACE') {
          keyEl.classList.add('key-2u');
        } else if (upperLabel === 'CAPS' || upperLabel === 'CAPS LOCK') {
          keyEl.classList.add('key-1-75u');
        }

        const rawKey = String(displayKey);
        if (rawKey.startsWith('LT(') || rawKey.startsWith('MT(') || (rawKey.startsWith('L') && rawKey.includes('+'))) {
          if (rawKey.includes('TAB') || rawKey.includes('SPC') || rawKey.includes('SPACE') || rawKey.includes('ENT')) {
            keyEl.classList.add('key-1-5u');
          }
        }
      }
      rowEl.appendChild(keyEl);
    }
    layoutContainer.appendChild(rowEl);
  }
  targetEl.appendChild(layoutContainer);
}

async function previewOnlineSync() {
  if (!selectedDevice) return;
  
  previewOnlineSyncBtn.disabled = true;
  onlineStatus.textContent = 'Reading keyboard configuration...';
  syncPreview.classList.add('hidden');
  previewLayouts.innerHTML = '';
  
  try {
    // 1. Read current state
    currentDeviceState = await window.api.saveDeviceState(selectedDevice.id);
    
    // 2. Clone and process to get target state
    const docToProcess = JSON.parse(JSON.stringify(currentDeviceState));
    targetDeviceState = await window.api.processConfig(docToProcess, configObj);
    
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
        layerSection.innerHTML = `<h4>Layer ${idx}</h4>`;
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
    tapdance: []
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
  
  return diffs;
}

function renderDiff(diff) {
  previewDiff.innerHTML = '';

  if (diff.keys.length === 0 && diff.combos.length === 0 && diff.tapdance.length === 0) {
    previewDiff.innerHTML = '<div class="no-changes">No changes required. Keyboard is already up to date.</div>';
    return;
  }

  const panel = document.createElement('div');
  panel.className = 'diff-panel';

  const details = document.createElement('details');
  details.className = 'diff-details';
  const summary = document.createElement('summary');
  summary.className = 'diff-summary-sticky';
  summary.textContent = `Detailed list (${diff.keys.length + diff.combos.length + diff.tapdance.length} changes) — click to expand/collapse`;
  details.appendChild(summary);

  const content = document.createElement('div');
  content.className = 'diff-content diff-content-scroll';

  let html = '';

  if (diff.keys.length > 0) {
    html += `<strong>Keys (${diff.keys.length} changes):</strong>\n`;
    diff.keys.forEach((d) => {
      html += `<span class="diff-loc">${d.loc}:</span> <span class="diff-old">${keycodeToChar(d.from)}</span> -> <span class="diff-new">${keycodeToChar(d.to)}</span>\n`;
    });
    html += '\n';
  }

  if (diff.combos.length > 0) {
    html += `<strong>Combos (${diff.combos.length} changes):</strong>\n`;
    diff.combos.forEach((d) => {
      html += `<span class="diff-loc">Slot ${d.idx}:</span> <span class="diff-old">${d.from}</span> -> <span class="diff-new">${d.to}</span>\n`;
    });
    html += '\n';
  }

  if (diff.tapdance.length > 0) {
    html += `<strong>TapDance (${diff.tapdance.length} changes):</strong>\n`;
    diff.tapdance.forEach((d) => {
      html += `<span class="diff-loc">Slot ${d.idx}:</span> <span class="diff-old">${d.from}</span> -> <span class="diff-new">${d.to}</span>\n`;
    });
  }

  content.innerHTML = `<pre>${html}</pre>`;
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
      await window.api.saveAlpha(filePath, JSON.stringify(currentDeviceState, null, 2));
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
    // Re-read firmware so macros/settings/combos match the device right before load (avoids stale preview state).
    currentDeviceState = await window.api.saveDeviceState(selectedDevice.id);

    // 1. Prepare data based on options
    const finalDoc = JSON.parse(JSON.stringify(currentDeviceState));
    
    if (document.getElementById('syncBaseKeys').checked) {
      finalDoc.layout = targetDeviceState.layout;
    }
    if (document.getElementById('syncCombos').checked) {
      finalDoc.combo = targetDeviceState.combo;
    }
    if (document.getElementById('syncTapDance').checked) {
      finalDoc.tap_dance = targetDeviceState.tap_dance;
    }
    
    // 2. Apply
    await window.api.applyDeviceState(selectedDevice.id, 'load', finalDoc);
    
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
    await saveConfigToFile();
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
  try {
    // Validate combos before saving
    const validation = validateCombos();
    if (!validation.valid) {
      const errorMsg = validation.errors.join('; ');
      setStatus(configStatus, `Validation error: ${errorMsg}`);
      // Still allow saving, but show warning
      if (!confirm(`Invalid keycodes found in combos:\n\n${validation.errors.join('\n')}\n\nSave anyway?`)) {
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
    setStatus(configStatus, validation.valid ? 'Config saved' : 'Config saved (with warnings)');
  } catch (err) {
    setStatus(configStatus, `Error saving: ${err.message}`);
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
    await saveConfigToFile();
  });
}

initDefaults();

