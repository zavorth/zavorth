import {
  EXTERNAL_AGENT_ADAPTER_BOUNDARY_POLICY,
  EXTERNAL_AGENT_NAMING_QUARANTINE,
  type ExternalAgentAdapterBoundaryPolicy,
  type ExternalAgentHealthSnapshot,
  type ExternalAgentNamingQuarantine,
  type ExternalAgentRuntimeDescriptor,
} from './contracts.js';

export type ExternalAgentGatewayHandshakeSourceEvidence = {
  sourceRuntimeName?: string;
  sourceRuntimeVersion?: string;
  sourcePaths: string[];
  observedAt: string;
  notes?: string[];
};

export type ExternalAgentGatewayHandshakeEvidence = {
  fixtureCase?: string;
  clientId: string;
  sourceRole: string;
  sourceScopes: string[];
  sourceToken?: string;
  sourceTokenPresent?: boolean;
  sourceEvidence?: ExternalAgentGatewayHandshakeSourceEvidence;
};

export type ExternalAgentGatewayHandshakeTrust = {
  authority: 'zavorth';
  sourceTokenAuthority: false;
  tokenEvidence: 'present-redacted' | 'missing';
  acceptedScopes: string[];
  downgradedScopes: string[];
  sourceRoleEvidence: string;
};

export type ExternalAgentGatewayHandshakeNormalization = {
  descriptor: ExternalAgentRuntimeDescriptor;
  health: ExternalAgentHealthSnapshot;
  trust: ExternalAgentGatewayHandshakeTrust;
};

export type ExternalAgentGatewayHandshakeBoundaryOptions = {
  descriptorIdPrefix?: string;
  label?: string;
  transport?: ExternalAgentRuntimeDescriptor['transport'];
  observedAt: string;
  acceptedScopes?: string[];
  sourceRuntimeVersion?: string;
  namingQuarantine?: ExternalAgentNamingQuarantine;
  boundary?: ExternalAgentAdapterBoundaryPolicy;
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

function tokenEvidenceFor(evidence: ExternalAgentGatewayHandshakeEvidence): ExternalAgentGatewayHandshakeTrust['tokenEvidence'] {
  return evidence.sourceToken || evidence.sourceTokenPresent ? 'present-redacted' : 'missing';
}

export function normalizeExternalAgentGatewayHandshake(
  evidence: ExternalAgentGatewayHandshakeEvidence,
  options: ExternalAgentGatewayHandshakeBoundaryOptions,
): ExternalAgentGatewayHandshakeNormalization {
  const allowedSourceScopes = new Set<string>(options.acceptedScopes || ['gateway:read', 'sessions:read']);
  const acceptedScopes = evidence.sourceScopes.filter((scope) => allowedSourceScopes.has(scope));
  const downgradedScopes = evidence.sourceScopes.filter((scope) => !acceptedScopes.includes(scope));
  const status: ExternalAgentHealthSnapshot['status'] = downgradedScopes.length > 0 ? 'degraded' : 'ready';
  const descriptorIdPrefix = normalizeText(options.descriptorIdPrefix, 'external-gateway-handshake');
  const sourceRuntimeVersion = evidence.sourceEvidence?.sourceRuntimeVersion || options.sourceRuntimeVersion;
  const tokenEvidence = tokenEvidenceFor(evidence);
  const descriptor: ExternalAgentRuntimeDescriptor = {
    id: `${descriptorIdPrefix}:${normalizeId(evidence.clientId, 'client')}`,
    label: normalizeText(options.label, 'External gateway handshake evidence'),
    adapterKind: 'sidecar',
    runtimeKind: 'external-agent-runtime',
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
    namingQuarantine: options.namingQuarantine || EXTERNAL_AGENT_NAMING_QUARANTINE,
    boundary: options.boundary || EXTERNAL_AGENT_ADAPTER_BOUNDARY_POLICY,
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
