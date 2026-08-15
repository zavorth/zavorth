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
        question: 'What task should Zavorth run?',
        reason: 'Empty input cannot safely infer intent.',
        missing: ['intent'],
        sensitiveDomain: signals.sensitiveDomain,
      };
    }

    if (signals.sensitiveDomain && !signals.hasKnownTarget && !signals.inspection) {
      return {
        askBeforeAssumption: true,
        question: 'Which target, file, or resource should I use before continuing?',
        reason: 'Sensitive domains require an explicit target before any action.',
        missing: ['target'],
        sensitiveDomain: true,
      };
    }

    if (signals.ambiguousTarget) {
      return {
        askBeforeAssumption: true,
        question: 'What exactly should I change or run?',
        reason: 'The request asks for action but uses an ambiguous target.',
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
