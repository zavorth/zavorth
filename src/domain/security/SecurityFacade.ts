import { DomainFacadeBase, type DomainSnapshot } from '../DomainFacadeBase.js';
import type { SecurityMeshSnapshotPort } from './domain/SecurityDomainTypes.js';

type SecurityFacadeRuntime = {
  now?: () => Date;
  securityMeshService?: SecurityMeshSnapshotPort;
};

export type SecurityDomainSnapshot = DomainSnapshot & {
  metrics: {
    totalModes: number;
    coreReady: number;
    extensionsReady: number;
    gvisorActive: boolean;
    firecrackerReady: boolean;
    neverDowngrade: boolean;
  };
};

export class SecurityFacade extends DomainFacadeBase<SecurityDomainSnapshot> {
  private readonly securityMesh: SecurityMeshSnapshotPort | null;

  constructor(runtime: SecurityFacadeRuntime = {}) {
    super('security', 'Security', runtime.now);
    this.securityMesh = runtime.securityMeshService || null;
  }

  public buildSnapshot(): SecurityDomainSnapshot {
    if (!this.securityMesh) {
      return this.composeSnapshot({
        summary: 'Security facade registered, waiting for security mesh injection.',
        details: [
          'Without injected security mesh, the domain does not instantiate posture/runtime readers by default.',
        ],
        metrics: {
          totalModes: 0,
          coreReady: 0,
          extensionsReady: 0,
          gvisorActive: false,
          firecrackerReady: false,
          neverDowngrade: false,
        },
      }) as SecurityDomainSnapshot;
    }

    const snapshot = this.securityMesh.buildSnapshot();

    return this.composeSnapshot({
      summary: snapshot.narrative.operatorSummary,
      details: [
        snapshot.narrative.trustBoundary,
        `Posture: ${snapshot.posture.label}.`,
      ],
      metrics: {
        totalModes: snapshot.summary.totalModes,
        coreReady: snapshot.summary.coreReady,
        extensionsReady: snapshot.summary.extensionsReady,
        gvisorActive: snapshot.summary.gvisorActive,
        firecrackerReady: snapshot.summary.firecrackerReady,
        neverDowngrade: snapshot.summary.neverDowngrade,
      },
    }) as SecurityDomainSnapshot;
  }
}
