/* Keycode help for the editor: suggestions while typing, the context bar
 * that shows what the focused field sends, and the searchable help drawer.
 *
 * Editor fields opt in with the `kc-field` class. The editor supplies
 * describeField(input) -> { title, color, hint, preview, suggest } where
 * `suggest` is 'keycode', 'base' or null. */
import { referenceGroups, searchReference } from './keycode-reference.js';

const SUGGEST_LIMIT = 8;
const COMMON_CATEGORIES = ['Basics', 'Shortcuts', 'Layer keys'];

export default function createKeycodeHelp(options) {
  const doc = options.documentLike || document;
  const getTapDances = options.getTapDances || (() => []);
  const getGuide = options.getGuide || (() => null);
  const getTargetLabel = options.getTargetLabel || (() => '');
  const describeField = options.describeField;

  const suggestBox = doc.getElementById('keycodeSuggest');
  const contextBar = doc.getElementById('contextBar');
  const drawer = doc.getElementById('helpDrawer');
  const scrim = doc.getElementById('helpScrim');
  const search = doc.getElementById('helpSearch');
  const body = doc.getElementById('helpBody');

  let field = null; // focused editor field
  let lastField = null; // last editor field, target for inserts from the drawer
  let items = [];
  let highlighted = -1;

  const el = (tag, className, text) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  const isField = (node) => node?.classList?.contains('kc-field');
  const attached = (node) => node && doc.body.contains(node);

  // ---------- Context bar ----------
  function renderContext() {
    if (!contextBar) return;
    contextBar.replaceChildren();
    const info = attached(field) ? describeField(field) : null;
    if (!info) {
      const hint = el('span', 'context-hint');
      hint.append('Click a field to edit it. Suggestions appear as you type, and this bar shows what is sent to the keyboard. Press ');
      hint.append(el('kbd', '', '?'));
      hint.append(' for all keycodes.');
      contextBar.append(hint);
      const target = getTargetLabel();
      if (target) contextBar.append(el('span', 'context-target', target));
      return;
    }
    const where = el('span', 'context-where');
    const swatch = el('span', 'swatch');
    if (info.color) swatch.style.setProperty('--swatch', info.color);
    where.append(swatch, info.title);
    const hint = el('span', 'context-hint', `${info.hint} `);
    const more = el('button', 'link-btn', 'All keycodes');
    more.type = 'button';
    more.addEventListener('mousedown', (event) => event.preventDefault());
    more.addEventListener('click', () => open(''));
    hint.append(more);
    contextBar.append(where, hint);
    const preview = info.preview;
    if (preview) {
      if (preview.ok && !preview.empty) contextBar.append(el('span', 'context-label', 'Sends'));
      const out = el('span', `context-out${preview.ok ? '' : ' bad'}${preview.empty ? ' empty' : ''}`, preview.ok && !preview.empty ? preview.code : preview.message);
      contextBar.append(out);
    }
  }

  // ---------- Suggestions ----------
  function hideSuggest() {
    if (suggestBox) suggestBox.hidden = true;
    items = [];
    highlighted = -1;
  }

  function suggestionsFor(info, query) {
    const tapDances = getTapDances();
    if (info.suggest === 'base') {
      const groups = searchReference(query, tapDances);
      const tds = groups.filter((group) => group.category === 'Tap dances');
      const rest = query ? groups.filter((group) => group.category !== 'Tap dances') : groups.filter((group) => group.category === 'Basics');
      return [...tds, ...rest];
    }
    if (!query) return referenceGroups(tapDances).filter((group) => COMMON_CATEGORIES.includes(group.category));
    return searchReference(query, tapDances);
  }

  function showSuggest() {
    if (!suggestBox || !attached(field)) return hideSuggest();
    const info = describeField(field);
    const query = field.value.trim();
    // A single character is almost always meant literally (ä, {, 1).
    if (!info?.suggest || [...query].length === 1) return hideSuggest();
    const groups = suggestionsFor(info, query);
    items = [];
    suggestBox.replaceChildren();
    for (const group of groups) {
      if (items.length >= SUGGEST_LIMIT) break;
      suggestBox.append(el('div', 'suggest-head', group.category));
      for (const entry of group.entries) {
        if (items.length >= SUGGEST_LIMIT) break;
        const option = el('div', 'suggest-item');
        option.setAttribute('role', 'option');
        option.dataset.index = String(items.length);
        const text = el('div', 'suggest-text');
        text.append(el('div', 'suggest-label', entry.label), el('div', 'suggest-desc', entry.desc));
        option.append(text, el('span', 'suggest-code', entry.code));
        option.addEventListener('mousedown', (event) => {
          event.preventDefault();
          insert(entry.label, field);
          hideSuggest();
        });
        suggestBox.append(option);
        items.push(entry);
      }
    }
    if (!items.length) return hideSuggest();
    highlighted = -1;
    suggestBox.hidden = false;
    const rect = field.getBoundingClientRect();
    const width = suggestBox.offsetWidth || 300;
    const height = suggestBox.offsetHeight || 280;
    const view = doc.defaultView;
    suggestBox.style.left = `${Math.max(8, Math.min(rect.left, view.innerWidth - width - 8))}px`;
    const below = rect.bottom + 4;
    suggestBox.style.top = `${below + height > view.innerHeight - 8 ? Math.max(8, rect.top - height - 4) : below}px`;
  }

  function highlight(index) {
    highlighted = index;
    suggestBox.querySelectorAll('.suggest-item').forEach((option, i) => {
      option.classList.toggle('active', i === index);
      if (i === index) option.scrollIntoView({ block: 'nearest' });
    });
  }

  function insert(value, target) {
    if (!attached(target)) return false;
    target.value = value;
    target.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  // ---------- Drawer ----------
  function renderDrawer() {
    if (!body) return;
    const query = search?.value.trim() || '';
    body.replaceChildren();
    const guide = getGuide();
    if (!query && guide) {
      const box = el('div', 'help-guide');
      box.append(el('strong', '', guide.title));
      guide.paragraphs.forEach((text) => box.append(el('p', '', text)));
      body.append(box);
      body.append(el('p', 'help-note', 'Click an entry to put it into the field you were editing.'));
    }
    const groups = searchReference(query, getTapDances());
    if (!groups.length) {
      body.append(el('p', 'help-note', `Nothing matches “${query}”. Single characters such as ä or { are always accepted and translated for ${getTargetLabel() || 'your keyboard'}.`));
      return;
    }
    for (const group of groups) {
      const details = el('details', 'help-group');
      details.open = Boolean(query) || COMMON_CATEGORIES.includes(group.category) || group.category === 'Tap dances';
      const summary = el('summary', '', group.category);
      summary.append(el('span', 'help-count', String(group.entries.length)));
      details.append(summary);
      for (const entry of group.entries) {
        const row = el('button', 'help-entry');
        row.type = 'button';
        row.title = entry.aliases?.length ? `Also accepted: ${entry.aliases.join(', ')}` : '';
        row.append(el('span', 'help-label', entry.label), el('span', 'help-desc', entry.desc), el('span', 'help-code', entry.code));
        row.addEventListener('click', () => pick(entry.label));
        details.append(row);
      }
      body.append(details);
    }
  }

  async function pick(value) {
    if (insert(value, lastField)) {
      close();
      lastField.focus();
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      if (search) search.placeholder = `Copied ${value}`;
    } catch { /* clipboard unavailable */ }
  }

  function open(query = '') {
    if (!drawer) return;
    hideSuggest();
    if (search) search.value = query;
    renderDrawer();
    drawer.hidden = false;
    if (scrim) scrim.hidden = false;
    requestAnimationFrame(() => drawer.classList.add('open'));
    setTimeout(() => search?.focus(), 50);
  }

  function close() {
    if (!drawer) return;
    drawer.classList.remove('open');
    drawer.hidden = true;
    if (scrim) scrim.hidden = true;
  }

  const isOpen = () => drawer && !drawer.hidden;

  // ---------- Events ----------
  doc.addEventListener('focusin', (event) => {
    if (isField(event.target)) {
      field = lastField = event.target;
      renderContext();
      if (!field.value.trim()) showSuggest(); else hideSuggest();
    }
  });
  doc.addEventListener('focusout', (event) => {
    if (!isField(event.target)) return;
    setTimeout(() => {
      if (doc.activeElement === field) return;
      hideSuggest();
      if (!isField(doc.activeElement)) {
        field = null;
        renderContext();
      }
    }, 0);
  });
  doc.addEventListener('input', (event) => {
    if (event.target === search) return renderDrawer();
    if (isField(event.target) && event.target === field) {
      renderContext();
      showSuggest();
    }
  });
  // Capture phase, so a picked suggestion wins over the editor's own Enter handling.
  doc.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (isOpen()) { close(); event.preventDefault(); return; }
      if (!suggestBox?.hidden) { hideSuggest(); event.preventDefault(); event.stopPropagation(); }
      return;
    }
    const target = event.target;
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(target?.tagName || '') || target?.isContentEditable;
    if (event.key === '?' && !typing && !isOpen()) {
      event.preventDefault();
      open('');
      return;
    }
    if (!items.length || suggestBox?.hidden || target !== field) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      highlight(highlighted < 0 ? (step > 0 ? 0 : items.length - 1) : (highlighted + step + items.length) % items.length);
    } else if (event.key === 'Enter' && highlighted >= 0) {
      event.preventDefault();
      event.stopPropagation();
      insert(items[highlighted].label, field);
      hideSuggest();
    }
  }, true);
  doc.addEventListener('scroll', (event) => {
    if (!suggestBox?.contains(event.target)) hideSuggest();
  }, true);
  doc.getElementById('closeHelp')?.addEventListener('click', close);
  scrim?.addEventListener('click', close);

  renderContext();

  return { open, close, refresh: renderContext, hideSuggest };
}
