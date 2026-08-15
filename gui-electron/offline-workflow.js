/* Offline generation workflow.  UI code supplies the path/grant controls and
 * the configuration session; this module owns sequencing and failure state. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.KeymapSyncOfflineWorkflow = factory;
})(typeof window !== 'undefined' ? window : globalThis, function createOfflineWorkflow(options = {}) {
  const api = options.api || (typeof window !== 'undefined' ? window.api : null);
  const session = options.session;
  const status = options.status || (() => {});
  const log = options.log || (() => {});
  let inputGrant = null;
  let outputGrant = null;

  async function run() {
    if (!session) throw new Error('Offline workflow requires a config session.');
    const saveResult = await session.save();
    if (!saveResult.ok) throw new Error(saveResult.error || 'Configuration was not saved.');
    const opts = {
      configGrant: session.grant,
      inputGrant,
      outputGrant,
    };
    if (!opts.configGrant?.id || !opts.inputGrant?.id || !opts.outputGrant?.id) {
      throw new Error('Choose a configuration, input directory, and output directory first.');
    }
    status('Sync in progress...');
    log(`\n--- Offline Sync started ${new Date().toLocaleString()} ---\n`);
    try {
      const result = await api.runGenerator(opts);
      status(`Finished (Exit Code: ${result.code})`);
      log(`Generator finished with code ${result.code}\n`);
      return result;
    } catch (error) {
      status(`Error: ${error.message || error}`);
      log(`Error: ${error.message || error}\n`);
      throw error;
    }
  }

  async function mount(options = {}) {
    const doc = options.documentLike || document;
    const inputPath = doc.getElementById('inputPath');
    const outputPath = doc.getElementById('outputPath');
    const inputLabel = doc.getElementById('inputPathLabel');
    const outputLabel = doc.getElementById('outputPathLabel');
    const display = (grant) => grant?.displayPath || '';
    try {
      const defaults = await api.getDefaults();
      inputGrant = defaults.inputGrant || defaults.input;
      outputGrant = defaults.outputGrant || defaults.output;
      inputPath.value = display(inputGrant);
      outputPath.value = display(outputGrant);
      if (inputLabel) inputLabel.textContent = inputPath.value;
      if (outputLabel) outputLabel.textContent = outputPath.value;
    } catch (error) { log(`Offline defaults error: ${error.message}\n`); }
    const choose = async (kind, current, input, label) => {
      const chosen = await api.chooseDirectory(kind, current?.id);
      if (!chosen) return;
      const grant = chosen.grant || chosen;
      if (kind === 'input') inputGrant = grant;
      else outputGrant = grant;
      input.value = display(grant);
      if (label) label.textContent = input.value;
    };
    doc.getElementById('pickInput')?.addEventListener('click', () => choose('input', inputGrant, inputPath, inputLabel));
    doc.getElementById('pickOutput')?.addEventListener('click', () => choose('output', outputGrant, outputPath, outputLabel));
    const button = doc.getElementById('runOfflineSyncBtn');
    button?.addEventListener('click', async () => {
      button.disabled = true;
      try { await run(); }
      catch (error) { status(`Error: ${error.message}`); log(`Error: ${error.message}\n`); }
      finally { button.disabled = false; }
    });
    return { run };
  }

  return { run, mount };
});
