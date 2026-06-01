import { DomainFacadeBase, type DomainSnapshot } from '../DomainFacadeBase.js';
import { TrustGovernanceUseCases } from './application/TrustGovernanceUseCases.js';
import type { GovernanceControlPlanePort, TrustPlaneSnapshotPort } from './domain/TrustGovernanceDomainTypes.js';
import { TrustGovernancePlaneAdapter } from './infrastructure/TrustGovernancePlaneAdapter.js';
import { TrustGovernanceDomainPresenter } from './presentation/TrustGovernanceDomainPresenter.js';

type TrustGovernanceFacadeRuntime = {
  now?: () => Date;
  trustPlaneService?: TrustPlaneSnapshotPort;
  governanceControlPlaneService?: GovernanceControlPlanePort;
  trustReady?: boolean | null;
  governanceReady?: boolean | null;
  policiesTracked?: number | null;
};

export type TrustGovernanceDomainSnapshot = DomainSnapshot & {
  metrics: {
    trustReady: boolean;
    governanceReady: boolean;
    policiesTracked: number;
  };
};

export class TrustGovernanceFacade extends DomainFacadeBase<TrustGovernanceDomainSnapshot> {
  private readonly useCases: TrustGovernanceUseCases;
  private readonly presenter = new TrustGovernanceDomainPresenter();

  constructor(runtime: TrustGovernanceFacadeRuntime = {}) {
    super('trust-governance', 'Trust Governance', runtime.now);
    this.useCases = new TrustGovernanceUseCases({
      now: runtime.now,
      trustGovernance: new TrustGovernancePlaneAdapter({
        now: runtime.now,
        trustPlaneService: runtime.trustPlaneService || null,
        governanceControlPlaneService: runtime.governanceControlPlaneService || null,
        trustReady: runtime.trustReady,
        governanceReady: runtime.governanceReady,
        policiesTracked: runtime.policiesTracked,
      }),
    });
  }

  public buildSnapshot(): TrustGovernanceDomainSnapshot {
    return this.composeSnapshot(this.presenter.presentReadiness(this.useCases.buildReadiness())) as TrustGovernanceDomainSnapshot;
  }
}
