const assert = require('assert');
const createConfigSession = require('./config-session');

(async () => {
  const calls = [];
  let chooseResult = { grant: { id: 'b', displayPath: '/b', kind: 'config' }, config: { value: 2 } };
  const api = {
    setUnsavedChanges: (value) => calls.push(['dirty', value]),
    chooseConfig: async () => {
      if (chooseResult instanceof Error) throw chooseResult;
      return chooseResult;
    },
    saveConfig: async (id, config) => calls.push(['save', id, config]),
  };
  const session = createConfigSession({ api, confirm: () => false });
  session.replace({ value: 1 }, { id: 'a', displayPath: '/a', kind: 'config' });
  session.config.value = 3;
  session.markChanged();
  assert.strictEqual(session.dirty, true);
  assert.strictEqual((await session.chooseConfig()).cancelled, true);
  assert.strictEqual((await session.save()).ok, true);
  assert.deepStrictEqual(calls.find((call) => call[0] === 'save'), ['save', 'a', { value: 3 }]);

  await session.chooseConfig();
  assert.strictEqual(session.grant.id, 'b');
  assert.deepStrictEqual(session.config, { value: 2 });

  chooseResult = null;
  const cancelled = await session.chooseConfig();
  assert.strictEqual(cancelled.cancelled, true);
  assert.strictEqual(session.grant.id, 'b');

  chooseResult = new Error('could not parse selected config');
  await assert.rejects(() => session.chooseConfig(), /could not parse/);
  assert.strictEqual(session.grant.id, 'b');
  assert.deepStrictEqual(session.config, { value: 2 });
  console.log('Config session tests passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
