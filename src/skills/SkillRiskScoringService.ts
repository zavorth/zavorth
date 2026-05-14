import type { SkillContentScanIssue } from './SkillContentScannerService.js';
import type {
  SkillLicensePolicyDecision,
  SkillRiskAssessment,
} from './SkillCatalogContract.js';

type SkillRiskScoringInput = {
  sourceTrust: 'trusted' | 'review' | 'blocked' | null;
  sourceAllowed: boolean;
  scanIssues: SkillContentScanIssue[];
  license: string | null;
  licenseConfidence: 'high' | 'medium' | 'low';
  licensePolicy: SkillLicensePolicyDecision;
  importableFileCount: number;
  skippedFileCount: number;
};

export class SkillRiskScoringService {
  public assessImport(input: SkillRiskScoringInput): SkillRiskAssessment {
    const reasons: string[] = [];
    const errorCount = input.scanIssues.filter((issue) => issue.severity === 'error').length;
    const warningCount = input.scanIssues.filter((issue) => issue.severity === 'warn').length;

    if (!input.sourceAllowed || input.sourceTrust === 'blocked') {
      reasons.push('Fonte bloqueada pela trust policy.');
      return this.buildBlockedRisk(reasons);
    }

    if (!input.licensePolicy.allowImport) {
      reasons.push(`Policy de licenca bloqueou o import: ${input.licensePolicy.summary}`);
      return this.buildBlockedRisk(reasons);
    }

    if (errorCount > 0) {
      reasons.push(`Scanner encontrou ${errorCount} issue(s) bloqueante(s).`);
      return this.buildBlockedRisk(reasons);
    }

    let score = 0;

    if (input.sourceTrust === 'review') {
      score += 25;
      reasons.push('Fonte exige revisao manual.');
    }

    if (warningCount > 0) {
      score += warningCount * 10;
      reasons.push(`Scanner encontrou ${warningCount} alerta(s) nao bloqueante(s).`);
    }

    if (!input.license) {
      score += 15;
      reasons.push('Licenca nao identificada com clareza.');
    }

    if (input.licenseConfidence === 'medium') {
      score += 4;
      reasons.push('Classificacao de licenca com confianca media.');
    }

    if (input.licenseConfidence === 'low') {
      score += 8;
      reasons.push('Classificacao de licenca com confianca baixa.');
    }

    if (input.licensePolicy.reviewRequired) {
      score += 15;
      reasons.push('Policy de licenca pede revisao antes de confiar na skill.');
    }

    if (input.skippedFileCount > 0) {
      score += input.skippedFileCount > input.importableFileCount ? 8 : 4;
      reasons.push('Parte do conteudo original ficou fora do intake seletivo.');
    }

    if (score <= 0) {
      reasons.push('Nenhum sinal adicional de risco alem da policy baseline.');
    }

    const normalizedScore = Math.max(0, Math.min(score, 100));
    return {
      score: normalizedScore,
      level: this.resolveLevel(normalizedScore),
      reviewRequired: input.licensePolicy.reviewRequired || normalizedScore >= 25,
      reasons,
    };
  }

  private buildBlockedRisk(reasons: string[]): SkillRiskAssessment {
    return {
      score: 100,
      level: 'blocked',
      reviewRequired: true,
      reasons,
    };
  }

  private resolveLevel(score: number): SkillRiskAssessment['level'] {
    if (score >= 60) {
      return 'high';
    }
    if (score >= 25) {
      return 'medium';
    }
    return 'low';
  }
}
