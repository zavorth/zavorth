import { DomainFacadeBase, type DomainSnapshot } from '../DomainFacadeBase.js';
import type { OperationsHealthPort } from './domain/OpsDomainTypes.js';

type OpsFacadeRuntime = {
  now?: () => Date;
  operationsHealthService?: OperationsHealthPort;
};

export type OpsDomainSnapshot = DomainSnapshot & {
  metrics: {
    enabledSidecars: number;
    readySidecars: number;
    recentErrors: number;
    nodeMeshReady: boolean;
    channelsHealthy: number;
  };
};

export class OpsFacade extends DomainFacadeBase<OpsDomainSnapshot> {
  private readonly operationsHealth: OperationsHealthPort | null;

  constructor(runtime: OpsFacadeRuntime = {}) {
    super('ops', 'Ops', runtime.now);
    this.operationsHealth = runtime.operationsHealthService || null;
  }

  public buildSnapshot(): OpsDomainSnapshot {
    if (!this.operationsHealth) {
      return this.composeSnapshot({
        summary: 'Ops facade registrada, aguardando injecao do operations health.',
        details: [
          'Sem operations health injetado, o dominio nao monta probes/health readers por conta propria.',
        ],
        metrics: {
          enabledSidecars: 0,
          readySidecars: 0,
          recentErrors: 0,
          nodeMeshReady: false,
          channelsHealthy: 0,
        },
      }) as OpsDomainSnapshot;
    }

    const snapshot = this.operationsHealth.readSnapshotFast();
    const sidecars = [snapshot.sidecars.AIGateway, snapshot.sidecars.ZavorthTerminal]
      .filter((entry): entry is { enabled?: boolean; ready?: boolean } => Boolean(entry));
    const enabledSidecars = sidecars.filter((entry) => entry.enabled).length;
    const readySidecars = sidecars.filter((entry) => entry.enabled && entry.ready).length;
    const recentErrors = Array.isArray(snapshot.errors.recent) ? snapshot.errors.recent.length : 0;
    const channelsHealthy = ['telegram', 'discordBridge', 'whatsapp', 'slack']
      .map((key) => (snapshot.channels as Record<string, any> | undefined)?.[key] || null)
      .filter((entry) => entry && entry.enabled && (entry.ready || entry.started || entry.configured)).length;

    return this.composeSnapshot({
      summary: snapshot.security.needsAttention
        ? 'Operations health pede atencao em pelo menos uma superficie critica.'
        : 'Operations health rapido esta coerente para sidecars, canais e seguranca.',
      details: [
        `Disk free: ${snapshot.storage.freePercent}%.`,
        snapshot.publish.available
          ? `Publish available; ultimo publish em ${snapshot.publish.publishedAt || 'n/d'}.`
          : 'Publish ainda nao foi registrado neste host.',
        snapshot.remoteTransportDoctor?.summary || 'Remote transport doctor ainda sem resumo.',
      ],
      metrics: {
        enabledSidecars,
        readySidecars,
        recentErrors,
        nodeMeshReady: snapshot.nodeMeshSmoke?.status === 'passed',
        channelsHealthy,
      },
    }) as OpsDomainSnapshot;
  }
}
