import path from 'path';
import { config } from '../config/index.js';
import {
  SkillSourceRegistryService,
  type SkillSourceRegistryEntry,
} from '../services/SkillSourceRegistryService.js';
import { SkillTrustPolicyService } from '../services/SkillTrustPolicyService.js';

import { SkillContentScannerService, type SkillContentScanIssue } from './SkillContentScannerService.js';
import { SkillHubGuardService, type SkillHubGuardSnapshot } from './SkillHubGuardService.js';
import { SkillLicenseClassifierService } from './SkillLicenseClassifierService.js';
import { LicensePolicyService } from './LicensePolicyService.js';
import { SkillRiskScoringService } from './SkillRiskScoringService.js';
import type {
  SkillImportAuditReference,
  SkillLicensePolicyDecision,
  SkillRiskAssessment,
} from './SkillCatalogContract.js';

type SkillImportPreviewRuntime = {
  sourceRegistryService?: Pick<SkillSourceRegistryService, 'getSource'>;
  skillTrustPolicyService?: Pick<SkillTrustPolicyService, 'evaluateSource' | 'evaluateSkill'>;
  skillContentScannerService?: Pick<SkillContentScannerService, 'scanSkillDirectory'>;
  skillHubGuardService?: Pick<SkillHubGuardService, 'evaluateSkillDirectory'>;
  skillLicenseClassifierService?: Pick<SkillLicenseClassifierService, 'classifySkillDirectory'>;
  licensePolicyService?: Pick<LicensePolicyService, 'evaluateClassification'>;
  skillRiskScoringService?: Pick<SkillRiskScoringService, 'assessImport'>;
};

export type SkillImportDetailedPreviewEntry = {
  skillName: string;
  sourceSkillDirPath: string;
  targetSkillDirPath: string;
  allowed: boolean;
  reason: string;
  alreadyImported: boolean;
  license: string | null;
  licenseConfidence: 'high' | 'medium' | 'low';
  licenseEvidence: string[];
  licensePolicy: SkillLicensePolicyDecision;
  risk: SkillRiskAssessment;
  guard: SkillHubGuardSnapshot;
  safeToImport: boolean;
  issues: SkillContentScanIssue[];
  importableFiles: string[];
  skippedFiles: string[];
};

export type SkillImportDetailedPreview = {
  sourceId: string;
  sourceLabel: string;
  sourcePath: string;
  targetSourceId: string;
  targetRootPath: string;
  totalCandidates: number;
  allowedCount: number;
  blockedCount: number;
  safeCount: number;
  entries: SkillImportDetailedPreviewEntry[];
  previewAudit: SkillImportAuditReference | null;
};

export class SkillImportPreviewService {
  private readonly sourceRegistry: Pick<SkillSourceRegistryService, 'getSource'>;
  private readonly trustPolicy: Pick<SkillTrustPolicyService, 'evaluateSource' | 'evaluateSkill'>;
  private readonly scanner: Pick<SkillContentScannerService, 'scanSkillDirectory'>;
  private readonly guard: Pick<SkillHubGuardService, 'evaluateSkillDirectory'>;
  private readonly licenseClassifier: Pick<SkillLicenseClassifierService, 'classifySkillDirectory'>;
  private readonly licensePolicyService: Pick<LicensePolicyService, 'evaluateClassification'>;
  private readonly riskScoringService: Pick<SkillRiskScoringService, 'assessImport'>;

  constructor(runtime: SkillImportPreviewRuntime = {}) {
    this.sourceRegistry = runtime.sourceRegistryService || new SkillSourceRegistryService();
    this.trustPolicy = runtime.skillTrustPolicyService || new SkillTrustPolicyService();
    this.scanner = runtime.skillContentScannerService || new SkillContentScannerService();
    this.guard = runtime.skillHubGuardService || new SkillHubGuardService({ scanner: this.scanner });
    this.licenseClassifier = runtime.skillLicenseClassifierService || new SkillLicenseClassifierService();
    this.licensePolicyService = runtime.licensePolicyService || new LicensePolicyService();
    this.riskScoringService = runtime.skillRiskScoringService || new SkillRiskScoringService();
  }

  public buildPreview(input: {
    source: SkillSourceRegistryEntry;
    targetSource: SkillSourceRegistryEntry;
    sourceSkillDirPaths: string[];
  }): SkillImportDetailedPreview {
    if (!input.source.enabled) {
      throw new Error(`Skill source ${input.source.id} is disabled and cannot generate an import preview.`);
    }
    if (input.source.kind !== 'workspace' && !input.source.pinnedRevision) {
      throw new Error(`External source ${input.source.id} must declare pinnedRevision before generating an import preview.`);
    }

    const sourceDecision = this.trustPolicy.evaluateSource(input.source.id);
    if (!sourceDecision.allowed) {
      throw new Error(sourceDecision.reason);
    }

    const entries = input.sourceSkillDirPaths
      .map((sourceSkillDirPath) => {
        const skillName = path.basename(sourceSkillDirPath);
        const decision = this.trustPolicy.evaluateSkill(input.source.id, skillName);
        const guard = this.guard.evaluateSkillDirectory({
          skillDirPath: sourceSkillDirPath,
          sourceTrust: input.source.trust,
        });
        const scan = guard.scan;
        const licenseClassification = this.licenseClassifier.classifySkillDirectory(sourceSkillDirPath, input.source);
        let licensePolicy = this.licensePolicyService.evaluateClassification(licenseClassification);
        let risk = this.riskScoringService.assessImport({
          sourceTrust: input.source.trust,
          sourceAllowed: sourceDecision.allowed,
          scanIssues: scan.issues,
          license: licenseClassification.license,
          licenseConfidence: licenseClassification.confidence,
          licensePolicy,
          importableFileCount: scan.importableFiles.length,
          skippedFileCount: scan.skippedFiles.length,
        });

        if (
          config.skillsGovernanceMode === 'casual'
          && scan.safeToImport
          && licensePolicy.allowImport
          && risk.level !== 'blocked'
          && risk.level !== 'high'
        ) {
          licensePolicy = {
            ...licensePolicy,
            reviewRequired: false,
            summary: `${licensePolicy.summary} Casual mode removes manual review only after hard blockers pass.`,
          };
          risk = {
            ...risk,
            reviewRequired: false,
            reasons: [
              ...risk.reasons,
              'Casual mode keeps security and license blockers, but skips manual review for non-blocking imports.',
            ],
          };
        }

        const targetSkillDirPath = path.join(input.targetSource.absolutePath, skillName);
        const allowed = decision.allowed
          && scan.safeToImport
          && licensePolicy.allowImport
          && risk.level !== 'blocked';
        return {
          skillName,
          sourceSkillDirPath,
          targetSkillDirPath,
          allowed,
          reason: !decision.allowed
            ? decision.reason
            : scan.safeToImport
              ? licensePolicy.allowImport
                ? risk.level === 'blocked'
                  ? 'Skill blocked by risk score.'
                  : 'Skill approved for selective import.'
                : `Skill blocked by license policy. ${licensePolicy.summary}`
              : 'Skill blocked by content scanner.',
          alreadyImported: false,
          license: licenseClassification.license,
          licenseConfidence: licenseClassification.confidence,
          licenseEvidence: licenseClassification.evidence,
          licensePolicy,
          risk,
          guard,
          safeToImport: scan.safeToImport,
          issues: scan.issues,
          importableFiles: scan.importableFiles,
          skippedFiles: scan.skippedFiles,
        };
      })
      .sort((left, right) => left.skillName.localeCompare(right.skillName, 'en-US'));

    return {
      sourceId: input.source.id,
      sourceLabel: input.source.label,
      sourcePath: input.source.absolutePath,
      targetSourceId: input.targetSource.id,
      targetRootPath: input.targetSource.absolutePath,
      totalCandidates: entries.length,
      allowedCount: entries.filter((entry) => entry.allowed).length,
      blockedCount: entries.filter((entry) => !entry.allowed).length,
      safeCount: entries.filter((entry) => entry.safeToImport).length,
      entries,
      previewAudit: null,
    };
  }
}
