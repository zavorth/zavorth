import fs from 'node:fs';
import path from 'node:path';

import {
  createExternalAgentExternalExecutorGatewaySecretRef,
  createExternalExecutorAuthenticatedEphemeralGatewayHealthProbeUnavailableFixtureSource,
  EXTERNAL_AGENT_SECRET_REF_DEFAULT_INJECTION_POLICY,
  normalizeExternalExecutorAuthenticatedEphemeralGatewayHealthProbe,
  normalizeExternalExecutorAuthenticatedEphemeralGatewayHealthProbeUnavailableFixture,
  resolveExternalAgentSecretRef,
} from '../../../src/runtime/external-agents/index.js';

const GATE_DOC = 'docs/156-wave-1-authenticated-ephemeral-external-executor-gateway-health-probe.md';
const SECRET_PREFLIGHT_DOC = 'docs/155-wave-1-external-executor-gateway-secret-ref-auth-preflight.md';
const CONTROLLED_START_DOC = 'docs/154-wave-1-controlled-ephemeral-external-executor-gateway-start.md';
const BOUNDARY_FILE = 'src/runtime/external-agents/ExternalAgentExternalExecutorAuthenticatedEphemeralGatewayHealthProbe.ts';
const INDEX_FILE = 'src/runtime/external-agents/index.ts';
const SECRET_RESOLVER_BOUNDARY_DOC = 'docs/157-wave-1-external-agent-secret-ref-resolver-injection-boundary.md';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('ExternalExecutor authenticated ephemeral gateway health probe gate', () => {
  it('records the 156 retry as authenticated-health-ok after redacted SecretRef injection', () => {
    const content = read(GATE_DOC);

    expect(content).toContain('Status: authenticated-health-ok');
    expect(content).toContain(CONTROLLED_START_DOC);
    expect(content).toContain(SECRET_PREFLIGHT_DOC);
    expect(content).toContain('external-executor-gateway-token');
    expect(content).toContain(SECRET_RESOLVER_BOUNDARY_DOC);
    expect(content).toContain('EXTERNAL_EXECUTOR_GATEWAY_TOKEN=present-redacted');
    expect(content).toContain('EXTERNAL_EXECUTOR_SKIP_CHANNELS=1');
    expect(content).toContain('EXTERNAL_EXECUTOR_SKIP_PROVIDERS=1');
    expect(content).toContain('| Listener observed | yes |');
    expect(content).toContain('| RPC preflight ready | yes |');
    expect(content).toContain('| Health exit | `0` |');
    expect(content).toContain('| Status rpc ok | true |');
    expect(content).toContain('| Probe ok | true |');
    expect(content).toContain('decision: authenticated-health-ok');
    expect(content).toContain('command-arg token used: false');
    expect(content).toContain('url override used: false');
    expect(content).toContain('docs/161-wave-1-real-capability-snapshot-read-only.md');
  });

  it('documents process, listener, config, and read-only command evidence', () => {
    const content = read(GATE_DOC);

    expect(content).toContain('Preexisting process/listener | none');
    expect(content).toContain('external-executor gateway run --auth token --port 18789 --bind loopback --ws-log compact');
    expect(content).toContain('Config hash before');
    expect(content).toContain('Config hash after');
    expect(content).toContain('d1a32b3211174de9b27422f9fc28ca10d13af63ddcd6ecfece7b132617347fe1');
    expect(content).toContain('cleanup confirmed: true');
    expect(content).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!present-redacted|<redacted-local-secret>)[^\s`]+/);
  });

  it('adds the Zavorth-owned normalization boundary and public exports', () => {
    const boundary = read(BOUNDARY_FILE);
    const index = read(INDEX_FILE);

    expect(boundary).toContain('ZavorthExternalExecutorAuthenticatedEphemeralGatewayHealthProbe/v1');
    expect(boundary).toContain('createExternalExecutorAuthenticatedEphemeralGatewayHealthProbeUnavailableFixtureSource');
    expect(boundary).toContain('normalizeExternalExecutorAuthenticatedEphemeralGatewayHealthProbe');
    expect(boundary).toContain('auth-secret-unavailable');
    expect(boundary).toContain('rawSecretValueLoadedByNormalizer: false');
    expect(boundary).toContain('rawSecretValuePrinted: false');
    expect(index).toContain("from './ExternalAgentExternalExecutorAuthenticatedEphemeralGatewayHealthProbe.js'");
    expect(index).toContain('ExternalExecutorAuthenticatedEphemeralGatewayHealthProbeNormalization');
  });

  it('normalizes the executed unavailable fixture without starting or probing ExternalExecutor', () => {
    const normalized = normalizeExternalExecutorAuthenticatedEphemeralGatewayHealthProbeUnavailableFixture();

    expect(normalized.nativeContract).toBe('ZavorthExternalExecutorAuthenticatedEphemeralGatewayHealthProbe/v1');
    expect(normalized.decision).toBe('auth-secret-unavailable');
    expect(normalized.secretRefId).toBe('external-executor-gateway-token');
    expect(normalized.commandProjections).toEqual([]);
    expect(normalized.cleanup).toEqual({
      preexistingProcessFound: false,
      preexistingListenerFound: false,
      gatewayStartedByGate: false,
      cleanupAttempted: false,
      cleanupSucceeded: true,
      configHashBefore: 'c506184cbcaea9181f133e49750287bb7d0e45516ad5854af5fc43607c1e351d',
      configHashAfter: 'c506184cbcaea9181f133e49750287bb7d0e45516ad5854af5fc43607c1e351d',
      configRestored: true,
    });
    expect(normalized.diagnostics).toEqual(expect.arrayContaining([
      'decision:auth-secret-unavailable',
      'secret-ref:unavailable',
      'gateway-start-attempted:false',
      'listener-observed:false',
      'commands-attempted:0',
      'secret-ref-unavailable-reason:no-real-provisioned-secret-for-external-executor-gateway-token',
    ]));
    expect(normalized.nextGateRecommended).toBeNull();
  });

  it('uses the 157 resolver boundary in retry mode and stops when no real secret is provisioned', () => {
    const envelope = resolveExternalAgentSecretRef({
      secretRef: createExternalAgentExternalExecutorGatewaySecretRef(),
      requestedChannel: 'env-var',
      policy: {
        ...EXTERNAL_AGENT_SECRET_REF_DEFAULT_INJECTION_POLICY,
        processStartAllowed: true,
        auditReason: '156-authenticated-ephemeral-health-probe-retry',
      },
      generatedAt: '2026-04-28T18:30:00.000Z',
      idPrefix: 'external-executor-authenticated-ephemeral-health-retry',
    });

    expect(envelope.status).toBe('secret-unavailable');
    expect(envelope.failureState).toBe('secret-unavailable');
    expect(envelope.injectionPlan).toBeNull();
    expect(envelope.requestedChannel).toBe('env-var');
    expect(envelope.executionGate.processStarted).toBe(false);
    expect(envelope.executionGate.gatewayStarted).toBe(false);
    expect(JSON.stringify(envelope)).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=[^\s"]+/);
  });

  it('normalizes the latest degraded authenticated retry without opening execution authority', () => {
    const normalized = normalizeExternalExecutorAuthenticatedEphemeralGatewayHealthProbe({
      generatedAt: '2026-04-28T20:00:00.000Z',
      runtimeId: 'external-executor-authenticated-health-degraded-retry',
      idPrefix: 'external-executor-authenticated-health-degraded',
      source: {
        runtimeLabel: 'ExternalExecutor gateway authenticated ephemeral health probe',
        endpoint: 'ws://127.0.0.1:18789',
        priorSecretRefDecision: 'secret-ref-path-known',
        secretRefResolution: {
          secretRefId: 'external-executor-gateway-token',
          resolver: 'zavorth-secret-store',
          status: 'resolved',
          rawSecretValueLoadedByNormalizer: false,
          rawSecretValuePrinted: false,
          credentialPassedThroughSecureChannel: true,
          commandLineContainsRawSecret: false,
          logsContainRawSecret: false,
        },
        preflight: {
          preexistingProcessFound: false,
          preexistingListenerFound: false,
          configHashBefore: 'd1a32b3211174de9b27422f9fc28ca10d13af63ddcd6ecfece7b132617347fe1',
          configHashAfter: 'd1a32b3211174de9b27422f9fc28ca10d13af63ddcd6ecfece7b132617347fe1',
          configRestored: true,
        },
        gatewayStart: {
          attempted: true,
          startedByGate: true,
          listenerObserved: false,
          cleanupAttempted: true,
          cleanupSucceeded: true,
        },
        commandResults: [
          {
            kind: 'health',
            commandLabel: 'external-executor gateway health --json --timeout 3000 --url ws://127.0.0.1:18789',
            attempted: false,
            exitCode: null,
            stdout: '',
            stderr: '',
          },
          {
            kind: 'status',
            commandLabel: 'external-executor gateway status --json --timeout 3000 --url ws://127.0.0.1:18789',
            attempted: false,
            exitCode: null,
            stdout: '',
            stderr: '',
          },
          {
            kind: 'probe',
            commandLabel: 'external-executor gateway probe --json --timeout 3000 --url ws://127.0.0.1:18789',
            attempted: false,
            exitCode: null,
            stdout: '',
            stderr: '',
          },
        ],
      },
    });

    expect(normalized.decision).toBe('health-still-degraded');
    expect(normalized.nextGateRecommended).toBeNull();
    expect(normalized.commandProjections).toHaveLength(3);
    expect(normalized.commandProjections.every((projection) => projection.status === 'skipped')).toBe(true);
    expect(normalized.diagnostics).toEqual(expect.arrayContaining([
      'decision:health-still-degraded',
      'secret-ref:resolved',
      'gateway-start-attempted:true',
      'listener-observed:false',
      'commands-attempted:0',
    ]));
    expect(normalized.executionGate).toEqual(expect.objectContaining({
      secretRefResolved: true,
      authSecretUnavailable: false,
      credentialPassedThroughSecureChannel: true,
      gatewayStartedByGate: true,
      readOnlyProbeCommandsAttempted: false,
      cleanupConfirmed: true,
      adapterCreated: false,
      liveEventStreamOpened: false,
      actionReachedExecutor: false,
      externalCommandExecuted: false,
      externalToolExecuted: false,
      externalProviderExecuted: false,
    }));
    expect(normalized.redaction).toEqual(expect.objectContaining({
      rawSecretValueLoadedByNormalizer: false,
      rawSecretValuePrinted: false,
      commandOutputSecretLikeValuesRedacted: true,
    }));
    expect(JSON.stringify(normalized)).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!missing|present-redacted)[^\s"]+/);
  });

  it('normalizes the corrected authenticated-health-ok retry without opening execution authority', () => {
    const normalized = normalizeExternalExecutorAuthenticatedEphemeralGatewayHealthProbe({
      generatedAt: '2026-04-28T19:51:25.000Z',
      runtimeId: 'external-executor-authenticated-health-ok-retry',
      idPrefix: 'external-executor-authenticated-health-ok',
      source: {
        runtimeLabel: 'ExternalExecutor gateway authenticated ephemeral health probe',
        endpoint: 'ws://127.0.0.1:18789',
        priorSecretRefDecision: 'secret-ref-path-known',
        secretRefResolution: {
          secretRefId: 'external-executor-gateway-token',
          resolver: 'zavorth-secret-store',
          status: 'resolved',
          rawSecretValueLoadedByNormalizer: false,
          rawSecretValuePrinted: false,
          credentialPassedThroughSecureChannel: true,
          commandLineContainsRawSecret: false,
          logsContainRawSecret: false,
        },
        preflight: {
          preexistingProcessFound: false,
          preexistingListenerFound: false,
          configHashBefore: 'd1a32b3211174de9b27422f9fc28ca10d13af63ddcd6ecfece7b132617347fe1',
          configHashAfter: 'd1a32b3211174de9b27422f9fc28ca10d13af63ddcd6ecfece7b132617347fe1',
          configRestored: true,
        },
        gatewayStart: {
          attempted: true,
          startedByGate: true,
          listenerObserved: true,
          cleanupAttempted: true,
          cleanupSucceeded: true,
        },
        commandResults: [
          {
            kind: 'health',
            commandLabel: 'external-executor gateway health --json --timeout 90000',
            attempted: true,
            exitCode: 0,
            stdout: '{"ok":true}',
            stderr: '',
          },
          {
            kind: 'status',
            commandLabel: 'external-executor gateway status --json --timeout 90000',
            attempted: true,
            exitCode: 0,
            stdout: '{"rpc":{"ok":true,"capability":"admin_capable"}}',
            stderr: '',
          },
          {
            kind: 'probe',
            commandLabel: 'external-executor gateway probe --json --timeout 90000',
            attempted: true,
            exitCode: 0,
            stdout: '{"ok":true,"capability":"admin_capable"}',
            stderr: '',
          },
        ],
      },
    });

    expect(normalized.decision).toBe('authenticated-health-ok');
    expect(normalized.nextGateRecommended).toBe('docs/161-wave-1-real-capability-snapshot-read-only.md');
    expect(normalized.commandProjections.map((projection) => projection.status)).toEqual(['ok', 'ok', 'ok']);
    expect(normalized.diagnostics).toEqual(expect.arrayContaining([
      'decision:authenticated-health-ok',
      'secret-ref:resolved',
      'gateway-start-attempted:true',
      'listener-observed:true',
      'commands-attempted:3',
    ]));
    expect(normalized.executionGate).toEqual(expect.objectContaining({
      secretRefResolved: true,
      authSecretUnavailable: false,
      credentialPassedThroughSecureChannel: true,
      gatewayStartedByGate: true,
      readOnlyProbeCommandsAttempted: true,
      cleanupConfirmed: true,
      adapterCreated: false,
      liveEventStreamOpened: false,
      actionReachedExecutor: false,
      externalCommandExecuted: false,
      externalToolExecuted: false,
      externalProviderExecuted: false,
    }));
    expect(JSON.stringify(normalized)).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!missing|present-redacted)[^\s"]+/);
  });

  it('redacts synthetic credential-like evidence and keeps execution gates closed', () => {
    const source = {
      ...createExternalExecutorAuthenticatedEphemeralGatewayHealthProbeUnavailableFixtureSource(),
      secretRefResolution: {
        ...createExternalExecutorAuthenticatedEphemeralGatewayHealthProbeUnavailableFixtureSource().secretRefResolution,
        accidentalRawCredentialInput: 'synthetic-raw-credential-sentinel-that-must-not-appear',
      },
      commandResults: [
        {
          kind: 'health' as const,
          commandLabel: 'external-executor gateway health --token synthetic-raw-credential-sentinel-that-must-not-appear',
          attempted: false,
          exitCode: null,
          stdout: 'EXTERNAL_EXECUTOR_GATEWAY_TOKEN=synthetic-raw-credential-sentinel-that-must-not-appear',
          stderr: 'authorization: synthetic-raw-credential-sentinel-that-must-not-appear',
        },
      ],
    };
    const normalized = normalizeExternalExecutorAuthenticatedEphemeralGatewayHealthProbe({
      generatedAt: '2026-04-28T17:00:00.000Z',
      runtimeId: 'external-executor-authenticated-ephemeral-gateway-health-probe',
      idPrefix: 'external-executor-authenticated-ephemeral-health',
      source,
    });
    const serialized = JSON.stringify(normalized);

    expect(serialized).not.toContain('synthetic-raw-credential-sentinel-that-must-not-appear');
    expect(normalized.commandProjections[0]).toEqual(expect.objectContaining({
      attempted: false,
      status: 'skipped',
      rawSecretRedacted: true,
      readOnly: true,
    }));
    expect(normalized.commandProjections[0].stdoutPreview).toContain('EXTERNAL_EXECUTOR_GATEWAY_TOKEN=[redacted-secret]');
    expect(normalized.commandProjections[0].stderrPreview).toContain('authorization: [redacted-secret]');
    expect(normalized.redaction).toEqual({
      rawSecretValueLoadedByNormalizer: false,
      rawSecretValuePrinted: false,
      accidentalRawCredentialInputDiscarded: true,
      serializedOutputContainsAccidentalRawCredential: false,
      commandOutputSecretLikeValuesRedacted: true,
    });
    expect(normalized.executionGate).toEqual(expect.objectContaining({
      authenticatedEphemeralProbeGate: true,
      priorSecretRefDecisionKnown: true,
      secretRefResolutionAttempted: true,
      secretRefResolved: false,
      authSecretUnavailable: true,
      rawSecretValueLoadedByNormalizer: false,
      rawSecretValuePrinted: false,
      credentialLogged: false,
      credentialPassedThroughSecureChannel: false,
      gatewayStartedByGate: false,
      sidecarProcessStarted: false,
      sourceRuntimeConnected: false,
      readOnlyProbeCommandsAttempted: false,
      cleanupConfirmed: true,
      persistentDaemonStarted: false,
      adapterCreated: false,
      liveEventStreamOpened: false,
      actionDispatchOpened: false,
      externalToolExecuted: false,
      externalProviderExecuted: false,
      messageSent: false,
      pluginInstalled: false,
      configMutated: false,
      stateMutated: false,
      dataMigrated: false,
      sourceModulesCopied: false,
      adapterRemoved: false,
      actionReachedExecutor: false,
    }));
  });

  it('keeps the previous preflight pointing at the actual 156 health-probe gate', () => {
    const preflight = read(SECRET_PREFLIGHT_DOC);

    expect(preflight).toContain(GATE_DOC);
    expect(preflight).not.toContain('docs/156-wave-1-authenticated-ephemeral-external-executor-gateway-start.md');
  });
});
