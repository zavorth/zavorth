import type { RequirementGapKind } from '../contracts/EngineeringCoreContract.js';

export type FailureClassification = {
  kind: RequirementGapKind | 'typescript_error' | 'test_failure' | 'unknown';
  confidence: number;
  summary: string;
};

export class FailureClassifierService {
  public classify(input: { stderr?: string | null; command?: string | null }): FailureClassification {
    const stderr = String(input.stderr || '').trim();
    if (!stderr) {
      return {
        kind: 'unknown',
        confidence: 0.2,
        summary: 'Failure without stderr util para classificar.',
      };
    }

    if (/cannot find module|module not found/i.test(stderr)) {
      return { kind: 'missing_dependency', confidence: 0.95, summary: 'Dependencia faltando.' };
    }
    if (/is not recognized as an internal or external command|command not found/i.test(stderr)) {
      return { kind: 'missing_toolchain', confidence: 0.93, summary: 'Tool or command missing.' };
    }
    if (/error ts\d+|typescript|tsc/i.test(stderr)) {
      return { kind: 'typescript_error', confidence: 0.9, summary: 'error de TypeScript detectado.' };
    }
    if (/test(s)? failed|failing test|jest|vitest|mocha|assert/i.test(stderr)) {
      return { kind: 'test_failure', confidence: 0.78, summary: 'Failure de testes detectada.' };
    }
    if (/missing required env|secret|token|credential|unauthorized|forbidden/i.test(stderr)) {
      return { kind: 'missing_secret', confidence: 0.84, summary: 'Missing credential or env value.' };
    }
    if (/timeout|eai_again|temporarily unavailable|network/i.test(stderr)) {
      return { kind: 'external_transient_error', confidence: 0.7, summary: 'error external/transitorio.' };
    }

    return {
      kind: 'unknown',
      confidence: 0.3,
      summary: `Failure not automatically classified yet for command ${String(input.command || '').trim() || 'n/d'}.`,
    };
  }
}
