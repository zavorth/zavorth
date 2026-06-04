import {
  RUNTIME_ADAPTER_ADAPTER_BOUNDARY_POLICY,
  RUNTIME_ADAPTER_NAMING_QUARANTINE,
  normalizeRuntimeAdapterApprovalToZavorthRequest,
  normalizeRuntimeAdapterArtifactToZavorthSummary,
  normalizeRuntimeAdapterCapabilitiesToZavorthProviderContract,
  normalizeRuntimeAdapterCapabilityToZavorthContract,
} from '../index.js';
import { RuntimeAdapterSidecarActionGate } from '../RuntimeAdapterSidecarActionGate.js';
import type {
  RuntimeAdapterAdapter,
  RuntimeAdapterAdapterDiagnostics,
  RuntimeAdapterAdapterLifecycleContract,
  RuntimeAdapterApprovalEnvelope,
  RuntimeAdapterArtifactEnvelope,
  RuntimeAdapterZavorthCapabilityContract,
  RuntimeAdapterCapabilityDescriptor,
  RuntimeAdapterCapabilityProviderContract,
  RuntimeAdapterChannelDescriptor,
  RuntimeAdapterEventEnvelope,
  RuntimeAdapterHealthSnapshot,
  RuntimeAdapterOutboundActionEnvelope,
  RuntimeAdapterOutboundActionResult,
  RuntimeAdapterRuntimeDescriptor,
  RuntimeAdapterSessionDescriptor,
  RuntimeAdapterSessionEnvelope,
} from '../contracts.js';
import { RuntimeAdapterSidecarAdapter } from '../RuntimeAdapterSidecarAdapter.js';
import type {
  NormalizedInboundMessage,
} from '../../agent/contracts/index.js';
import type {
  UniversalApprovalRequest,
  UniversalArtifactSummary,
} from '../../agent/UniversalAgentRuntimeTypes.js';

const EXTERNAL_EXECUTOR_DIAGNOSTICS: RuntimeAdapterAdapterDiagnostics = {
  sourceRuntimeName: 'ExternalExecutor',
  sourceRuntimeVersion: 'frozen-310d2db3124126331b412df68ddd9ca14556b728',
  endpointHint: '/mnt/c/TESTES DEV/zavorth-core/Zavorth/data/vendor/external-executor-repo',
  notes: [
    'Quarantined source-specific adapter; source name is diagnostic evidence only.',
    'Approval gate connects through an injected client and does not copy source runtime modules.',
  ],
};

export type QuarantinedExternalExecutorSidecarClient = {
  getHealth(): Promise<RuntimeAdapterHealthSnapshot>;
  listCapabilities(): Promise<RuntimeAdapterCapabilityDescriptor[]>;
  listChannels(): Promise<RuntimeAdapterChannelDescriptor[]>;
  listSessions(): Promise<RuntimeAdapterSessionDescriptor[]>;
  listApprovalEnvelopes(): Promise<RuntimeAdapterApprovalEnvelope[]>;
  listArtifactEnvelopes(): Promise<RuntimeAdapterArtifactEnvelope[]>;
  pullEvents(): Promise<RuntimeAdapterEventEnvelope[]>;
  dispatchControlledOutboundAction(action: RuntimeAdapterOutboundActionEnvelope): Promise<{
    receiptId: string;
    label: string;
    data?: Record<string, unknown>;
  }>;
};

export type QuarantinedExternalExecutorSidecarAdapterOptions = {
  client: QuarantinedExternalExecutorSidecarClient;
  now?: () => Date;
  actionGate?: RuntimeAdapterSidecarActionGate;
};

export const QUARANTINED_EXTERNAL_EXECUTOR_SIDECAR_LIFECYCLE: RuntimeAdapterAdapterLifecycleContract = {
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

export class QuarantinedExternalExecutorSidecarAdapter implements RuntimeAdapterAdapter {
  public readonly descriptor: RuntimeAdapterRuntimeDescriptor = {
    id: 'external-runtime:primary-sidecar',
    label: 'External runtime primary sidecar',
    adapterKind: 'sidecar',
    runtimeKind: 'runtime-adapter-runtime',
    transport: 'stdio',
    version: 'checkpoint-3',
    diagnostics: EXTERNAL_EXECUTOR_DIAGNOSTICS,
    namingQuarantine: RUNTIME_ADAPTER_NAMING_QUARANTINE,
    boundary: RUNTIME_ADAPTER_ADAPTER_BOUNDARY_POLICY,
  };

  public readonly lifecycle = QUARANTINED_EXTERNAL_EXECUTOR_SIDECAR_LIFECYCLE;

  private readonly client: QuarantinedExternalExecutorSidecarClient;
  private readonly now: () => Date;
  private readonly actionGate: RuntimeAdapterSidecarActionGate;
  private status: RuntimeAdapterHealthSnapshot['status'] = 'created';

  constructor(options: QuarantinedExternalExecutorSidecarAdapterOptions) {
    this.client = options.client;
    this.now = options.now || (() => new Date());
    this.actionGate = options.actionGate || new RuntimeAdapterSidecarActionGate();
  }

  public async start(): Promise<RuntimeAdapterHealthSnapshot> {
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

  public async stop(): Promise<RuntimeAdapterHealthSnapshot> {
    this.status = 'stopped';
    return this.getHealth();
  }

  public async getHealth(): Promise<RuntimeAdapterHealthSnapshot> {
    const health = await this.client.getHealth();
    return {
      ...health,
      runtimeId: this.descriptor.id,
      status: this.status === 'created' ? health.status : this.status,
      diagnostics: this.descriptor.diagnostics,
    };
  }

  public async listCapabilities(): Promise<RuntimeAdapterCapabilityDescriptor[]> {
    return this.client.listCapabilities();
  }

  public async listChannels(): Promise<RuntimeAdapterChannelDescriptor[]> {
    return this.client.listChannels();
  }

  public async listSessions(): Promise<RuntimeAdapterSessionDescriptor[]> {
    return this.client.listSessions();
  }

  public async listSessionEnvelopes(): Promise<RuntimeAdapterSessionEnvelope[]> {
    const sessions = await this.listSessions();
    return sessions.map((session) => ({
      id: `external-session:${session.id}`,
      runtimeId: this.descriptor.id,
      descriptor: session,
      observedAt: this.now().toISOString(),
      diagnostics: this.descriptor.diagnostics,
    }));
  }

  public async listApprovalEnvelopes(): Promise<RuntimeAdapterApprovalEnvelope[]> {
    return this.client.listApprovalEnvelopes();
  }

  public async listArtifactEnvelopes(): Promise<RuntimeAdapterArtifactEnvelope[]> {
    return this.client.listArtifactEnvelopes();
  }

  public async pullTestEvents(): Promise<RuntimeAdapterEventEnvelope[]> {
    return this.client.pullEvents();
  }

  public normalizeEvent(event: RuntimeAdapterEventEnvelope): NormalizedInboundMessage {
    return new RuntimeAdapterSidecarAdapter({
      descriptor: this.descriptor,
      testEvents: [event],
      now: this.now,
    }).normalizeEvent(event);
  }

  public normalizeCapability(
    capability: RuntimeAdapterCapabilityDescriptor,
  ): RuntimeAdapterZavorthCapabilityContract {
    return normalizeRuntimeAdapterCapabilityToZavorthContract(capability);
  }

  public async normalizeCapabilityProvider(): Promise<RuntimeAdapterCapabilityProviderContract>;
  public normalizeCapabilityProvider(capabilities: RuntimeAdapterCapabilityDescriptor[]): RuntimeAdapterCapabilityProviderContract;
  public normalizeCapabilityProvider(
    capabilities?: RuntimeAdapterCapabilityDescriptor[],
  ): Promise<RuntimeAdapterCapabilityProviderContract> | RuntimeAdapterCapabilityProviderContract {
    if (capabilities) {
      return normalizeRuntimeAdapterCapabilitiesToZavorthProviderContract(this.descriptor, capabilities);
    }

    return this.listCapabilities().then((listedCapabilities) => (
      normalizeRuntimeAdapterCapabilitiesToZavorthProviderContract(this.descriptor, listedCapabilities)
    ));
  }

  public normalizeApproval(approval: RuntimeAdapterApprovalEnvelope): UniversalApprovalRequest {
    return normalizeRuntimeAdapterApprovalToZavorthRequest(approval);
  }

  public normalizeArtifact(artifact: RuntimeAdapterArtifactEnvelope): UniversalArtifactSummary {
    return normalizeRuntimeAdapterArtifactToZavorthSummary(artifact);
  }

  public async dispatchControlledOutboundAction(
    action: RuntimeAdapterOutboundActionEnvelope,
  ): Promise<RuntimeAdapterOutboundActionResult> {
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
