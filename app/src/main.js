/* App composition root: wires the editor and online workflows to the
 * platform shell and owns view navigation. */
import platform from './platform/index.js';
import { editor } from './ui/editor-workflow.js';
import createOnlineWorkflow from './ui/online-workflow.js';

const logOutput = document.getElementById('logOutput');
const appendLog = (message) => { if (logOutput) { logOutput.textContent += message; logOutput.scrollTop = logOutput.scrollHeight; } };
const online = createOnlineWorkflow({
  api: platform,
  status: (message) => { const element = document.getElementById('onlineStatus'); if (element) element.textContent = message; },
  confirm: (message) => window.confirm(message),
}).mount({ session: editor.configSession, documentLike: document, log: appendLog, keycodeToChar: editor.keycodeToChar });
const views = {
  keymap: document.getElementById('keymapView'),
  online: document.getElementById('onlineView'),
};
const buttons = {
  keymap: document.getElementById('viewKeymapBtn'),
  online: document.getElementById('viewOnlineBtn'),
};

function switchView(viewId) {
  Object.entries(views).forEach(([id, view]) => view?.classList.toggle('visible', id === viewId));
  Object.entries(buttons).forEach(([id, button]) => button?.classList.toggle('active', id === viewId));
  if (viewId === 'online') {
    online.ensureDevices();
  }
}

Object.entries(buttons).forEach(([id, button]) => button?.addEventListener('click', () => switchView(id)));
window.KeymapSyncRenderer = { switchView };
