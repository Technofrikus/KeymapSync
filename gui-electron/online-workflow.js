/* Online device workflow. Device snapshots are re-read before apply and
 * selected sections are compared with the preview, preventing stale writes. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.KeymapSyncOnlineWorkflow = factory;
})(typeof window !== 'undefined' ? window : globalThis, function createOnlineWorkflow(options = {}) {
  const globalScope = typeof window !== 'undefined' ? window : globalThis;
  const api = options.api || globalScope.api;
  const status = options.status || (() => {});
  const confirmApply = options.confirm || ((message) => globalScope.confirm(message));
  const stringify = (value) => JSON.stringify(value);

  function calculateDiff(current, target, helpers = {}) {
    const getCell = helpers.getMatrixCell || ((row, index) => row?.[index]);
    const label = helpers.keycodeToChar || ((value) => value == null ? '' : String(value));
    const diff = { keys: [], combos: [], tapdance: [], keyOverrides: [] };
    const currentLayout = current?.layout || [];
    const targetLayout = target?.layout || [];
    for (let layerIdx = 0; layerIdx < Math.max(currentLayout.length, targetLayout.length); layerIdx += 1) {
      const fromLayer = currentLayout[layerIdx] || [];
      const toLayer = targetLayout[layerIdx] || [];
      for (let rowIdx = 0; rowIdx < Math.max(fromLayer.length, toLayer.length); rowIdx += 1) {
        const fromRow = fromLayer[rowIdx] || [];
        const toRow = toLayer[rowIdx] || [];
        for (let colIdx = 0; colIdx < Math.max(fromRow.length, toRow.length); colIdx += 1) {
          const from = getCell(fromRow, colIdx);
          const to = getCell(toRow, colIdx);
          if (from !== to) diff.keys.push({ layerIdx, loc: `L${layerIdx} R${rowIdx} C${colIdx}`, from, to });
        }
      }
    }
    const compareArray = (name, output, formatter = (value) => value == null ? 'Empty' : stringify(value)) => {
      const from = current?.[name] || [];
      const to = target?.[name] || [];
      for (let idx = 0; idx < Math.max(from.length, to.length); idx += 1) {
        if (stringify(from[idx]) !== stringify(to[idx])) output.push({ idx, from: formatter(from[idx]), to: formatter(to[idx]) });
      }
    };
    compareArray('combo', diff.combos, (value) => {
      if (!Array.isArray(value)) return 'Empty';
      const keys = value.slice(0, 4).filter((key) => key && key !== 'KC_NO').map(label).join('+');
      return `${keys} -> ${label(value[4])}`;
    });
    compareArray('tap_dance', diff.tapdance, (value) => {
      if (!Array.isArray(value)) return 'Empty';
      return value.slice(0, 4).filter((key) => key && key !== 'KC_NO').map(label).join(' | ') || 'No actions';
    });
    compareArray('key_override', diff.keyOverrides);
    return diff;
  }

  function selectedSections(documentLike = typeof document !== 'undefined' ? document : null) {
    const checked = (id) => documentLike?.getElementById(id)?.checked;
    return [['layout', checked('syncBaseKeys')], ['combo', checked('syncCombos')], ['tap_dance', checked('syncTapDance')], ['key_override', checked('syncKeyOverrides')]];
  }

  function mergeSelected(current, target, sections) {
    const result = JSON.parse(JSON.stringify(current));
    sections.forEach(([section, enabled]) => { if (enabled) result[section] = target[section]; });
    return result;
  }

  function mount(mountOptions = {}) {
    const doc = mountOptions.documentLike || document;
    const ids = [
      'refreshDevicesBtn', 'deviceList', 'onlineSyncPanel', 'selectedDeviceName',
      'deviceCapabilities', 'previewOnlineSyncBtn', 'runOnlineSyncBtn', 'previewDiff',
      'syncPreview', 'onlineStatus', 'layoutVisualization', 'layoutGrid',
      'previewLayouts', 'downloadBackupBtn',
    ];
    const refs = Object.fromEntries(ids.map((id) => [id, doc.getElementById(id)]));
    const presentation = globalScope.KeymapPresentation;
    const state = { selectedDevice: null, currentDeviceState: null, targetDeviceState: null, geometry: null };
    const clear = (element) => element?.replaceChildren();
    const text = (parent, tag, className, value) => {
      if (!parent) return null;
      const element = doc.createElement(tag);
      if (className) element.className = className;
      element.textContent = value;
      parent?.appendChild(element);
      return element;
    };
    const empty = (message) => { clear(refs.deviceList); text(refs.deviceList, 'div', 'empty-state', message); };
    const keycodeToLabel = mountOptions.keycodeToChar || globalScope.KeymapSyncEditor?.keycodeToChar || ((value) => value == null ? '' : String(value));
    const renderLayout = (deviceState, target, layer = 0, targetState = null) => presentation?.render({
      state: deviceState, target, layer, targetState, geometry: state.geometry, keycodeToLabel,
    });
    const appendInfo = (className, label, value) => {
      const info = doc.createElement('div');
      info.className = className;
      text(info, 'span', 'label', label);
      text(info, 'span', 'value', value);
      refs.deviceCapabilities?.appendChild(info);
    };
    const renderDiff = (diff) => {
      clear(refs.previewDiff);
      const count = diff.keys.length + diff.combos.length + diff.tapdance.length + diff.keyOverrides.length;
      if (!count) { text(refs.previewDiff, 'div', 'no-changes', 'No changes required. Keyboard is already up to date.'); return; }
      const pre = doc.createElement('pre');
      const section = (title, entries, format) => {
        if (!entries.length) return;
        text(pre, 'strong', '', `${title} (${entries.length} changes):`);
        pre.appendChild(doc.createTextNode('\n'));
        entries.forEach((entry) => {
          const line = format(entry);
          text(pre, 'span', 'diff-loc', `${line.location}:`);
          pre.appendChild(doc.createTextNode(` ${line.from} -> ${line.to}\n`));
        });
        pre.appendChild(doc.createTextNode('\n'));
      };
      section('Keys', diff.keys, (entry) => ({ location: entry.loc, from: keycodeToLabel(entry.from), to: keycodeToLabel(entry.to) }));
      section('Combos', diff.combos, (entry) => ({ location: `Slot ${entry.idx}`, from: entry.from, to: entry.to }));
      section('TapDance', diff.tapdance, (entry) => ({ location: `Slot ${entry.idx}`, from: entry.from, to: entry.to }));
      section('Key Overrides', diff.keyOverrides, (entry) => ({ location: `Slot ${entry.idx}`, from: entry.from, to: entry.to }));
      const details = doc.createElement('details');
      text(details, 'summary', 'diff-summary-sticky', `Detailed list (${count} changes) — click to expand/collapse`);
      details.appendChild(pre);
      refs.previewDiff?.appendChild(details);
    };

    async function refreshDevices() {
      empty('Searching for keyboards...');
      refs.onlineSyncPanel?.classList.add('hidden');
      refs.layoutVisualization?.classList.add('hidden');
      state.selectedDevice = null;
      state.geometry = null;
      try {
        const devices = await api.device.discover();
        if (!devices?.length) { empty('No Vial keyboards found.'); return; }
        clear(refs.deviceList);
        devices.sort((a, b) => (a.product_name || '').localeCompare(b.product_name || ''));
        devices.forEach((device) => {
          const card = doc.createElement('div');
          card.className = 'device-card';
          text(card, 'div', 'device-name', device.product_name || 'Unknown Keyboard');
          text(card, 'div', 'device-meta', `ID: ${device.vendor_id}:${device.product_id} | SN: ${device.serial_number || 'N/A'}`);
          card.addEventListener('click', () => selectDevice(device, card));
          refs.deviceList?.appendChild(card);
        });
      } catch (error) { empty(`Error during search: ${error.message}`); }
    }

    async function selectDevice(device, card) {
      state.selectedDevice = device;
      doc.querySelectorAll('.device-card').forEach((element) => element.classList.remove('selected'));
      card.classList.add('selected');
      refs.selectedDeviceName.textContent = device.product_name || 'Unknown Keyboard';
      refs.onlineSyncPanel?.classList.remove('hidden');
      refs.syncPreview?.classList.add('hidden');
      refs.runOnlineSyncBtn?.classList.add('hidden');
      refs.previewOnlineSyncBtn?.classList.remove('hidden');
      refs.layoutVisualization?.classList.add('hidden');
      clear(refs.deviceCapabilities);
      text(refs.deviceCapabilities, 'span', 'cap-tag supported', `Keys (${device.layers || 0} Layers)`);
      text(refs.deviceCapabilities, 'span', `cap-tag ${device.has_combos ? 'supported' : ''}`, 'Combos');
      text(refs.deviceCapabilities, 'span', `cap-tag ${device.has_tap_dance ? 'supported' : ''}`, 'TapDance');
      const combos = doc.getElementById('syncCombos');
      const tapDance = doc.getElementById('syncTapDance');
      if (combos) {
        combos.disabled = !device.has_combos;
        combos.checked = device.has_combos;
      }
      if (tapDance) {
        tapDance.disabled = !device.has_tap_dance;
        tapDance.checked = device.has_tap_dance;
      }
      try {
        refs.onlineStatus.textContent = 'Loading keyboard layout and options...';
        state.currentDeviceState = await api.device.snapshot(device.id);
        let layoutInfo = '';
        try {
          const raw = await api.device.layout(device.id);
          if (raw && String(raw).trim()) layoutInfo = String(raw).trim();
        } catch { /* optional diagnostic */ }
        const definition = await api.fetchKeyboardDefinition({
          vendorId: device.vendor_id,
          productId: device.product_id,
          serialNumber: device.serial_number || '',
        });
        if (definition?.ok && definition.definition?.layouts?.keymap) {
          const packed = presentation.resolvePackedLayoutOptions(state.currentDeviceState, definition.layoutOptionsPacked);
          state.geometry = presentation.prepare(definition.definition, packed);
          const debug = state.geometry
            ? presentation.formatLayoutOptionsDebug(state.geometry.labels, state.geometry.packedLayoutOptions, state.geometry.decodedLayoutOptions, state.geometry.layoutOptionsMap)
            : '';
          appendInfo('layout-options-info', 'Layout options (saved on keyboard):', state.geometry?.summary || 'Default');
          appendInfo('layout-options-info subtle', 'Layout debug:', debug);
          if (state.geometry?.fallbackApplied) {
            appendInfo(
              'layout-options-info subtle',
              'KLE:',
              'Using layout option 0 for each layout group (fallback — saved layout_options may not have matched this definition).',
            );
          }
        } else {
          appendInfo('layout-options-info warn', 'KLE geometry:', `${definition?.error || 'Keyboard definition unavailable'} — using matrix view.`);
        }
        if (layoutInfo) appendInfo('layout-options-info subtle', 'vitaly layout:', layoutInfo);
        renderLayout(state.currentDeviceState, refs.layoutGrid); refs.layoutVisualization?.classList.remove('hidden'); refs.onlineStatus.textContent = 'Ready for sync.';
      } catch (error) { refs.onlineStatus.textContent = `Error loading layout: ${error.message}`; }
    }

    async function preview() {
      if (!state.selectedDevice) return;
      refs.previewOnlineSyncBtn.disabled = true;
      refs.onlineStatus.textContent = 'Reading keyboard configuration...';
      refs.syncPreview?.classList.add('hidden');
      clear(refs.previewLayouts);
      try {
        state.currentDeviceState = await api.device.snapshot(state.selectedDevice.id);
        const config = mountOptions.session?.config || globalScope.KeymapSyncEditor?.configSession?.config;
        const transformation = await api.processConfig(state.currentDeviceState, config);
        state.targetDeviceState = transformation.state;
        (transformation.warnings || []).forEach((warning) => mountOptions.log?.(`Warning: untranslated symbol ${warning}\n`));
        const diff = calculateDiff(state.currentDeviceState, state.targetDeviceState, {
          getMatrixCell: presentation.getMatrixCell,
          keycodeToChar: keycodeToLabel,
        });
        renderDiff(diff);
        [...new Set(diff.keys.map((entry) => entry.layerIdx))]
          .sort((a, b) => a - b)
          .forEach((layer) => {
            const section = doc.createElement('div');
            section.className = 'preview-layer-section';
            text(section, 'h4', '', `Layer ${layer}`);
            const grid = doc.createElement('div');
            grid.className = 'layout-grid';
            renderLayout(state.currentDeviceState, grid, layer, state.targetDeviceState);
            section.appendChild(grid);
            refs.previewLayouts?.appendChild(section);
          });
        refs.syncPreview?.classList.remove('hidden');
        refs.runOnlineSyncBtn?.classList.remove('hidden');
        refs.onlineStatus.textContent = 'Preview ready.';
      } catch (error) { refs.onlineStatus.textContent = `Error: ${error.message}`; } finally { refs.previewOnlineSyncBtn.disabled = false; }
    }

    async function applyCurrent() {
      const config = mountOptions.session?.config || globalScope.KeymapSyncEditor?.configSession?.config;
      const result = await apply({ device: state.selectedDevice, previewTarget: state.targetDeviceState, config, documentLike: doc });
      if (result.ok) {
        refs.runOnlineSyncBtn?.classList.add('hidden');
        refs.syncPreview?.classList.add('hidden');
      }
    }
    async function backupCurrent() {
      const result = await backup({
        device: state.selectedDevice,
        state: state.currentDeviceState,
        suggestedName: `${state.selectedDevice?.product_name || 'keyboard'}_backup.vil`,
      });
      if (result.ok) refs.onlineStatus.textContent = 'Backup saved.';
    }
    refs.refreshDevicesBtn?.addEventListener('click', refreshDevices);
    refs.previewOnlineSyncBtn?.addEventListener('click', preview);
    refs.runOnlineSyncBtn?.addEventListener('click', applyCurrent);
    refs.downloadBackupBtn?.addEventListener('click', backupCurrent);
    return {
      refreshDevices,
      ensureDevices: () => state.selectedDevice ? Promise.resolve() : refreshDevices(),
      state,
    };
  }

  async function apply({ device, previewTarget, config, documentLike } = {}) {
    if (!device || !previewTarget || !config) return { ok: false, error: 'Preview is not ready.' };
    if (!confirmApply('Do you want to write these changes to the keyboard now?')) return { ok: false, cancelled: true };
    try {
      const current = await api.device.snapshot(device.id);
      const transformed = await api.processConfig(current, config);
      const sections = selectedSections(documentLike);
      const stale = sections.some(([section, enabled]) => (
        enabled && stringify(previewTarget[section]) !== stringify(transformed.state[section])
      ));
      if (stale) {
        status('The keyboard changed since the preview. Please preview again before applying.');
        return { ok: false, stale: true };
      }
      await api.device.apply(device.id, mergeSelected(current, transformed.state, sections));
      status('Sync completed successfully!');
      return { ok: true };
    } catch (error) {
      status(`Error writing: ${error.message || error}`);
      return { ok: false, error: error.message || String(error) };
    }
  }

  async function backup({ device, state, suggestedName } = {}) {
    if (!state) return { ok: false, error: 'Please load preview first to read configuration.' };
    try {
      const result = await api.saveVilBackup({
        suggestedName: suggestedName || `${device?.product_name || 'keyboard'}_backup.vil`,
        state,
      });
      if (!result) return { ok: false, cancelled: true };
      status('Backup saved.');
      return { ok: true };
    } catch (error) {
      status(`Error saving backup: ${error.message || error}`);
      return { ok: false, error: error.message || String(error) };
    }
  }

  return { calculateDiff, selectedSections, mergeSelected, apply, backup, mount };
});
