import {
  capabilityTokenAllows,
  createCapabilityToken,
  verifyCapabilityTokenTime,
} from '../../../src/runtime/capabilities/index.js';
import {
  createResourceRef,
} from '../../../src/runtime/effects/index.js';

import type { CapabilityScope } from '../../../src/runtime/capabilities/index.js';

describe('CapabilityToken contracts', () => {
  const workspaceReadScope: CapabilityScope = {
    resourceKind: 'workspace',
    operations: ['read'],
    uriPrefix: 'src/',
  };

  it('validates token expiry and scoped resource access', () => {
    const token = createCapabilityToken({
      tokenId: 'cap-1',
      subject: 'run-1',
      scopes: [workspaceReadScope],
      issuedAt: '2026-05-22T12:00:00.000Z',
      expiresAt: '2026-05-22T12:05:00.000Z',
    });

    expect(verifyCapabilityTokenTime(token, new Date('2026-05-22T12:01:00.000Z')))
      .toEqual({ ok: true, reason: 'capability-token-time-valid' });
    expect(capabilityTokenAllows(
      token,
      'read',
      createResourceRef({ kind: 'workspace', uri: 'src/runtime/agent.ts' }),
    )).toBe(true);
    expect(capabilityTokenAllows(
      token,
      'write',
      createResourceRef({ kind: 'workspace', uri: 'src/runtime/agent.ts' }),
    )).toBe(false);
    expect(capabilityTokenAllows(
      token,
      'read',
      createResourceRef({ kind: 'workspace', uri: 'docs/security.md' }),
    )).toBe(false);
  });

  it('rejects expired capability tokens', () => {
    const token = createCapabilityToken({
      tokenId: 'cap-2',
      subject: 'run-2',
      scopes: [workspaceReadScope],
      issuedAt: '2026-05-22T12:00:00.000Z',
      expiresAt: '2026-05-22T12:00:30.000Z',
    });

    expect(verifyCapabilityTokenTime(token, new Date('2026-05-22T12:01:00.000Z')))
      .toEqual({ ok: false, reason: 'capability-token-expired' });
  });
});
