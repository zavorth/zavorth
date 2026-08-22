import type {
  AgentOsFutureCandidate,
  AgentOsFutureComparison,
  AgentOsImpactDryRun,
  AgentOsProjectTwinSnapshot,
} from '../contracts/AgentOsContract.js';
import type { IntelligenceFabricClassification } from '../contracts/native/IntelligenceFabricContract.js';

export class FutureComparatorService {
  public compare(input: {
    classification: IntelligenceFabricClassification;
    dryRun: AgentOsImpactDryRun;
    twin: AgentOsProjectTwinSnapshot;
  }): AgentOsFutureComparison {
    const risk = input.classification.riskLevel;
    const candidates: AgentOsFutureCandidate[] = [
      {
        id: 'minimal_safe',
        title: 'path minimo e seguro',
        summary: 'Executes the smallest possible change, with dry run and rollback before any impact.',
        riskLevel: Math.min(risk, 3) as AgentOsFutureCandidate['riskLevel'],
        complexity: 'low',
        maintenanceCost: 'low',
        recommended: false,
        rejectedReason: null,
      },
      {
        id: 'balanced',
        title: 'path equilibrado',
        summary: 'Uses the Digital Twin, compares impact, prepares a transaction, and applies only when the gate allows it.',
        riskLevel: risk,
        complexity: input.classification.complexity === 'expert' ? 'high' : 'medium',
        maintenanceCost: 'medium',
        recommended: false,
        rejectedReason: null,
      },
      {
        id: 'advanced',
        title: 'advanced path',
        summary: 'Inclui verifier extra, red team, sandbox e ADR para changes arquiteturais maiores.',
        riskLevel: Math.max(risk, 3) as AgentOsFutureCandidate['riskLevel'],
        complexity: 'high',
        maintenanceCost: 'high',
        recommended: false,
        rejectedReason: null,
      },
    ];
    const selected = this.select(input, candidates);
    const annotated = candidates.map((candidate) => ({
      ...candidate,
      recommended: candidate.id === selected,
      rejectedReason: candidate.id === selected ? null : this.rejection(candidate.id, selected),
    }));
    return {
      source: 'FutureComparatorService',
      status: input.dryRun.status,
      selectedCandidateId: selected,
      candidates: annotated,
      receipts: ['future-comparison-recorded', 'rejected-futures-kept-as-receipts'],
    };
  }

  private select(
    input: {
      classification: IntelligenceFabricClassification;
      dryRun: AgentOsImpactDryRun;
      twin: AgentOsProjectTwinSnapshot;
    },
    candidates: AgentOsFutureCandidate[],
  ): AgentOsFutureCandidate['id'] {
    if (input.dryRun.status === 'blocked' || input.classification.riskLevel >= 5) return 'minimal_safe';
    if (['hard', 'expert'].includes(input.classification.complexity) || input.classification.taskKind === 'architecture') {
      return 'advanced';
    }
    return candidates.some((candidate) => candidate.id === 'balanced') ? 'balanced' : 'minimal_safe';
  }

  private rejection(candidateId: AgentOsFutureCandidate['id'], selected: AgentOsFutureCandidate['id']): string {
    if (candidateId === 'advanced' && selected !== 'advanced') return 'Poder demais para o risk/complexidade current.';
    if (candidateId === 'minimal_safe' && selected !== 'minimal_safe') return 'Seguro, mas deixa value operational na mesa.';
    return 'Menos aderente ao contexto desta task.';
  }
}
