const assert = require('assert');
const { loadGeneratorConfig } = require('./workflow-utils');
const validConfig = {
  mappingsVersion: 1,
  target: { language: 'en', os: 'mac' },
  layers: { alpha: 0, symbol: 1, number: 2 },
  alphaMappings: { A: { layer1: '!', layer2: '1', base: null, aliases: [] } },
  comboOverrides: [],
  tapDanceOverrides: [],
  keyOverrideOverrides: [],
};

function runTests() {
  const files = new Map([['/selected.json', JSON.stringify(validConfig)]]);
  const fs = {
    existsSync: (filePath) => files.has(filePath),
    statSync: () => ({ isFile: () => true }),
    readFileSync: (filePath) => files.get(filePath),
  };

  assert.deepStrictEqual(loadGeneratorConfig('/selected.json', { fs }), validConfig);
  assert.throws(() => loadGeneratorConfig('/missing.json', { fs }), /Config not found/);
  files.set('/bad.json', '{');
  assert.throws(() => loadGeneratorConfig('/bad.json', { fs }), /Invalid configuration/);
  console.log('Workflow utility tests passed.');
}

if (require.main === module) runTests();

module.exports = { runTests };
