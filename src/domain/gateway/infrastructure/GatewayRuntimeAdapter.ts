import type {
  GatewayChannelRegistryPort,
  GatewayDomainPort,
  GatewayDomainReadModel,
  GatewayMemoryPlanePort,
  GatewayRemoteTransportPort,
  GatewayRuntimeSnapshotPort,
  GatewayServiceSnapshotPort,
  GatewaySessionPlanePort,
  GatewayStatusInput,
} from '../domain/GatewayDomainTypes.js';

type GatewayRuntimeAdapterRuntime = {
  now?: () => Date;
  gatewayRuntime?: GatewayRuntimeSnapshotPort | null;
  gatewayService?: GatewayServiceSnapshotPort | null;
  channelRegistry?: GatewayChannelRegistryPort | null;
  sessionPlane?: GatewaySessionPlanePort | null;
  memoryPlane?: GatewayMemoryPlanePort | null;
  remoteTransports?: GatewayRemoteTransportPort | null;
};

export class GatewayRuntimeAdapter implements GatewayDomainPort {
  private readonly now: () => Date;
  private readonly gatewayRuntime: GatewayRuntimeSnapshotPort | null;
  private readonly gatewayService: GatewayServiceSnapshotPort | null;
  private readonly channelRegistry: GatewayChannelRegistryPort | null;
  private readonly sessionPlane: GatewaySessionPlanePort | null;
  private readonly memoryPlane: GatewayMemoryPlanePort | null;
  private readonly remoteTransports: GatewayRemoteTransportPort | null;

  constructor(runtime: GatewayRuntimeAdapterRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.gatewayRuntime = runtime.gatewayRuntime || null;
    this.gatewayService = runtime.gatewayService || null;
    this.channelRegistry = runtime.channelRegistry || null;
    this.sessionPlane = runtime.sessionPlane || null;
    this.memoryPlane = runtime.memoryPlane || null;
    this.remoteTransports = runtime.remoteTransports || null;
  }

  public readGatewayState(input: GatewayStatusInput): GatewayDomainReadModel {
    const runtimeSnapshot = this.gatewayRuntime?.buildCoreSnapshot() || null;
    const gatewaySnapshot = this.gatewayService?.buildSnapshot() || null;
    const sessionPlaneSnapshot = this.sessionPlane?.buildStatusSummaryFast(input) || null;
    const memoryPlaneSnapshot = this.memoryPlane?.buildSnapshotFast(input) || null;
    const remoteTransportSnapshot = this.remoteTransports?.buildSnapshot() || null;
    const channelCount = this.channelRegistry?.listChannels().length || 0;
    const channels = Number(
      gatewaySnapshot?.summary?.channelsTotal
      ?? runtimeSnapshot?.channels?.total
      ?? channelCount,
    ) || 0;
    const sessions = Number(
      gatewaySnapshot?.summary?.sessionTargets
      ?? runtimeSnapshot?.sessions?.total
      ?? sessionPlaneSnapshot?.summary?.sessions,
    ) || 0;
    const memoryArtifacts = Number(
      gatewaySnapshot?.summary?.memoryArtifacts
      ?? memoryPlaneSnapshot?.summary?.artifacts,
    ) || 0;
    const remoteTransportsReady = Number(
      gatewaySnapshot?.summary?.remoteTransportsReady
      ?? remoteTransportSnapshot?.summary?.ready,
    ) || 0;
    const state = typeof runtimeSnapshot?.lifecycle?.state === 'string'
      ? runtimeSnapshot.lifecycle.state
      : null;
    const hasSignals = Boolean(
      runtimeSnapshot
      || gatewaySnapshot
      || sessionPlaneSnapshot
      || memoryPlaneSnapshot
      || remoteTransportSnapshot
      || this.channelRegistry,
    );

    return {
      generatedAt: this.now().toISOString(),
      state,
      channels,
      sessions,
      memoryArtifacts,
      remoteTransportsReady,
      summary: gatewaySnapshot?.narrative?.operatorSummary
        || (state
          ? `Gateway em estado ${state} com ${channels} canal(is) e ${sessions} sessao(oes) visivel(is).`
          : hasSignals
            ? `Gateway consolidado com ${channels} canal(is), ${sessions} sessao(oes) e ${remoteTransportsReady} transporte(s) remoto(s) pronto(s).`
            : 'Gateway domain aguardando runtime e snapshots canonicos.'),
      details: [
        state ? `Lifecycle: ${state}.` : 'Lifecycle ainda nao foi publicado no runtime.',
        `Channels: ${channels}.`,
        `Sessions: ${sessions}.`,
        hasSignals
          ? `Memory artifacts: ${memoryArtifacts} | remote transports ready: ${remoteTransportsReady}.`
          : 'Snapshot expandido do gateway ainda nao foi injetado neste dominio.',
      ],
      source: hasSignals ? 'gateway' : 'empty',
    };
  }
}
