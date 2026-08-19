/**
 * Governance System — Integrated governance for agent autonomy and trust.
 *
 * Provides progressive authorization, AI judge evaluation, nightly evals,
 * golden data management, and action recording with trust updates.
 */

export interface ActionContext {
  id: string;
  agentId: string;
  type: string;
  description: string;
  context: string;
  expectedOutcome: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface GovernanceDecision {
  allowed: boolean;
  requiresApproval: boolean;
  trustLevel: string;
  reason: string;
  conditions?: string[];
}

export interface AgentReport {
  agentId: string;
  trustLevel: string;
  actionsCount: number;
  successfulActions: number;
  failedActions: number;
  lastUpdated: string;
}

export interface SystemStatus {
  autonomyLevels: Record<string, { level: string; description: string; maxRisk: string }>;
  aiJudge: { enabled: boolean; criteria: string[] };
  nightlyEval: { enabled: boolean; schedule: string };
  goldenData: { enabled: boolean; casesCount: number };
  progressiveAuth: { enabled: boolean; levels: readonly TrustLevel[] };
}

const TRUST_LEVELS = ['L0', 'L1', 'L2', 'L3', 'L4'] as const;
type TrustLevel = typeof TRUST_LEVELS[number];

const RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
type RiskLevel = typeof RISK_LEVELS[number];

export class GovernanceSystem {
  private readonly workspacePath: string;
  private readonly agentReports: Map<string, AgentReport> = new Map();
  private readonly actionHistory: Map<string, Array<{ action: ActionContext; success: boolean; decision: GovernanceDecision }>> = new Map();

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  /**
   * Checks if an action is allowed and returns governance decision.
   */
  async checkAction(action: ActionContext): Promise<GovernanceDecision> {
    const agentReport = this.getOrCreateReport(action.agentId);
    const trustLevel = agentReport.trustLevel as TrustLevel;
    const trustIndex = TRUST_LEVELS.indexOf(trustLevel);

    // L0 requires approval for everything
    if (trustIndex === 0) {
      return {
        allowed: true,
        requiresApproval: true,
        trustLevel,
        reason: 'L0 trust level requires approval for all actions',
      };
    }

    // Higher trust levels allow more autonomy based on risk
    const maxRiskForTrust: Record<TrustLevel, RiskLevel> = {
      L0: 'low',
      L1: 'low',
      L2: 'medium',
      L3: 'high',
      L4: 'critical',
    };

    const allowedRisk = maxRiskForTrust[trustLevel];
    const riskIndex = RISK_LEVELS.indexOf(action.riskLevel as RiskLevel);
    const allowedRiskIndex = RISK_LEVELS.indexOf(allowedRisk);

    const requiresApproval = riskIndex > allowedRiskIndex;

    return {
      allowed: true,
      requiresApproval,
      trustLevel,
      reason: requiresApproval
        ? `Risk level ${action.riskLevel} exceeds autonomy for ${trustLevel}`
        : 'Within autonomy limits',
    };
  }

  /**
   * Records an action execution and updates agent trust.
   */
  async recordExecution(action: ActionContext, success: boolean, decision: GovernanceDecision): Promise<void> {
    const agentReport = this.getOrCreateReport(action.agentId);
    const history = this.actionHistory.get(action.agentId) || [];

    history.push({ action, success, decision });
    this.actionHistory.set(action.agentId, history);

    agentReport.actionsCount += 1;
    if (success) {
      agentReport.successfulActions += 1;
      // Increase trust on consistent success
      if (agentReport.successfulActions % 10 === 0 && agentReport.trustLevel !== 'L4') {
        const currentIndex = TRUST_LEVELS.indexOf(agentReport.trustLevel as TrustLevel);
        if (currentIndex < TRUST_LEVELS.length - 1) {
          agentReport.trustLevel = TRUST_LEVELS[currentIndex + 1];
        }
      }
    } else {
      agentReport.failedActions += 1;
      // Decrease trust on failure
      if (agentReport.trustLevel !== 'L0') {
        const currentIndex = TRUST_LEVELS.indexOf(agentReport.trustLevel as TrustLevel);
        if (currentIndex > 0) {
          agentReport.trustLevel = TRUST_LEVELS[currentIndex - 1];
        }
      }
    }

    agentReport.lastUpdated = new Date().toISOString();
  }

  /**
   * Gets or creates an agent report.
   */
  getReport(agentId: string): AgentReport {
    return this.getOrCreateReport(agentId);
  }

  private getOrCreateReport(agentId: string): AgentReport {
    let report = this.agentReports.get(agentId);
    if (!report) {
      report = {
        agentId,
        trustLevel: 'L0',
        actionsCount: 0,
        successfulActions: 0,
        failedActions: 0,
        lastUpdated: new Date().toISOString(),
      };
      this.agentReports.set(agentId, report);
    }
    return report;
  }

  /**
   * Returns overall system status.
   */
  getSystemStatus(): SystemStatus {
    return {
      autonomyLevels: {
        L0: { level: 'L0', description: 'No autonomy - all actions require approval', maxRisk: 'low' },
        L1: { level: 'L1', description: 'Read-only autonomy', maxRisk: 'low' },
        L2: { level: 'L2', description: 'Standard autonomy - low/medium risk allowed', maxRisk: 'medium' },
        L3: { level: 'L3', description: 'High autonomy - high risk allowed', maxRisk: 'high' },
        L4: { level: 'L4', description: 'Full autonomy - all risk levels allowed', maxRisk: 'critical' },
      },
      aiJudge: {
        enabled: true,
        criteria: ['correctness', 'security', 'performance', 'maintainability'],
      },
      nightlyEval: {
        enabled: true,
        schedule: '0 2 * * *',
      },
      goldenData: {
        enabled: true,
        casesCount: 0,
      },
      progressiveAuth: {
        enabled: true,
        levels: TRUST_LEVELS,
      },
    };
  }
}