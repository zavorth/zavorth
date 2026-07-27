import type {
  GovernanceControlPlanePort,
  TrustGovernanceDomainPort,
  TrustGovernanceDomainReadModel,
  TrustGovernanceReadinessInput,
  TrustPlaneSnapshotPort,
} from '../domain/TrustGovernanceDomainTypes.js';

type TrustGovernancePlaneAdapterRuntime = {
  now?: () => Date;
  trustPlaneService?: TrustPlaneSnapshotPort | null;
  governanceControlPlaneService?: GovernanceControlPlanePort | null;
  trustReady?: boolean | null;
  governanceReady?: boolean | null;
  policiesTracked?: number | null;
};

export class TrustGovernancePlaneAdapter implements TrustGovernanceDomainPort {
  private readonly now: () => Date;
  private readonly trustPlaneService: TrustPlaneSnapshotPort | null;
  private readonly governanceControlPlaneService: GovernanceControlPlanePort | null;
  private readonly trustReadyHint: boolean | null;
  private readonly governanceReadyHint: boolean | null;
  private readonly policiesTrackedHint: number | null;

  constructor(runtime: TrustGovernancePlaneAdapterRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.trustPlaneService = runtime.trustPlaneService || null;
    this.governanceControlPlaneService = runtime.governanceControlPlaneService || null;
    this.trustReadyHint = runtime.trustReady === true ? true : null;
    this.governanceReadyHint = runtime.governanceReady === true ? true : null;
    this.policiesTrackedHint = Number.isFinite(runtime.policiesTracked)
      ? Number(runtime.policiesTracked)
      : null;
  }

  public readTrustState(input: TrustGovernanceReadinessInput = {}): TrustGovernanceDomainReadModel {
    const trustSnapshot = this.trustPlaneService?.buildSnapshot() || null;
    const governanceSnapshot = this.governanceControlPlaneService?.buildSnapshot({ limit: input.limit ?? null }) || null;
    const trustReady = this.trustReadyHint ?? Boolean(trustSnapshot);
    const governanceReady = this.governanceReadyHint ?? Boolean(governanceSnapshot);
    const policiesTracked = (
      this.policiesTrackedHint
      ?? Number(governanceSnapshot?.summary?.decisions ?? trustSnapshot?.summary?.skillAllowedSources ?? 0)
    ) || 0;
    const hasSignals = trustReady || governanceReady || policiesTracked > 0;

    return {
      generatedAt: this.now().toISOString(),
      trustReady,
      governanceReady,
      policiesTracked,
      headline: hasSignals ? 'Trust governance domain already consolidates trust plane and governance control plane.'
        : 'Trust governance domain waiting for the canonical planes.',
      operatorSummary:
        governanceSnapshot?.narrative?.operatorSummary
        || trustSnapshot?.narrative?.operatorSummary
        || (hasSignals ? `Trust governance domain ready with ${policiesTracked} policy(ies) tracked.`
          : 'Trust governance domain seeded to aggregate policy, approvals and tenancy.'),
      details: [
        trustSnapshot?.narrative?.headline || 'Trust plane has not yet published a headline in this context.',
        governanceSnapshot?.narrative?.headline || 'Governance control plane has not yet published a headline in this context.',
        `Trust ready: ${trustReady ? 'yes' : 'no'}.`,
        `Governance ready: ${governanceReady ? 'yes' : 'no'}.`,
        `Policies tracked: ${policiesTracked}.`,
      ],
      source: hasSignals ? 'planes' : 'seed',
    };
  }
}
