export const EXTERNAL_AGENT_SECRET_REF_RESOLVER_BOUNDARY_NOW = '2026-04-28T18:00:00.000Z' as const;
export const EXTERNAL_AGENT_SECRET_REF_RESOLVER_BOUNDARY_RUNTIME_ID = 'external-agent-secret-ref-resolver-boundary' as const;

export type ExternalAgentSecretCredentialKind =
  | 'api-key'
  | 'opaque'
  | 'password'
  | 'token';

export type ExternalAgentSecretInjectionChannel =
  | 'command-arg'
  | 'env-var'
  | 'stdin'
  | 'temp-file';

export type ExternalAgentSecretResolutionFailureState =
  | 'injection-channel-blocked'
  | 'policy-blocked'
  | 'resolver-unavailable'
  | 'secret-unavailable';

export type ExternalAgentSecretResolutionStatus =
  | 'resolved'
  | ExternalAgentSecretResolutionFailureState;

export type ExternalAgentSecretRef = {
  id: string;
  providerId: string;
  purpose: string;
  credentialKind: ExternalAgentSecretCredentialKind;
  resolver: 'zavorth-secret-store';
  sourceRuntimeId?: string;
  nativeContract: 'ExternalAgentSecretRef/v1';
};

export type ExternalAgentSecretResolverResult = {
  status: 'resolved' | 'unavailable';
  value?: string;
  source: 'fixture' | 'zavorth-secret-store';
  realSecretRead: false;
  diagnostics?: string[];
};

export type ExternalAgentSecretResolver = (
  secretRef: ExternalAgentSecretRef,
) => ExternalAgentSecretResolverResult;

export type ExternalAgentSecretInjectionPolicy = {
  allowedChannels: ExternalAgentSecretInjectionChannel[];
  commandArgExplicitlyAllowed: boolean;
  processStartAllowed: boolean;
  envVarName?: string;
  tempFileLabel?: string;
  stdinLabel?: string;
  auditReason: string;
};

export type ExternalAgentSecretInjectionPlan = {
  id: string;
  channel: ExternalAgentSecretInjectionChannel;
  status: 'planned';
  secretRefId: string;
  placeholder: string;
  redactedValuePreview: '[redacted-secret]';
  rawValueIncluded: false;
  commandLineContainsRawSecret: false;
  logsContainRawSecret: false;
  env?: {
    name: string;
    valuePreview: '[redacted-secret]';
    rawValueLogged: false;
  };
  tempFile?: {
    label: string;
    pathPreview: '<zavorth-owned-temp-file>';
    fileMode: '0600';
    cleanupRequired: true;
    cleanupPlan: 'delete-after-process-exit-or-failure';
    contentPreview: '[redacted-secret]';
    createdNow: false;
  };
  stdin?: {
    label: string;
    payloadPreview: '[redacted-secret]';
    rawPayloadLogged: false;
  };
  commandArg?: {
    argName: string;
    valuePreview: '[redacted-secret]';
    explicitlyPolicyAllowed: true;
    rawValueLogged: false;
  };
  nativeContract: 'ExternalAgentSecretInjectionPlan/v1';
};

export type ExternalAgentSecretResolutionAuditMetadata = {
  id: string;
  secretRefId: string;
  providerId: string;
  channel: ExternalAgentSecretInjectionChannel;
  status: ExternalAgentSecretResolutionStatus;
  reason: string;
  rawSecretRecorded: false;
  rawSecretPrinted: false;
  secretLengthRecorded: false;
  secretHashRecorded: false;
  resolverSourceRecordedAsMetadataOnly: true;
  processStarted: false;
  generatedAt: string;
};

export type ExternalAgentSecretResolverExecutionGate = {
  boundaryOnly: true;
  fixtureResolverOnly: boolean;
  realSecretRead: false;
  rawSecretSerialized: false;
  rawSecretLogged: false;
  processStarted: false;
  gatewayStarted: false;
  adapterCreated: false;
  liveEventStreamOpened: false;
  externalToolExecuted: false;
  externalProviderExecuted: false;
  externalCommandExecuted: false;
  configMutated: false;
  stateMutated: false;
  sourceModulesCopied: false;
  dataMigrated: false;
  adapterRemoved: false;
};

export type ExternalAgentSecretResolutionEnvelope = {
  nativeContract: 'ExternalAgentSecretResolutionEnvelope/v1';
  generatedAt: string;
  secretRef: ExternalAgentSecretRef;
  status: ExternalAgentSecretResolutionStatus;
  requestedChannel: ExternalAgentSecretInjectionChannel;
  allowedChannels: ExternalAgentSecretInjectionChannel[];
  injectionPlan: ExternalAgentSecretInjectionPlan | null;
  audit: ExternalAgentSecretResolutionAuditMetadata;
  diagnostics: string[];
  failureState: ExternalAgentSecretResolutionFailureState | null;
  redaction: {
    required: true;
    rawSecretValuePresentInEnvelope: false;
    rawSecretValuePresentInJson: false;
    accidentalRawInputDiscarded: boolean;
    placeholder: string;
  };
  executionGate: ExternalAgentSecretResolverExecutionGate;
};

export type ExternalAgentSecretRefResolverBoundaryOptions = {
  secretRef: ExternalAgentSecretRef;
  requestedChannel: ExternalAgentSecretInjectionChannel;
  policy: ExternalAgentSecretInjectionPolicy;
  generatedAt: string;
  idPrefix: string;
  resolver?: ExternalAgentSecretResolver;
  accidentalRawInput?: string;
};

export const EXTERNAL_AGENT_SECRET_REF_DEFAULT_INJECTION_POLICY: ExternalAgentSecretInjectionPolicy = {
  allowedChannels: ['env-var', 'temp-file', 'stdin'],
  commandArgExplicitlyAllowed: false,
  processStartAllowed: false,
  envVarName: 'EXTERNAL_EXECUTOR_GATEWAY_TOKEN',
  tempFileLabel: 'external-executor-gateway-token',
  stdinLabel: 'external-executor-gateway-token',
  auditReason: 'external-agent-secret-ref-boundary-fixture',
};

export const EXTERNAL_AGENT_SECRET_REF_PROHIBITED_CHANNELS_BY_DEFAULT: ExternalAgentSecretInjectionChannel[] = [
  'command-arg',
];

function placeholder(secretRefId: string): string {
  return `<SecretRef:${secretRefId}>`;
}

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'secret';
}

function redactedText(value: string, rawSecretValue?: string): string {
  let redacted = value;

  if (rawSecretValue) {
    redacted = redacted.split(rawSecretValue).join('[redacted-secret]');
  }

  return redacted
    .replace(/(--(?:password|token)\s+)([^\s]+)/gi, '$1[redacted-secret]')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[redacted-secret]')
    .replace(/\b([A-Z0-9_]*(?:API|ACCESS|AUTH|SECRET|TOKEN|KEY)[A-Z0-9_]*)=([^\s]+)/gi, '$1=[redacted-secret]')
    .replace(/\b(api[_-]...key|authorization|secret|token)(\s*[:=]\s*)([^\s]+)/gi, '$1$2[redacted-secret]');
}

function createExecutionGate(fixtureResolverOnly: boolean): ExternalAgentSecretResolverExecutionGate {
  return {
    boundaryOnly: true,
    fixtureResolverOnly,
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
  };
}

function failureEnvelope(
  options: ExternalAgentSecretRefResolverBoundaryOptions,
  status: ExternalAgentSecretResolutionFailureState,
  diagnostics: string[],
): ExternalAgentSecretResolutionEnvelope {
  return {
    nativeContract: 'ExternalAgentSecretResolutionEnvelope/v1',
    generatedAt: options.generatedAt,
    secretRef: options.secretRef,
    status,
    requestedChannel: options.requestedChannel,
    allowedChannels: options.policy.allowedChannels,
    injectionPlan: null,
    audit: {
      id: `${options.idPrefix}:audit-${normalizeId(status)}`,
      secretRefId: options.secretRef.id,
      providerId: options.secretRef.providerId,
      channel: options.requestedChannel,
      status,
      reason: options.policy.auditReason,
      rawSecretRecorded: false,
      rawSecretPrinted: false,
      secretLengthRecorded: false,
      secretHashRecorded: false,
      resolverSourceRecordedAsMetadataOnly: true,
      processStarted: false,
      generatedAt: options.generatedAt,
    },
    diagnostics,
    failureState: status,
    redaction: {
      required: true,
      rawSecretValuePresentInEnvelope: false,
      rawSecretValuePresentInJson: false,
      accidentalRawInputDiscarded: options.accidentalRawInput !== undefined,
      placeholder: placeholder(options.secretRef.id),
    },
    executionGate: createExecutionGate(options.resolver !== undefined),
  };
}

function planForChannel(
  options: ExternalAgentSecretRefResolverBoundaryOptions,
): ExternalAgentSecretInjectionPlan {
  const base = {
    id: `${options.idPrefix}:injection-${normalizeId(options.requestedChannel)}`,
    channel: options.requestedChannel,
    status: 'planned' as const,
    secretRefId: options.secretRef.id,
    placeholder: placeholder(options.secretRef.id),
    redactedValuePreview: '[redacted-secret]' as const,
    rawValueIncluded: false as const,
    commandLineContainsRawSecret: false as const,
    logsContainRawSecret: false as const,
    nativeContract: 'ExternalAgentSecretInjectionPlan/v1' as const,
  };

  if (options.requestedChannel === 'env-var') {
    return {
      ...base,
      env: {
        name: options.policy.envVarName || `${normalizeId(options.secretRef.id).replace(/[-:.]+/g, '_').toUpperCase()}_SECRET`,
        valuePreview: '[redacted-secret]',
        rawValueLogged: false,
      },
    };
  }

  if (options.requestedChannel === 'temp-file') {
    return {
      ...base,
      tempFile: {
        label: options.policy.tempFileLabel || options.secretRef.id,
        pathPreview: '<zavorth-owned-temp-file>',
        fileMode: '0600',
        cleanupRequired: true,
        cleanupPlan: 'delete-after-process-exit-or-failure',
        contentPreview: '[redacted-secret]',
        createdNow: false,
      },
    };
  }

  if (options.requestedChannel === 'stdin') {
    return {
      ...base,
      stdin: {
        label: options.policy.stdinLabel || options.secretRef.id,
        payloadPreview: '[redacted-secret]',
        rawPayloadLogged: false,
      },
    };
  }

  return {
    ...base,
    commandArg: {
      argName: '--token',
      valuePreview: '[redacted-secret]',
      explicitlyPolicyAllowed: true,
      rawValueLogged: false,
    },
  };
}

export function createExternalAgentExternalExecutorGatewaySecretRef(): ExternalAgentSecretRef {
  return {
    id: 'external-executor-gateway-token',
    providerId: 'external-executor-gateway',
    purpose: 'gateway-auth',
    credentialKind: 'token',
    resolver: 'zavorth-secret-store',
    sourceRuntimeId: 'external-executor',
    nativeContract: 'ExternalAgentSecretRef/v1',
  };
}

export function createFixtureExternalAgentSecretResolver(
  syntheticSecretValue = 'synthetic-raw-credential-sentinel-that-must-not-appear',
): ExternalAgentSecretResolver {
  return () => ({
    status: 'resolved',
    value: syntheticSecretValue,
    source: 'fixture',
    realSecretRead: false,
    diagnostics: ['fixture-secret-resolver-used', redactedText(`token=${syntheticSecretValue}`, syntheticSecretValue)],
  });
}

export function resolveExternalAgentSecretRef(
  options: ExternalAgentSecretRefResolverBoundaryOptions,
): ExternalAgentSecretResolutionEnvelope {
  if (!options.policy.processStartAllowed) {
    return failureEnvelope(options, 'policy-blocked', [
      'policy-blocked',
      'process-start-not-allowed',
      'secret-resolver-not-invoked',
    ]);
  }

  if (!options.policy.allowedChannels.includes(options.requestedChannel)) {
    return failureEnvelope(options, 'injection-channel-blocked', [
      `injection-channel-blocked:${options.requestedChannel}`,
      `allowed-channels:${options.policy.allowedChannels.join(',')}`,
      'secret-resolver-not-invoked',
    ]);
  }

  if (options.requestedChannel === 'command-arg' && !options.policy.commandArgExplicitlyAllowed) {
    return failureEnvelope(options, 'injection-channel-blocked', [
      'command-arg-blocked-by-default',
      'secret-resolver-not-invoked',
    ]);
  }

  if (!options.resolver) {
    return failureEnvelope(options, 'secret-unavailable', [
      'secret-unavailable',
      'resolver-unavailable',
    ]);
  }

  const resolved = options.resolver(options.secretRef);

  if (resolved.status !== 'resolved' || !resolved.value) {
    return failureEnvelope(options, 'secret-unavailable', [
      'secret-unavailable',
      ...(resolved.diagnostics || []).map((diagnostic) => redactedText(diagnostic)),
    ]);
  }

  const injectionPlan = planForChannel(options);

  return {
    nativeContract: 'ExternalAgentSecretResolutionEnvelope/v1',
    generatedAt: options.generatedAt,
    secretRef: options.secretRef,
    status: 'resolved',
    requestedChannel: options.requestedChannel,
    allowedChannels: options.policy.allowedChannels,
    injectionPlan,
    audit: {
      id: `${options.idPrefix}:audit-resolved`,
      secretRefId: options.secretRef.id,
      providerId: options.secretRef.providerId,
      channel: options.requestedChannel,
      status: 'resolved',
      reason: options.policy.auditReason,
      rawSecretRecorded: false,
      rawSecretPrinted: false,
      secretLengthRecorded: false,
      secretHashRecorded: false,
      resolverSourceRecordedAsMetadataOnly: true,
      processStarted: false,
      generatedAt: options.generatedAt,
    },
    diagnostics: [
      'secret-ref-resolved',
      `injection-channel:${options.requestedChannel}`,
      ...((resolved.diagnostics || []).map((diagnostic) => redactedText(diagnostic, resolved.value))),
    ],
    failureState: null,
    redaction: {
      required: true,
      rawSecretValuePresentInEnvelope: false,
      rawSecretValuePresentInJson: false,
      accidentalRawInputDiscarded: options.accidentalRawInput !== undefined,
      placeholder: placeholder(options.secretRef.id),
    },
    executionGate: createExecutionGate(resolved.source === 'fixture'),
  };
}

export function normalizeExternalAgentSecretRefResolverBoundaryFixture(): ExternalAgentSecretResolutionEnvelope {
  return resolveExternalAgentSecretRef({
    secretRef: createExternalAgentExternalExecutorGatewaySecretRef(),
    requestedChannel: 'env-var',
    policy: {
      ...EXTERNAL_AGENT_SECRET_REF_DEFAULT_INJECTION_POLICY,
      processStartAllowed: true,
    },
    generatedAt: EXTERNAL_AGENT_SECRET_REF_RESOLVER_BOUNDARY_NOW,
    idPrefix: 'external-agent-secret-ref-resolver',
    resolver: createFixtureExternalAgentSecretResolver(),
  });
}
