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
  securityContract: {
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
      summary: 'Zavorth Transaction Plane Security contract is ready as a security contract and policy gate.',
      contract,
      securityContract: {
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
      '[transaction-plane] Security contract security contract',
      `[transaction-plane] status: ${snapshot.status}`,
      `[transaction-plane] summary: ${snapshot.summary}`,
      `[transaction-plane] llm direct execution: ${snapshot.securityContract.llmDirectExecutionAllowed ? 'allowed' : 'blocked'}`,
      `[transaction-plane] real money approval: ${snapshot.securityContract.realMoneyRequiresExplicitApproval ? 'required' : 'not-required'}`,
      `[transaction-plane] critical value movement: ${snapshot.securityContract.criticalValueMovementBlockedByDefault ? 'blocked-by-default' : 'allowed'}`,
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
