/*
 * Renderer-side configuration state machine.
 *
 * The session deliberately stores a grant id, never a filesystem path.  This
 * makes the editor independent of the IPC authority implementation and keeps
 * selecting a file and loading its contents one atomic transition.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.KeymapSyncConfigSession = factory;
})(typeof window !== 'undefined' ? window : globalThis, function createConfigSession(options = {}) {
  const api = options.api || (typeof window !== 'undefined' ? window.api : null);
  const onChange = options.onChange || (() => {});
  const onStatus = options.onStatus || (() => {});
  const ask = options.confirm || ((message) => typeof window !== 'undefined' ? window.confirm(message) : true);

  let config = null;
  let grant = null;
  let savedSnapshot = null;
  let dirty = false;

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const snapshot = (value) => JSON.stringify(value, null, 2);

  function setState(nextConfig, nextGrant, markClean = true) {
    config = nextConfig;
    grant = nextGrant || null;
    savedSnapshot = markClean ? snapshot(config) : savedSnapshot;
    dirty = markClean ? false : snapshot(config) !== savedSnapshot;
    if (api?.setUnsavedChanges) api.setUnsavedChanges(dirty);
    onChange(getState());
  }

  async function loadResponse(response, fallbackGrant = null) {
    if (!response) throw new Error('No configuration was returned.');
    const nextGrant = response.grant || response.configGrant || fallbackGrant;
    let nextConfig = response.config;
    if (nextConfig == null && response.content != null) {
      nextConfig = typeof response.content === 'string' ? JSON.parse(response.content) : response.content;
    }
    if (nextConfig == null) throw new Error('Configuration contents are missing.');
    setState(nextConfig, nextGrant, true);
    return getState();
  }

  async function init(defaults = null) {
    const source = defaults || await api.getDefaults();
    const defaultGrant = source.configGrant || source.config || source.grant;
    if (source.config && typeof source.config === 'object' && source.configGrant) {
      return loadResponse({ grant: source.configGrant, config: source.config });
    }
    if (source.configContent != null) return loadResponse({ grant: defaultGrant, content: source.configContent });
    if (api.loadConfig && defaultGrant?.id) return loadResponse(await api.loadConfig(defaultGrant.id), defaultGrant);
    throw new Error('The default configuration could not be loaded.');
  }

  async function chooseConfig() {
    if (dirty && !ask('The current configuration has unsaved changes. Discard them and open another file?')) {
      return { cancelled: true, ...getState() };
    }
    const response = await api.chooseConfig();
    if (!response) return { cancelled: true, ...getState() };
    return loadResponse(response);
  }

  async function reload() {
    if (!grant) throw new Error('No configuration is loaded.');
    if (dirty && !ask('The current configuration has unsaved changes. Discard them and reload?')) {
      return { cancelled: true, ...getState() };
    }
    return loadResponse(await api.loadConfig(grant.id), grant);
  }

  function markChanged() {
    dirty = snapshot(config) !== savedSnapshot;
    if (api?.setUnsavedChanges) api.setUnsavedChanges(dirty);
    onChange(getState());
    return dirty;
  }

  async function save() {
    if (!config || !grant?.id) return { ok: false, error: 'No configuration is loaded.' };
    try {
      await api.saveConfig(grant.id, clone(config));
      savedSnapshot = snapshot(config);
      dirty = false;
      if (api?.setUnsavedChanges) api.setUnsavedChanges(false);
      onChange(getState());
      onStatus('Config saved');
      return { ok: true };
    } catch (error) {
      onStatus(`Error saving: ${error.message || error}`);
      return { ok: false, error: error.message || String(error) };
    }
  }

  function getState() {
    return { config, grant, dirty, savedSnapshot };
  }

  return {
    init, chooseConfig, reload, save, markChanged, getState,
    get config() { return config; },
    get grant() { return grant; },
    get dirty() { return dirty; },
    replace: setState,
  };
});
