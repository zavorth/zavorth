import type {
  AgentOsFutureCandidate,
  AgentOsFutureComparison,
  AgentOsImpactSimulation,
  AgentOsProjectTwinSnapshot,
} from '../contracts/AgentOsContract.js';
import type { IntelligenceFabricClassification } from '../contracts/IntelligenceFabricContract.js';

export class FutureComparatorService {
  public compare(input: {
    classification: IntelligenceFabricClassification;
    simulation: AgentOsImpactSimulation;
    twin: AgentOsProjectTwinSnapshot;
  }): AgentOsFutureComparison {
    const risk = input.classification.riskLevel;
    const candidates: AgentOsFutureCandidate[] = [
      {
        id: 'minimal_safe',
        title: 'Caminho minimo e seguro',
        summary: 'Executa a menor mudanca possivel, com simulacao e rollback antes de qualquer impacto.',
        riskLevel: Math.min(risk, 3) as AgentOsFutureCandidate['riskLevel'],
        complexity: 'low',
        maintenanceCost: 'low',
        recommended: false,
        rejectedReason: null,
      },
      {
        id: 'balanced',
        title: 'Caminho equilibrado',
        summary: 'Usa o Digital Twin, compara impacto, prepara transacao e aplica somente quando o gate permitir.',
        riskLevel: risk,
        complexity: input.classification.complexity === 'expert' ? 'high' : 'medium',
        maintenanceCost: 'medium',
        recommended: false,
        rejectedReason: null,
      },
      {
        id: 'advanced',
        title: 'Caminho avancado',
        summary: 'Inclui verifier extra, red team, sandbox e ADR para mudancas arquiteturais maiores.',
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
      status: input.simulation.status,
      selectedCandidateId: selected,
      candidates: annotated,
      receipts: ['future-comparison-recorded', 'rejected-futures-kept-as-receipts'],
    };
  }

  private select(
    input: {
      classification: IntelligenceFabricClassification;
      simulation: AgentOsImpactSimulation;
      twin: AgentOsProjectTwinSnapshot;
    },
    candidates: AgentOsFutureCandidate[],
  ): AgentOsFutureCandidate['id'] {
    if (input.simulation.status === 'blocked' || input.classification.riskLevel >= 5) return 'minimal_safe';
    if (['hard', 'expert'].includes(input.classification.complexity) || input.classification.taskKind === 'architecture') {
      return 'advanced';
    }
    return candidates.some((candidate) => candidate.id === 'balanced') ? 'balanced' : 'minimal_safe';
  }

  private rejection(candidateId: AgentOsFutureCandidate['id'], selected: AgentOsFutureCandidate['id']): string {
    if (candidateId === 'advanced' && selected !== 'advanced') return 'Poder demais para o risco/complexidade atual.';
    if (candidateId === 'minimal_safe' && selected !== 'minimal_safe') return 'Seguro, mas deixa valor operacional na mesa.';
    return 'Menos aderente ao contexto desta tarefa.';
  }
}
