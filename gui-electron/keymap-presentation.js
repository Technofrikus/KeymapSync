/**
 * Keymap State presentation module.
 * It owns layout preparation and visual rendering; the renderer only orchestrates UI.
 */
(function (global) {
/** Same as pipette DisplayKeyboard: 1u = 4 grid cells; each cell is KLE_CELL_PX wide/tall */
const KLE_GRID_SCALE = 4;
const KLE_CELL_PX = 8 * 1.4;

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
 * Resolve packed layout options (VIA/Vial bitfield) used for KLE variant selection.
 * Prefer `vitaly save` JSON when valid, and fall back to HID-read options.
 */
function resolvePackedLayoutOptions(deviceState, hidPacked) {
  const raw =
    deviceState &&
    (typeof deviceState.layout_options === 'number'
      ? deviceState.layout_options
      : typeof deviceState.layoutOptions === 'number'
        ? deviceState.layoutOptions
        : NaN);
  // In practice, some boards report 0 via VIA_LAYOUT_OPTIONS even when a non-default
  // layout is active. Prefer the value from `vitaly save` when it is present and valid.
  if (Number.isFinite(raw) && raw >= 0) return raw >>> 0;
  if (typeof hidPacked === 'number' && hidPacked >= 0) return hidPacked >>> 0;
  return 0;
}

function countKleNonDecalKeys(keys) {
  const hasMatrixPos = (key) => {
    const l0 = key.labels && key.labels[0];
    return l0 != null && String(l0).includes(',');
  };
  return keys.filter((key) => !key.decal || hasMatrixPos(key)).length;
}

function deriveActiveKleGeometry(definition, packedLayoutOptions) {
  if (!definition || !definition.layouts || !definition.layouts.keymap) {
    return null;
  }
  const labels = definition.layouts.labels || [];
  const rawKleKeys = parseKle(definition.layouts.keymap).keys;
  const decodedLayoutOptions = decodeLayoutOptions(packedLayoutOptions, labels);
  const layoutOptionsMap =
    decodedLayoutOptions.size > 0 ? decodedLayoutOptions : buildLayoutOptionsDefaultMap(rawKleKeys);

  let visibleKeys = repositionLayoutKeys(rawKleKeys, layoutOptionsMap);
  visibleKeys = filterVisibleKeys(visibleKeys, layoutOptionsMap);

  let effectiveLayoutOptions = layoutOptionsMap;
  const rawNd = countKleNonDecalKeys(rawKleKeys);
  const visNd = countKleNonDecalKeys(visibleKeys);
  let fallbackApplied = false;
  const minVisibleThreshold = Math.max(12, rawNd * 0.42);
  if (
    decodedLayoutOptions.size === 0 &&
    rawNd >= 16 &&
    visNd < minVisibleThreshold
  ) {
    console.warn(`[KLE] Layout looks broken (visible=${visNd}, total=${rawNd}). Falling back to layout option 0 per group.`);
    effectiveLayoutOptions = buildLayoutOptionsDefaultMap(rawKleKeys);
    visibleKeys = repositionLayoutKeys(rawKleKeys, effectiveLayoutOptions);
    visibleKeys = filterVisibleKeys(visibleKeys, effectiveLayoutOptions);
    fallbackApplied = true;
  }

  const summary =
    formatLayoutOptionsSummary(labels, decodedLayoutOptions.size ? decodedLayoutOptions : effectiveLayoutOptions) ||
    (decodedLayoutOptions.size === 0 && Number.isFinite(packedLayoutOptions) ? `raw ${packedLayoutOptions}` : '');

  return {
    keys: visibleKeys,
    labels,
    decodedLayoutOptions,
    layoutOptionsMap: effectiveLayoutOptions,
    packedLayoutOptions,
    summary,
    fallbackApplied,
  };
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

function formatLayoutOptionsDebug(labels, packed, decodedMap, effectiveMap) {
  const mapToString = (m) => {
    if (!m || m.size === 0) return '[]';
    return `[${Array.from(m.entries()).map(([k, v]) => `${k}:${v}`).join(', ')}]`;
  };
  const picked = [];
  if (labels && labels.length && effectiveMap && effectiveMap.size) {
    for (let i = 0; i < labels.length; i++) {
      const sel = effectiveMap.get(i);
      if (sel === undefined) continue;
      const label = labels[i];
      if (typeof label === 'string') {
        picked.push(`${label}=${sel ? 'On' : 'Off'}`);
      } else if (Array.isArray(label)) {
        const title = label[0] || `opt${i}`;
        const choice = label[sel + 1] != null ? label[sel + 1] : `#${sel}`;
        picked.push(`${title}=${choice}(${sel})`);
      }
    }
  }
  return `packed=${packed} decoded=${mapToString(decodedMap)} effective=${mapToString(effectiveMap)} labels=${picked.join(' | ') || '-'}`;
}

function renderKeyboardLayout({
  state,
  target: targetEl,
  layer: layerIdx = 0,
  targetState = null,
  geometry = null,
  keycodeToLabel: keycodeToChar = String,
}) {
  const layerExists = (state && state.layout && state.layout[layerIdx]) || (targetState && targetState.layout && targetState.layout[layerIdx]);
  if (!layerExists) {
    renderEmptyState(targetEl, 'No layout data for this layer.');
    return;
  }
  if (geometry && geometry.keys && geometry.keys.length) {
    renderKleKeyboardLayout(state, targetEl, layerIdx, targetState, geometry, keycodeToChar);
    return;
  }
  renderMatrixFallbackLayout(state, targetEl, layerIdx, targetState, keycodeToChar);
}

function clearNode(node) {
  node.replaceChildren();
}

function renderEmptyState(targetEl, message) {
  clearNode(targetEl);
  const emptyState = document.createElement('div');
  emptyState.className = 'empty-state';
  emptyState.textContent = message;
  targetEl.appendChild(emptyState);
}

function rotatePoint(x, y, cx, cy, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  return {
    x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

function keyCornersPx(kleKey, scalePx, spacingPx) {
  const corners = [];
  const addRect = (x, y, w, h) => {
    corners.push([x, y], [x + w, y], [x + w, y + h], [x, y + h]);
  };
  const x = scalePx * kleKey.x;
  const y = scalePx * kleKey.y;
  const w = scalePx * kleKey.width - spacingPx;
  const h = scalePx * kleKey.height - spacingPx;
  addRect(x, y, w, h);

  if (hasSteppedGeometry(kleKey)) {
    const x2 = x + scalePx * kleKey.x2;
    const y2 = y + scalePx * kleKey.y2;
    const w2 = scalePx * kleKey.width2 - spacingPx;
    const h2 = scalePx * kleKey.height2 - spacingPx;
    addRect(x2, y2, w2, h2);
  }

  if (!kleKey.rotation) return corners;
  const cx = scalePx * kleKey.rotationX;
  const cy = scalePx * kleKey.rotationY;
  return corners.map(([px, py]) => {
    const r = rotatePoint(px, py, cx, cy, kleKey.rotation);
    return [r.x, r.y];
  });
}

function computeKleSvgBounds(keys) {
  if (!keys || keys.length === 0) {
    return { width: 10, height: 10, originX: -5, originY: -5 };
  }
  const scalePx = KLE_GRID_SCALE * KLE_CELL_PX;
  const spacingPx = (scalePx * 0.2) / (3.2 + 0.2);
  const padding = 5;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const key of keys) {
    for (const [cx, cy] of keyCornersPx(key, scalePx, spacingPx)) {
      if (cx < minX) minX = cx;
      if (cy < minY) minY = cy;
      if (cx > maxX) maxX = cx;
      if (cy > maxY) maxY = cy;
    }
  }

  return {
    width: Math.max(10, maxX - minX + padding * 2),
    height: Math.max(10, maxY - minY + padding * 2),
    originX: minX - padding,
    originY: minY - padding,
  };
}

function setSvgText(node, value) {
  while (node.firstChild) node.removeChild(node.firstChild);
  node.appendChild(document.createTextNode(value));
}

function setSvgDiffText(node, fromLabel, toLabel) {
  while (node.firstChild) node.removeChild(node.firstChild);
  const mk = (txt, cls) => {
    const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
    tspan.setAttribute('class', cls);
    tspan.textContent = txt;
    return tspan;
  };
  node.appendChild(mk(fromLabel, 'old-label'));
  node.appendChild(mk(' → ', 'arrow'));
  node.appendChild(mk(toLabel, 'new-label'));
}

function setHtmlDiffText(node, fromLabel, toLabel) {
  clearNode(node);
  const makeSpan = (text, className) => {
    const span = document.createElement('span');
    span.className = className;
    span.textContent = text;
    return span;
  };
  node.appendChild(makeSpan(fromLabel, 'old-label'));
  node.appendChild(makeSpan('→', 'arrow'));
  node.appendChild(makeSpan(toLabel, 'new-label'));
}

function wrapLabelLines(rawText) {
  const text = String(rawText || '').trim();
  if (!text) return [''];
  if (text.includes('\n')) {
    return text.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 2);
  }
  if (text.length <= 7) return [text];
  const sep = text.search(/[_\-\s]/);
  if (sep > 1 && sep < text.length - 2) {
    return [text.slice(0, sep), text.slice(sep + 1)].slice(0, 2);
  }
  const cut = Math.ceil(text.length / 2);
  return [text.slice(0, cut), text.slice(cut)];
}

function setSvgWrappedText(node, text, widthPx) {
  while (node.firstChild) node.removeChild(node.firstChild);
  const lines = wrapLabelLines(text).slice(0, 2);
  const maxLen = Math.max(...lines.map((x) => x.length), 0);

  // Keep text readable, but shrink slightly for long labels.
  let fontSize = 11;
  if (maxLen >= 10) fontSize = 10;
  if (maxLen >= 14) fontSize = 9;
  if (widthPx < 40) fontSize = Math.max(8, fontSize - 1);
  node.style.fontSize = `${fontSize}px`;

  if (lines.length === 1) {
    node.appendChild(document.createTextNode(lines[0]));
    return;
  }
  const first = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
  first.setAttribute('x', node.getAttribute('x') || '0');
  first.setAttribute('dy', '-0.48em');
  first.textContent = lines[0];
  node.appendChild(first);

  const second = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
  second.setAttribute('x', node.getAttribute('x') || '0');
  second.setAttribute('dy', '1.05em');
  second.textContent = lines[1];
  node.appendChild(second);
}

function renderKleKeyboardLayout(state, targetEl, layerIdx, targetState, geom, keycodeToChar) {
  clearNode(targetEl);
  const wrap = document.createElement('div');
  wrap.className = 'keyboard-layout-container kle-keyboard-wrap';

  const keys = geom && Array.isArray(geom.keys) ? geom.keys : [];
  if (!keys.length) {
    renderEmptyState(targetEl, 'No KLE geometry to display.');
    return;
  }

  const bounds = computeKleSvgBounds(keys);
  const board = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  board.classList.add('kle-board-svg');
  board.setAttribute('width', String(bounds.width));
  board.setAttribute('height', String(bounds.height));
  board.setAttribute('viewBox', `${bounds.originX} ${bounds.originY} ${bounds.width} ${bounds.height}`);

  const scalePx = KLE_GRID_SCALE * KLE_CELL_PX;
  const spacingPx = (scalePx * 0.2) / (3.2 + 0.2);
  const faceInset = (scalePx * 0.1) / (3.2 + 0.2);
  const corner = scalePx * 0.08;

  for (const kleKey of keys) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    if (kleKey.rotation) {
      const rotX = scalePx * kleKey.rotationX;
      const rotY = scalePx * kleKey.rotationY;
      group.setAttribute('transform', `translate(${rotX}, ${rotY}) rotate(${kleKey.rotation}) translate(${-rotX}, ${-rotY})`);
    }

    const x = scalePx * kleKey.x;
    const y = scalePx * kleKey.y;
    const w = scalePx * kleKey.width - spacingPx;
    const h = scalePx * kleKey.height - spacingPx;

    if (kleKey.encoderIdx >= 0) {
      const face = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      face.setAttribute('x', String(x + faceInset));
      face.setAttribute('y', String(y + faceInset));
      face.setAttribute('width', String(Math.max(1, w - 2 * faceInset)));
      face.setAttribute('height', String(Math.max(1, h - 2 * faceInset)));
      face.setAttribute('rx', String(corner));
      face.setAttribute('ry', String(corner));
      face.setAttribute('class', 'kle-key-path');
      group.appendChild(face);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', String(x + w / 2));
      label.setAttribute('y', String(y + h / 2));
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('dominant-baseline', 'central');
      label.setAttribute('class', 'kle-key-text');
      label.textContent = '⟳';
      group.appendChild(label);
      board.appendChild(group);
      continue;
    }

    const unionPath = buildPipetteUnionPath(kleKey);
    let labelX = x + w / 2;
    let labelY = y + h / 2;
    let keyBgNode = null;
    if (unionPath) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', unionPath);
      path.setAttribute('class', 'kle-key-path');
      group.appendChild(path);
      keyBgNode = path;

      const vb = steppedUnionViewBox(kleKey);
      labelX = vb.minPx + vb.w / 2;
      labelY = vb.minPy + vb.h / 2;
    } else {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(x + faceInset));
      rect.setAttribute('y', String(y + faceInset));
      rect.setAttribute('width', String(Math.max(1, w - 2 * faceInset)));
      rect.setAttribute('height', String(Math.max(1, h - 2 * faceInset)));
      rect.setAttribute('rx', String(corner));
      rect.setAttribute('ry', String(corner));
      rect.setAttribute('class', 'kle-key-path');
      group.appendChild(rect);
      keyBgNode = rect;
    }

    const r = kleKey.row;
    const col = kleKey.col;
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

    if (isChanged || isNew && keyBgNode) {
      keyBgNode.classList.add('changed');
    }

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', String(labelX));
    label.setAttribute('y', String(labelY));
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('dominant-baseline', 'central');
    label.setAttribute('class', 'kle-key-text');

    if (displayKey === null || displayKey === undefined || displayKey === 'KC_NO') {
      setSvgText(label, '');
      if (isChanged || isNew) {
        const curL = currentKey && currentKey !== 'KC_NO' ? keycodeToChar(String(currentKey)) : '—';
        const tgtL = targetKey && targetKey !== 'KC_NO' ? keycodeToChar(String(targetKey)) : '—';
        setSvgDiffText(label, curL, tgtL);
        label.classList.add('changed');
      }
    } else if (isTransparentKeycode(displayKey)) {
      setSvgText(label, '▼');
      label.classList.add('transparent-key');
      if (isChanged || isNew) {
        const curL = currentKey && !isTransparentKeycode(currentKey) ? keycodeToChar(String(currentKey)) : '▼';
        const tgtL = targetKey && !isTransparentKeycode(targetKey) ? keycodeToChar(String(targetKey)) : '▼';
        setSvgDiffText(label, curL, tgtL);
        label.classList.add('changed');
      }
    } else {
      const keyLabel = keycodeToChar(displayKey);
      setSvgWrappedText(label, keyLabel, w);

      if (isChanged || isNew) {
        const currentLabel = currentKey ? keycodeToChar(String(currentKey)) : '—';
        const targetLabel = targetKey ? keycodeToChar(String(targetKey)) : '—';
        setSvgDiffText(label, currentLabel, targetLabel);
        label.classList.add('changed');
      }
    }

    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = isChanged || isNew
      ? `Original: ${currentKey ?? '—'}\nNew: ${targetKey ?? '—'}`
      : String(displayKey ?? '');
    group.appendChild(title);

    group.appendChild(label);
    board.appendChild(group);
  }

  wrap.appendChild(board);
  targetEl.appendChild(wrap);
}

function renderMatrixFallbackLayout(state, targetEl, layerIdx = 0, targetState = null, keycodeToChar) {
  const baseState = targetState && targetState.layout && targetState.layout[layerIdx] ? targetState : state;
  if (!baseState || !baseState.layout || !baseState.layout[layerIdx]) {
    renderEmptyState(targetEl, 'No layout data for this layer.');
    return;
  }
  clearNode(targetEl);

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
          setHtmlDiffText(keyEl, curL, tgtL);
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
          setHtmlDiffText(keyEl, curL, tgtL);
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
          setHtmlDiffText(keyEl, currentLabel, targetLabel);
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
  global.KeymapPresentation = {
    prepare: deriveActiveKleGeometry,
    resolvePackedLayoutOptions,
    formatLayoutOptionsDebug,
    render: renderKeyboardLayout,
    getMatrixCell,
    isTransparentKeycode,
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = global.KeymapPresentation;
  }
})(typeof window !== "undefined" ? window : global);
