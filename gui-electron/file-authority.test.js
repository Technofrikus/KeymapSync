'use strict';

const assert = require('assert');
const { createFileAuthority, FileAuthorityError } = require('./file-authority.js');

function expectCode(action, code) {
  assert.throws(action, (error) => error instanceof FileAuthorityError && error.code === code);
}

const authority = createFileAuthority({
  randomBytes: () => Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef', 'hex'),
});

const config = authority.register('./fixtures/../alpha_layers.json', {
  owner: { id: 11 },
  kind: 'config',
  operations: ['read', 'write'],
});
assert.equal(config.kind, 'config');
assert.equal(config.displayPath, require('path').resolve('alpha_layers.json'));
assert.ok(config.id);
assert.deepEqual(Object.keys(config).sort(), ['displayPath', 'id', 'kind']);

assert.equal(authority.resolve(config.id, { owner: 11, kind: 'config', operation: 'read' }).path, config.displayPath);
assert.equal(authority.resolve(config, { owner: 11, kind: 'config', operation: 'write' }).path, config.displayPath);
expectCode(() => authority.resolve(config.id, { owner: 12 }), 'WRONG_OWNER');
expectCode(() => authority.resolve(config.id, { owner: 11, kind: 'output' }), 'WRONG_KIND');
expectCode(() => authority.resolve(config.id, { owner: 11, operation: 'execute' }), 'WRONG_OPERATION');

const input = authority.register('/tmp/keysync-input', { owner: 11, kind: 'input', operations: ['read'] });
expectCode(() => authority.resolve(input.id, { owner: 11, operation: 'write' }), 'WRONG_OPERATION');
authority.revokeOwner(11);
expectCode(() => authority.resolve(config.id, { owner: 11 }), 'UNKNOWN_GRANT');
expectCode(() => authority.resolve(input.id, { owner: 11 }), 'UNKNOWN_GRANT');

console.log('file-authority tests passed');
