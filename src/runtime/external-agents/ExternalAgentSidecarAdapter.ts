import { ToolExposurePolicy } from '../agent/ToolExposurePolicy.js';
import type { ToolExposurePolicyInput } from '../agent/ToolExposurePolicy.js';
import type {
  NormalizedInboundMessage,
} from '../agent/contracts/index.js';
import type {
  UniversalAgentChannel,
  UniversalApprovalRequest,
  UniversalArtifactSummary,
  UniversalToolExposureProfile,
} from '../agent/UniversalAgentRuntimeTypes.js';
import {
  EXTERNAL_AGENT_ADAPTER_BOUNDARY_POLICY,
  EXTERNAL_AGENT_ADAPTER_LIFECYCLE_CONTRACT,
  EXTERNAL_AGENT_NAMING_QUARANTINE,
  type ExternalAgentAdapter,
  type ExternalAgentApprovalEnvelope,
  type ExternalAgentArtifactEnvelope,
  type ExternalAgentZavorthCapabilityContract,
  type ExternalAgentCapabilityDescriptor,
  type ExternalAgentCapabilityProviderContract,
  type ExternalAgentChannelDescriptor,
  type ExternalAgentEventEnvelope,
  type ExternalAgentHealthSnapshot,
  type ExternalAgentRuntimeDescriptor,
  type ExternalAgentSessionDescriptor,
  type ExternalAgentSessionEnvelope,
} from './contracts.js';

export type ExternalAgentSidecarAdapterOptions = {
  descriptor: Omit<ExternalAgentRuntimeDescriptor, 'boundary' | 'namingQuarantine'> & {
    boundary?: ExternalAgentRuntimeDescriptor['boundary'];
    namingQuarantine?: ExternalAgentRuntimeDescriptor['namingQuarantine'];
  };
  capabilities?: ExternalAgentCapabilityDescriptor[];
  channels?: ExternalAgentChannelDescriptor[];
  sessions?: ExternalAgentSessionDescriptor[];
  approvals?: ExternalAgentApprovalEnvelope[];
  artifacts?: ExternalAgentArtifactEnvelope[];
  testEvents?: ExternalAgentEventEnvelope[];
  now?: () => Date;
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

function uniqueStrings(values: unknown[]): string[] {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean)));
}

function normalizeChannel(value: unknown): UniversalAgentChannel {
  const channel = normalizeText(value).toLowerCase();
  if (channel === 'web' || channel === 'cli' || channel === 'telegram' || channel === 'api') {
    return channel;
  }
  return channel ? 'api' : 'unknown';
}

function summarizeTrust(
  capabilities: ExternalAgentCapabilityDescriptor[],
): ExternalAgentHealthSnapshot['capabilities'] {
  return capabilities.reduce<ExternalAgentHealthSnapshot['capabilities']>((summary, capability) => {
    summary.total += 1;
    summary[capability.trustState] += 1;
    return summary;
  }, {
    total: 0,
    trusted: 0,
    safe: 0,
    quarantined: 0,
  });
}

function riskRequiresApproval(capability: ExternalAgentCapabilityDescriptor): boolean {
  return capability.requiresApproval === true
    || capability.risk === 'danger'
    || capability.risk === 'attention'
    || capability.risk === 'unknown';
}

function capabilityToolNames(capability: ExternalAgentCapabilityDescriptor): string[] {
  const toolNames = uniqueStrings(capability.toolNames || []);
  return toolNames.length > 0
    ? toolNames
    : [`external.${normalizeId(capability.id, 'capability')}`];
}

export function normalizeExternalAgentCapabilityToZavorthContract(
  capability: ExternalAgentCapabilityDescriptor,
): ExternalAgentZavorthCapabilityContract {
  const toolNames = capabilityToolNames(capability);
  const quarantined = capability.trustState === 'quarantined';
  const requiresApproval = riskRequiresApproval(capability);
  const toolExposurePolicyInput: ToolExposurePolicyInput = {
    allowedTools: quarantined ? [] : toolNames,
    blockedTools: quarantined ? toolNames : [],
    requireApprovalFor: !quarantined && requiresApproval ? toolNames : [],
    blockedToolReason: 'blocked-by-external-adapter-quarantine',
  };

  return {
    id: `${EXTERNAL_AGENT_NAMING_QUARANTINE.publicIdPrefix}:${normalizeId(capability.id, 'capability')}`,
    label: normalizeText(capability.label, 'External capability'),
    kind: capability.kind,
    risk: capability.risk,
    trustState: capability.trustState,
    toolNames,
    toolExposurePolicyInput,
    inventoryEvidence: capability.inventoryEvidence,
    nativeContract: 'ToolExposurePolicyInput',
  };
}

export function normalizeExternalAgentCapabilitiesToZavorthProviderContract(
  runtime: ExternalAgentRuntimeDescriptor,
  capabilities: ExternalAgentCapabilityDescriptor[],
): ExternalAgentCapabilityProviderContract {
  return {
    id: `${EXTERNAL_AGENT_NAMING_QUARANTINE.publicIdPrefix}-provider:${normalizeId(runtime.id, 'runtime')}`,
    runtimeId: runtime.id,
    label: `External capability provider ${normalizeId(runtime.id, 'runtime')}`,
    capabilities: capabilities.map(normalizeExternalAgentCapabilityToZavorthContract),
    toolExposurePolicyInput: buildToolExposurePolicyInputFromExternalCapabilities(capabilities),
    nativeContract: 'ToolExposurePolicyInput',
    boundary: runtime.boundary,
  };
}

export function buildToolExposurePolicyInputFromExternalCapabilities(
  capabilities: ExternalAgentCapabilityDescriptor[],
): ToolExposurePolicyInput {
  const contracts = capabilities.map(normalizeExternalAgentCapabilityToZavorthContract);
  return {
    requestedTools: uniqueStrings(contracts.flatMap((contract) => contract.toolNames)),
    allowedTools: uniqueStrings(contracts.flatMap((contract) => contract.toolExposurePolicyInput.allowedTools || [])),
    blockedTools: uniqueStrings(contracts.flatMap((contract) => contract.toolExposurePolicyInput.blockedTools || [])),
    requireApprovalFor: uniqueStrings(contracts.flatMap((contract) => contract.toolExposurePolicyInput.requireApprovalFor || [])),
    blockedToolReason: 'blocked-by-external-adapter-quarantine',
  };
}

export function normalizeExternalAgentApprovalToZavorthRequest(
  approval: ExternalAgentApprovalEnvelope,
): UniversalApprovalRequest {
  const normalizedSessionId = normalizeId(approval.sessionId || approval.runtimeId, 'session');
  const actionTools = uniqueStrings(approval.action.requestedToolNames || []);
  const toolSuffix = actionTools.length > 0 ? ` (${actionTools.join(', ')})` : '';

  return {
    id: `external-approval:${normalizeId(approval.id, 'approval')}`,
    runId: `external-run:${normalizedSessionId}`,
    title: normalizeText(approval.title, 'External approval request'),
    reason: normalizeText(
      approval.reason,
      `External ${approval.action.kind} action requires Zavorth approval${toolSuffix}.`,
    ),
    risk: approval.risk,
    status: approval.status,
    createdAt: approval.requestedAt,
  };
}

export function normalizeExternalAgentArtifactToZavorthSummary(
  artifact: ExternalAgentArtifactEnvelope,
): UniversalArtifactSummary {
  return {
    id: `external-artifact:${normalizeId(artifact.id, 'artifact')}`,
    title: normalizeText(artifact.title, 'External artifact'),
    kind: artifact.kind,
    createdAt: artifact.createdAt,
    ...(artifact.sessionId ? {
      sessionId: `external:${normalizeId(artifact.sessionId, 'session')}`,
    } : {}),
    status: artifact.status,
  };
}

export function buildColdContextMetadataFromExternalCapabilities(
  capabilities: ExternalAgentCapabilityDescriptor[],
): Record<string, unknown> {
  const trustSummary = summarizeTrust(capabilities);
  const riskReports = capabilities.map((capability) => {
    const quarantined = capability.trustState === 'quarantined';
    return {
      kind: 'mcp',
      id: normalizeExternalAgentCapabilityToZavorthContract(capability).id,
      toolNames: capabilityToolNames(capability),
      trustState: capability.trustState,
      riskLevel: capability.risk === 'danger' ? 'high' : capability.risk === 'attention' ? 'medium' : 'low',
      quarantined,
      requiresReview: quarantined,
      canExposeToModel: !quarantined,
      canExposeTools: !quarantined,
      reasons: [quarantined ? 'external-capability-quarantined' : `external-capability-${capability.trustState}`],
      sourceCapabilityKind: capability.kind,
      inventoryEvidence: capability.inventoryEvidence || null,
    };
  });

  return {
    externalCapabilityContext: {
      source: 'ExternalAgentSidecarAdapter',
      trustSummary,
      riskReports,
    },
    mcpContext: {
      source: 'ExternalAgentSidecarAdapter',
      trustSummary,
      riskReports,
    },
  };
}

export class ExternalAgentSidecarAdapter implements ExternalAgentAdapter {
  public readonly descriptor: ExternalAgentRuntimeDescriptor;
  public readonly lifecycle = EXTERNAL_AGENT_ADAPTER_LIFECYCLE_CONTRACT;
  private readonly capabilities: ExternalAgentCapabilityDescriptor[];
  private readonly channels: ExternalAgentChannelDescriptor[];
  private readonly sessions: ExternalAgentSessionDescriptor[];
  private readonly approvals: ExternalAgentApprovalEnvelope[];
  private readonly artifacts: ExternalAgentArtifactEnvelope[];
  private readonly testEvents: ExternalAgentEventEnvelope[];
  private readonly now: () => Date;
  private status: ExternalAgentHealthSnapshot['status'] = 'created';

  constructor(options: ExternalAgentSidecarAdapterOptions) {
    this.descriptor = {
      ...options.descriptor,
      boundary: options.descriptor.boundary || EXTERNAL_AGENT_ADAPTER_BOUNDARY_POLICY,
      namingQuarantine: options.descriptor.namingQuarantine || EXTERNAL_AGENT_NAMING_QUARANTINE,
    };
    this.capabilities = options.capabilities || [];
    this.channels = options.channels || [];
    this.sessions = options.sessions || [];
    this.approvals = options.approvals || [];
    this.artifacts = options.artifacts || [];
    this.testEvents = options.testEvents || [];
    this.now = options.now || (() => new Date());
  }

  public async start(): Promise<ExternalAgentHealthSnapshot> {
    this.status = 'starting';
    this.status = 'ready';
    return this.getHealth();
  }

  public async stop(): Promise<ExternalAgentHealthSnapshot> {
    this.status = 'stopped';
    return this.getHealth();
  }

  public async getHealth(): Promise<ExternalAgentHealthSnapshot> {
    return {
      runtimeId: this.descriptor.id,
      status: this.status,
      generatedAt: this.now().toISOString(),
      capabilities: summarizeTrust(this.capabilities),
      approvals: {
        total: this.approvals.length,
        pending: this.approvals.filter((approval) => approval.status === 'pending').length,
      },
      artifacts: {
        total: this.artifacts.length,
        ready: this.artifacts.filter((artifact) => artifact.status === 'ready').length,
      },
      channels: this.channels.slice(),
      diagnostics: this.descriptor.diagnostics,
    };
  }

  public async listCapabilities(): Promise<ExternalAgentCapabilityDescriptor[]> {
    return this.capabilities.slice();
  }

  public async listChannels(): Promise<ExternalAgentChannelDescriptor[]> {
    return this.channels.slice();
  }

  public async listSessions(): Promise<ExternalAgentSessionDescriptor[]> {
    return this.sessions.slice();
  }

  public async listSessionEnvelopes(): Promise<ExternalAgentSessionEnvelope[]> {
    return this.sessions.map((session) => ({
      id: `external-session:${normalizeId(session.id, 'session')}`,
      runtimeId: this.descriptor.id,
      descriptor: session,
      observedAt: this.now().toISOString(),
      diagnostics: this.descriptor.diagnostics,
    }));
  }

  public async listApprovalEnvelopes(): Promise<ExternalAgentApprovalEnvelope[]> {
    return this.approvals.slice();
  }

  public async listArtifactEnvelopes(): Promise<ExternalAgentArtifactEnvelope[]> {
    return this.artifacts.slice();
  }

  public async pullTestEvents(): Promise<ExternalAgentEventEnvelope[]> {
    return this.testEvents.slice();
  }

  public normalizeEvent(event: ExternalAgentEventEnvelope): NormalizedInboundMessage {
    const session = this.sessions.find((candidate) => candidate.id === event.sessionId);
    const channel = normalizeChannel(event.payload.channel || session?.channel || 'api');
    const text = normalizeText(event.payload.text, '[external event without text]');
    const requestedTools = uniqueStrings(event.payload.requestedTools || []);

    return {
      requestId: `external-event:${normalizeId(event.id, 'event')}`,
      traceId: `${this.descriptor.id}:${normalizeId(event.sessionId, 'session')}:${normalizeId(event.id, 'event')}`,
      userId: normalizeText(event.actor.id, session?.userId || 'external-user'),
      sessionId: `external:${normalizeId(event.sessionId, 'session')}`,
      channel,
      text,
      workspace: event.payload.workspace ?? session?.workspace ?? null,
      requestedTools,
      metadata: {
        source: 'external-agent-adapter',
        normalizedInboundMessage: true,
        externalAdapter: {
          adapterId: this.descriptor.id,
          runtimeId: event.runtimeId,
          eventId: event.id,
          eventKind: event.kind,
          occurredAt: event.occurredAt,
          rawType: event.payload.rawType || null,
          channel: event.payload.channel || session?.channel || null,
          boundary: {
            gatewayEntry: 'ZavorthAgentGateway.handle',
            replyEntry: 'ReplyPipeline',
            policyEntry: 'ToolExposurePolicy',
          },
          diagnostics: event.diagnostics || this.descriptor.diagnostics || null,
        },
      },
    };
  }

  public normalizeCapability(
    capability: ExternalAgentCapabilityDescriptor,
  ): ExternalAgentZavorthCapabilityContract {
    return normalizeExternalAgentCapabilityToZavorthContract(capability);
  }

  public normalizeCapabilityProvider(
    capabilities: ExternalAgentCapabilityDescriptor[] = this.capabilities,
  ): ExternalAgentCapabilityProviderContract {
    return normalizeExternalAgentCapabilitiesToZavorthProviderContract(this.descriptor, capabilities);
  }

  public normalizeApproval(approval: ExternalAgentApprovalEnvelope): UniversalApprovalRequest {
    return normalizeExternalAgentApprovalToZavorthRequest(approval);
  }

  public normalizeArtifact(artifact: ExternalAgentArtifactEnvelope): UniversalArtifactSummary {
    return normalizeExternalAgentArtifactToZavorthSummary(artifact);
  }

  public buildToolExposureProfile(
    capabilities: ExternalAgentCapabilityDescriptor[] = this.capabilities,
    policy = new ToolExposurePolicy(),
  ): UniversalToolExposureProfile {
    return policy.buildProfile(buildToolExposurePolicyInputFromExternalCapabilities(capabilities));
  }

  public buildColdContextMetadata(
    capabilities: ExternalAgentCapabilityDescriptor[] = this.capabilities,
  ): Record<string, unknown> {
    return buildColdContextMetadataFromExternalCapabilities(capabilities);
  }
}
