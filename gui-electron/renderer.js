/* Renderer composition root.
 * Workflow modules are loaded as browser globals by index.html.  This file
 * owns only view navigation and shared lifecycle wiring. */
(function () {
  const editor = window.KeymapSyncEditor;
  const offlineStatus = document.getElementById('offlineStatus');
  const logOutput = document.getElementById('logOutput');
  const setOfflineStatus = (message) => { if (offlineStatus) offlineStatus.textContent = message; };
  const appendLog = (message) => { if (logOutput) { logOutput.textContent += message; logOutput.scrollTop = logOutput.scrollHeight; } };
  const offline = window.KeymapSyncOfflineWorkflow?.({
    api: window.api,
    session: editor?.configSession,
    status: setOfflineStatus,
    log: appendLog,
  });
  const online = window.KeymapSyncOnlineWorkflow?.({
    api: window.api,
    session: editor?.configSession,
    status: (message) => { const element = document.getElementById('onlineStatus'); if (element) element.textContent = message; },
    confirm: (message) => window.confirm(message),
    log: appendLog,
  })?.mount({ session: editor?.configSession, documentLike: document, log: appendLog });
  offline?.mount({ documentLike: document });
  const views = {
    keymap: document.getElementById('keymapView'),
    offline: document.getElementById('offlineView'),
    online: document.getElementById('onlineView'),
  };
  const buttons = {
    keymap: document.getElementById('viewKeymapBtn'),
    offline: document.getElementById('viewOfflineBtn'),
    online: document.getElementById('viewOnlineBtn'),
  };

  function switchView(viewId) {
    Object.entries(views).forEach(([id, view]) => view?.classList.toggle('visible', id === viewId));
    Object.entries(buttons).forEach(([id, button]) => button?.classList.toggle('active', id === viewId));
    if (viewId === 'online') {
      online?.ensureDevices?.();
    }
  }

  Object.entries(buttons).forEach(([id, button]) => button?.addEventListener('click', () => switchView(id)));
  window.KeymapSyncRenderer = { switchView };
})();
