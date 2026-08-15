const assert = require('assert');

require('./kle-parser');
require('./kle-layout');
const presentation = require('./keymap-presentation');

function runTests() {
  assert.strictEqual(
    presentation.resolvePackedLayoutOptions({ layout_options: 6 }, 3),
    6,
  );
  assert.strictEqual(
    presentation.resolvePackedLayoutOptions({}, 3),
    3,
  );
  assert.strictEqual(presentation.getMatrixCell([null, 'KC_A'], 0), 'KC_TRNS');
  assert.strictEqual(presentation.getMatrixCell([null, 'KC_A'], 1), 'KC_A');

  const geometry = presentation.prepare(
    { layouts: { keymap: [['0,0', '0,1']], labels: [] } },
    0,
  );
  assert.strictEqual(geometry.keys.length, 2);
  assert.strictEqual(geometry.summary, 'raw 0');
  assert.strictEqual(presentation.prepare(null, 0), null);

  console.log('Keymap presentation tests passed.');
}

if (require.main === module) runTests();

module.exports = { runTests };
