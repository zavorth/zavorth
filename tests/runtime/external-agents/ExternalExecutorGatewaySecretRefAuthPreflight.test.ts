import fs from 'node:fs';
import path from 'node:path';

import {
  createExternalExecutorGatewaySecretRefAuthPreflightFixtureSource,
  normalizeExternalExecutorGatewaySecretRefAuthPreflight,
  normalizeExternalExecutorGatewaySecretRefAuthPreflightFixture,
} from '../../../src/runtime/external-agents/index.js';

const AUTH_PREFLIGHT_DOC = 'docs/155-wave-1-external-executor-gateway-secret-ref-auth-preflight.md';
const CONTROLLED_START_DOC = 'docs/154-wave-1-controlled-ephemeral-external-executor-gateway-start.md';
const BOUNDARY_FILE = 'src/runtime/external-agents/ExternalAgentExternalExecutorGatewaySecretRefAuthPreflight.ts';
const INDEX_FILE = 'src/runtime/external-agents/index.core.ts';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('ExternalExecutor gateway SecretRef auth preflight', () => {
  it('documents a SecretRef-only auth preflight after the degraded controlled start', () => {
    const content = read(AUTH_PREFLIGHT_DOC);

    expect(content).toContain('Status: wave-1-external-executor-gateway-secret-ref-auth-preflight-secret-ref-path-known');
    expect(content).toContain(CONTROLLED_START_DOC);
    expect(content).toContain('explicit `--url` is used without explicit credentials');
    expect(content).toContain('does not read a raw token');
    expect(content).toContain('print a token');
    expect(content).toContain('pass a real credential');
    expect(content).toContain('start a gateway');
    expect(content).toContain('create a real adapter');
    expect(content).toContain('open a live event stream');
    expect(content).toContain('execute a');
    expect(content).toContain('mutate config/state/secrets');
  });

  it('records only redacted help/config evidence and identifies supported auth surfaces', () => {
    const content = read(AUTH_PREFLIGHT_DOC);

    expect(content).toContain('external-executor gateway run --help');
    expect(content).toContain('`--auth <mode>`');
    expect(content).toContain('`--token <token>`');
    expect(content).toContain('`EXTERNAL_EXECUTOR_GATEWAY_TOKEN`');
    expect(content).toContain('`--password <password>`');
    expect(content).toContain('`--password-file <path>`');
    expect(content).toContain('external-executor gateway health --help');
    expect(content).toContain('external-executor gateway status --help');
    expect(content).toContain('external-executor gateway probe --help');
    expect(content).toContain('token-file flag: unavailable');
    expect(content).toContain('password-file flag: available');
    expect(content).toContain('token value was not printed');
    expect(content).toContain('decision: secret-ref-path-known');
    expect(content).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=[^\s<`]+/);
  });

  it('adds the Zavorth-owned boundary and public exports', () => {
    const boundary = read(BOUNDARY_FILE);
    const index = read(INDEX_FILE);

    expect(boundary).toContain('ZavorthExternalExecutorGatewaySecretRefAuthPreflight/v1');
    expect(boundary).toContain('createExternalExecutorGatewaySecretRefAuthPreflightFixtureSource');
    expect(boundary).toContain('normalizeExternalExecutorGatewaySecretRefAuthPreflight');
    expect(boundary).toContain("nativeContract: 'SecretRef'");
    expect(boundary).toContain('rawSecretValueLoaded: false');
    expect(boundary).toContain('rawSecretValuePrinted: false');
    expect(index).toContain("from './ExternalAgentExternalExecutorGatewaySecretRefAuthPreflight.js'");
    expect(index).toContain('ExternalExecutorGatewaySecretRefAuthPreflightNormalization');
  });

  it('normalizes the fixture into SecretRef metadata and future command templates only', () => {
    const normalized = normalizeExternalExecutorGatewaySecretRefAuthPreflightFixture();

    expect(normalized.nativeContract).toBe('ZavorthExternalExecutorGatewaySecretRefAuthPreflight/v1');
    expect(normalized.decision).toBe('secret-ref-path-known');
    expect(normalized.secretRefs).toEqual([
      expect.objectContaining({
        id: 'external-executor-gateway-token',
        providerId: 'external-executor-gateway',
        purpose: 'gateway-auth',
        credentialKind: 'token',
        resolver: 'zavorth-secret-store',
        rawSecretValueLoaded: false,
        rawSecretValuePrinted: false,
        nativeContract: 'SecretRef',
      }),
    ]);
    expect(normalized.secretRefs[0].allowedSourceSurfaces).toEqual([
      'cli-token-flag',
      'env-token',
      'config-auth-token',
    ]);
    expect(normalized.credentialSurfaceInventory.map((row) => row.kind)).toEqual([
      'cli-token-flag',
      'env-token',
      'cli-password-flag',
      'cli-password-file-flag',
      'config-auth-token',
    ]);
    expect(normalized.futureCommandTemplates).toHaveLength(4);
    normalized.futureCommandTemplates.forEach((template) => {
      expect(template.template).toContain('<SecretRef:external-executor-gateway-token>');
      expect(template.usesSecretRefPlaceholder).toBe(true);
      expect(template.containsRawSecretValue).toBe(false);
      expect(template.executionAuthorizedNow).toBe(false);
    });
    expect(normalized.nextGateRecommended).toBe('docs/156-wave-1-authenticated-ephemeral-external-executor-gateway-health-probe.md');
  });

  it('redacts accidental raw credential input and keeps all execution paths blocked', () => {
    const source = {
      ...createExternalExecutorGatewaySecretRefAuthPreflightFixtureSource(),
      accidentalRawCredentialInput: 'synthetic-raw-credential-sentinel-that-must-not-appear',
    };
    const normalized = normalizeExternalExecutorGatewaySecretRefAuthPreflight({
      source,
      generatedAt: '2026-04-28T16:00:00.000Z',
      runtimeId: 'external-executor-gateway-secret-ref-auth-preflight',
      idPrefix: 'external-executor-gateway-secret-ref-auth',
    });
    const serialized = JSON.stringify(normalized);

    expect(normalized.redaction).toEqual({
      rawSecretValueLoaded: false,
      rawSecretValuePrinted: false,
      accidentalRawCredentialInputDiscarded: true,
      serializedOutputContainsAccidentalRawCredential: false,
      secretPlaceholder: '<SecretRef:external-executor-gateway-token>',
    });
    expect(serialized).not.toContain('synthetic-raw-credential-sentinel-that-must-not-appear');
    expect(serialized).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=[^\s"]+/);
    expect(normalized.executionGate).toEqual(expect.objectContaining({
      authPreflightOnly: true,
      helpConsultedReadOnly: true,
      configReadOnly: true,
      secretRefModeled: true,
      realCredentialPassed: false,
      gatewayStarted: false,
      sidecarProcessStarted: false,
      sourceRuntimeConnected: false,
      externalExecutorLiveCalled: false,
      httpConnectionOpened: false,
      websocketConnectionOpened: false,
      liveEventStreamOpened: false,
      externalCommandExecuted: false,
      externalToolExecuted: false,
      externalProviderExecuted: false,
      commandOrToolExecuted: false,
      sourceHandlerLoaded: false,
      rawSecretsRead: false,
      configMigrated: false,
      configMutated: false,
      stateMigrated: false,
      stateMutated: false,
      sourceModulesCopied: false,
      adapterRemoved: false,
      actionReachedExecutor: false,
    }));
    expect(normalized.adapterCreated).toBe(false);
    expect(normalized.adapterRemoved).toBe(false);
    expect(normalized.sourceModulesCopied).toBe(false);
  });

  it('updates 154 to point at the SecretRef preflight without authorizing the next start', () => {
    const content = read(CONTROLLED_START_DOC);

    expect(content).toContain(AUTH_PREFLIGHT_DOC);
    expect(content).toContain('still does not authorize an authenticated start');
    expect(content).toContain('adapter');
    expect(content).toContain('event');
    expect(content).toContain('action dispatch');
    expect(content).toContain('provider execution');
    expect(content).toContain('native replacement');
  });
});
