import type {
  AgentOsReputationScore,
  AgentOsReputationSnapshot,
} from '../contracts/AgentOsContract.js';
import type { IntelligenceTaskEval } from '../contracts/IntelligenceFabricContract.js';
import { safeAgentOsId } from './AgentOsTextSafety.js';

export type AgentOsReputationEval = Pick<
  IntelligenceTaskEval,
  'taskKind' | 'success' | 'latencyMs' | 'securityIssuesFound'
> & {
  subjectType: AgentOsReputationScore['subjectType'];
  subjectId: string;
  rollbackUsed?: boolean;
};

export class ReputationScoreboardService {
  public buildSnapshot(input: { evals?: AgentOsReputationEval[] | null }): AgentOsReputationSnapshot {
    const grouped = new Map<string, AgentOsReputationEval[]>();
    for (const item of input.evals || []) {
      const subjectType = item.subjectType;
      const subjectId = safeAgentOsId(item.subjectId, `${subjectType}-unknown`);
      const key = `${subjectType}:${subjectId}`;
      grouped.set(key, [...(grouped.get(key) || []), { ...item, subjectId }]);
    }
    const scores = Array.from(grouped.values()).map((items) => this.score(items));
    return {
      source: 'ReputationScoreboardService',
      scores,
      hardBlocksCanBeOverridden: false,
      liveActivationAllowed: false,
      receipts: [
        'reputation-informs-routing-only',
        'reputation-cannot-bypass-hard-blocks',
        'reputation-no-live-activation',
      ],
    };
  }

  private score(items: AgentOsReputationEval[]): AgentOsReputationScore {
    const total = Math.max(1, items.length);
    const success = items.filter((item) => item.success).length;
    const securityWarnings = items.filter((item) => item.securityIssuesFound).length;
    const rollbacks = items.filter((item) => item.rollbackUsed).length;
    const latency = Math.round(items.reduce((sum, item) => sum + Math.max(0, item.latencyMs || 0), 0) / total);
    const subject = items[0];
    const taskKinds = Array.from(new Set(items.filter((item) => item.success).map((item) => item.taskKind))).slice(0, 5);
    return {
      subjectType: subject.subjectType,
      subjectId: safeAgentOsId(subject.subjectId, `${subject.subjectType}-unknown`),
      taskKind: subject.taskKind || 'unknown',
      successRate: round(success / total),
      failureRate: round((total - success) / total),
      securityWarningRate: round(securityWarnings / total),
      rollbackRate: round(rollbacks / total),
      averageLatencyMs: latency,
      recommendedFor: taskKinds,
    };
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
