const assert = require('assert');
const { loadGeneratorConfig } = require('./workflow-utils');

function runTests() {
  const files = new Map([['/selected.json', '{"target":"US"}']]);
  const fs = {
    existsSync: (filePath) => files.has(filePath),
    statSync: () => ({ isFile: () => true }),
    readFileSync: (filePath) => files.get(filePath),
  };

  assert.deepStrictEqual(loadGeneratorConfig('/selected.json', { fs }), { target: 'US' });
  assert.throws(() => loadGeneratorConfig('/missing.json', { fs }), /Config not found/);
  files.set('/bad.json', '{');
  assert.throws(() => loadGeneratorConfig('/bad.json', { fs }), /Could not read config/);
  console.log('Workflow utility tests passed.');
}

if (require.main === module) runTests();

module.exports = { runTests };
