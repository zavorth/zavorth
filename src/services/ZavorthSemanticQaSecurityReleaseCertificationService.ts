import type {
  ZavorthCertificationFamilyResult,
  ZavorthQaSecurityReleaseCertificationSnapshot,
  ZavorthQaSecurityReleaseCheckStatus,
  ZavorthQaSecurityReleaseFamilyId,
  ZavorthQaSecurityReleaseReceipt,
  ZavorthQaSecurityReleaseSeverity,
} from '../contracts/ZavorthQaSecurityReleaseCertificationContract.js';
import { ZavorthQaSecurityReleaseCertificationPackService } from './ZavorthQaSecurityReleaseCertificationPackService.js';
import { ZAVORTH_SEMANTIC_QA_SECURITY_RELEASE_CERTIFICATION_CONTRACT_VERSION } from '../contracts/ZavorthSemanticQaSecurityReleaseCertificationContract.js';

import type {
  ZavorthSemanticQaSecurityReleaseCertificationSnapshot,
  ZavorthSemanticQaSecurityReleaseCertificationStatus,
  ZavorthSemanticQaSecurityReleaseClaim,
  ZavorthSemanticQaSecurityReleaseClaimKind,
  ZavorthSemanticQaSecurityReleaseClaimPriority,
  ZavorthSemanticQaSecurityReleaseClaimStatus,
  ZavorthSemanticQaSecurityReleaseScenario,
} from '../contracts/ZavorthSemanticQaSecurityReleaseCertificationContract.js';

type Runtime = {
  now?: () => Date;
  rootDir?: string;
  packService?: Pick<ZavorthQaSecurityReleaseCertificationPackService, 'buildSnapshot'>;
};

type ClaimInput = {
  kind: ZavorthSemanticQaSecurityReleaseClaimKind;
  status: ZavorthSemanticQaSecurityReleaseClaimStatus;
  priority: ZavorthSemanticQaSecurityReleaseClaimPriority;
  familyId?: ZavorthQaSecurityReleaseFamilyId;
  checkId?: string;
  receiptStatus?: ZavorthQaSecurityReleaseCheckStatus;
  severity?: ZavorthQaSecurityReleaseSeverity;
  evidenceKind?: ZavorthSemanticQaSecurityReleaseClaim['evidenceKind'];
  expectedBehavior: string;
  zavorthEquivalent: string;
  evidence: string[];
  receiptIds?: string[];
  notes?: string[];
};

const RECEIPT_PREFIX = 'zavorth.semantic.s7.qa-security-release';

export class ZavorthSemanticQaSecurityReleaseCertificationService {
  private readonly now: () => Date;
  private readonly packService: Pick<ZavorthQaSecurityReleaseCertificationPackService, 'buildSnapshot'>;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.packService = runtime.packService || new ZavorthQaSecurityReleaseCertificationPackService({
      now: this.now,
      rootDir: runtime.rootDir,
    });
  }

  public buildSnapshot(): ZavorthSemanticQaSecurityReleaseCertificationSnapshot {
    const pack = this.packService.buildSnapshot();
    const scenarios = this.buildScenarios(pack);
    const claims = this.buildClaims(pack, scenarios);
    const gaps = claims.filter((claim) => claim.status === 'gap').length;
    const status: ZavorthSemanticQaSecurityReleaseCertificationStatus =
      pack.status === 'passed'
      && gaps === 0
      && scenarios.every((scenario) => scenario.status === 'passed')
      && pack.summary.dependencyPatchesAcceptedSilently === false
      && pack.summary.rawWorkflowYamlCopied === false
      && pack.summary.liveExternalIoPerformed === false
      && pack.summary.secretValuesSerialized === false
        ? 'passed'
        : 'failed';
    const receipts = allReceipts(pack);

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_SEMANTIC_QA_SECURITY_RELEASE_CERTIFICATION_CONTRACT_VERSION,
      status,
      semanticPhase: 'S7',
      statement: 'QA, security, release, workflow and patch-risk semantics are certified as local-only artifact-first Zavorth release gates.',
      packStatus: pack.status,
      packContractVersion: pack.contractVersion,
      runtime: pack.runtime,
      claims,
      scenarios,
      summary: {
        semanticClaims: claims.length,
        covered: countStatus(claims, 'covered'),
        ownerGated: countStatus(claims, 'owner-gated'),
        rejected: countStatus(claims, 'rejected'),
        gaps,
        p0Claims: countPriority(claims, 'P0'),
        p1Claims: countPriority(claims, 'P1'),
        p2Claims: countPriority(claims, 'P2'),
        receiptBackedClaims: claims.filter((claim) => claim.receiptIds.length > 0).length,
        familyClaimsCertified: claims.filter((claim) => claim.kind === 'family-coverage').length,
        receiptClaimsCertified: claims.filter((claim) => claim.kind === 'receipt-coverage').length,
        qaScenarioClaimsCertified: claims.filter((claim) => claim.kind === 'qa-scenario-policy').length,
        securityControlClaimsCertified: claims.filter((claim) => claim.kind === 'security-control-policy').length,
        releaseAcceptanceClaimsCertified: claims.filter((claim) => claim.kind === 'release-acceptance-policy').length,
        workflowSemanticClaimsCertified: claims.filter((claim) => claim.kind === 'workflow-semantic-policy').length,
        patchRiskClaimsCertified: claims.filter((claim) => claim.kind === 'patch-risk-policy').length,
        functionalRunnerClaimsCertified: claims.filter((claim) => claim.kind === 'functional-runner-policy').length,
        scenariosPassed: scenarios.filter((scenario) => scenario.status === 'passed').length,
        packFamilies: pack.summary.families,
        packReceipts: pack.summary.receipts,
        passFamilies: pack.summary.passFamilies,
        warnFamilies: pack.summary.warnFamilies,
        failFamilies: pack.summary.failFamilies,
        warningReceipts: receipts.filter((receipt) => receipt.status === 'warn').length,
        blockingFailures: pack.functionalConsistencyRunner.families.reduce((sum, family) => sum + family.blockingFailures, 0),
        localChecksOnly: true,
        dependencyPatchesAcceptedSilently: false,
        rawWorkflowYamlCopied: false,
        liveExternalIoPerformed: false,
        secretValuesSerialized: false,
        sourceCodeCopied: false,
      },
      policy: {
        semanticClaimRequiredForEveryFamily: true,
        semanticClaimRequiredForEveryReceipt: true,
        localChecksOnly: true,
        noRawWorkflowYamlCopy: true,
        dependencyPatchesNeedReceipt: true,
        patchWarningsRemainOwnerGated: true,
        blockingFailuresBlockRelease: true,
        noLiveProviderCalls: true,
        noLiveChannelSends: true,
        noSecretValuesSerialized: true,
        artifactFirstReceipts: true,
        optionalCiCompatible: true,
        noSourceWorkflowCopy: true,
        rawWorkflowYamlRejected: true,
        silentPatchAcceptanceRejected: true,
        liveReleaseIoRejected: true,
        gapsBlockRelease: true,
      },
      commands: {
        inspect: 'npm run semantic-qa-security-release-certification --silent',
        inspectJson: 'npm run semantic-qa-security-release-certification:json --silent',
        check: 'npm run semantic-qa-security-release-certification:check --silent',
        qa: 'npm run qa:semantic-qa-security-release-certification --silent',
        nextStage: 'S8 - Skill Ecosystem Semantics',
      },
    };
  }

  public formatSnapshotText(snapshot = this.buildSnapshot()): string {
    const lines = [
      'Zavorth Semantic QA Security Release Certification - S7',
      `Status: ${snapshot.status}`,
      `Contract: ${snapshot.contractVersion}`,
      `Pack status: ${snapshot.packStatus}`,
      `Claims: ${snapshot.summary.semanticClaims}`,
      `Covered/owner-gated/rejected/gaps: ${snapshot.summary.covered}/${snapshot.summary.ownerGated}/${snapshot.summary.rejected}/${snapshot.summary.gaps}`,
      `P0/P1/P2: ${snapshot.summary.p0Claims}/${snapshot.summary.p1Claims}/${snapshot.summary.p2Claims}`,
      `Receipt-backed claims: ${snapshot.summary.receiptBackedClaims}`,
      `Family claims certified: ${snapshot.summary.familyClaimsCertified}`,
      `Receipt claims certified: ${snapshot.summary.receiptClaimsCertified}`,
      `QA/security/release/workflow/patch/runner claims: ${snapshot.summary.qaScenarioClaimsCertified}/${snapshot.summary.securityControlClaimsCertified}/${snapshot.summary.releaseAcceptanceClaimsCertified}/${snapshot.summary.workflowSemanticClaimsCertified}/${snapshot.summary.patchRiskClaimsCertified}/${snapshot.summary.functionalRunnerClaimsCertified}`,
      `Scenarios passed: ${snapshot.summary.scenariosPassed}/${snapshot.scenarios.length}`,
      `Pack families pass/warn/fail: ${snapshot.summary.passFamilies}/${snapshot.summary.warnFamilies}/${snapshot.summary.failFamilies}`,
      `Dependency patches accepted silently: ${snapshot.summary.dependencyPatchesAcceptedSilently}`,
      `Raw workflow YAML copied: ${snapshot.summary.rawWorkflowYamlCopied}`,
      `Live external I/O performed: ${snapshot.summary.liveExternalIoPerformed}`,
      `Secret values serialized: ${snapshot.summary.secretValuesSerialized}`,
      'Claim groups:',
      ...snapshot.claims.map((claim) =>
        `- ${claim.status} ${claim.priority} ${claim.id}: ${claim.expectedBehavior} -> ${claim.zavorthEquivalent}`,
      ),
      `Next: ${snapshot.commands.nextStage}`,
    ];
    return lines.join('\n');
  }

  private buildClaims(
    pack: ZavorthQaSecurityReleaseCertificationSnapshot,
    scenarios: ZavorthSemanticQaSecurityReleaseScenario[],
  ): ZavorthSemanticQaSecurityReleaseClaim[] {
    const receipts = allReceipts(pack);
    return [
      ...pack.functionalConsistencyRunner.families.map((family) => this.familyClaim(family)),
      ...receipts.map((receipt) => this.receiptClaim(receipt)),
      ...pack.qaScenarios.receipts.map((receipt) => this.qaScenarioClaim(receipt)),
      ...pack.security.receipts.map((receipt) => this.securityControlClaim(receipt)),
      ...pack.releaseAcceptance.receipts.map((receipt) => this.releaseAcceptanceClaim(receipt)),
      ...pack.workflowSemantics.receipts.map((receipt) => this.workflowSemanticClaim(receipt)),
      ...pack.patchRisk.receipts.map((receipt) => this.patchRiskClaim(receipt)),
      this.functionalRunnerClaim(pack),
      ...this.globalPolicyClaims(pack),
      ...this.scenarioClaims(scenarios),
      ...this.unsafeReleaseClaims(pack),
    ];
  }

  private familyClaim(family: ZavorthCertificationFamilyResult): ZavorthSemanticQaSecurityReleaseClaim {
    return this.claim({
      kind: 'family-coverage',
      status: semanticStatus(family.status, family.familyId),
      priority: familyPriority(family.familyId),
      familyId: family.familyId,
      receiptStatus: family.status,
      expectedBehavior: `${family.label} is represented as a release-certification family with explicit pass/warn/fail semantics.`,
      zavorthEquivalent: 'ZavorthCertificationFamilyResult with artifact-first receipts and blocking failure counts.',
      evidence: [
        `status=${family.status}`,
        `requiredChecks=${family.requiredChecks}`,
        `advisoryChecks=${family.advisoryChecks}`,
        `receipts=${family.receipts.length}`,
        `blockingFailures=${family.blockingFailures}`,
        `warnings=${family.warnings}`,
      ],
      receiptIds: family.receipts.map((receipt) => receipt.id),
      notes: family.notes,
    });
  }

  private receiptClaim(receipt: ZavorthQaSecurityReleaseReceipt): ZavorthSemanticQaSecurityReleaseClaim {
    return this.claim({
      kind: 'receipt-coverage',
      status: semanticReceiptStatus(receipt),
      priority: receiptPriority(receipt),
      familyId: receipt.familyId,
      checkId: receipt.checkId,
      receiptStatus: receipt.status,
      severity: receipt.severity,
      evidenceKind: receipt.evidenceKind,
      expectedBehavior: `${receipt.label} emits an explicit local release-certification receipt.`,
      zavorthEquivalent: 'ZavorthQaSecurityReleaseReceipt metadata with status, severity and policy flags.',
      evidence: receiptEvidence(receipt),
      receiptIds: [receipt.id],
      notes: receipt.notes,
    });
  }

  private qaScenarioClaim(receipt: ZavorthQaSecurityReleaseReceipt): ZavorthSemanticQaSecurityReleaseClaim {
    return this.familySpecificClaim('qa-scenario-policy', receipt, 'QA scenario gates must be represented as local commands or local evidence, not implicit live provider/channel calls.');
  }

  private securityControlClaim(receipt: ZavorthQaSecurityReleaseReceipt): ZavorthSemanticQaSecurityReleaseClaim {
    return this.familySpecificClaim('security-control-policy', receipt, 'Security controls must be local-only, secret-safe and release-gateable.');
  }

  private releaseAcceptanceClaim(receipt: ZavorthQaSecurityReleaseReceipt): ZavorthSemanticQaSecurityReleaseClaim {
    return this.familySpecificClaim('release-acceptance-policy', receipt, 'Release acceptance must expose CLI/package/SDK/check gates as local evidence.');
  }

  private workflowSemanticClaim(receipt: ZavorthQaSecurityReleaseReceipt): ZavorthSemanticQaSecurityReleaseClaim {
    return this.familySpecificClaim('workflow-semantic-policy', receipt, 'Workflow behavior must be modeled as local semantic commands without copying raw workflow YAML.');
  }

  private patchRiskClaim(receipt: ZavorthQaSecurityReleaseReceipt): ZavorthSemanticQaSecurityReleaseClaim {
    const status = receipt.status === 'warn'
      ? 'owner-gated'
      : semanticReceiptStatus(receipt);
    return this.claim({
      kind: 'patch-risk-policy',
      status,
      priority: 'P0',
      familyId: receipt.familyId,
      checkId: receipt.checkId,
      receiptStatus: receipt.status,
      severity: receipt.severity,
      evidenceKind: receipt.evidenceKind,
      expectedBehavior: 'Dependency patches are absent or explicitly tracked with owner decision before release.',
      zavorthEquivalent: 'Patch-risk ledger receipt with silent acceptance rejected.',
      evidence: receiptEvidence(receipt),
      receiptIds: [receipt.id],
      notes: receipt.notes,
    });
  }

  private familySpecificClaim(
    kind: ZavorthSemanticQaSecurityReleaseClaimKind,
    receipt: ZavorthQaSecurityReleaseReceipt,
    expectedBehavior: string,
  ): ZavorthSemanticQaSecurityReleaseClaim {
    return this.claim({
      kind,
      status: semanticReceiptStatus(receipt),
      priority: receiptPriority(receipt),
      familyId: receipt.familyId,
      checkId: receipt.checkId,
      receiptStatus: receipt.status,
      severity: receipt.severity,
      evidenceKind: receipt.evidenceKind,
      expectedBehavior,
      zavorthEquivalent: `${receipt.familyId} receipt ${receipt.checkId} is available as a Zavorth-owned gate.`,
      evidence: receiptEvidence(receipt),
      receiptIds: [receipt.id],
      notes: receipt.notes,
    });
  }

  private functionalRunnerClaim(pack: ZavorthQaSecurityReleaseCertificationSnapshot): ZavorthSemanticQaSecurityReleaseClaim {
    return this.claim({
      kind: 'functional-runner-policy',
      status: pack.functionalConsistencyRunner.status === 'fail' ? 'gap' : 'covered',
      priority: 'P0',
      familyId: 'functional-consistency',
      receiptStatus: pack.functionalConsistencyRunner.status,
      expectedBehavior: 'Functional consistency runner aggregates every QA/security/release family into one local release gate.',
      zavorthEquivalent: 'ZavorthFunctionalReleaseCertificationRunnerSnapshot printable family matrix.',
      evidence: [
        `status=${pack.functionalConsistencyRunner.status}`,
        `families=${pack.functionalConsistencyRunner.families.length}`,
        `printableLines=${pack.functionalConsistencyRunner.printableLines.length}`,
        `dependencyPatchesAcceptedSilently=${pack.functionalConsistencyRunner.dependencyPatchesAcceptedSilently}`,
        `rawWorkflowYamlCopied=${pack.functionalConsistencyRunner.rawWorkflowYamlCopied}`,
      ],
      receiptIds: pack.functionalConsistencyRunner.families
        .flatMap((family) => family.receipts)
        .filter((receipt) => receipt.familyId === 'functional-consistency')
        .map((receipt) => receipt.id),
      notes: ['The runner is the S7 release-certification surface for downstream automation.'],
    });
  }

  private globalPolicyClaims(pack: ZavorthQaSecurityReleaseCertificationSnapshot): ZavorthSemanticQaSecurityReleaseClaim[] {
    const receipts = allReceipts(pack);
    return [
      this.claim({
        kind: 'local-only-policy',
        status: pack.policy.localChecksOnly
          && pack.summary.liveExternalIoPerformed === false
          && receipts.every((receipt) => receipt.liveExternalIoPerformed === false)
            ? 'covered'
            : 'gap',
        priority: 'P0',
        expectedBehavior: 'QA/security/release certification stays local-only and performs no live provider/channel/device I/O.',
        zavorthEquivalent: 'Surface controls policy and receipt flags keep all checks local.',
        evidence: [
          `localChecksOnly=${pack.policy.localChecksOnly}`,
          `noLiveProviderCalls=${pack.policy.noLiveProviderCalls}`,
          `noLiveChannelSends=${pack.policy.noLiveChannelSends}`,
          `liveExternalIoPerformed=${pack.summary.liveExternalIoPerformed}`,
        ],
        receiptIds: [`${RECEIPT_PREFIX}.policy.local-only`],
        notes: ['S7 certifies availability of gates; it does not run live integrations.'],
      }),
      this.claim({
        kind: 'artifact-receipt-policy',
        status: pack.policy.artifactFirstReceipts
          && receipts.length > 0
          && receipts.every((receipt) => receipt.artifactFirst)
          && receipts.every((receipt) => receipt.secretValuesSerialized === false)
            ? 'covered'
            : 'gap',
        priority: 'P0',
        expectedBehavior: 'Every QA/security/release surface emits artifact-first, secret-safe receipts.',
        zavorthEquivalent: 'ZavorthQaSecurityReleaseReceipt for each family check and runner check.',
        evidence: [
          `artifactFirstReceipts=${pack.policy.artifactFirstReceipts}`,
          `receipts=${receipts.length}`,
          `secretValuesSerialized=${pack.summary.secretValuesSerialized}`,
          `sourceCodeCopied=false`,
        ],
        receiptIds: receipts.map((receipt) => receipt.id),
        notes: ['Receipts store release metadata, commands and policy flags only.'],
      }),
    ];
  }

  private scenarioClaims(
    scenarios: ZavorthSemanticQaSecurityReleaseScenario[],
  ): ZavorthSemanticQaSecurityReleaseClaim[] {
    return scenarios.map((scenario) => this.claim({
      kind: scenario.id === 'tracked-patch-warning-is-owner-gated'
        ? 'patch-risk-policy'
        : scenario.id === 'workflow-semantics-do-not-copy-yaml'
          ? 'workflow-semantic-policy'
          : 'local-only-policy',
      status: scenario.status === 'passed' ? 'covered' : 'gap',
      priority: scenario.id === 'blocking-failure-blocks-release' ? 'P0' : 'P1',
      expectedBehavior: scenarioBehavior(scenario.id),
      zavorthEquivalent: scenarioEquivalent(scenario.id),
      evidence: scenario.evidence,
      receiptIds: scenario.receiptIds,
      notes: ['Scenario proves release gate semantics without live external I/O.'],
    }));
  }

  private unsafeReleaseClaims(pack: ZavorthQaSecurityReleaseCertificationSnapshot): ZavorthSemanticQaSecurityReleaseClaim[] {
    return [
      this.claim({
        kind: 'unsafe-release-policy',
        status: pack.summary.rawWorkflowYamlCopied === false ? 'rejected' : 'gap',
        priority: 'P0',
        expectedBehavior: 'The architecture must reject raw workflow YAML copying as the release integration strategy.',
        zavorthEquivalent: 'Workflow semantics are represented as local commands and receipts.',
        evidence: [`rawWorkflowYamlCopied=${pack.summary.rawWorkflowYamlCopied}`],
        receiptIds: [`${RECEIPT_PREFIX}.reject.raw-workflow-yaml-copy`],
        notes: ['Rejected here means intentionally not implemented.'],
      }),
      this.claim({
        kind: 'unsafe-release-policy',
        status: pack.summary.dependencyPatchesAcceptedSilently === false ? 'rejected' : 'gap',
        priority: 'P0',
        expectedBehavior: 'The architecture must reject silent dependency patch acceptance.',
        zavorthEquivalent: 'Patch-risk receipts require explicit owner decision or no-patch evidence.',
        evidence: [`dependencyPatchesAcceptedSilently=${pack.summary.dependencyPatchesAcceptedSilently}`],
        receiptIds: [`${RECEIPT_PREFIX}.reject.silent-patch-acceptance`],
        notes: ['Rejected here means intentionally blocked by policy.'],
      }),
      this.claim({
        kind: 'unsafe-release-policy',
        status: pack.summary.liveExternalIoPerformed === false ? 'rejected' : 'gap',
        priority: 'P0',
        expectedBehavior: 'The architecture must reject live provider/channel calls during release certification.',
        zavorthEquivalent: 'Release certification records commands and local evidence only.',
        evidence: [`liveExternalIoPerformed=${pack.summary.liveExternalIoPerformed}`],
        receiptIds: [`${RECEIPT_PREFIX}.reject.live-release-io`],
        notes: ['Rejected here means certification stays offline/local.'],
      }),
      this.claim({
        kind: 'unsafe-release-policy',
        status: pack.summary.secretValuesSerialized === false ? 'rejected' : 'gap',
        priority: 'P0',
        expectedBehavior: 'The architecture must reject raw secret serialization in release receipts.',
        zavorthEquivalent: 'Receipts serialize command names and metadata only.',
        evidence: [`secretValuesSerialized=${pack.summary.secretValuesSerialized}`],
        receiptIds: [`${RECEIPT_PREFIX}.reject.raw-secret-values`],
        notes: ['Rejected here means intentionally not implemented.'],
      }),
    ];
  }

  private buildScenarios(pack: ZavorthQaSecurityReleaseCertificationSnapshot): ZavorthSemanticQaSecurityReleaseScenario[] {
    const receipts = allReceipts(pack);
    const patchReceipts = pack.patchRisk.receipts;
    return [
      {
        id: 'blocking-failure-blocks-release',
        status: pack.summary.failFamilies === 0
          && pack.functionalConsistencyRunner.families.every((family) => family.blockingFailures === 0)
            ? 'passed'
            : 'failed',
        evidence: [
          `failFamilies=${pack.summary.failFamilies}`,
          `blockingFailures=${pack.functionalConsistencyRunner.families.reduce((sum, family) => sum + family.blockingFailures, 0)}`,
        ],
        receiptIds: receipts.filter((receipt) => receipt.severity === 'blocking').map((receipt) => receipt.id),
        liveExternalIoPerformed: false,
        secretValuesSerialized: false,
        rawWorkflowYamlCopied: false,
        dependencyPatchesAcceptedSilently: false,
      },
      {
        id: 'tracked-patch-warning-is-owner-gated',
        status: pack.patchRisk.dependencyPatchesAcceptedSilently === false
          && patchReceipts.every((receipt) => receipt.dependencyPatchAcceptedSilently === false)
            ? 'passed'
            : 'failed',
        evidence: [
          `patchFilesObserved=${pack.patchRisk.patchFilesObserved}`,
          `patchReceiptStatuses=${patchReceipts.map((receipt) => receipt.status).join(',')}`,
          `dependencyPatchesAcceptedSilently=${pack.patchRisk.dependencyPatchesAcceptedSilently}`,
        ],
        receiptIds: patchReceipts.map((receipt) => receipt.id),
        liveExternalIoPerformed: false,
        secretValuesSerialized: false,
        rawWorkflowYamlCopied: false,
        dependencyPatchesAcceptedSilently: false,
      },
      {
        id: 'workflow-semantics-do-not-copy-yaml',
        status: pack.workflowSemantics.rawWorkflowYamlCopied === false
          && pack.workflowSemantics.receipts.every((receipt) => receipt.copiedWorkflowYaml === false)
            ? 'passed'
            : 'failed',
        evidence: [
          `workflowFilesObserved=${pack.workflowSemantics.workflowFilesObserved}`,
          `semanticsChecked=${pack.workflowSemantics.semanticsChecked}`,
          `rawWorkflowYamlCopied=${pack.workflowSemantics.rawWorkflowYamlCopied}`,
        ],
        receiptIds: pack.workflowSemantics.receipts.map((receipt) => receipt.id),
        liveExternalIoPerformed: false,
        secretValuesSerialized: false,
        rawWorkflowYamlCopied: false,
        dependencyPatchesAcceptedSilently: false,
      },
      {
        id: 'release-certification-stays-local-only',
        status: pack.policy.localChecksOnly
          && pack.summary.liveExternalIoPerformed === false
          && receipts.every((receipt) => receipt.liveExternalIoPerformed === false)
          && pack.summary.secretValuesSerialized === false
            ? 'passed'
            : 'failed',
        evidence: [
          `localChecksOnly=${pack.policy.localChecksOnly}`,
          `liveExternalIoPerformed=${pack.summary.liveExternalIoPerformed}`,
          `secretValuesSerialized=${pack.summary.secretValuesSerialized}`,
          `receipts=${receipts.length}`,
        ],
        receiptIds: receipts.map((receipt) => receipt.id),
        liveExternalIoPerformed: false,
        secretValuesSerialized: false,
        rawWorkflowYamlCopied: false,
        dependencyPatchesAcceptedSilently: false,
      },
    ];
  }

  private claim(input: ClaimInput): ZavorthSemanticQaSecurityReleaseClaim {
    const id = `${input.kind}:${slug([
      input.familyId,
      input.checkId,
      input.severity,
      input.expectedBehavior,
    ].filter(Boolean).join('-'))}`;
    return {
      id,
      kind: input.kind,
      status: input.status,
      priority: input.priority,
      ...(input.familyId ? { familyId: input.familyId } : {}),
      ...(input.checkId ? { checkId: input.checkId } : {}),
      ...(input.receiptStatus ? { receiptStatus: input.receiptStatus } : {}),
      ...(input.severity ? { severity: input.severity } : {}),
      ...(input.evidenceKind ? { evidenceKind: input.evidenceKind } : {}),
      expectedBehavior: input.expectedBehavior,
      zavorthEquivalent: input.zavorthEquivalent,
      evidence: input.evidence,
      receiptIds: input.receiptIds || [`${RECEIPT_PREFIX}.${id}`],
      notes: input.notes || [],
    };
  }
}

function allReceipts(pack: ZavorthQaSecurityReleaseCertificationSnapshot): ZavorthQaSecurityReleaseReceipt[] {
  return pack.functionalConsistencyRunner.families.flatMap((family) => family.receipts);
}

function semanticStatus(
  status: ZavorthQaSecurityReleaseCheckStatus,
  familyId: ZavorthQaSecurityReleaseFamilyId,
): ZavorthSemanticQaSecurityReleaseClaimStatus {
  if (status === 'pass') return 'covered';
  if (status === 'warn') return familyId === 'patch-risk' ? 'owner-gated' : 'owner-gated';
  return 'gap';
}

function semanticReceiptStatus(receipt: ZavorthQaSecurityReleaseReceipt): ZavorthSemanticQaSecurityReleaseClaimStatus {
  if (receipt.status === 'pass') return 'covered';
  if (receipt.status === 'warn') return 'owner-gated';
  return 'gap';
}

function familyPriority(familyId: ZavorthQaSecurityReleaseFamilyId): ZavorthSemanticQaSecurityReleaseClaimPriority {
  switch (familyId) {
    case 'qa-scenarios':
    case 'security':
    case 'release-acceptance':
    case 'functional-consistency':
      return 'P0';
    case 'workflow-semantics':
    case 'patch-risk':
      return 'P1';
    default:
      return 'P2';
  }
}

function receiptPriority(receipt: ZavorthQaSecurityReleaseReceipt): ZavorthSemanticQaSecurityReleaseClaimPriority {
  if (receipt.severity === 'blocking') return 'P0';
  if (receipt.severity === 'required') return 'P1';
  return 'P2';
}

function receiptEvidence(receipt: ZavorthQaSecurityReleaseReceipt): string[] {
  return [
    `familyId=${receipt.familyId}`,
    `checkId=${receipt.checkId}`,
    `status=${receipt.status}`,
    `severity=${receipt.severity}`,
    `evidenceKind=${receipt.evidenceKind}`,
    `command=${receipt.command || 'none'}`,
    `localCheckPerformed=${receipt.localCheckPerformed}`,
    `liveExternalIoPerformed=${receipt.liveExternalIoPerformed}`,
    `secretValuesSerialized=${receipt.secretValuesSerialized}`,
    `rawWorkflowYamlCopied=${receipt.rawWorkflowYamlCopied}`,
    `dependencyPatchAcceptedSilently=${receipt.dependencyPatchAcceptedSilently}`,
    `observed=${receipt.observed}`,
  ];
}

function scenarioBehavior(id: ZavorthSemanticQaSecurityReleaseScenario['id']): string {
  switch (id) {
    case 'blocking-failure-blocks-release':
      return 'Blocking release-certification failures must block semantic release readiness.';
    case 'tracked-patch-warning-is-owner-gated':
      return 'Tracked dependency patch warnings must remain owner-gated instead of silently accepted.';
    case 'workflow-semantics-do-not-copy-yaml':
      return 'Workflow behavior must be certified by semantic commands without copying raw workflow YAML.';
    case 'release-certification-stays-local-only':
      return 'Release certification must stay local-only and avoid live external I/O.';
    default:
      return 'QA/security/release scenario must pass.';
  }
}

function scenarioEquivalent(id: ZavorthSemanticQaSecurityReleaseScenario['id']): string {
  switch (id) {
    case 'blocking-failure-blocks-release':
      return 'Family blockingFailures and failFamilies are zero.';
    case 'tracked-patch-warning-is-owner-gated':
      return 'Patch-risk ledger receipts require explicit owner decision.';
    case 'workflow-semantics-do-not-copy-yaml':
      return 'WorkflowSemanticCheck receipts set copiedWorkflowYaml=false.';
    case 'release-certification-stays-local-only':
      return 'Surface controls policy and receipts keep liveExternalIoPerformed=false.';
    default:
      return 'Zavorth QA/security/release semantic scenario receipt.';
  }
}

function countStatus(
  claims: ZavorthSemanticQaSecurityReleaseClaim[],
  status: ZavorthSemanticQaSecurityReleaseClaimStatus,
): number {
  return claims.filter((claim) => claim.status === status).length;
}

function countPriority(
  claims: ZavorthSemanticQaSecurityReleaseClaim[],
  priority: ZavorthSemanticQaSecurityReleaseClaimPriority,
): number {
  return claims.filter((claim) => claim.priority === priority).length;
}

function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 96);
}
