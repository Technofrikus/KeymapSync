import assert from 'node:assert';
import createOnlineWorkflow from '../src/ui/online-workflow.js';

(async () => {
  const workflow = createOnlineWorkflow({ presentation: {} });
  assert.doesNotThrow(() => workflow.mount({
    documentLike: { getElementById: () => null },
  }));
  let discoveryCalls = 0;
  const mounted = createOnlineWorkflow({
    api: { device: { discover: async () => { discoveryCalls += 1; return []; } } },
    presentation: {},
  }).mount({ documentLike: { getElementById: () => null } });
  await mounted.ensureDevices();
  assert.strictEqual(discoveryCalls, 1);
  const diff = workflow.calculateDiff(
    { layout: [[['KC_A']]], key_override: [{ trigger: 'KC_A' }] },
    { layout: [[['KC_B']]], key_override: [{ trigger: 'KC_B' }] },
    { getMatrixCell: (row, index) => row[index], keycodeToChar: (key) => key },
  );
  assert.strictEqual(diff.keys.length, 1);
  assert.strictEqual(diff.keyOverrides.length, 1);
  assert.deepStrictEqual(
    workflow.mergeSelected({ layout: ['old'], key_override: ['old'] }, { layout: ['new'], key_override: ['new'] }, [['layout', false], ['key_override', true]]),
    { layout: ['old'], key_override: ['new'] },
  );

  let applied;
  const documentLike = {
    getElementById: (id) => ({
      syncBaseKeys: false,
      syncCombos: false,
      syncTapDance: false,
      syncKeyOverrides: true,
    })[id] === undefined ? null : { checked: ({
      syncBaseKeys: false,
      syncCombos: false,
      syncTapDance: false,
      syncKeyOverrides: true,
    })[id] },
  };
  const applyWorkflow = createOnlineWorkflow({
    api: {
      device: {
        snapshot: async () => ({ layout: ['live'], combo: ['keep'], key_override: ['old'] }),
        apply: async (_id, state) => { applied = state; },
      },
    },
    transform: () => ({ state: { layout: ['new-layout'], combo: ['changed'], key_override: ['new'] } }),
    confirm: () => true,
  });
  const applyResult = await applyWorkflow.apply({
    device: { id: 1 },
    previewTarget: { layout: ['new-layout'], combo: ['changed'], key_override: ['new'] },
    config: { valid: true },
    documentLike,
  });
  assert.strictEqual(applyResult.ok, true);
  assert.deepStrictEqual(applied, { layout: ['live'], combo: ['keep'], key_override: ['new'] });

  const staleWorkflow = createOnlineWorkflow({
    api: {
      device: { snapshot: async () => ({ layout: ['live'] }), apply: async () => assert.fail('stale preview must not apply') },
    },
    transform: () => ({ state: { layout: ['fresh-target'] } }),
    confirm: () => true,
  });
  const staleDocument = { getElementById: (id) => id === 'syncBaseKeys' ? { checked: true } : { checked: false } };
  const staleResult = await staleWorkflow.apply({
    device: { id: 1 },
    previewTarget: { layout: ['old-target'] },
    config: { valid: true },
    documentLike: staleDocument,
  });
  assert.strictEqual(staleResult.stale, true);

  // A locked keyboard (web shell) is unlocked by holding keys, then the write is retried.
  const lockedCalls = [];
  const messages = [];
  let lockedOnce = true;
  const lockedWorkflow = createOnlineWorkflow({
    api: {
      device: {
        snapshot: async () => ({ layout: [[['KC_ESC', 'KC_A']]] }),
        apply: async () => {
          lockedCalls.push('apply');
          if (lockedOnce) { lockedOnce = false; throw Object.assign(new Error('locked'), { code: 'LOCKED' }); }
        },
        lockStatus: async () => ({ locked: true, unlockKeys: [[0, 0], [0, 1]] }),
        lock: async (_id, locked, { onProgress }) => { lockedCalls.push(`lock:${locked}`); onProgress({ remaining: 3 }); },
      },
    },
    transform: () => ({ state: { layout: [[['KC_ESC', 'KC_A']]] } }), // previews show canonical names
    confirm: (message) => { messages.push(message); return true; },
    status: (message) => messages.push(message),
  });
  const lockedResult = await lockedWorkflow.apply({
    device: { id: 1 },
    previewTarget: { layout: [[['KC_ESCAPE', 'KC_A']]] },
    config: { valid: true },
    documentLike: staleDocument,
  });
  assert.strictEqual(lockedResult.ok, true);
  assert.deepStrictEqual(lockedCalls, ['apply', 'lock:false', 'apply']);
  assert.ok(messages.some((message) => message.includes('hold KC_ESC + KC_A')));
  assert.ok(messages.includes('Hold KC_ESC + KC_A… 3'));

  console.log('Online workflow tests passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
