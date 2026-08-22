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
  RUNTIME_ADAPTER_ADAPTER_BOUNDARY_POLICY,
  RUNTIME_ADAPTER_ADAPTER_LIFECYCLE_CONTRACT,
  RUNTIME_ADAPTER_NAMING_QUARANTINE,
  type RuntimeAdapterAdapter,
  type RuntimeAdapterApprovalEnvelope,
  type RuntimeAdapterArtifactEnvelope,
  type RuntimeAdapterZavorthCapabilityContract,
  type RuntimeAdapterCapabilityDescriptor,
  type RuntimeAdapterCapabilityProviderContract,
  type RuntimeAdapterChannelDescriptor,
  type RuntimeAdapterEventEnvelope,
  type RuntimeAdapterHealthSnapshot,
  type RuntimeAdapterRuntimeDescriptor,
  type RuntimeAdapterSessionDescriptor,
  type RuntimeAdapterSessionEnvelope,
} from './contracts.js';

export type RuntimeAdapterSidecarAdapterOptions = {
  descriptor: Omit<RuntimeAdapterRuntimeDescriptor, 'boundary' | 'namingQuarantine'> & {
    boundary?: RuntimeAdapterRuntimeDescriptor['boundary'];
    namingQuarantine?: RuntimeAdapterRuntimeDescriptor['namingQuarantine'];
  };
  capabilities?: RuntimeAdapterCapabilityDescriptor[];
  channels?: RuntimeAdapterChannelDescriptor[];
  sessions?: RuntimeAdapterSessionDescriptor[];
  approvals?: RuntimeAdapterApprovalEnvelope[];
  artifacts?: RuntimeAdapterArtifactEnvelope[];
  testEvents?: RuntimeAdapterEventEnvelope[];
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
  capabilities: RuntimeAdapterCapabilityDescriptor[],
): RuntimeAdapterHealthSnapshot['capabilities'] {
  return capabilities.reduce<RuntimeAdapterHealthSnapshot['capabilities']>((summary, capability) => {
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

function riskRequiresApproval(capability: RuntimeAdapterCapabilityDescriptor): boolean {
  return capability.requiresApproval === true
    || capability.risk === 'danger'
    || capability.risk === 'attention'
    || capability.risk === 'unknown';
}

function capabilityToolNames(capability: RuntimeAdapterCapabilityDescriptor): string[] {
  const toolNames = uniqueStrings(capability.toolNames || []);
  return toolNames.length > 0
    ? toolNames
    : [`external.${normalizeId(capability.id, 'capability')}`];
}

export function normalizeRuntimeAdapterCapabilityToZavorthContract(
  capability: RuntimeAdapterCapabilityDescriptor,
): RuntimeAdapterZavorthCapabilityContract {
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
    id: `${RUNTIME_ADAPTER_NAMING_QUARANTINE.publicIdPrefix}:${normalizeId(capability.id, 'capability')}`,
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

export function normalizeRuntimeAdapterCapabilitiesToZavorthProviderContract(
  runtime: RuntimeAdapterRuntimeDescriptor,
  capabilities: RuntimeAdapterCapabilityDescriptor[],
): RuntimeAdapterCapabilityProviderContract {
  return {
    id: `${RUNTIME_ADAPTER_NAMING_QUARANTINE.publicIdPrefix}-provider:${normalizeId(runtime.id, 'runtime')}`,
    runtimeId: runtime.id,
    label: `External capability provider ${normalizeId(runtime.id, 'runtime')}`,
    capabilities: capabilities.map(normalizeRuntimeAdapterCapabilityToZavorthContract),
    toolExposurePolicyInput: buildToolExposurePolicyInputFromExternalCapabilities(capabilities),
    nativeContract: 'ToolExposurePolicyInput',
    boundary: runtime.boundary,
  };
}

export function buildToolExposurePolicyInputFromExternalCapabilities(
  capabilities: RuntimeAdapterCapabilityDescriptor[],
): ToolExposurePolicyInput {
  const contracts = capabilities.map(normalizeRuntimeAdapterCapabilityToZavorthContract);
  return {
    requestedTools: uniqueStrings(contracts.flatMap((contract) => contract.toolNames)),
    allowedTools: uniqueStrings(contracts.flatMap((contract) => contract.toolExposurePolicyInput.allowedTools || [])),
    blockedTools: uniqueStrings(contracts.flatMap((contract) => contract.toolExposurePolicyInput.blockedTools || [])),
    requireApprovalFor: uniqueStrings(contracts.flatMap((contract) => contract.toolExposurePolicyInput.requireApprovalFor || [])),
    blockedToolReason: 'blocked-by-external-adapter-quarantine',
  };
}

export function normalizeRuntimeAdapterApprovalToZavorthRequest(
  approval: RuntimeAdapterApprovalEnvelope,
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

export function normalizeRuntimeAdapterArtifactToZavorthSummary(
  artifact: RuntimeAdapterArtifactEnvelope,
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
  capabilities: RuntimeAdapterCapabilityDescriptor[],
): Record<string, unknown> {
  const trustSummary = summarizeTrust(capabilities);
  const riskReports = capabilities.map((capability) => {
    const quarantined = capability.trustState === 'quarantined';
    return {
      kind: 'mcp',
      id: normalizeRuntimeAdapterCapabilityToZavorthContract(capability).id,
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
      source: 'RuntimeAdapterSidecarAdapter',
      trustSummary,
      riskReports,
    },
    mcpContext: {
      source: 'RuntimeAdapterSidecarAdapter',
      trustSummary,
      riskReports,
    },
  };
}

export class RuntimeAdapterSidecarAdapter implements RuntimeAdapterAdapter {
  public readonly descriptor: RuntimeAdapterRuntimeDescriptor;
  public readonly lifecycle = RUNTIME_ADAPTER_ADAPTER_LIFECYCLE_CONTRACT;
  private readonly capabilities: RuntimeAdapterCapabilityDescriptor[];
  private readonly channels: RuntimeAdapterChannelDescriptor[];
  private readonly sessions: RuntimeAdapterSessionDescriptor[];
  private readonly approvals: RuntimeAdapterApprovalEnvelope[];
  private readonly artifacts: RuntimeAdapterArtifactEnvelope[];
  private readonly testEvents: RuntimeAdapterEventEnvelope[];
  private readonly now: () => Date;
  private status: RuntimeAdapterHealthSnapshot['status'] = 'created';

  constructor(options: RuntimeAdapterSidecarAdapterOptions) {
    this.descriptor = {
      ...options.descriptor,
      boundary: options.descriptor.boundary || RUNTIME_ADAPTER_ADAPTER_BOUNDARY_POLICY,
      namingQuarantine: options.descriptor.namingQuarantine || RUNTIME_ADAPTER_NAMING_QUARANTINE,
    };
    this.capabilities = options.capabilities || [];
    this.channels = options.channels || [];
    this.sessions = options.sessions || [];
    this.approvals = options.approvals || [];
    this.artifacts = options.artifacts || [];
    this.testEvents = options.testEvents || [];
    this.now = options.now || (() => new Date());
  }

  public async start(): Promise<RuntimeAdapterHealthSnapshot> {
    this.status = 'starting';
    this.status = 'ready';
    return this.getHealth();
  }

  public async stop(): Promise<RuntimeAdapterHealthSnapshot> {
    this.status = 'stopped';
    return this.getHealth();
  }

  public async getHealth(): Promise<RuntimeAdapterHealthSnapshot> {
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

  public async listCapabilities(): Promise<RuntimeAdapterCapabilityDescriptor[]> {
    return this.capabilities.slice();
  }

  public async listChannels(): Promise<RuntimeAdapterChannelDescriptor[]> {
    return this.channels.slice();
  }

  public async listSessions(): Promise<RuntimeAdapterSessionDescriptor[]> {
    return this.sessions.slice();
  }

  public async listSessionEnvelopes(): Promise<RuntimeAdapterSessionEnvelope[]> {
    return this.sessions.map((session) => ({
      id: `external-session:${normalizeId(session.id, 'session')}`,
      runtimeId: this.descriptor.id,
      descriptor: session,
      observedAt: this.now().toISOString(),
      diagnostics: this.descriptor.diagnostics,
    }));
  }

  public async listApprovalEnvelopes(): Promise<RuntimeAdapterApprovalEnvelope[]> {
    return this.approvals.slice();
  }

  public async listArtifactEnvelopes(): Promise<RuntimeAdapterArtifactEnvelope[]> {
    return this.artifacts.slice();
  }

  public async pullTestEvents(): Promise<RuntimeAdapterEventEnvelope[]> {
    return this.testEvents.slice();
  }

  public normalizeEvent(event: RuntimeAdapterEventEnvelope): NormalizedInboundMessage {
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
        source: 'runtime-adapter-adapter',
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
    capability: RuntimeAdapterCapabilityDescriptor,
  ): RuntimeAdapterZavorthCapabilityContract {
    return normalizeRuntimeAdapterCapabilityToZavorthContract(capability);
  }

  public normalizeCapabilityProvider(
    capabilities: RuntimeAdapterCapabilityDescriptor[] = this.capabilities,
  ): RuntimeAdapterCapabilityProviderContract {
    return normalizeRuntimeAdapterCapabilitiesToZavorthProviderContract(this.descriptor, capabilities);
  }

  public normalizeApproval(approval: RuntimeAdapterApprovalEnvelope): UniversalApprovalRequest {
    return normalizeRuntimeAdapterApprovalToZavorthRequest(approval);
  }

  public normalizeArtifact(artifact: RuntimeAdapterArtifactEnvelope): UniversalArtifactSummary {
    return normalizeRuntimeAdapterArtifactToZavorthSummary(artifact);
  }

  public buildToolExposureProfile(
    capabilities: RuntimeAdapterCapabilityDescriptor[] = this.capabilities,
    policy = new ToolExposurePolicy(),
  ): UniversalToolExposureProfile {
    return policy.buildProfile(buildToolExposurePolicyInputFromExternalCapabilities(capabilities));
  }

  public buildColdContextMetadata(
    capabilities: RuntimeAdapterCapabilityDescriptor[] = this.capabilities,
  ): Record<string, unknown> {
    return buildColdContextMetadataFromExternalCapabilities(capabilities);
  }
}
