import {
  createWave1HandshakeFixtures,
  normalizeWave1GatewayHandshake,
} from '../../../src/runtime/external-agents/index.js';

describe('Wave 1 gateway handshake trust fixture parity', () => {
  it('downgrades source connect token and role evidence to Zavorth health metadata only', () => {
    const [ownerHandshake] = createWave1HandshakeFixtures();
    const normalized = normalizeWave1GatewayHandshake(ownerHandshake);

    expect(normalized.trust).toEqual({
      authority: 'zavorth',
      sourceTokenAuthority: false,
      tokenEvidence: 'present-redacted',
      acceptedScopes: ['gateway:read', 'sessions:read'],
      downgradedScopes: [],
      sourceRoleEvidence: 'owner',
    });
    expect(normalized.health.status).toBe('ready');
    expect(normalized.descriptor.boundary).toEqual(expect.objectContaining({
      requiresZavorthGateway: true,
      requiresApprovalPolicy: true,
      mayExecuteTools: false,
      mayLaunchWorkers: false,
    }));
    expect(JSON.stringify(normalized)).not.toContain(ownerHandshake.sourceToken);
    expect(JSON.stringify(normalized.descriptor)).toContain('source-token:present-redacted');
  });

  it('marks unsupported source scopes as degraded without granting elevated Zavorth authority', () => {
    const scopeDowngrade = createWave1HandshakeFixtures().find((fixture) => (
      fixture.fixtureCase === 'connect-scope-downgrade'
    ));

    if (!scopeDowngrade) {
      throw new Error('Expected scope downgrade handshake fixture.');
    }

    const normalized = normalizeWave1GatewayHandshake(scopeDowngrade);

    expect(normalized.health.status).toBe('degraded');
    expect(normalized.trust.authority).toBe('zavorth');
    expect(normalized.trust.sourceTokenAuthority).toBe(false);
    expect(normalized.trust.acceptedScopes).toEqual(['gateway:read']);
    expect(normalized.trust.downgradedScopes).toEqual([
      'tools:execute',
      'files:write',
      'workers:launch',
    ]);
    expect(normalized.descriptor.diagnostics?.notes).toEqual(expect.arrayContaining([
      'downgraded-scopes:tools:execute,files:write,workers:launch',
    ]));
    expect(normalized.descriptor.boundary.prohibitedActions).toEqual(expect.arrayContaining([
      'execute-tools',
      'launch-workers',
      'mutate-files',
    ]));
    expect(JSON.stringify(normalized)).not.toContain(scopeDowngrade.sourceToken);
  });
});
