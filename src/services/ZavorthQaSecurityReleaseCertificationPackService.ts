import path from 'node:path';
import type {
  ZavorthCertificationFamilyResult,
  ZavorthFunctionalParityCertificationRunnerSnapshot,
  ZavorthQaScenarioImporterSnapshot,
  ZavorthQaSecurityReleaseCertificationSnapshot,
  ZavorthQaSecurityReleaseCheckStatus,
  ZavorthQaSecurityReleaseFamilyId,
  ZavorthQaSecurityReleaseReceipt,
  ZavorthReleaseAcceptanceSnapshot,
  ZavorthSecurityCertificationSnapshot,
  ZavorthPatchRiskLedgerSnapshot,
  ZavorthWorkflowSemanticSnapshot,
} from '../contracts/ZavorthQaSecurityReleaseCertificationContract.js';
import { ZAVORTH_QA_SECURITY_RELEASE_CERTIFICATION_CONTRACT_VERSION } from '../contracts/ZavorthQaSecurityReleaseCertificationContract.js';
import { ZavorthPatchRiskLedgerService } from './ZavorthPatchRiskLedgerService.js';
import { ZavorthQaScenarioImporterService } from './ZavorthQaScenarioImporterService.js';
import { ZavorthReleaseAcceptanceCheckService } from './ZavorthReleaseAcceptanceCheckService.js';
import { ZavorthSecurityCertificationCheckService } from './ZavorthSecurityCertificationCheckService.js';
import { ZavorthWorkflowSemanticCheckService } from './ZavorthWorkflowSemanticCheckService.js';

type Runtime = {
  now?: () => Date;
  rootDir?: string;
  qaScenarioImporter?: ZavorthQaScenarioImporterService;
  securityCheck?: ZavorthSecurityCertificationCheckService;
  releaseAcceptanceCheck?: ZavorthReleaseAcceptanceCheckService;
  workflowSemanticCheck?: ZavorthWorkflowSemanticCheckService;
  patchRiskLedger?: ZavorthPatchRiskLedgerService;
};

export class ZavorthQaSecurityReleaseCertificationPackService {
  private readonly now: () => Date;
  private readonly rootDir: string;
  private readonly qaScenarioImporter: ZavorthQaScenarioImporterService;
  private readonly securityCheck: ZavorthSecurityCertificationCheckService;
  private readonly releaseAcceptanceCheck: ZavorthReleaseAcceptanceCheckService;
  private readonly workflowSemanticCheck: ZavorthWorkflowSemanticCheckService;
  private readonly patchRiskLedger: ZavorthPatchRiskLedgerService;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.rootDir = path.resolve(runtime.rootDir || process.cwd());
    this.qaScenarioImporter = runtime.qaScenarioImporter || new ZavorthQaScenarioImporterService({
      now: this.now,
      rootDir: this.rootDir,
    });
    this.securityCheck = runtime.securityCheck || new ZavorthSecurityCertificationCheckService({
      now: this.now,
      rootDir: this.rootDir,
    });
    this.releaseAcceptanceCheck = runtime.releaseAcceptanceCheck || new ZavorthReleaseAcceptanceCheckService({
      now: this.now,
      rootDir: this.rootDir,
    });
    this.workflowSemanticCheck = runtime.workflowSemanticCheck || new ZavorthWorkflowSemanticCheckService({
      now: this.now,
      rootDir: this.rootDir,
    });
    this.patchRiskLedger = runtime.patchRiskLedger || new ZavorthPatchRiskLedgerService({
      now: this.now,
      rootDir: this.rootDir,
    });
  }

  public buildSnapshot(): ZavorthQaSecurityReleaseCertificationSnapshot {
    const qaScenarios = this.qaScenarioImporter.buildSnapshot();
    const security = this.securityCheck.buildSnapshot();
    const releaseAcceptance = this.releaseAcceptanceCheck.buildSnapshot();
    const workflowSemantics = this.workflowSemanticCheck.buildSnapshot();
    const patchRisk = this.patchRiskLedger.buildSnapshot();
    const baseFamilies = [
      this.familyFromQaScenarios(qaScenarios),
      this.familyFromSecurity(security),
      this.familyFromReleaseAcceptance(releaseAcceptance),
      this.familyFromWorkflowSemantics(workflowSemantics),
      this.familyFromPatchRisk(patchRisk),
    ];
    const functionalParityRunner = this.buildFunctionalParityRunner(baseFamilies);
    const families = functionalParityRunner.families;
    const receipts = families.flatMap((family) => family.receipts);
    const failFamilies = families.filter((family) => family.status === 'fail').length;
    const warnFamilies = families.filter((family) => family.status === 'warn').length;
    const passFamilies = families.filter((family) => family.status === 'pass').length;

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_QA_SECURITY_RELEASE_CERTIFICATION_CONTRACT_VERSION,
      status: failFamilies > 0 ? 'failed' : 'passed',
      phase: 7,
      statement: 'Zavorth QA, security, release, workflow and patch-risk surfaces are certified through local artifact-first checks.',
      runtime: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        cwd: normalizePath(this.rootDir),
      },
      qaScenarios,
      security,
      releaseAcceptance,
      workflowSemantics,
      patchRisk,
      functionalParityRunner,
      summary: {
        families: families.length,
        passFamilies,
        warnFamilies,
        failFamilies,
        receipts: receipts.length,
        scenariosImported: qaScenarios.scenariosImported,
        securityChecks: security.controlsChecked,
        releaseChecks: releaseAcceptance.acceptanceChecks,
        workflowChecks: workflowSemantics.semanticsChecked,
        patchRisksTracked: Math.max(0, patchRisk.patchFilesObserved),
        dependencyPatchesAcceptedSilently: false,
        rawWorkflowYamlCopied: false,
        liveExternalIoPerformed: false,
        secretValuesSerialized: false,
      },
      policy: {
        localChecksOnly: true,
        noRawWorkflowYamlCopy: true,
        dependencyPatchesNeedReceipt: true,
        noLiveProviderCalls: true,
        noLiveChannelSends: true,
        noSecretValuesSerialized: true,
        artifactFirstReceipts: true,
        optionalCiCompatible: true,
      },
      commands: {
        inspect: 'npm run zavorth-qa-security-release-certification-pack --silent',
        inspectJson: 'npm run zavorth-qa-security-release-certification-pack:json --silent',
        check: 'npm run zavorth-qa-security-release-certification-pack:check --silent',
        qa: 'npm run qa:zavorth-qa-security-release-certification-pack --silent',
        nextPhase: 'Phase 8 - Skill Ecosystem Pack',
      },
    };
  }

  public formatSnapshotText(snapshot: ZavorthQaSecurityReleaseCertificationSnapshot): string {
    const lines = [
      'Zavorth QA Security Release Certification Pack - Phase 7',
      `Status: ${snapshot.status}`,
      `Contract: ${snapshot.contractVersion}`,
      `Families: ${snapshot.summary.families}`,
      `Pass families: ${snapshot.summary.passFamilies}`,
      `Warn families: ${snapshot.summary.warnFamilies}`,
      `Fail families: ${snapshot.summary.failFamilies}`,
      `Receipts: ${snapshot.summary.receipts}`,
      `Scenarios imported: ${snapshot.summary.scenariosImported}`,
      `Security checks: ${snapshot.summary.securityChecks}`,
      `Release checks: ${snapshot.summary.releaseChecks}`,
      `Workflow checks: ${snapshot.summary.workflowChecks}`,
      `Patch risks tracked: ${snapshot.summary.patchRisksTracked}`,
      `Dependency patches accepted silently: ${snapshot.summary.dependencyPatchesAcceptedSilently}`,
      `Raw workflow YAML copied: ${snapshot.summary.rawWorkflowYamlCopied}`,
      `Live external IO performed: ${snapshot.summary.liveExternalIoPerformed}`,
      'Families:',
      ...snapshot.functionalParityRunner.printableLines,
      `Next: ${snapshot.commands.nextPhase}`,
    ];
    return lines.join('\n');
  }

  private buildFunctionalParityRunner(
    baseFamilies: ZavorthCertificationFamilyResult[],
  ): ZavorthFunctionalParityCertificationRunnerSnapshot {
    const baseStatus = combineStatuses(baseFamilies.map((family) => family.status));
    const functionalReceipt: ZavorthQaSecurityReleaseReceipt = {
      id: `zavorth.phase7.functional-parity.runner.${this.now().getTime()}.receipt`,
      familyId: 'functional-parity',
      checkId: 'functional-parity.runner',
      label: 'Functional parity certification runner is complete',
      status: baseStatus === 'fail' ? 'fail' : baseStatus === 'warn' ? 'warn' : 'pass',
      severity: 'blocking',
      evidenceKind: 'policy',
      target: 'All absorbed QA, security, release, workflow and patch-risk families emit artifact-first receipts.',
      observed: `families=${baseFamilies.length}, failing=${baseFamilies.filter((family) => family.status === 'fail').length}, warnings=${baseFamilies.filter((family) => family.status === 'warn').length}`,
      command: 'npm run zavorth-qa-security-release-certification-pack:check --silent',
      artifactFirst: true,
      localCheckPerformed: true,
      liveExternalIoPerformed: false,
      secretValuesSerialized: false,
      rawWorkflowYamlCopied: false,
      dependencyPatchAcceptedSilently: false,
      notes: ['The runner prints pass, warn and fail for every absorbed surface family.'],
    };
    const functionalFamily = this.buildFamilyResult({
      familyId: 'functional-parity',
      label: 'Functional Parity Runner',
      receipts: [functionalReceipt],
      notes: ['Aggregates all Phase 7 family receipts into a release-ready runner.'],
    });
    const families = [...baseFamilies, functionalFamily];

    return {
      status: combineStatuses(families.map((family) => family.status)),
      families,
      printableLines: families.map((family) => (
        `- ${family.status} ${family.familyId}: receipts=${family.receipts.length}, blockingFailures=${family.blockingFailures}, warnings=${family.warnings}`
      )),
      dependencyPatchesAcceptedSilently: false,
      rawWorkflowYamlCopied: false,
      liveExternalIoPerformed: false,
      secretValuesSerialized: false,
    };
  }

  private familyFromQaScenarios(snapshot: ZavorthQaScenarioImporterSnapshot): ZavorthCertificationFamilyResult {
    return this.buildFamilyResult({
      familyId: 'qa-scenarios',
      label: 'QA Scenario Importer',
      receipts: snapshot.receipts,
      notes: [`Imported ${snapshot.scenariosImported} local QA scenarios.`],
    });
  }

  private familyFromSecurity(snapshot: ZavorthSecurityCertificationSnapshot): ZavorthCertificationFamilyResult {
    return this.buildFamilyResult({
      familyId: 'security',
      label: 'Security Certification Check',
      receipts: snapshot.receipts,
      notes: ['Security checks are local-only and do not serialize secret values.'],
    });
  }

  private familyFromReleaseAcceptance(snapshot: ZavorthReleaseAcceptanceSnapshot): ZavorthCertificationFamilyResult {
    return this.buildFamilyResult({
      familyId: 'release-acceptance',
      label: 'Release Acceptance Check',
      receipts: snapshot.receipts,
      notes: ['Release acceptance confirms package scripts, bin and SDK surfaces.'],
    });
  }

  private familyFromWorkflowSemantics(snapshot: ZavorthWorkflowSemanticSnapshot): ZavorthCertificationFamilyResult {
    return this.buildFamilyResult({
      familyId: 'workflow-semantics',
      label: 'Workflow Semantic Check',
      receipts: snapshot.receipts,
      notes: [`Observed ${snapshot.workflowFilesObserved} workflow files without copying YAML.`],
    });
  }

  private familyFromPatchRisk(snapshot: ZavorthPatchRiskLedgerSnapshot): ZavorthCertificationFamilyResult {
    return this.buildFamilyResult({
      familyId: 'patch-risk',
      label: 'Patch Risk Ledger',
      receipts: snapshot.receipts,
      notes: [`Tracked ${snapshot.patchFilesObserved} patch files with explicit decisions.`],
    });
  }

  private buildFamilyResult(input: {
    familyId: ZavorthQaSecurityReleaseFamilyId;
    label: string;
    receipts: ZavorthQaSecurityReleaseReceipt[];
    notes: string[];
  }): ZavorthCertificationFamilyResult {
    const blockingFailures = input.receipts
      .filter((receipt) => receipt.severity === 'blocking' && receipt.status === 'fail')
      .length;
    const warnings = input.receipts.filter((receipt) => receipt.status === 'warn').length;
    return {
      familyId: input.familyId,
      label: input.label,
      status: combineStatuses(input.receipts.map((receipt) => receipt.status)),
      receipts: input.receipts,
      requiredChecks: input.receipts.filter((receipt) => receipt.severity !== 'advisory').length,
      advisoryChecks: input.receipts.filter((receipt) => receipt.severity === 'advisory').length,
      blockingFailures,
      warnings,
      notes: input.notes,
    };
  }
}

function combineStatuses(statuses: ZavorthQaSecurityReleaseCheckStatus[]): ZavorthQaSecurityReleaseCheckStatus {
  if (statuses.includes('fail')) return 'fail';
  if (statuses.includes('warn')) return 'warn';
  return 'pass';
}

function normalizePath(input: string): string {
  return input.replace(/\\/g, '/');
}
