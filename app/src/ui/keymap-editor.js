/* Keymap editor panels: the Keys tab (layer strip, table and keyboard views),
 * the Tap Dance tab and the Combos tab. Edits go straight into the session's
 * config object; the caller is told through onChange. */
import { charToKeycode, parseKeycodeString } from '../core/keycode-mapping.js';
import {
  MAX_EXTRA_LAYERS,
  MAX_LAYER_INDEX,
  getExtraLayers,
  nextLayerId,
  nextLayerIndex,
} from '../core/config-layers.js';
import { KEY_ORDERS, groupKeys, mappingKeys } from './key-order.js';
import {
  previewBase,
  previewComboKeys,
  previewKeycodeInput,
  previewLayerValue,
  targetLabel,
} from './field-preview.js';
import createKeycodeHelp from './keycode-help.js';

const LAYER_COLORS = 8;
const BASE_COLOR = 'var(--layer-base)';
const layerColor = (position) => `var(--layer-${position % LAYER_COLORS})`;

const LEGEND_SYMBOLS = {
  KC_LEFT: '←', KC_RIGHT: '→', KC_UP: '↑', KC_DOWN: '↓',
  KC_HOME: '⇤', KC_END: '⇥', KC_PGUP: '⇞', KC_PGDN: '⇟',
  KC_LCTL: '⌃', KC_LALT: '⌥', KC_LGUI: '⌘', KC_LSFT: '⇧',
  KC_BSPC: '⌫', KC_DEL: '⌦', KC_ENT: '⏎', KC_TAB: '⇥', KC_ESC: 'Esc', KC_SPC: '␣',
};

function storageGet(key, fallback) {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}

export default function createKeymapEditor(options) {
  const doc = options.documentLike || document;
  const getConfig = options.getConfig;
  const onChange = options.onChange || (() => {});
  const keycodeToChar = options.keycodeToChar || ((value) => value);
  const confirmRemove = options.confirm || ((message) => window.confirm(message));

  const $ = (id) => doc.getElementById(id);
  const refs = {
    tabs: [...doc.querySelectorAll('[data-editor-tab]')],
    panels: { keys: $('keysPanel'), tapdance: $('tapDancePanel'), combos: $('comboPanel') },
    layerStrip: $('layerStrip'),
    viewButtons: [...doc.querySelectorAll('[data-keys-view]')],
    layoutSelect: $('layoutSelect'),
    tableCard: $('keysTableCard'),
    tableHead: $('alphaTableHead'),
    tableBody: $('alphaTableBody'),
    keyboardCard: $('keysKeyboardCard'),
    tapDanceList: $('tapDanceList'),
    comboList: $('comboList'),
    tapDanceCount: $('tapDanceCount'),
    comboCount: $('comboCount'),
    addTapDance: $('addTapDance'),
    addCombo: $('addCombo'),
  };

  const state = {
    tab: 'keys',
    view: storageGet('keymapsync-keys-view', 'table') === 'keyboard' ? 'keyboard' : 'table',
    order: KEY_ORDERS[storageGet('keymapsync-layout', 'qwerty')] ? storageGet('keymapsync-layout', 'qwerty') : 'qwerty',
    selectedKey: null,
    openLayerId: null,
  };

  const el = (tag, className, text) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  const config = () => getConfig();
  const extraLayers = () => getExtraLayers(config());
  const tapDanceNames = () => (config()?.tapDanceOverrides || []).map((td) => td?.name).filter(Boolean);
  const isDim = (value) => !value || /^(no|kc_no)$/i.test(String(value).trim());

  function changed() {
    onChange();
    help.refresh();
  }

  /** Converts a legacy layers object to the list form before the first layer edit. */
  function ensureExtraLayers() {
    const cfg = config();
    if (!Array.isArray(cfg.layers.extra)) cfg.layers = { alpha: cfg.layers.alpha ?? 0, extra: getExtraLayers(cfg) };
    return cfg.layers.extra;
  }

  // ---------- Field descriptions for the help module ----------
  function describeField(input) {
    const cfg = config();
    const kind = input.dataset.kind;
    if (kind === 'layer') {
      const position = extraLayers().findIndex((layer) => layer.id === input.dataset.layer);
      const layer = extraLayers()[position];
      return {
        title: `${layer?.name || 'Layer'} · ${input.dataset.key}`,
        color: layerColor(position),
        hint: 'A character, a shortcut like Alt+Bksp, a layer key like MO(1), or NO.',
        preview: previewLayerValue(input.value, cfg?.target),
        suggest: 'keycode',
      };
    }
    if (kind === 'base') {
      return {
        title: `Base override · ${input.dataset.key}`,
        color: BASE_COLOR,
        hint: 'Leave empty to keep the letter. TD(name) puts a tap dance on this key.',
        preview: previewBase(input.value, tapDanceNames()),
        suggest: 'base',
      };
    }
    if (kind === 'td') {
      return {
        title: `${input.dataset.owner || 'Tap dance'} · ${input.dataset.label}`,
        color: 'var(--warn)',
        hint: 'A key, a shortcut like Cmd+H, or NO.',
        preview: previewKeycodeInput(input.value),
        suggest: 'keycode',
      };
    }
    if (kind === 'combo-result') {
      return {
        title: 'Combo result',
        color: 'var(--accent)',
        hint: 'What the combo sends: a key, a shortcut or a layer key.',
        preview: previewKeycodeInput(input.value),
        suggest: 'keycode',
      };
    }
    if (kind === 'combo-keys') {
      return {
        title: 'Combo keys',
        color: 'var(--accent)',
        hint: 'The keys to press together, separated by commas.',
        preview: previewComboKeys(input.value),
        suggest: null,
      };
    }
    return null;
  }

  function fieldState(input) {
    const info = describeField(input);
    const value = input.value.trim();
    input.classList.toggle('invalid', Boolean(value) && info?.preview && !info.preview.ok);
    if (input.dataset.kind === 'layer') input.classList.toggle('dim', isDim(value));
    if (input.dataset.kind === 'base') input.classList.toggle('set', Boolean(value));
  }

  function field({ kind, value, placeholder, data = {}, onInput, label }) {
    const input = el('input', `kc-field cell cell-${kind}`);
    input.type = 'text';
    input.value = value ?? '';
    input.placeholder = placeholder ?? '';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.dataset.kind = kind;
    Object.entries(data).forEach(([k, v]) => { input.dataset[k] = v; });
    if (label) input.setAttribute('aria-label', label);
    input.addEventListener('input', () => {
      onInput(input.value);
      fieldState(input);
      changed();
    });
    fieldState(input);
    return input;
  }

  // ---------- Alpha key fields ----------
  function setLayerValue(key, layerId, value) {
    const mapping = config().alphaMappings[key];
    const text = value.trim();
    if (text) mapping[layerId] = text;
    else delete mapping[layerId];
  }

  function layerField(key, layer, position) {
    const mapping = config().alphaMappings[key] || {};
    const input = field({
      kind: 'layer',
      value: mapping[layer.id] ?? '',
      placeholder: '—',
      data: { key, layer: layer.id },
      label: `${layer.name} for ${key}`,
      onInput: (value) => {
        setLayerValue(key, layer.id, value);
        refreshKeyLegend(key);
      },
    });
    input.style.setProperty('--layer-color', layerColor(position));
    return input;
  }

  function baseField(key) {
    const mapping = config().alphaMappings[key] || {};
    return field({
      kind: 'base',
      value: mapping.base ?? '',
      placeholder: key,
      data: { key },
      label: `Base override for ${key}`,
      onInput: (value) => {
        config().alphaMappings[key].base = value.trim() || null;
        refreshKeyLegend(key);
      },
    });
  }

  // ---------- Layer strip ----------
  function chip(text, index, color, extraClass = '') {
    const node = el('span', `layer-chip ${extraClass}`.trim());
    const swatch = el('span', 'swatch');
    swatch.style.setProperty('--swatch', color);
    node.append(swatch, el('span', 'chip-name', text), el('span', 'chip-index', `L${index}`));
    return node;
  }

  function renderLayerStrip() {
    const strip = refs.layerStrip;
    strip.replaceChildren();
    strip.append(el('span', 'strip-label', 'Layers'));
    const cfg = config();
    const base = chip('Base', cfg.layers.alpha ?? 0, BASE_COLOR, 'fixed');
    base.title = 'The layer with your letters';
    strip.append(base);
    extraLayers().forEach((layer, position) => {
      const button = el('button', 'layer-chip');
      button.type = 'button';
      button.title = 'Rename, move or remove this layer';
      button.dataset.layerId = layer.id;
      button.setAttribute('aria-expanded', String(state.openLayerId === layer.id));
      const swatch = el('span', 'swatch');
      swatch.style.setProperty('--swatch', layerColor(position));
      button.append(swatch, el('span', 'chip-name', layer.name), el('span', 'chip-index', `L${layer.index}`));
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        state.openLayerId = state.openLayerId === layer.id ? null : layer.id;
        renderLayerStrip();
        if (state.openLayerId) refs.layerStrip.querySelector('.layer-pop input')?.focus();
      });
      strip.append(button);
      if (state.openLayerId === layer.id) strip.append(layerPopover(layer, button));
    });
    if (extraLayers().length < MAX_EXTRA_LAYERS) {
      const add = el('button', 'layer-chip add', '+ Add layer');
      add.type = 'button';
      add.addEventListener('click', (event) => {
        event.stopPropagation();
        addLayer();
      });
      strip.append(add);
    }
  }

  function layerPopover(layer, anchor) {
    const pop = el('div', 'layer-pop');
    pop.addEventListener('click', (event) => event.stopPropagation());
    const cfg = config();

    const nameLabel = el('label', 'pop-field', 'Name');
    const name = el('input');
    name.type = 'text';
    name.value = layer.name;
    name.maxLength = 40;
    name.addEventListener('input', () => {
      const extra = ensureExtraLayers();
      const target = extra.find((item) => item.id === layer.id);
      if (name.value.trim()) {
        target.name = name.value.trim();
        anchor.querySelector('.chip-name').textContent = target.name;
        renderKeysView();
        changed();
      }
    });
    name.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') closePopover();
    });
    nameLabel.append(name);

    const indexLabel = el('label', 'pop-field', 'Writes to keyboard layer');
    const select = el('select');
    const used = new Set([cfg.layers.alpha ?? 0, ...extraLayers().filter((item) => item.id !== layer.id).map((item) => item.index)]);
    for (let i = 0; i <= MAX_LAYER_INDEX; i += 1) {
      if (used.has(i)) continue;
      const option = el('option', '', String(i));
      option.value = String(i);
      option.selected = i === layer.index;
      select.append(option);
    }
    select.addEventListener('change', () => {
      ensureExtraLayers().find((item) => item.id === layer.id).index = Number(select.value);
      changed();
      renderLayerStrip();
      renderKeysView();
    });
    indexLabel.append(select);

    const actions = el('div', 'pop-actions');
    const remove = el('button', 'danger-btn', 'Remove layer');
    remove.type = 'button';
    remove.disabled = extraLayers().length <= 1;
    remove.addEventListener('click', () => removeLayer(layer));
    const done = el('button', 'primary', 'Done');
    done.type = 'button';
    done.addEventListener('click', closePopover);
    actions.append(remove, done);

    pop.append(nameLabel, indexLabel, actions);
    // Place under the chip, inside the strip.
    requestAnimationFrame(() => {
      const strip = refs.layerStrip.getBoundingClientRect();
      const box = anchor.getBoundingClientRect();
      const maxLeft = Math.max(0, strip.width - pop.offsetWidth);
      pop.style.left = `${Math.min(Math.max(0, box.left - strip.left), maxLeft)}px`;
    });
    return pop;
  }

  function closePopover() {
    if (!state.openLayerId) return;
    state.openLayerId = null;
    renderLayerStrip();
  }

  function addLayer() {
    const cfg = config();
    const extra = ensureExtraLayers();
    const layer = {
      id: nextLayerId(extra),
      name: `Layer ${extra.length + 1}`,
      index: nextLayerIndex(cfg.layers.alpha ?? 0, extra),
    };
    if (layer.index > MAX_LAYER_INDEX) return;
    extra.push(layer);
    state.openLayerId = layer.id;
    changed();
    renderLayerStrip();
    renderKeysView();
    const input = refs.layerStrip.querySelector('.layer-pop input');
    input?.focus();
    input?.select();
  }

  function removeLayer(layer) {
    const mappings = config().alphaMappings || {};
    const filled = Object.values(mappings).filter((mapping) => mapping?.[layer.id] != null && mapping[layer.id] !== '').length;
    if (filled && !confirmRemove(`Remove the layer “${layer.name}”? Its ${filled} key ${filled === 1 ? 'value' : 'values'} will be deleted.`)) return;
    const extra = ensureExtraLayers();
    extra.splice(extra.findIndex((item) => item.id === layer.id), 1);
    Object.values(mappings).forEach((mapping) => { if (mapping) delete mapping[layer.id]; });
    state.openLayerId = null;
    changed();
    renderLayerStrip();
    renderKeysView();
  }

  // ---------- Keys: table ----------
  function renderTable() {
    const cfg = config();
    const layers = extraLayers();
    const head = el('tr');
    head.append(el('th', 'key-col', 'Key'));
    const baseHead = el('th', 'base-col', 'Base override');
    baseHead.title = 'Optional: replace the letter itself, e.g. with a tap dance';
    head.append(baseHead);
    layers.forEach((layer, position) => {
      const th = el('th', 'layer-col');
      const swatch = el('span', 'swatch');
      swatch.style.setProperty('--swatch', layerColor(position));
      th.append(swatch, layer.name, el('span', 'col-index', `L${layer.index}`));
      head.append(th);
    });
    head.append(el('th', 'fill-col'));
    refs.tableHead.replaceChildren(head);

    const rows = [];
    for (const group of groupKeys(mappingKeys(cfg.alphaMappings), state.order)) {
      const groupRow = el('tr', 'group-row');
      groupRow.append(el('td', 'key-col', group.name));
      const rest = el('td');
      rest.colSpan = layers.length + 2;
      groupRow.append(rest);
      rows.push(groupRow);
      for (const key of group.keys) {
        const row = el('tr');
        const keyCell = el('td', 'key-col');
        keyCell.append(el('span', 'keycap', key));
        row.append(keyCell);
        const baseCell = el('td', 'base-col');
        baseCell.append(baseField(key));
        row.append(baseCell);
        layers.forEach((layer, position) => {
          const cell = el('td', 'layer-col');
          cell.append(layerField(key, layer, position));
          row.append(cell);
        });
        row.append(el('td', 'fill-col'));
        rows.push(row);
      }
    }
    refs.tableBody.replaceChildren(...rows);
  }

  // Arrow keys and Enter move between rows of the same column.
  refs.tableBody.addEventListener('keydown', (event) => {
    const input = event.target;
    if (!input.classList?.contains('kc-field')) return;
    const down = event.key === 'ArrowDown' || (event.key === 'Enter' && !event.shiftKey);
    const up = event.key === 'ArrowUp' || (event.key === 'Enter' && event.shiftKey);
    if (!down && !up) return;
    const selector = input.dataset.kind === 'layer' ? `.kc-field[data-layer="${input.dataset.layer}"]` : '.kc-field[data-kind="base"]';
    const column = [...refs.tableBody.querySelectorAll(selector)];
    const next = column[column.indexOf(input) + (down ? 1 : -1)];
    if (next) {
      event.preventDefault();
      next.focus();
      next.select();
    }
  });

  // ---------- Keys: keyboard ----------
  function legendText(value) {
    const preview = previewLayerValue(value, config()?.target);
    if (preview.ok && LEGEND_SYMBOLS[preview.code]) return LEGEND_SYMBOLS[preview.code];
    const text = String(value).trim();
    if ([...text].length <= 2) return text;
    const label = preview.ok ? keycodeToChar(preview.code) : text;
    return label.length > 5 ? `${label.slice(0, 4)}…` : label;
  }

  function fillLegends(button, key) {
    const mapping = config().alphaMappings[key] || {};
    const legends = el('span', 'kb-legends');
    extraLayers().forEach((layer, position) => {
      const value = mapping[layer.id];
      if (isDim(value)) return;
      const legend = el('span', 'kb-legend', legendText(value));
      legend.style.setProperty('--layer-color', layerColor(position));
      legend.title = `${layer.name}: ${value}`;
      legends.append(legend);
    });
    button.querySelector('.kb-legends')?.remove();
    button.querySelector('.kb-td')?.remove();
    if (mapping.base) {
      const td = el('span', 'kb-td', /^TD\(/.test(mapping.base) ? 'TD' : '★');
      td.title = `Base override: ${mapping.base}`;
      button.append(td);
    }
    button.append(legends);
  }

  function refreshKeyLegend(key) {
    if (state.view !== 'keyboard') return;
    const button = refs.keyboardCard.querySelector(`.kb-key[data-key="${CSS.escape(key)}"]`);
    if (button) fillLegends(button, key);
  }

  function renderKeyboard() {
    const cfg = config();
    const groups = groupKeys(mappingKeys(cfg.alphaMappings), state.order);
    const allKeys = groups.flatMap((group) => group.keys);
    if (!allKeys.includes(state.selectedKey)) state.selectedKey = allKeys[0] || null;

    const board = el('div', 'kb-board');
    const legend = el('div', 'kb-key-legend');
    const baseItem = el('span', 'kb-legend-item', 'Base');
    baseItem.style.setProperty('--layer-color', BASE_COLOR);
    legend.append(baseItem);
    extraLayers().forEach((layer, position) => {
      const item = el('span', 'kb-legend-item', layer.name);
      item.style.setProperty('--layer-color', layerColor(position));
      legend.append(item);
    });
    board.append(legend);

    groups.forEach((group, rowIndex) => {
      const row = el('div', `kb-row kb-row-${Math.min(rowIndex, 3)}`);
      row.setAttribute('aria-label', group.name);
      const label = el('span', 'kb-row-label', group.name);
      row.append(label);
      const keys = el('div', 'kb-keys');
      for (const key of group.keys) {
        const button = el('button', 'kb-key');
        button.type = 'button';
        button.dataset.key = key;
        button.setAttribute('aria-pressed', String(key === state.selectedKey));
        button.append(el('span', 'kb-main', key));
        fillLegends(button, key);
        button.addEventListener('click', () => {
          state.selectedKey = key;
          refs.keyboardCard.querySelectorAll('.kb-key').forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
          renderKeyEditor(editor);
        });
        keys.append(button);
      }
      row.append(keys);
      board.append(row);
    });

    const editor = el('div', 'kb-editor');
    renderKeyEditor(editor);
    refs.keyboardCard.replaceChildren(board, editor);
  }

  function renderKeyEditor(container) {
    container.replaceChildren();
    const key = state.selectedKey;
    if (!key) return;
    const title = el('div', 'kb-editor-title');
    title.append('Key ', el('span', 'keycap small', key));
    container.append(title);
    const base = el('label', 'kb-field');
    base.append(el('span', 'kb-field-name', 'Base override'), baseField(key));
    container.append(base);
    extraLayers().forEach((layer, position) => {
      const label = el('label', 'kb-field');
      const name = el('span', 'kb-field-name');
      const swatch = el('span', 'swatch');
      swatch.style.setProperty('--swatch', layerColor(position));
      name.append(swatch, layer.name);
      label.append(name, layerField(key, layer, position));
      container.append(label);
    });
  }

  function renderKeysView() {
    if (!config()?.alphaMappings) return;
    refs.viewButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.keysView === state.view)));
    refs.tableCard.hidden = state.view !== 'table';
    refs.keyboardCard.hidden = state.view !== 'keyboard';
    if (state.view === 'table') renderTable(); else renderKeyboard();
  }

  // ---------- Tap dances ----------
  /** Renames TD(from) to TD(to) in every key mapping, combo and key override. */
  function renameTapDanceReferences(from, to) {
    const identifier = /^[A-Za-z_][A-Za-z0-9_]*$/;
    if (from === to || !identifier.test(from || '') || !identifier.test(to || '')) return;
    const pattern = new RegExp(`TD\\(\\s*${from}\\s*\\)`, 'g');
    const rename = (value) => {
      if (typeof value === 'string') return value.replace(pattern, `TD(${to})`);
      if (Array.isArray(value)) return value.map(rename);
      if (value && typeof value === 'object') {
        Object.keys(value).forEach((key) => { value[key] = rename(value[key]); });
      }
      return value;
    };
    const cfg = config();
    for (const section of ['alphaMappings', 'comboOverrides', 'keyOverrideOverrides']) {
      if (cfg[section]) rename(cfg[section]);
    }
  }

  function renderTapDances() {
    const cfg = config();
    if (!cfg.tapDanceOverrides) cfg.tapDanceOverrides = [];
    const items = cfg.tapDanceOverrides.map((td, index) => {
      const item = el('div', 'item-card');
      const head = el('div', 'item-head');
      let previousName = td.name || '';
      const name = el('input', 'cell name-input');
      name.type = 'text';
      name.value = td.name || '';
      name.placeholder = 'Name, e.g. H_GUIH';
      name.setAttribute('aria-label', 'Tap dance name');
      name.addEventListener('input', () => {
        td.name = name.value.trim();
        name.classList.toggle('invalid', !/^[A-Za-z_][A-Za-z0-9_]*$/.test(td.name));
        changed();
      });
      name.addEventListener('change', () => {
        renameTapDanceReferences(previousName, td.name);
        previousName = td.name;
        updateUsage();
        changed();
      });
      const usage = el('span', 'item-usage');
      const updateUsage = () => {
        const used = Object.entries(cfg.alphaMappings || {})
          .filter(([, mapping]) => td.name && mapping?.base === `TD(${td.name})`)
          .map(([key]) => key);
        usage.textContent = used.length ? `Used on ${used.length === 1 ? 'key' : 'keys'} ${used.join(', ')}` : 'Not used on any key yet';
      };
      updateUsage();
      const remove = el('button', 'icon-btn', '✕');
      remove.type = 'button';
      remove.title = 'Delete tap dance';
      remove.setAttribute('aria-label', 'Delete tap dance');
      remove.addEventListener('click', () => {
        cfg.tapDanceOverrides.splice(index, 1);
        changed();
        renderTapDances();
      });
      head.append(name, usage, remove);

      const fields = el('div', 'item-fields');
      for (const [key, label, placeholder] of [
        ['tap', 'Tap', 'e.g. H'],
        ['hold', 'Hold', 'e.g. Cmd+H'],
        ['doubleTap', 'Double tap', '—'],
        ['tapHold', 'Tap then hold', '—'],
      ]) {
        const wrap = el('label', 'item-field');
        wrap.append(el('span', 'item-field-name', label), field({
          kind: 'td',
          value: td[key] ? keycodeToChar(td[key]) : '',
          placeholder,
          data: { owner: td.name || 'Tap dance', label },
          label: `${label} for ${td.name || 'tap dance'}`,
          onInput: (value) => { td[key] = value.trim() ? charToKeycode(value.trim()) : ''; },
        }));
        fields.append(wrap);
      }
      const termWrap = el('label', 'item-field');
      const term = el('input', 'cell');
      term.type = 'number';
      term.min = '0';
      term.max = '65535';
      term.placeholder = '200';
      term.value = td.term ?? '';
      term.addEventListener('input', () => {
        const value = term.value.trim();
        if (value === '') delete td.term; else td.term = Math.max(0, Math.min(65535, Math.round(Number(value)) || 0));
        changed();
      });
      termWrap.append(el('span', 'item-field-name', 'Timing (ms)'), term);
      fields.append(termWrap);

      item.append(head, fields);
      return item;
    });
    refs.tapDanceList.replaceChildren(...items);
    if (!items.length) refs.tapDanceList.append(el('p', 'empty-note', 'No tap dances yet.'));
    updateCounts();
  }

  // ---------- Combos ----------
  function renderCombos() {
    const cfg = config();
    if (!cfg.comboOverrides) cfg.comboOverrides = [];
    const items = cfg.comboOverrides.map((combo, index) => {
      const item = el('div', 'item-card combo-card');
      const keys = field({
        kind: 'combo-keys',
        value: Array.isArray(combo.keys) ? combo.keys.map((key) => keycodeToChar(key)).join(', ') : '',
        placeholder: 'e.g. J, K',
        label: 'Combo keys',
        onInput: (value) => { combo.keys = parseKeycodeString(value); },
      });
      const result = field({
        kind: 'combo-result',
        value: combo.result ? keycodeToChar(combo.result) : '',
        placeholder: 'e.g. Bksp',
        label: 'Combo result',
        onInput: (value) => { combo.result = value.trim() ? charToKeycode(value.trim()) : ''; },
      });
      const remove = el('button', 'icon-btn', '✕');
      remove.type = 'button';
      remove.title = 'Delete combo';
      remove.setAttribute('aria-label', 'Delete combo');
      remove.addEventListener('click', () => {
        cfg.comboOverrides.splice(index, 1);
        changed();
        renderCombos();
      });
      item.append(keys, el('span', 'combo-arrow', '→'), result, el('span', 'spacer'), remove);
      return item;
    });
    refs.comboList.replaceChildren(...items);
    if (!items.length) refs.comboList.append(el('p', 'empty-note', 'No combos yet.'));
    updateCounts();
  }

  function updateCounts() {
    const cfg = config();
    if (refs.tapDanceCount) refs.tapDanceCount.textContent = String(cfg?.tapDanceOverrides?.length || 0);
    if (refs.comboCount) refs.comboCount.textContent = String(cfg?.comboOverrides?.length || 0);
  }

  // ---------- Tabs and toolbar ----------
  function showTab(tab) {
    state.tab = tab;
    help.hideSuggest();
    refs.tabs.forEach((button) => button.setAttribute('aria-selected', String(button.dataset.editorTab === tab)));
    Object.entries(refs.panels).forEach(([id, panel]) => { if (panel) panel.hidden = id !== tab; });
    if (tab === 'keys') renderKeysView();
    if (tab === 'tapdance') renderTapDances();
    if (tab === 'combos') renderCombos();
  }

  refs.tabs.forEach((button) => button.addEventListener('click', () => showTab(button.dataset.editorTab)));
  refs.viewButtons.forEach((button) => button.addEventListener('click', () => {
    state.view = button.dataset.keysView;
    storageSet('keymapsync-keys-view', state.view);
    renderKeysView();
  }));
  if (refs.layoutSelect) {
    refs.layoutSelect.value = state.order;
    refs.layoutSelect.addEventListener('change', () => {
      state.order = refs.layoutSelect.value;
      storageSet('keymapsync-layout', state.order);
      renderKeysView();
    });
  }
  refs.addTapDance?.addEventListener('click', () => {
    const cfg = config();
    if (!cfg) return;
    const used = new Set(tapDanceNames());
    let n = cfg.tapDanceOverrides.length + 1;
    while (used.has(`TD_${n}`)) n += 1;
    cfg.tapDanceOverrides.push({ name: `TD_${n}`, tap: '', hold: '' });
    changed();
    renderTapDances();
    refs.tapDanceList.querySelector('.item-card:last-child .name-input')?.select();
  });
  refs.addCombo?.addEventListener('click', () => {
    const cfg = config();
    if (!cfg) return;
    cfg.comboOverrides.push({ keys: [], result: '' });
    changed();
    renderCombos();
    refs.comboList.querySelector('.item-card:last-child .kc-field')?.focus();
  });
  doc.addEventListener('click', (event) => {
    if (state.openLayerId && !event.target.closest?.('.layer-pop')) closePopover();
  });

  const help = createKeycodeHelp({
    documentLike: doc,
    describeField,
    getTapDances: () => config()?.tapDanceOverrides || [],
    getTargetLabel: () => targetLabel(config()?.target),
    getGuide: () => {
      if (state.tab === 'tapdance') {
        return { title: 'Tap Dance', paragraphs: ['A tap dance does different things on tap, hold, double tap and tap-then-hold. Put TD(name) into a key’s Base override to use it.'] };
      }
      if (state.tab === 'combos') {
        return { title: 'Combos', paragraphs: ['Press the listed keys together to send the result. Keys are separated by commas; the result can be any key, shortcut or layer key.'] };
      }
      return {
        title: 'Keys',
        paragraphs: [
          `Each column is one layer. Type what the key should produce on that layer. Characters like ä or { are translated for ${targetLabel(config()?.target) || 'your keyboard'} automatically.`,
          'An empty field leaves the key as it is on the keyboard. NO clears the key.',
        ],
      };
    },
  });

  /** Full render; call after a different config was loaded. */
  function render() {
    if (!config()?.alphaMappings) return;
    state.openLayerId = null;
    renderLayerStrip();
    updateCounts();
    showTab(state.tab);
    help.refresh();
  }

  return { render, openHelp: (query) => help.open(query) };
}
