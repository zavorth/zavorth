import {
  buildZavorthTransactionPlaneContractSnapshot,
  evaluateZavorthTransactionPlaneSafety,
  type ZavorthTransactionPlaneContractSnapshot,
  type ZavorthTransactionPlaneSafetyDecision,
  type ZavorthTransactionPlaneSafetyInput,
  type ZavorthTransactionRiskLevel,
} from '../contracts/ZavorthTransactionPlaneContract.js';

export type ZavorthTransactionPlanePolicySnapshot = {
  generatedAt: string;
  status: 'ready';
  summary: string;
  contract: ZavorthTransactionPlaneContractSnapshot;
  phase0: {
    liveExecutionAuthorizedByDefault: false;
    llmDirectExecutionAllowed: false;
    realMoneyRequiresExplicitApproval: true;
    rawSecretPersistenceAllowed: false;
    criticalValueMovementBlockedByDefault: true;
  };
};

export class ZavorthTransactionPlanePolicyService {
  public buildSnapshot(now: Date = new Date()): ZavorthTransactionPlanePolicySnapshot {
    const contract = buildZavorthTransactionPlaneContractSnapshot();
    return {
      generatedAt: now.toISOString(),
      status: 'ready',
      summary: 'Zavorth Transaction Plane Phase 0 is ready as a security contract and policy gate.',
      contract,
      phase0: {
        liveExecutionAuthorizedByDefault: false,
        llmDirectExecutionAllowed: false,
        realMoneyRequiresExplicitApproval: true,
        rawSecretPersistenceAllowed: false,
        criticalValueMovementBlockedByDefault: true,
      },
    };
  }

  public evaluate(input: ZavorthTransactionPlaneSafetyInput): ZavorthTransactionPlaneSafetyDecision {
    return evaluateZavorthTransactionPlaneSafety(input);
  }

  public assertAllowed(input: ZavorthTransactionPlaneSafetyInput): ZavorthTransactionPlaneSafetyDecision {
    const decision = this.evaluate(input);
    if (!decision.allowed) {
      throw new Error(
        `Transaction Plane blocked ${decision.actionKind}: ${decision.blockers.join(', ') || decision.status}.`,
      );
    }
    return decision;
  }

  public renderReport(snapshot: ZavorthTransactionPlanePolicySnapshot = this.buildSnapshot()): string {
    const lines = [
      '[transaction-plane] Phase 0 security contract',
      `[transaction-plane] status: ${snapshot.status}`,
      `[transaction-plane] summary: ${snapshot.summary}`,
      `[transaction-plane] llm direct execution: ${snapshot.phase0.llmDirectExecutionAllowed ? 'allowed' : 'blocked'}`,
      `[transaction-plane] real money approval: ${snapshot.phase0.realMoneyRequiresExplicitApproval ? 'required' : 'not-required'}`,
      `[transaction-plane] critical value movement: ${snapshot.phase0.criticalValueMovementBlockedByDefault ? 'blocked-by-default' : 'allowed'}`,
      `[transaction-plane] irreversible actions: ${snapshot.contract.irreversibleActions.join(', ')}`,
      `[transaction-plane] default controls: ${snapshot.contract.defaultControls.join(', ')}`,
    ];

    for (const level of ['low', 'medium', 'high', 'critical'] as ZavorthTransactionRiskLevel[]) {
      const entry = snapshot.contract.riskTaxonomy[level];
      lines.push(`[transaction-plane] risk ${level}: ${entry.summary}`);
    }

    return lines.join('\n');
  }
}
