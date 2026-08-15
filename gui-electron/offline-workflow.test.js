const assert = require('assert');
const createOfflineWorkflow = require('./offline-workflow');

(async () => {
  const elements = new Map();
  for (const id of [
    'inputPath', 'outputPath', 'inputPathLabel', 'outputPathLabel',
    'pickInput', 'pickOutput', 'runOfflineSyncBtn',
  ]) {
    elements.set(id, {
      value: '',
      textContent: '',
      disabled: false,
      addEventListener() {},
    });
  }
  const documentLike = { getElementById: (id) => elements.get(id) || null };
  let generatorOptions;
  const api = {
    getDefaults: async () => ({
      config: { id: 'default-config', kind: 'config', displayPath: '/config.json' },
      input: { id: 'input', kind: 'input', displayPath: '/input' },
      output: { id: 'output', kind: 'output', displayPath: '/output' },
    }),
    runGenerator: async (options) => {
      generatorOptions = options;
      return { code: 0 };
    },
  };
  const session = {
    grant: { id: 'active-config', kind: 'config', displayPath: '/active.json' },
    save: async () => ({ ok: true }),
  };
  const workflow = createOfflineWorkflow({ api, session });
  const mounted = await workflow.mount({ documentLike });
  const result = await mounted.run();

  assert.strictEqual(result.code, 0);
  assert.deepStrictEqual(generatorOptions, {
    configGrant: session.grant,
    inputGrant: { id: 'input', kind: 'input', displayPath: '/input' },
    outputGrant: { id: 'output', kind: 'output', displayPath: '/output' },
  });
  assert.strictEqual(elements.get('inputPath').value, '/input');
  assert.strictEqual(elements.get('outputPath').value, '/output');
  console.log('Offline workflow tests passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
