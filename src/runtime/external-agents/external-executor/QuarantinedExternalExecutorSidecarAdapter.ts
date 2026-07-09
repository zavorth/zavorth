import {
  EXTERNAL_AGENT_ADAPTER_BOUNDARY_POLICY,
  EXTERNAL_AGENT_NAMING_QUARANTINE,
  normalizeExternalAgentApprovalToZavorthRequest,
  normalizeExternalAgentArtifactToZavorthSummary,
  normalizeExternalAgentCapabilitiesToZavorthProviderContract,
  normalizeExternalAgentCapabilityToZavorthContract,
} from '../index.js';
import { ExternalAgentSidecarActionGate } from '../ExternalAgentSidecarActionGate.js';
import { ExternalAgentSidecarAdapter } from '../ExternalAgentSidecarAdapter.js';

import type {
  ExternalAgentAdapter,
  ExternalAgentAdapterDiagnostics,
  ExternalAgentAdapterLifecycleContract,
  ExternalAgentApprovalEnvelope,
  ExternalAgentArtifactEnvelope,
  ExternalAgentZavorthCapabilityContract,
  ExternalAgentCapabilityDescriptor,
  ExternalAgentCapabilityProviderContract,
  ExternalAgentChannelDescriptor,
  ExternalAgentEventEnvelope,
  ExternalAgentHealthSnapshot,
  ExternalAgentOutboundActionEnvelope,
  ExternalAgentOutboundActionResult,
  ExternalAgentRuntimeDescriptor,
  ExternalAgentSessionDescriptor,
  ExternalAgentSessionEnvelope,
} from '../contracts.js';

import type {
  NormalizedInboundMessage,
} from '../../agent/contracts/index.js';
import type {
  UniversalApprovalRequest,
  UniversalArtifactSummary,
} from '../../agent/UniversalAgentRuntimeTypes.js';

const EXTERNAL_EXECUTOR_DIAGNOSTICS: ExternalAgentAdapterDiagnostics = {
  sourceRuntimeName: 'ExternalExecutor',
  sourceRuntimeVersion: 'frozen-310d2db3124126331b412df68ddd9ca14556b728',
  endpointHint: '/mnt/c/TESTES DEV/zavorth-core/Zavorth/data/vendor/external-executor-repo',
  notes: [
    'Quarantined source-specific adapter; source name is diagnostic evidence only.',
    'Approval gate connects through an injected client and does not copy source runtime modules.',
  ],
};

export type QuarantinedExternalExecutorSidecarClient = {
  getHealth(): Promise<ExternalAgentHealthSnapshot>;
  listCapabilities(): Promise<ExternalAgentCapabilityDescriptor[]>;
  listChannels(): Promise<ExternalAgentChannelDescriptor[]>;
  listSessions(): Promise<ExternalAgentSessionDescriptor[]>;
  listApprovalEnvelopes(): Promise<ExternalAgentApprovalEnvelope[]>;
  listArtifactEnvelopes(): Promise<ExternalAgentArtifactEnvelope[]>;
  pullEvents(): Promise<ExternalAgentEventEnvelope[]>;
  dispatchControlledOutboundAction(action: ExternalAgentOutboundActionEnvelope): Promise<{
    receiptId: string;
    label: string;
    data?: Record<string, unknown>;
  }>;
};

export type QuarantinedExternalExecutorSidecarAdapterOptions = {
  client: QuarantinedExternalExecutorSidecarClient;
  now?: () => Date;
  actionGate?: ExternalAgentSidecarActionGate;
};

export const QUARANTINED_EXTERNAL_EXECUTOR_SIDECAR_LIFECYCLE: ExternalAgentAdapterLifecycleContract = {
  stage: 'sidecar-adapter',
  startBehavior: 'connect-existing-runtime-only',
  stopBehavior: 'disconnect-client-only',
  canSpawnSourceRuntime: false,
  canMutateSourceRuntime: false,
  allowedTransitions: {
    created: ['starting', 'stopped'],
    starting: ['ready', 'degraded', 'offline', 'stopped'],
    ready: ['degraded', 'offline', 'stopped'],
    degraded: ['ready', 'offline', 'stopped'],
    offline: ['starting', 'stopped'],
    stopped: ['starting'],
  },
};

export class QuarantinedExternalExecutorSidecarAdapter implements ExternalAgentAdapter {
  public readonly descriptor: ExternalAgentRuntimeDescriptor = {
    id: 'external-runtime:primary-sidecar',
    label: 'External runtime primary sidecar',
    adapterKind: 'sidecar',
    runtimeKind: 'external-agent-runtime',
    transport: 'stdio',
    version: 'checkpoint-3',
    diagnostics: EXTERNAL_EXECUTOR_DIAGNOSTICS,
    namingQuarantine: EXTERNAL_AGENT_NAMING_QUARANTINE,
    boundary: EXTERNAL_AGENT_ADAPTER_BOUNDARY_POLICY,
  };

  public readonly lifecycle = QUARANTINED_EXTERNAL_EXECUTOR_SIDECAR_LIFECYCLE;

  private readonly client: QuarantinedExternalExecutorSidecarClient;
  private readonly now: () => Date;
  private readonly actionGate: ExternalAgentSidecarActionGate;
  private status: ExternalAgentHealthSnapshot['status'] = 'created';

  constructor(options: QuarantinedExternalExecutorSidecarAdapterOptions) {
    this.client = options.client;
    this.now = options.now || (() => new Date());
    this.actionGate = options.actionGate || new ExternalAgentSidecarActionGate();
  }

  public async start(): Promise<ExternalAgentHealthSnapshot> {
    this.status = 'starting';
    const health = await this.client.getHealth();
    this.status = health.status === 'offline' ? 'offline' : 'ready';
    return {
      ...health,
      runtimeId: this.descriptor.id,
      status: this.status,
      diagnostics: this.descriptor.diagnostics,
    };
  }

  public async stop(): Promise<ExternalAgentHealthSnapshot> {
    this.status = 'stopped';
    return this.getHealth();
  }

  public async getHealth(): Promise<ExternalAgentHealthSnapshot> {
    const health = await this.client.getHealth();
    return {
      ...health,
      runtimeId: this.descriptor.id,
      status: this.status === 'created' ? health.status : this.status,
      diagnostics: this.descriptor.diagnostics,
    };
  }

  public async listCapabilities(): Promise<ExternalAgentCapabilityDescriptor[]> {
    return this.client.listCapabilities();
  }

  public async listChannels(): Promise<ExternalAgentChannelDescriptor[]> {
    return this.client.listChannels();
  }

  public async listSessions(): Promise<ExternalAgentSessionDescriptor[]> {
    return this.client.listSessions();
  }

  public async listSessionEnvelopes(): Promise<ExternalAgentSessionEnvelope[]> {
    const sessions = await this.listSessions();
    return sessions.map((session) => ({
      id: `external-session:${session.id}`,
      runtimeId: this.descriptor.id,
      descriptor: session,
      observedAt: this.now().toISOString(),
      diagnostics: this.descriptor.diagnostics,
    }));
  }

  public async listApprovalEnvelopes(): Promise<ExternalAgentApprovalEnvelope[]> {
    return this.client.listApprovalEnvelopes();
  }

  public async listArtifactEnvelopes(): Promise<ExternalAgentArtifactEnvelope[]> {
    return this.client.listArtifactEnvelopes();
  }

  public async pullTestEvents(): Promise<ExternalAgentEventEnvelope[]> {
    return this.client.pullEvents();
  }

  public normalizeEvent(event: ExternalAgentEventEnvelope): NormalizedInboundMessage {
    return new ExternalAgentSidecarAdapter({
      descriptor: this.descriptor,
      testEvents: [event],
      now: this.now,
    }).normalizeEvent(event);
  }

  public normalizeCapability(
    capability: ExternalAgentCapabilityDescriptor,
  ): ExternalAgentZavorthCapabilityContract {
    return normalizeExternalAgentCapabilityToZavorthContract(capability);
  }

  public async normalizeCapabilityProvider(): Promise<ExternalAgentCapabilityProviderContract>;
  public normalizeCapabilityProvider(capabilities: ExternalAgentCapabilityDescriptor[]): ExternalAgentCapabilityProviderContract;
  public normalizeCapabilityProvider(
    capabilities?: ExternalAgentCapabilityDescriptor[],
  ): Promise<ExternalAgentCapabilityProviderContract> | ExternalAgentCapabilityProviderContract {
    if (capabilities) {
      return normalizeExternalAgentCapabilitiesToZavorthProviderContract(this.descriptor, capabilities);
    }

    return this.listCapabilities().then((listedCapabilities) => (
      normalizeExternalAgentCapabilitiesToZavorthProviderContract(this.descriptor, listedCapabilities)
    ));
  }

  public normalizeApproval(approval: ExternalAgentApprovalEnvelope): UniversalApprovalRequest {
    return normalizeExternalAgentApprovalToZavorthRequest(approval);
  }

  public normalizeArtifact(artifact: ExternalAgentArtifactEnvelope): UniversalArtifactSummary {
    return normalizeExternalAgentArtifactToZavorthSummary(artifact);
  }

  public async dispatchControlledOutboundAction(
    action: ExternalAgentOutboundActionEnvelope,
  ): Promise<ExternalAgentOutboundActionResult> {
    const decision = this.actionGate.evaluate(action, this.descriptor.boundary);
    const dispatchedAt = this.now().toISOString();
    if (!decision.ok) {
      return {
        actionId: action.id,
        runtimeId: this.descriptor.id,
        status: 'blocked',
        dryRun: action.dryRun,
        decision,
        dispatchedAt,
        diagnostics: this.descriptor.diagnostics,
      };
    }

    const receipt = await this.client.dispatchControlledOutboundAction(action);
    return {
      actionId: action.id,
      runtimeId: this.descriptor.id,
      status: action.dryRun ? 'dry-run' : 'dispatched',
      dryRun: action.dryRun,
      decision,
      dispatchedAt,
      receipt: {
        id: receipt.receiptId,
        label: receipt.label,
        data: receipt.data,
      },
      diagnostics: this.descriptor.diagnostics,
    };
  }
}
