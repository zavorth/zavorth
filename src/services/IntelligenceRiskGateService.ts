import type {
  IntelligenceExecutionProposal,
  IntelligenceLegacyTrustMode,
  IntelligenceRiskActionDecision,
  IntelligenceRiskGateSnapshot,
  IntelligenceTrustMode,
} from '../contracts/IntelligenceFabricContract.js';

const TRUST_TO_LEGACY: Record<IntelligenceTrustMode, IntelligenceLegacyTrustMode> = {
  locked_down: 'protected',
  balanced: 'collaborator',
  local_owner: 'collaborator',
  developer_fast: 'overlord',
  enterprise: 'protected',
};

export class IntelligenceRiskGateService {
  public evaluate(input: {
    proposal: IntelligenceExecutionProposal;
    trustMode: IntelligenceTrustMode;
  }): IntelligenceRiskGateSnapshot {
    const actionDecisions = input.proposal.actions.map((action): IntelligenceRiskActionDecision => {
      if (action.touchesSecrets || action.riskLevel === 5) {
        return {
          actionId: action.id,
          actionKind: action.kind,
          decision: 'require_approval',
          reason: 'Risk 5 action requires explicit owner approval before impact.',
          requiresApproval: true,
          requiresSandbox: false,
        };
      }

      if (action.riskLevel <= 2) {
        return {
          actionId: action.id,
          actionKind: action.kind,
          decision: 'allow',
          reason: 'Thinking, planning, reading, draft or simulation does not require approval.',
          requiresApproval: false,
          requiresSandbox: false,
        };
      }

      if (action.riskLevel === 3) {
        const localOwnerWriteAllowed = (input.trustMode === 'local_owner' || input.trustMode === 'developer_fast')
          && action.insideWorkspace
          && action.reversible
          && !action.usesNetwork;
        return {
          actionId: action.id,
          actionKind: action.kind,
          decision: localOwnerWriteAllowed ? 'allow' : 'require_approval',
          reason: localOwnerWriteAllowed
            ? 'Reversible workspace impact is allowed in local owner/developer fast mode.'
            : 'Workspace impact requires approval outside local owner/developer fast mode.',
          requiresApproval: !localOwnerWriteAllowed,
          requiresSandbox: false,
        };
      }

      return {
        actionId: action.id,
        actionKind: action.kind,
        decision: action.usesNetwork || action.kind === 'exec' || action.kind === 'install'
          ? 'require_sandbox'
          : 'require_approval',
        reason: 'Risk 4 action requires sandbox/dry-run or explicit approval before impact.',
        requiresApproval: true,
        requiresSandbox: true,
      };
    });

    const requiresSandbox = actionDecisions.some((decision) => decision.requiresSandbox);
    const requiresApproval = actionDecisions.some((decision) => decision.requiresApproval);
    const blocked = actionDecisions.some((decision) => decision.decision === 'block');
    const overallDecision = blocked
      ? 'block'
      : requiresSandbox
        ? 'require_sandbox'
        : requiresApproval
          ? 'require_approval'
          : 'allow';

    return {
      source: 'IntelligenceRiskGateService',
      trustMode: input.trustMode,
      legacyTrustMode: TRUST_TO_LEGACY[input.trustMode],
      overallDecision,
      canExecuteNow: overallDecision === 'allow',
      requiresApproval,
      requiresSandbox,
      actionDecisions,
      receipts: [
        'risk-gate-evaluated-after-planning',
        'risk-0-2-thinking-planning-simulation-free',
        'risk-4-5-impact-gated',
      ],
    };
  }

  public static toLegacyTrustMode(mode: IntelligenceTrustMode): IntelligenceLegacyTrustMode {
    return TRUST_TO_LEGACY[mode];
  }
}
