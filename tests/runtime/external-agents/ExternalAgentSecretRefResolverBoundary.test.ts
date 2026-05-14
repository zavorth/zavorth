import fs from 'node:fs';
import path from 'node:path';

import {
  createExternalAgentExternalExecutorGatewaySecretRef,
  createFixtureExternalAgentSecretResolver,
  EXTERNAL_AGENT_SECRET_REF_DEFAULT_INJECTION_POLICY,
  EXTERNAL_AGENT_SECRET_REF_PROHIBITED_CHANNELS_BY_DEFAULT,
  normalizeExternalAgentSecretRefResolverBoundaryFixture,
  resolveExternalAgentSecretRef,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/157-wave-1-external-agent-secret-ref-resolver-injection-boundary.md';
const BOUNDARY_FILE = 'src/runtime/external-agents/ExternalAgentSecretRefResolverBoundary.ts';
const INDEX_FILE = 'src/runtime/external-agents/index.ts';
const SECRET_SENTINEL = 'synthetic-raw-credential-sentinel-that-must-not-appear';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function baseOptions() {
  return {
    secretRef: createExternalAgentExternalExecutorGatewaySecretRef(),
    generatedAt: '2026-04-28T18:00:00.000Z',
    idPrefix: 'external-agent-secret-ref-resolver',
    policy: {
      ...EXTERNAL_AGENT_SECRET_REF_DEFAULT_INJECTION_POLICY,
      processStartAllowed: true,
    },
  };
}

describe('External agent SecretRef resolver injection boundary', () => {
  it('documents the 157 boundary as ready without authorizing live runtime work', () => {
    const content = read(DOC);

    expect(content).toContain('Status: wave-1-external-agent-secret-ref-resolver-injection-boundary-secret-ref-boundary-ready');
    expect(content).toContain('decision: secret-ref-boundary-ready');
    expect(content).toContain('docs/155-wave-1-external-executor-gateway-secret-ref-auth-preflight.md');
    expect(content).toContain('docs/156-wave-1-authenticated-ephemeral-external-executor-gateway-health-probe.md');
    expect(content).toContain('ExternalAgentSecretRefResolverBoundary.ts');
    expect(content).toContain('ExternalAgentSecretRefResolverBoundary.test.ts');
    expect(content).toContain('no token real');
    expect(content).toContain('no gateway start');
    expect(content).toContain('no adapter real');
    expect(content).toContain('no live event stream');
  });

  it('exports the Zavorth-owned SecretRef resolver boundary and contracts', () => {
    const boundary = read(BOUNDARY_FILE);
    const index = read(INDEX_FILE);

    expect(boundary).toContain('ExternalAgentSecretRef');
    expect(boundary).toContain('ExternalAgentSecretResolutionEnvelope');
    expect(boundary).toContain('resolveExternalAgentSecretRef');
    expect(boundary).toContain('EXTERNAL_AGENT_SECRET_REF_PROHIBITED_CHANNELS_BY_DEFAULT');
    expect(boundary).toContain('ExternalAgentSecretInjectionPlan/v1');
    expect(index).toContain("from './ExternalAgentSecretRefResolverBoundary.js'");
    expect(index).toContain('ExternalAgentSecretResolutionEnvelope');
  });

  it('turns a resolved SecretRef into a redacted resolution envelope', () => {
    const envelope = normalizeExternalAgentSecretRefResolverBoundaryFixture();
    const serialized = JSON.stringify(envelope);

    expect(envelope.nativeContract).toBe('ExternalAgentSecretResolutionEnvelope/v1');
    expect(envelope.status).toBe('resolved');
    expect(envelope.secretRef).toEqual(expect.objectContaining({
      id: 'external-executor-gateway-token',
      providerId: 'external-executor-gateway',
      purpose: 'gateway-auth',
      credentialKind: 'token',
      resolver: 'zavorth-secret-store',
      nativeContract: 'ExternalAgentSecretRef/v1',
    }));
    expect(envelope.injectionPlan).toEqual(expect.objectContaining({
      channel: 'env-var',
      placeholder: '<SecretRef:external-executor-gateway-token>',
      redactedValuePreview: '[redacted-secret]',
      rawValueIncluded: false,
      commandLineContainsRawSecret: false,
      logsContainRawSecret: false,
      nativeContract: 'ExternalAgentSecretInjectionPlan/v1',
    }));
    expect(envelope.audit).toEqual(expect.objectContaining({
      rawSecretRecorded: false,
      rawSecretPrinted: false,
      secretLengthRecorded: false,
      secretHashRecorded: false,
      processStarted: false,
    }));
    expect(serialized).not.toContain(SECRET_SENTINEL);
  });

  it('never exposes the raw value through JSON, diagnostics, audit metadata, or stringify', () => {
    const envelope = resolveExternalAgentSecretRef({
      ...baseOptions(),
      requestedChannel: 'env-var',
      resolver: createFixtureExternalAgentSecretResolver(SECRET_SENTINEL),
      accidentalRawInput: SECRET_SENTINEL,
    });
    const serialized = JSON.stringify(envelope);

    expect(envelope.redaction).toEqual({
      required: true,
      rawSecretValuePresentInEnvelope: false,
      rawSecretValuePresentInJson: false,
      accidentalRawInputDiscarded: true,
      placeholder: '<SecretRef:external-executor-gateway-token>',
    });
    expect(serialized).not.toContain(SECRET_SENTINEL);
    expect(serialized).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=[^\s"]+/);
    expect(envelope.diagnostics.join('\n')).toContain('token=[redacted-secret]');
  });

  it('plans env var injection with a redacted value and no process start', () => {
    const envelope = resolveExternalAgentSecretRef({
      ...baseOptions(),
      requestedChannel: 'env-var',
      resolver: createFixtureExternalAgentSecretResolver(SECRET_SENTINEL),
    });

    expect(envelope.status).toBe('resolved');
    expect(envelope.injectionPlan?.env).toEqual({
      name: 'EXTERNAL_EXECUTOR_GATEWAY_TOKEN',
      valuePreview: '[redacted-secret]',
      rawValueLogged: false,
    });
    expect(envelope.executionGate).toEqual(expect.objectContaining({
      boundaryOnly: true,
      realSecretRead: false,
      rawSecretSerialized: false,
      rawSecretLogged: false,
      processStarted: false,
      gatewayStarted: false,
      adapterCreated: false,
      liveEventStreamOpened: false,
      externalToolExecuted: false,
      externalProviderExecuted: false,
      externalCommandExecuted: false,
      configMutated: false,
      stateMutated: false,
      sourceModulesCopied: false,
      dataMigrated: false,
      adapterRemoved: false,
    }));
  });

  it('blocks command arg injection by default', () => {
    const envelope = resolveExternalAgentSecretRef({
      ...baseOptions(),
      requestedChannel: 'command-arg',
      resolver: createFixtureExternalAgentSecretResolver(SECRET_SENTINEL),
    });

    expect(EXTERNAL_AGENT_SECRET_REF_PROHIBITED_CHANNELS_BY_DEFAULT).toContain('command-arg');
    expect(envelope.status).toBe('injection-channel-blocked');
    expect(envelope.failureState).toBe('injection-channel-blocked');
    expect(envelope.injectionPlan).toBeNull();
    expect(envelope.diagnostics).toContain('injection-channel-blocked:command-arg');
    expect(envelope.executionGate.processStarted).toBe(false);
  });

  it('allows command arg injection only when explicitly policy-allowed and still redacts', () => {
    const envelope = resolveExternalAgentSecretRef({
      ...baseOptions(),
      requestedChannel: 'command-arg',
      policy: {
        ...EXTERNAL_AGENT_SECRET_REF_DEFAULT_INJECTION_POLICY,
        allowedChannels: ['command-arg'],
        commandArgExplicitlyAllowed: true,
        processStartAllowed: true,
      },
      resolver: createFixtureExternalAgentSecretResolver(SECRET_SENTINEL),
    });

    expect(envelope.status).toBe('resolved');
    expect(envelope.injectionPlan?.commandArg).toEqual({
      argName: '--token',
      valuePreview: '[redacted-secret]',
      explicitlyPolicyAllowed: true,
      rawValueLogged: false,
    });
    expect(JSON.stringify(envelope)).not.toContain(SECRET_SENTINEL);
  });

  it('requires cleanup metadata for temp file injection', () => {
    const envelope = resolveExternalAgentSecretRef({
      ...baseOptions(),
      requestedChannel: 'temp-file',
      resolver: createFixtureExternalAgentSecretResolver(SECRET_SENTINEL),
    });

    expect(envelope.status).toBe('resolved');
    expect(envelope.injectionPlan?.tempFile).toEqual({
      label: 'external-executor-gateway-token',
      pathPreview: '<zavorth-owned-temp-file>',
      fileMode: '0600',
      cleanupRequired: true,
      cleanupPlan: 'delete-after-process-exit-or-failure',
      contentPreview: '[redacted-secret]',
      createdNow: false,
    });
    expect(envelope.executionGate.processStarted).toBe(false);
  });

  it('returns secret-unavailable when the resolver is absent', () => {
    const envelope = resolveExternalAgentSecretRef({
      ...baseOptions(),
      requestedChannel: 'env-var',
    });

    expect(envelope.status).toBe('secret-unavailable');
    expect(envelope.failureState).toBe('secret-unavailable');
    expect(envelope.injectionPlan).toBeNull();
    expect(envelope.diagnostics).toEqual([
      'secret-unavailable',
      'resolver-unavailable',
    ]);
    expect(envelope.executionGate.processStarted).toBe(false);
  });

  it('returns policy-blocked without invoking resolver or starting a process', () => {
    let resolverInvoked = false;
    const envelope = resolveExternalAgentSecretRef({
      ...baseOptions(),
      requestedChannel: 'env-var',
      policy: {
        ...EXTERNAL_AGENT_SECRET_REF_DEFAULT_INJECTION_POLICY,
        processStartAllowed: false,
      },
      resolver: () => {
        resolverInvoked = true;
        return {
          status: 'resolved',
          value: SECRET_SENTINEL,
          source: 'fixture',
          realSecretRead: false,
        };
      },
    });

    expect(resolverInvoked).toBe(false);
    expect(envelope.status).toBe('policy-blocked');
    expect(envelope.failureState).toBe('policy-blocked');
    expect(envelope.injectionPlan).toBeNull();
    expect(envelope.diagnostics).toEqual([
      'policy-blocked',
      'process-start-not-allowed',
      'secret-resolver-not-invoked',
    ]);
    expect(envelope.executionGate.processStarted).toBe(false);
    expect(envelope.executionGate.gatewayStarted).toBe(false);
  });
});
