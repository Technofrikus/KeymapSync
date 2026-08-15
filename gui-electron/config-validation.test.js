const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  ConfigValidationError,
  validateConfig,
  parseConfig,
  assertValidConfig,
  validKeycode,
} = require('./config-validation');

const checkedInConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'alpha_layers.json'), 'utf8'));

function validConfig() {
  return {
    mappingsVersion: 1,
    target: { language: 'en', os: 'mac' },
    layers: { alpha: 0, symbol: 1, number: 2 },
    alphaMappings: {
      A: { layer1: '!', layer2: '1', base: null, aliases: [] },
    },
    comboOverrides: [],
    tapDanceOverrides: [],
    keyOverrideOverrides: [],
  };
}

function invalidIssue(config, pathName) {
  const result = validateConfig(config);
  assert.strictEqual(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.path === pathName), `${pathName} was not reported: ${JSON.stringify(result.issues)}`);
}

function runTests() {
  assert.strictEqual(validateConfig(checkedInConfig).valid, true);
  assert.strictEqual(validateConfig(validConfig()).valid, true);

  invalidIssue({ ...validConfig(), target: { language: 'xx', os: 'mac' } }, 'target.language');
  invalidIssue({ ...validConfig(), layers: { alpha: 0, symbol: 0, number: 2 } }, 'layers');
  invalidIssue({ ...validConfig(), alphaMappings: { A: { layer1: 'not-a-keycode', aliases: [] } } }, 'alphaMappings.A.layer1');
  invalidIssue({ ...validConfig(), comboOverrides: [{ keys: ['KC_A', 'KC_A', 'KC_A', 'KC_A', 'KC_A'], result: 'KC_B' }] }, 'comboOverrides[0].keys');
  invalidIssue({ ...validConfig(), tapDanceOverrides: [{ name: 'bad-name', tap: 'KC_A', hold: 'KC_B' }] }, 'tapDanceOverrides[0].name');
  invalidIssue({ ...validConfig(), keyOverrideOverrides: [{ trigger: 'KC_A', replacement: 'KC_B', mods: 'MOD_MASK_SHIFT' }] }, 'keyOverrideOverrides[0].mods');
  invalidIssue({ ...validConfig(), unknown: true }, 'unknown');

  const duplicate = validConfig();
  duplicate.tapDanceOverrides = [
    { name: 'A_DANCE', tap: 'KC_A', hold: 'KC_B' },
    { name: 'A_DANCE', tap: 'KC_C', hold: 'KC_D' },
  ];
  invalidIssue(duplicate, 'tapDanceOverrides[1].name');

  const unresolved = validConfig();
  unresolved.alphaMappings.A.base = 'TD(MISSING)';
  invalidIssue(unresolved, 'alphaMappings.A.base');

  const unresolvedWithoutOverrides = validConfig();
  delete unresolvedWithoutOverrides.tapDanceOverrides;
  unresolvedWithoutOverrides.alphaMappings.A.base = 'TD(MISSING)';
  invalidIssue(unresolvedWithoutOverrides, 'alphaMappings.A.base');

  const withKeyOverride = validConfig();
  withKeyOverride.keyOverrideOverrides = [{
    trigger: 'KC_Q',
    replacement: 'LALT(KC_BSPC)',
    layers: 65535,
    trigger_mods: 8,
    negative_mod_mask: 0,
    suppressed_mods: 0,
    options: 135,
  }];
  assert.strictEqual(validateConfig(withKeyOverride).valid, true);

  const withUnusedTapDanceActions = validConfig();
  withUnusedTapDanceActions.tapDanceOverrides = [{
    name: 'A_DANCE',
    tap: 'KC_A',
    hold: 'KC_B',
    doubleTap: '',
    tapHold: '',
  }];
  assert.strictEqual(validateConfig(withUnusedTapDanceActions).valid, true);

  assert.strictEqual(validKeycode('KC_Q'), true);
  assert.strictEqual(validKeycode('TD(H_GUIH)'), true);
  assert.strictEqual(validKeycode('MOD_MASK_SHIFT'), false);
  assert.strictEqual(validKeycode('not a keycode'), false);

  assert.deepStrictEqual(parseConfig(JSON.stringify(validConfig()), 'test.json'), validConfig());
  assert.throws(() => parseConfig('{', 'broken.json'), (error) => error instanceof ConfigValidationError && error.source === 'broken.json');
  assert.throws(() => assertValidConfig({}), (error) => error instanceof ConfigValidationError && error.issues.length > 0);
  console.log('Config validation tests passed.');
}

if (require.main === module) runTests();

module.exports = { runTests };
