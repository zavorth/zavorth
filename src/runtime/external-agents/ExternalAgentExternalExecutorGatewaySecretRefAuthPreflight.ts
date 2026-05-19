import type {
  ExternalAgentSidecarReadOnlyExecutionGate,
} from './ExternalAgentSidecarReadOnlyBoundaryPack.js';
import {
  createCanonicalSidecarReadOnlyExecutionGate,
} from './ExternalAgentSidecarReadOnlyBoundaryPack.js';

export const EXTERNAL_EXECUTOR_GATEWAY_SECRET_REF_AUTH_PREFLIGHT_NOW = '2026-04-28T16:00:00.000Z' as const;
export const EXTERNAL_EXECUTOR_GATEWAY_SECRET_REF_AUTH_PREFLIGHT_RUNTIME_ID = 'external-executor-gateway-secret-ref-auth-preflight' as const;

export type ExternalExecutorGatewayAuthDecision =
  | 'auth-blocked'
  | 'auth-not-required'
  | 'secret-ref-path-known'
  | 'secret-ref-path-unknown';

export type ExternalExecutorGatewayCredentialKind = 'password' | 'token';

export type ExternalExecutorGatewayCredentialSurfaceKind =
  | 'cli-password-file-flag'
  | 'cli-password-flag'
  | 'cli-token-flag'
  | 'config-auth-token'
  | 'env-token';

export type ExternalExecutorGatewayAuthHelpEvidence = {
  command: string;
  acceptedCredentialSurfaces: ExternalExecutorGatewayCredentialSurfaceKind[];
  acceptedAuthModes: Array<'none' | 'password' | 'token' | 'trusted-proxy'>;
  readOnlyHelpConsulted: true;
};

export type ExternalExecutorGatewayAuthConfigEvidence = {
  configPathEvidenceId: string;
  gatewayConfigPresent: boolean;
  gatewayAuthMode: 'none' | 'password' | 'token' | 'trusted-proxy' | 'unknown';
  tokenPresent: boolean;
  rawTokenPrinted: false;
  rawTokenReadByZavorth: false;
  configStoredAsEvidenceOnly: true;
};

export type ExternalExecutorGatewaySecretRefAuthPreflightSource = {
  runtimeLabel: string;
  endpoint: string;
  binaryEvidenceId: string;
  helpEvidence: ExternalExecutorGatewayAuthHelpEvidence[];
  configEvidence: ExternalExecutorGatewayAuthConfigEvidence;
  accidentalRawCredentialInput?: string;
};

export type ExternalExecutorGatewaySecretRef = {
  id: string;
  providerId: 'external-executor-gateway';
  purpose: 'gateway-auth';
  credentialKind: ExternalExecutorGatewayCredentialKind;
  resolver: 'zavorth-secret-store';
  allowedSourceSurfaces: ExternalExecutorGatewayCredentialSurfaceKind[];
  sourceCredentialStoredAsEvidenceOnly: true;
  rawSecretValueLoaded: false;
  rawSecretValuePrinted: false;
  nativeContract: 'SecretRef';
};

export type ExternalExecutorGatewayAuthFutureCommandTemplate = {
  id: string;
  purpose: 'health-probe' | 'probe' | 'status-probe' | 'start';
  template: string;
  usesSecretRefPlaceholder: true;
  containsRawSecretValue: false;
  executionAuthorizedNow: false;
};

export type ExternalExecutorGatewaySecretRefAuthExecutionGate = ExternalAgentSidecarReadOnlyExecutionGate & {
  authPreflightOnly: true;
  helpConsultedReadOnly: true;
  configReadOnly: true;
  secretRefModeled: true;
  realCredentialPassed: false;
  gatewayStarted: false;
  liveEventStreamOpened: false;
  commandOrToolExecuted: false;
  configMutated: false;
  stateMutated: false;
};

export type ExternalExecutorGatewaySecretRefAuthPreflightNormalization<TRuntimeId extends string = string> = {
  nativeContract: 'ZavorthExternalExecutorGatewaySecretRefAuthPreflight/v1';
  generatedAt: string;
  runtimeId: TRuntimeId;
  decision: ExternalExecutorGatewayAuthDecision;
  endpoint: string;
  secretRefs: ExternalExecutorGatewaySecretRef[];
  credentialSurfaceInventory: Array<{
    id: string;
    kind: ExternalExecutorGatewayCredentialSurfaceKind;
    acceptedByCommands: string[];
    storedAsEvidenceOnly: true;
  }>;
  futureCommandTemplates: ExternalExecutorGatewayAuthFutureCommandTemplate[];
  redaction: {
    rawSecretValueLoaded: false;
    rawSecretValuePrinted: false;
    accidentalRawCredentialInputDiscarded: boolean;
    serializedOutputContainsAccidentalRawCredential: false;
    secretPlaceholder: '<SecretRef:external-executor-gateway-token>';
  };
  nextGateRecommended: 'docs/authenticated-ephemeral-external-executor-gateway-health-probe.md' | null;
  executionGate: ExternalExecutorGatewaySecretRefAuthExecutionGate;
  sidecarOptional: true;
  zavorthRunsWithoutSidecar: true;
  sourceModulesCopied: false;
  adapterCreated: false;
  adapterRemoved: false;
};

export type ExternalExecutorGatewaySecretRefAuthPreflightOptions<TRuntimeId extends string = string> = {
  source: ExternalExecutorGatewaySecretRefAuthPreflightSource;
  generatedAt: string;
  runtimeId: TRuntimeId;
  idPrefix: string;
  createExecutionGate?: () => ExternalExecutorGatewaySecretRefAuthExecutionGate;
};

function unique<TValue>(values: TValue[]): TValue[] {
  return Array.from(new Set(values));
}

function createExternalExecutorGatewaySecretRefAuthExecutionGate(): ExternalExecutorGatewaySecretRefAuthExecutionGate {
  return {
    ...createCanonicalSidecarReadOnlyExecutionGate(),
    authPreflightOnly: true,
    helpConsultedReadOnly: true,
    configReadOnly: true,
    secretRefModeled: true,
    realCredentialPassed: false,
    gatewayStarted: false,
    liveEventStreamOpened: false,
    commandOrToolExecuted: false,
    configMutated: false,
    stateMutated: false,
  };
}

function determineDecision(
  source: ExternalExecutorGatewaySecretRefAuthPreflightSource,
): ExternalExecutorGatewayAuthDecision {
  if (source.configEvidence.gatewayAuthMode === 'none') {
    return 'auth-not-required';
  }

  const tokenAccepted = source.helpEvidence.some((evidence) => (
    evidence.acceptedCredentialSurfaces.includes('cli-token-flag')
    || evidence.acceptedCredentialSurfaces.includes('env-token')
  ));

  if (source.configEvidence.gatewayAuthMode === 'token' && source.configEvidence.tokenPresent && tokenAccepted) {
    return 'secret-ref-path-known';
  }

  if (source.helpEvidence.length === 0 || source.configEvidence.gatewayAuthMode === 'unknown') {
    return 'secret-ref-path-unknown';
  }

  return 'auth-blocked';
}

function buildCredentialSurfaceInventory(
  idPrefix: string,
  helpEvidence: ExternalExecutorGatewayAuthHelpEvidence[],
): ExternalExecutorGatewaySecretRefAuthPreflightNormalization['credentialSurfaceInventory'] {
  const surfaces = unique(helpEvidence.flatMap((evidence) => evidence.acceptedCredentialSurfaces));

  return surfaces.map((surface, index) => ({
    id: `${idPrefix}:credential-surface-${index + 1}-${surface}`,
    kind: surface,
    acceptedByCommands: helpEvidence
      .filter((evidence) => evidence.acceptedCredentialSurfaces.includes(surface))
      .map((evidence) => evidence.command),
    storedAsEvidenceOnly: true,
  }));
}

function buildFutureCommandTemplates(endpoint: string): ExternalExecutorGatewayAuthFutureCommandTemplate[] {
  const secretRefPlaceholder = '<SecretRef:external-executor-gateway-token>';

  return [
    {
      id: 'external-executor-gateway-auth:start',
      purpose: 'start',
      template: `external-executor gateway run --port 18789 --bind loopback --auth token --token ${secretRefPlaceholder}`,
      usesSecretRefPlaceholder: true,
      containsRawSecretValue: false,
      executionAuthorizedNow: false,
    },
    {
      id: 'external-executor-gateway-auth:health',
      purpose: 'health-probe',
      template: `external-executor gateway health --json --timeout 3000 --url ${endpoint} --token ${secretRefPlaceholder}`,
      usesSecretRefPlaceholder: true,
      containsRawSecretValue: false,
      executionAuthorizedNow: false,
    },
    {
      id: 'external-executor-gateway-auth:status',
      purpose: 'status-probe',
      template: `external-executor gateway status --json --timeout 3000 --url ${endpoint} --token ${secretRefPlaceholder}`,
      usesSecretRefPlaceholder: true,
      containsRawSecretValue: false,
      executionAuthorizedNow: false,
    },
    {
      id: 'external-executor-gateway-auth:probe',
      purpose: 'probe',
      template: `external-executor gateway probe --json --timeout 3000 --url ${endpoint} --token ${secretRefPlaceholder}`,
      usesSecretRefPlaceholder: true,
      containsRawSecretValue: false,
      executionAuthorizedNow: false,
    },
  ];
}

function buildSecretRefs(
  decision: ExternalExecutorGatewayAuthDecision,
  inventory: ExternalExecutorGatewaySecretRefAuthPreflightNormalization['credentialSurfaceInventory'],
): ExternalExecutorGatewaySecretRef[] {
  if (decision !== 'secret-ref-path-known') {
    return [];
  }

  return [
    {
      id: 'external-executor-gateway-token',
      providerId: 'external-executor-gateway',
      purpose: 'gateway-auth',
      credentialKind: 'token',
      resolver: 'zavorth-secret-store',
      allowedSourceSurfaces: inventory
        .map((row) => row.kind)
        .filter((kind) => kind === 'cli-token-flag' || kind === 'env-token' || kind === 'config-auth-token'),
      sourceCredentialStoredAsEvidenceOnly: true,
      rawSecretValueLoaded: false,
      rawSecretValuePrinted: false,
      nativeContract: 'SecretRef',
    },
  ];
}

export function createExternalExecutorGatewaySecretRefAuthPreflightFixtureSource(): ExternalExecutorGatewaySecretRefAuthPreflightSource {
  return {
    runtimeLabel: 'ExternalExecutor gateway',
    endpoint: 'ws://127.0.0.1:18789',
    binaryEvidenceId: '/home/grey/.local/bin/external-executor',
    helpEvidence: [
      {
        command: 'external-executor gateway run --help',
        acceptedCredentialSurfaces: [
          'cli-token-flag',
          'env-token',
          'cli-password-flag',
          'cli-password-file-flag',
        ],
        acceptedAuthModes: ['none', 'token', 'password', 'trusted-proxy'],
        readOnlyHelpConsulted: true,
      },
      {
        command: 'external-executor gateway health --help',
        acceptedCredentialSurfaces: ['cli-token-flag', 'cli-password-flag'],
        acceptedAuthModes: ['token', 'password'],
        readOnlyHelpConsulted: true,
      },
      {
        command: 'external-executor gateway status --help',
        acceptedCredentialSurfaces: ['cli-token-flag', 'cli-password-flag'],
        acceptedAuthModes: ['token', 'password'],
        readOnlyHelpConsulted: true,
      },
      {
        command: 'external-executor gateway probe --help',
        acceptedCredentialSurfaces: ['cli-token-flag', 'cli-password-flag'],
        acceptedAuthModes: ['token', 'password'],
        readOnlyHelpConsulted: true,
      },
      {
        command: 'redacted config metadata',
        acceptedCredentialSurfaces: ['config-auth-token'],
        acceptedAuthModes: ['token'],
        readOnlyHelpConsulted: true,
      },
    ],
    configEvidence: {
      configPathEvidenceId: '/home/grey/.external-executor/external-executor.json',
      gatewayConfigPresent: true,
      gatewayAuthMode: 'token',
      tokenPresent: true,
      rawTokenPrinted: false,
      rawTokenReadByZavorth: false,
      configStoredAsEvidenceOnly: true,
    },
  };
}

export function normalizeExternalExecutorGatewaySecretRefAuthPreflight<TRuntimeId extends string>(
  options: ExternalExecutorGatewaySecretRefAuthPreflightOptions<TRuntimeId>,
): ExternalExecutorGatewaySecretRefAuthPreflightNormalization<TRuntimeId> {
  const decision = determineDecision(options.source);
  const credentialSurfaceInventory = buildCredentialSurfaceInventory(options.idPrefix, options.source.helpEvidence);
  const secretRefs = buildSecretRefs(decision, credentialSurfaceInventory);
  const futureCommandTemplates = decision === 'secret-ref-path-known'
    ? buildFutureCommandTemplates(options.source.endpoint)
    : [];

  return {
    nativeContract: 'ZavorthExternalExecutorGatewaySecretRefAuthPreflight/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision,
    endpoint: options.source.endpoint,
    secretRefs,
    credentialSurfaceInventory,
    futureCommandTemplates,
    redaction: {
      rawSecretValueLoaded: false,
      rawSecretValuePrinted: false,
      accidentalRawCredentialInputDiscarded: options.source.accidentalRawCredentialInput !== undefined,
      serializedOutputContainsAccidentalRawCredential: false,
      secretPlaceholder: '<SecretRef:external-executor-gateway-token>',
    },
    nextGateRecommended: decision === 'secret-ref-path-known'
      ? 'docs/authenticated-ephemeral-external-executor-gateway-health-probe.md'
      : null,
    executionGate: options.createExecutionGate?.() || createExternalExecutorGatewaySecretRefAuthExecutionGate(),
    sidecarOptional: true,
    zavorthRunsWithoutSidecar: true,
    sourceModulesCopied: false,
    adapterCreated: false,
    adapterRemoved: false,
  };
}

export function normalizeExternalExecutorGatewaySecretRefAuthPreflightFixture(): ExternalExecutorGatewaySecretRefAuthPreflightNormalization<typeof EXTERNAL_EXECUTOR_GATEWAY_SECRET_REF_AUTH_PREFLIGHT_RUNTIME_ID> {
  return normalizeExternalExecutorGatewaySecretRefAuthPreflight({
    source: createExternalExecutorGatewaySecretRefAuthPreflightFixtureSource(),
    generatedAt: EXTERNAL_EXECUTOR_GATEWAY_SECRET_REF_AUTH_PREFLIGHT_NOW,
    runtimeId: EXTERNAL_EXECUTOR_GATEWAY_SECRET_REF_AUTH_PREFLIGHT_RUNTIME_ID,
    idPrefix: 'external-executor-gateway-secret-ref-auth',
  });
}
