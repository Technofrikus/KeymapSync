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

let defaults = null;
let currentConfigPath = null;
let configObj = null;
let currentLayout = localStorage.getItem('keymapsync-layout') || 'qwerty';

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
    tapdanceList.innerHTML = '<li>Keine Tap-Dance-Einträge vorhanden.</li>';
    return;
  }
  list.forEach((td, idx) => {
    const li = document.createElement('li');
    const name = td.name || `TD${idx + 1}`;
    const tap = td.tap || '';
    const hold = td.hold || '';
    li.textContent = `${name}: tap = ${tap}  |  hold = ${hold}`;
    tapdanceList.appendChild(li);
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
    });
    const baseAdd = document.createElement('button');
    baseAdd.type = 'button';
    baseAdd.className = 'tiny-button';
    baseAdd.textContent = '+';
    baseAdd.title = 'Tap-Dance wählen';
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
    setStatus(configStatus, 'Config loaded');
  } catch (err) {
    setStatus(configStatus, `Error loading config: ${err.message}`);
  }
}

async function saveConfigToFile() {
  try {
    const content = JSON.stringify(configObj, null, 2);
    await window.api.saveAlpha(currentConfigPath, content);
    setStatus(configStatus, 'Config saved');
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
syncBtn.addEventListener('click', runGenerator);
settingsBtn.addEventListener('click', () => toggleDrawer(true));
closeDrawer.addEventListener('click', () => toggleDrawer(false));
toggleHelp.addEventListener('click', () => {
  helpPanel.classList.toggle('collapsed');
  gridAndHelp.classList.toggle('collapsed', helpPanel.classList.contains('collapsed'));
  toggleHelp.textContent = helpPanel.classList.contains('collapsed') ? '▸ Hilfe' : '▾ Hilfe';
});

if (layoutSelect) {
  layoutSelect.value = currentLayout;
  layoutSelect.addEventListener('change', (e) => {
    currentLayout = e.target.value;
    localStorage.setItem('keymapsync-layout', currentLayout);
    renderGrid();
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

initDefaults();

