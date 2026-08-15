'use strict';

const crypto = require('crypto');
const defaultFs = require('fs');
const defaultPath = require('path');

const KINDS = new Set(['config', 'input', 'output', 'backup']);
const OPERATIONS = new Set(['read', 'write']);

class FileAuthorityError extends Error {
  constructor(message, code = 'FILE_AUTHORITY_DENIED') {
    super(message);
    this.name = 'FileAuthorityError';
    this.code = code;
  }
}

function ownerId(owner) {
  if (owner === undefined || owner === null) throw new FileAuthorityError('An IPC owner is required.');
  if (typeof owner === 'object' && owner.id !== undefined) return String(owner.id);
  return String(owner);
}

/**
 * Capability registry for paths selected by the user in the main process.
 * The renderer receives only the opaque id and a display label. Paths are
 * never looked up from renderer-provided strings after registration.
 */
function createFileAuthority({ fs = defaultFs, path = defaultPath, randomBytes = crypto.randomBytes } = {}) {
  const grants = new Map();

  function canonicalPath(candidate) {
    if (typeof candidate !== 'string' || !candidate.trim()) {
      throw new FileAuthorityError('A non-empty path is required.', 'INVALID_PATH');
    }
    const absolute = path.resolve(candidate);
    try {
      if (typeof fs.realpathSync?.native === 'function') return fs.realpathSync.native(absolute);
      if (typeof fs.realpathSync === 'function') return fs.realpathSync(absolute);
    } catch {
      // A save target may not exist yet. Canonicalize its existing parent.
      try {
        const parent = path.dirname(absolute);
        const canonicalParent = fs.realpathSync?.native?.(parent) || fs.realpathSync?.(parent);
        if (canonicalParent) return path.join(canonicalParent, path.basename(absolute));
      } catch {
        // Keep the absolute path when a test/fake filesystem has no realpath.
      }
    }
    return absolute;
  }

  function token() {
    // Include enough entropy that a renderer cannot feasibly guess a grant.
    return randomBytes(24).toString('hex');
  }

  function register(candidate, { owner, kind, operations = ['read'] } = {}) {
    if (!KINDS.has(kind)) throw new FileAuthorityError(`Unsupported grant kind: ${kind}`, 'INVALID_KIND');
    const permitted = [...new Set(operations)];
    if (!permitted.length || permitted.some((op) => !OPERATIONS.has(op))) {
      throw new FileAuthorityError('A grant has invalid operations.', 'INVALID_OPERATION');
    }
    const id = token();
    const grant = {
      id,
      path: canonicalPath(candidate),
      kind,
      owner: ownerId(owner),
      operations: new Set(permitted),
    };
    grants.set(id, grant);
    return publicGrant(grant);
  }

  function publicGrant(grant) {
    return { id: grant.id, displayPath: grant.path, kind: grant.kind };
  }

  function resolve(idOrGrant, { owner, kind, operation } = {}) {
    const id = typeof idOrGrant === 'string' ? idOrGrant : idOrGrant?.id;
    if (typeof id !== 'string' || !id) throw new FileAuthorityError('A valid grant is required.', 'INVALID_GRANT');
    const grant = grants.get(id);
    if (!grant) throw new FileAuthorityError('The file grant is unknown or expired.', 'UNKNOWN_GRANT');
    if (grant.owner !== ownerId(owner)) throw new FileAuthorityError('The file grant belongs to another window.', 'WRONG_OWNER');
    if (kind && grant.kind !== kind) throw new FileAuthorityError(`Expected a ${kind} grant.`, 'WRONG_KIND');
    if (operation && !grant.operations.has(operation)) throw new FileAuthorityError(`Grant does not permit ${operation}.`, 'WRONG_OPERATION');
    // A path can be replaced by a symlink after the dialog closes. Re-check
    // the canonical location at each use so a capability cannot be retargeted
    // behind the renderer's back.
    if (canonicalPath(grant.path) !== grant.path) {
      throw new FileAuthorityError('The selected path changed and must be selected again.', 'PATH_CHANGED');
    }
    return { ...grant, operations: new Set(grant.operations) };
  }

  function revokeOwner(owner) {
    const id = ownerId(owner);
    for (const [grantId, grant] of grants) if (grant.owner === id) grants.delete(grantId);
  }

  function revoke(idOrGrant, owner) {
    const grant = resolve(idOrGrant, { owner });
    grants.delete(grant.id);
  }

  return {
    register,
    resolve,
    revoke,
    revokeOwner,
    publicGrant,
    size: () => grants.size,
    // Exported for focused unit tests without exposing paths to the renderer.
    _canonicalPath: canonicalPath,
  };
}

module.exports = { createFileAuthority, FileAuthorityError, KINDS, OPERATIONS };
