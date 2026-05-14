import type {
  NaturalClarificationPolicy,
  UniversalIntentSafetyClassification,
} from './UniversalIntentContracts.js';

export class NaturalClarificationPolicyService {
  public build(classification: UniversalIntentSafetyClassification): NaturalClarificationPolicy {
    const signals = classification.signals;
    if (signals.textEmpty) {
      return {
        askBeforeAssumption: true,
        question: 'Qual tarefa voce quer que Zavorth execute?',
        reason: 'Entrada vazia nao permite inferir intencao com seguranca.',
        missing: ['intent'],
        sensitiveDomain: signals.sensitiveDomain,
      };
    }

    if (signals.sensitiveDomain && !signals.hasKnownTarget && !signals.inspection) {
      return {
        askBeforeAssumption: true,
        question: 'Qual alvo, arquivo ou recurso devo usar antes de prosseguir?',
        reason: 'Dominio sensivel exige alvo explicito antes de qualquer acao.',
        missing: ['target'],
        sensitiveDomain: true,
      };
    }

    if (signals.ambiguousTarget && this.requiresConcreteTarget(classification)) {
      return {
        askBeforeAssumption: true,
        question: 'O que exatamente devo alterar ou executar?',
        reason: 'A entrada pede acao, mas usa um alvo ambiguo.',
        missing: ['target'],
        sensitiveDomain: signals.sensitiveDomain,
      };
    }

    return {
      askBeforeAssumption: false,
      question: null,
      reason: null,
      missing: [],
      sensitiveDomain: signals.sensitiveDomain,
    };
  }

  private requiresConcreteTarget(classification: UniversalIntentSafetyClassification): boolean {
    const signals = classification.signals;
    return Boolean(
      signals.mutation
      || signals.shell
      || signals.externalSideEffect
      || signals.destructive
      || signals.automation
      || signals.operatorRequired,
    );
  }
}
