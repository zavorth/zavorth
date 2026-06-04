import {
  RUNTIME_ADAPTER_ADAPTER_BOUNDARY_POLICY,
  RUNTIME_ADAPTER_NAMING_QUARANTINE,
  type RuntimeAdapterAdapterBoundaryPolicy,
  type RuntimeAdapterHealthSnapshot,
  type RuntimeAdapterNamingQuarantine,
  type RuntimeAdapterRuntimeDescriptor,
} from './contracts.js';

export type RuntimeAdapterGatewayHandshakeSourceEvidence = {
  sourceRuntimeName?: string;
  sourceRuntimeVersion?: string;
  sourcePaths: string[];
  observedAt: string;
  notes?: string[];
};

export type RuntimeAdapterGatewayHandshakeEvidence = {
  fixtureCase?: string;
  clientId: string;
  sourceRole: string;
  sourceScopes: string[];
  sourceToken?: string;
  sourceTokenPresent?: boolean;
  sourceEvidence?: RuntimeAdapterGatewayHandshakeSourceEvidence;
};

export type RuntimeAdapterGatewayHandshakeTrust = {
  authority: 'zavorth';
  sourceTokenAuthority: false;
  tokenEvidence: 'present-redacted' | 'missing';
  acceptedScopes: string[];
  downgradedScopes: string[];
  sourceRoleEvidence: string;
};

export type RuntimeAdapterGatewayHandshakeNormalization = {
  descriptor: RuntimeAdapterRuntimeDescriptor;
  health: RuntimeAdapterHealthSnapshot;
  trust: RuntimeAdapterGatewayHandshakeTrust;
};

export type RuntimeAdapterGatewayHandshakeBoundaryOptions = {
  descriptorIdPrefix?: string;
  label?: string;
  transport?: RuntimeAdapterRuntimeDescriptor['transport'];
  observedAt: string;
  acceptedScopes?: string[];
  sourceRuntimeVersion?: string;
  namingQuarantine?: RuntimeAdapterNamingQuarantine;
  boundary?: RuntimeAdapterAdapterBoundaryPolicy;
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeId(value: unknown, fallback: string): string {
  const normalized = normalizeText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function tokenEvidenceFor(evidence: RuntimeAdapterGatewayHandshakeEvidence): RuntimeAdapterGatewayHandshakeTrust['tokenEvidence'] {
  return evidence.sourceToken || evidence.sourceTokenPresent ? 'present-redacted' : 'missing';
}

export function normalizeRuntimeAdapterGatewayHandshake(
  evidence: RuntimeAdapterGatewayHandshakeEvidence,
  options: RuntimeAdapterGatewayHandshakeBoundaryOptions,
): RuntimeAdapterGatewayHandshakeNormalization {
  const allowedSourceScopes = new Set<string>(options.acceptedScopes || ['gateway:read', 'sessions:read']);
  const acceptedScopes = evidence.sourceScopes.filter((scope) => allowedSourceScopes.has(scope));
  const downgradedScopes = evidence.sourceScopes.filter((scope) => !acceptedScopes.includes(scope));
  const status: RuntimeAdapterHealthSnapshot['status'] = downgradedScopes.length > 0 ? 'degraded' : 'ready';
  const descriptorIdPrefix = normalizeText(options.descriptorIdPrefix, 'external-gateway-handshake');
  const sourceRuntimeVersion = evidence.sourceEvidence?.sourceRuntimeVersion || options.sourceRuntimeVersion;
  const tokenEvidence = tokenEvidenceFor(evidence);
  const descriptor: RuntimeAdapterRuntimeDescriptor = {
    id: `${descriptorIdPrefix}:${normalizeId(evidence.clientId, 'client')}`,
    label: normalizeText(options.label, 'External gateway handshake evidence'),
    adapterKind: 'sidecar',
    runtimeKind: 'runtime-adapter-runtime',
    transport: options.transport || 'fixture',
    version: 'handshake-boundary',
    diagnostics: {
      sourceRuntimeName: evidence.sourceEvidence?.sourceRuntimeName,
      sourceRuntimeVersion,
      notes: [
        ...(evidence.sourceEvidence?.notes || []),
        `source-role:${normalizeText(evidence.sourceRole, 'unknown')}`,
        `source-client:${normalizeText(evidence.clientId, 'client')}`,
        `source-token:${tokenEvidence}`,
        `accepted-scopes:${acceptedScopes.join(',') || 'none'}`,
        `downgraded-scopes:${downgradedScopes.join(',') || 'none'}`,
      ],
    },
    namingQuarantine: options.namingQuarantine || RUNTIME_ADAPTER_NAMING_QUARANTINE,
    boundary: options.boundary || RUNTIME_ADAPTER_ADAPTER_BOUNDARY_POLICY,
  };

  return {
    descriptor,
    health: {
      runtimeId: descriptor.id,
      status,
      generatedAt: options.observedAt,
      capabilities: {
        total: 0,
        trusted: 0,
        safe: 0,
        quarantined: 0,
      },
      channels: [],
      diagnostics: descriptor.diagnostics,
    },
    trust: {
      authority: 'zavorth',
      sourceTokenAuthority: false,
      tokenEvidence,
      acceptedScopes,
      downgradedScopes,
      sourceRoleEvidence: normalizeText(evidence.sourceRole, 'unknown'),
    },
  };
}
