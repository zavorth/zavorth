import os from 'node:os';
import path from 'node:path';
import type {
  ZavorthSemanticClosureClaimStatus,
  ZavorthSemanticClosureConsolidationSnapshot,
  ZavorthSemanticClosureConsolidationStatus,
  ZavorthSemanticClosurePhaseId,
  ZavorthSemanticClosurePhaseLabel,
  ZavorthSemanticClosurePhaseReceipt,
  ZavorthSemanticClosureReleaseGate,
} from '../contracts/ZavorthSemanticClosureConsolidationContract.js';
import { ZAVORTH_SEMANTIC_CLOSURE_CONSOLIDATION_CONTRACT_VERSION } from '../contracts/ZavorthSemanticClosureConsolidationContract.js';

import { ZavorthSemanticAgentRuntimeCertificationService } from './ZavorthSemanticAgentRuntimeCertificationService.js';
import { ZavorthSemanticChannelMeshCertificationService } from './ZavorthSemanticChannelMeshCertificationService.js';
import { ZavorthSemanticFunctionalClosureCertificationService } from './ZavorthSemanticFunctionalClosureCertificationService.js';
import { ZavorthFunctionalClosureService } from './ZavorthFunctionalClosureService.js';
import { ZavorthSemanticMemoryDocumentTerminalCertificationService } from './ZavorthSemanticMemoryDocumentTerminalCertificationService.js';
import { ZavorthSemanticNativeCompanionDeviceCapabilityCertificationService } from './ZavorthSemanticNativeCompanionDeviceCapabilityCertificationService.js';
import { ZavorthSemanticPluginPackageCertificationService } from './ZavorthSemanticPluginPackageCertificationService.js';
import { ZavorthSemanticProviderMeshCertificationService } from './ZavorthSemanticProviderMeshCertificationService.js';
import { ZavorthSemanticQaSecurityReleaseCertificationService } from './ZavorthSemanticQaSecurityReleaseCertificationService.js';
import { ZavorthSemanticSkillEcosystemCertificationService } from './ZavorthSemanticSkillEcosystemCertificationService.js';
import { ZavorthNativeCompanionDevicePackService } from './ZavorthNativeCompanionDevicePackService.js';

type Runtime = {
  now?: () => Date;
  rootDir?: string;
  tempRoot?: string;
  sourceRoot?: string;
  zavorthRoot?: string;
  certifiers?: Partial<Record<ZavorthSemanticClosurePhaseId, () => MaybePromise<SemanticPhaseSnapshot>>>;
};

type MaybePromise<T> = T | Promise<T>;

type SemanticPhaseSnapshot = {
  contractVersion: string;
  status: ZavorthSemanticClosureConsolidationStatus;
  semanticPhase: ZavorthSemanticClosurePhaseId;
  statement: string;
  claims: SemanticPhaseClaim[];
  summary: Record<string, unknown>;
  commands: {
    inspect?: string;
    inspectJson?: string;
    check?: string;
    qa?: string;
    releaseGate?: string;
    nextAction?: string;
    nextStep?: string;
  };
};

type SemanticPhaseClaim = {
  id: string;
  status: ZavorthSemanticClosureClaimStatus;
  priority: 'P0' | 'P1' | 'P2';
  receiptIds: string[];
};

const PHASE_ORDER: ZavorthSemanticClosurePhaseId[] = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9'];

const PHASE_LABELS: Record<ZavorthSemanticClosurePhaseId, ZavorthSemanticClosurePhaseLabel> = {
  S1: 'Plugin and package semantics',
  S2: 'Agent runtime semantics',
  S3: 'Provider mesh semantics',
  S4: 'Channel mesh semantics',
  S5: 'Memory, document, search and terminal semantics',
  S6: 'Native companion and device semantics',
  S7: 'QA, security and release semantics',
  S8: 'Skill ecosystem semantics',
  S9: 'Functional closure semantics',
};

export class ZavorthSemanticClosureConsolidationService {
  private readonly now: () => Date;
  private readonly rootDir?: string;
  private readonly tempRoot: string;
  private readonly sourceRoot?: string;
  private readonly zavorthRoot?: string;
  private readonly certifiers: Record<ZavorthSemanticClosurePhaseId, () => MaybePromise<SemanticPhaseSnapshot>>;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.rootDir = runtime.rootDir;
    this.tempRoot = path.resolve(runtime.tempRoot || path.join(
      os.tmpdir(),
      `zavorth-semantic-closure-consolidation-${process.pid}-${Date.now()}`,
    ));
    this.sourceRoot = runtime.sourceRoot;
    this.zavorthRoot = runtime.zavorthRoot;
    this.certifiers = {
      ...this.defaultCertifiers(),
      ...runtime.certifiers,
    };
  }

  public async buildSnapshot(): Promise<ZavorthSemanticClosureConsolidationSnapshot> {
    const snapshots: SemanticPhaseSnapshot[] = [];
    for (const phase of PHASE_ORDER) {
      snapshots.push(await this.certifiers[phase]());
    }
    const phaseReceipts = snapshots.map((snapshot) => this.phaseReceipt(snapshot));
    const releaseGate = this.buildReleaseGate(phaseReceipts);
    const summary = {
      phases: phaseReceipts.length,
      passed: phaseReceipts.filter((receipt) => receipt.status === 'passed').length,
      failed: phaseReceipts.filter((receipt) => receipt.status !== 'passed').length,
      semanticClaims: sum(phaseReceipts, 'semanticClaims'),
      covered: sum(phaseReceipts, 'covered'),
      replaced: sum(phaseReceipts, 'replaced'),
      ownerGated: sum(phaseReceipts, 'ownerGated'),
      rejected: sum(phaseReceipts, 'rejected'),
      gaps: sum(phaseReceipts, 'gaps'),
      p0Claims: sum(phaseReceipts, 'p0Claims'),
      p1Claims: sum(phaseReceipts, 'p1Claims'),
      p2Claims: sum(phaseReceipts, 'p2Claims'),
      receiptBackedClaims: sum(phaseReceipts, 'receiptBackedClaims'),
      receiptIds: phaseReceipts.reduce((count, receipt) => count + receipt.receiptIds.length, 0),
      phasesWithOwnerGates: phaseReceipts.filter((receipt) => receipt.ownerGated > 0).length,
      phasesWithRejectedPolicies: phaseReceipts.filter((receipt) => receipt.rejected > 0).length,
      releaseAllowed: releaseGate.releaseAllowed,
      releaseBlockers: releaseGate.blockers.length,
      machineReadableClosurePassed: releaseGate.machineReadableClosurePassed,
      functionalReleaseAllowed: releaseGate.functionalReleaseAllowed,
      liveExternalIoPerformed: !releaseGate.noLiveExternalIo,
      liveExecutionPerformed: !releaseGate.noLiveExecution,
      runtimeExecutionPerformed: !releaseGate.noRuntimeExecutionDuringCertification,
      secretValuesSerialized: !releaseGate.noSecretValuesSerialized,
      sourceCodeCopied: !releaseGate.noSourceCodeCopied,
      enabledByDefault: !releaseGate.noDefaultEnablement,
    };
    const status: ZavorthSemanticClosureConsolidationStatus = releaseGate.releaseAllowed ? 'passed' : 'failed';

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_SEMANTIC_CLOSURE_CONSOLIDATION_CONTRACT_VERSION,
      status,
      semanticScope: 'S1-S9',
      statement: 'Semantic closure consolidation proves S1-S9 remain passing together as one artifact-first Zavorth release gate.',
      phaseReceipts,
      releaseGate,
      summary,
      policy: {
        everySemanticPhaseMustPass: true,
        everyPhaseMustHaveClaims: true,
        everyClaimMustHaveReceipt: true,
        claimIdsMustBeUniqueWithinPhase: true,
        noGapsAllowed: true,
        functionalClosureMustAllowRelease: true,
        semanticClosureMustBeMachineReadable: true,
        noLiveExternalIoDuringConsolidation: true,
        noRuntimeExecutionDuringCertification: true,
        noSecretValuesSerialized: true,
        noSourceCodeCopied: true,
        noDefaultEnablement: true,
        rejectedPoliciesRemainExplicit: true,
        ownerGatesRemainExplicit: true,
        releaseGateBlocksAnyRegression: true,
      },
      commands: {
        inspect: 'npm run semantic-closure-consolidation --silent',
        inspectJson: 'npm run semantic-closure-consolidation:json --silent',
        check: 'npm run semantic-closure-consolidation:check --silent',
        qa: 'npm run qa:semantic-closure-consolidation --silent',
        releaseGate: 'npm run semantic-closure-consolidation -- --release-gate --require-pass',
        nextStep: 'S1-S9 semantic consolidation complete',
      },
    };
  }

  public formatSnapshotText(snapshot: ZavorthSemanticClosureConsolidationSnapshot): string {
    const lines = [
      'Zavorth Semantic Closure Consolidation - S1-S9',
      `Status: ${snapshot.status}`,
      `Contract: ${snapshot.contractVersion}`,
      `Phases passed: ${snapshot.summary.passed}/${snapshot.summary.phases}`,
      `Claims: ${snapshot.summary.semanticClaims}`,
      `Covered/replaced/owner-gated/rejected/gaps: ${snapshot.summary.covered}/${snapshot.summary.replaced}/${snapshot.summary.ownerGated}/${snapshot.summary.rejected}/${snapshot.summary.gaps}`,
      `P0/P1/P2 claims: ${snapshot.summary.p0Claims}/${snapshot.summary.p1Claims}/${snapshot.summary.p2Claims}`,
      `Receipt-backed claims: ${snapshot.summary.receiptBackedClaims}`,
      `Release allowed: ${snapshot.summary.releaseAllowed}`,
      `Release blockers: ${snapshot.summary.releaseBlockers}`,
      `Machine-readable closure passed: ${snapshot.summary.machineReadableClosurePassed}`,
      `Functional release allowed: ${snapshot.summary.functionalReleaseAllowed}`,
      `Live external I/O performed: ${snapshot.summary.liveExternalIoPerformed}`,
      `Runtime execution performed: ${snapshot.summary.runtimeExecutionPerformed}`,
      `Secret values serialized: ${snapshot.summary.secretValuesSerialized}`,
      'Gate receipts:',
      ...snapshot.phaseReceipts.map((receipt) =>
        `- ${receipt.phase} ${receipt.status} ${receipt.label}: claims=${receipt.semanticClaims}, gaps=${receipt.gaps}, receipts=${receipt.receiptBackedClaims}, next=${receipt.next}`,
      ),
      `Next: ${snapshot.commands.nextStep}`,
    ];
    return lines.join('\n');
  }

  public formatReleaseGateText(snapshot: ZavorthSemanticClosureConsolidationSnapshot): string {
    return [
      `Zavorth Semantic Closure Consolidation Release Gate: ${snapshot.status}`,
      `Release allowed: ${snapshot.releaseGate.releaseAllowed}`,
      `Phases passed: ${snapshot.releaseGate.phasesPassed}/${snapshot.releaseGate.phaseCount}`,
      `Claims: ${snapshot.summary.semanticClaims}`,
      `Gaps: ${snapshot.summary.gaps}`,
      `Release blockers: ${snapshot.summary.releaseBlockers}`,
      `Functional release allowed: ${snapshot.releaseGate.functionalReleaseAllowed}`,
      `Machine-readable closure passed: ${snapshot.releaseGate.machineReadableClosurePassed}`,
    ].join('\n');
  }

  private phaseReceipt(snapshot: SemanticPhaseSnapshot): ZavorthSemanticClosurePhaseReceipt {
    const claims = snapshot.claims || [];
    const summary = snapshot.summary || {};
    const receiptIds = unique(claims.flatMap((claim) => claim.receiptIds || []));
    return {
      phase: snapshot.semanticPhase,
      label: PHASE_LABELS[snapshot.semanticPhase],
      status: snapshot.status,
      contractVersion: snapshot.contractVersion,
      statement: snapshot.statement,
      command: snapshot.commands.inspectJson || snapshot.commands.inspect || '',
      checkCommand: snapshot.commands.check || '',
      qaCommand: snapshot.commands.qa || '',
      semanticClaims: numberValue(summary.semanticClaims, claims.length),
      covered: countClaimStatus(claims, 'covered', summary.covered),
      replaced: countClaimStatus(claims, 'replaced', summary.replaced),
      ownerGated: countClaimStatus(claims, 'owner-gated', summary.ownerGated),
      rejected: countClaimStatus(claims, 'rejected', summary.rejected),
      gaps: countClaimStatus(claims, 'gap', summary.gaps),
      p0Claims: countPriority(claims, 'P0', summary.p0Claims),
      p1Claims: countPriority(claims, 'P1', summary.p1Claims),
      p2Claims: countPriority(claims, 'P2', summary.p2Claims),
      receiptBackedClaims: numberValue(
        summary.receiptBackedClaims,
        claims.filter((claim) => Array.isArray(claim.receiptIds) && claim.receiptIds.length > 0).length,
      ),
      receiptIds,
      claimIdsUnique: new Set(claims.map((claim) => claim.id)).size === claims.length,
      receiptIdsValid: claims.every((claim) =>
        Array.isArray(claim.receiptIds)
        && claim.receiptIds.length > 0
        && claim.receiptIds.every((id) => typeof id === 'string' && id.trim().length > 0),
      ),
      liveExternalIoPerformed: anyBoolean(summary, ['liveExternalIoPerformed']),
      liveExecutionPerformed: anyBoolean(summary, ['liveExecutionPerformed']),
      runtimeExecutionPerformed: anyBoolean(summary, ['runtimeExecutionPerformed']),
      secretValuesSerialized: anyBoolean(summary, ['secretValuesSerialized']),
      sourceCodeCopied: anyBoolean(summary, ['sourceCodeCopied']),
      enabledByDefault: anyBoolean(summary, ['enabledByDefault']),
      releaseAllowed: booleanValue(summary.releaseAllowed),
      releaseBlockers: numberValue(summary.releaseBlockers),
      next: snapshot.commands.nextStep || snapshot.commands.nextAction || 'complete',
    };
  }

  private buildReleaseGate(phaseReceipts: ZavorthSemanticClosurePhaseReceipt[]): ZavorthSemanticClosureReleaseGate {
    const blockers = [
      ...phaseReceipts
        .filter((receipt) => receipt.status !== 'passed')
        .map((receipt) => `${receipt.phase}: phase status is ${receipt.status}`),
      ...phaseReceipts
        .filter((receipt) => receipt.semanticClaims <= 0)
        .map((receipt) => `${receipt.phase}: phase has no semantic claims`),
      ...phaseReceipts
        .filter((receipt) => receipt.gaps > 0)
        .map((receipt) => `${receipt.phase}: phase has ${receipt.gaps} semantic gap(s)`),
      ...phaseReceipts
        .filter((receipt) => receipt.receiptBackedClaims !== receipt.semanticClaims)
        .map((receipt) => `${receipt.phase}: receipt-backed claims do not match semantic claims`),
      ...phaseReceipts
        .filter((receipt) => !receipt.claimIdsUnique)
        .map((receipt) => `${receipt.phase}: claim ids are not unique within the phase`),
      ...phaseReceipts
        .filter((receipt) => !receipt.receiptIdsValid)
        .map((receipt) => `${receipt.phase}: one or more receipt ids are invalid`),
    ];
    const functionalClosure = phaseReceipts.find((receipt) => receipt.phase === 'S9');
    const machineReadableClosurePassed = functionalClosure?.releaseAllowed === true
      && (functionalClosure.releaseBlockers || 0) === 0;
    const functionalReleaseAllowed = functionalClosure?.releaseAllowed === true;
    if (!machineReadableClosurePassed) {
      blockers.push('S9: machine-readable functional closure did not pass');
    }
    if (!functionalReleaseAllowed) {
      blockers.push('S9: functional release is not allowed');
    }
    const noLiveExternalIo = phaseReceipts.every((receipt) => !receipt.liveExternalIoPerformed);
    const noLiveExecution = phaseReceipts.every((receipt) => !receipt.liveExecutionPerformed);
    const noRuntimeExecutionDuringCertification = phaseReceipts.every((receipt) => !receipt.runtimeExecutionPerformed);
    const noSecretValuesSerialized = phaseReceipts.every((receipt) => !receipt.secretValuesSerialized);
    const noSourceCodeCopied = phaseReceipts.every((receipt) => !receipt.sourceCodeCopied);
    const noDefaultEnablement = phaseReceipts.every((receipt) => !receipt.enabledByDefault);
    if (!noLiveExternalIo) blockers.push('Consolidation detected live external I/O');
    if (!noLiveExecution) blockers.push('Consolidation detected live execution');
    if (!noRuntimeExecutionDuringCertification) blockers.push('Consolidation detected runtime execution during certification');
    if (!noSecretValuesSerialized) blockers.push('Consolidation detected serialized secret values');
    if (!noSourceCodeCopied) blockers.push('Consolidation detected source code copy flag');
    if (!noDefaultEnablement) blockers.push('Consolidation detected default enablement');

    const allClaimsReceiptBacked = phaseReceipts.every((receipt) => receipt.receiptBackedClaims === receipt.semanticClaims);
    const allPhaseClaimIdsUnique = phaseReceipts.every((receipt) => receipt.claimIdsUnique);
    const allReceiptIdsValid = phaseReceipts.every((receipt) => receipt.receiptIdsValid);
    const releaseAllowed = blockers.length === 0
      && phaseReceipts.length === PHASE_ORDER.length
      && phaseReceipts.every((receipt) => PHASE_ORDER.includes(receipt.phase));

    return {
      status: releaseAllowed ? 'passed' : 'failed',
      releaseAllowed,
      phaseCount: phaseReceipts.length,
      phasesPassed: phaseReceipts.filter((receipt) => receipt.status === 'passed').length,
      phasesFailed: phaseReceipts.filter((receipt) => receipt.status !== 'passed').length,
      totalGaps: sum(phaseReceipts, 'gaps'),
      totalReleaseBlockers: blockers.length,
      allClaimsReceiptBacked,
      allPhaseClaimIdsUnique,
      allReceiptIdsValid,
      machineReadableClosurePassed,
      functionalReleaseAllowed,
      noLiveExternalIo,
      noLiveExecution,
      noRuntimeExecutionDuringCertification,
      noSecretValuesSerialized,
      noSourceCodeCopied,
      noDefaultEnablement,
      blockers,
    };
  }

  private defaultCertifiers(): Record<ZavorthSemanticClosurePhaseId, () => MaybePromise<SemanticPhaseSnapshot>> {
    const rootedInput = {
      sourceRoot: this.sourceRoot,
      zavorthRoot: this.zavorthRoot,
    };
    return {
      S1: () => new ZavorthSemanticPluginPackageCertificationService({
        now: this.now,
        sourceRoot: this.sourceRoot,
      }).buildSnapshot({ sourceRoot: this.sourceRoot }),
      S2: () => new ZavorthSemanticAgentRuntimeCertificationService({
        now: this.now,
        ...rootedInput,
      }).buildSnapshot(rootedInput),
      S3: () => new ZavorthSemanticProviderMeshCertificationService({
        now: this.now,
        ...rootedInput,
      }).buildSnapshot(rootedInput),
      S4: () => new ZavorthSemanticChannelMeshCertificationService({
        now: this.now,
        ...rootedInput,
      }).buildSnapshot(rootedInput),
      S5: () => new ZavorthSemanticMemoryDocumentTerminalCertificationService({
        now: this.now,
        ...rootedInput,
      }).buildSnapshot(rootedInput),
      S6: () => new ZavorthSemanticNativeCompanionDeviceCapabilityCertificationService({
        now: this.now,
        cwd: this.rootDir,
        tempRoot: path.join(this.tempRoot, 's6-native'),
      }).buildSnapshot(),
      S7: () => new ZavorthSemanticQaSecurityReleaseCertificationService({
        now: this.now,
        rootDir: this.rootDir,
      }).buildSnapshot(),
      S8: () => new ZavorthSemanticSkillEcosystemCertificationService({
        now: this.now,
        rootDir: this.rootDir,
      }).buildSnapshot(),
      S9: () => {
        const nativeCompanionDevicePackService = new ZavorthNativeCompanionDevicePackService({
          now: this.now,
          cwd: this.rootDir,
          tempRoot: path.join(this.tempRoot, 's9-native'),
        });
        const closureService = new ZavorthFunctionalClosureService({
          now: this.now,
          rootDir: this.rootDir,
          nativeCompanionDevicePackService,
        });
        return new ZavorthSemanticFunctionalClosureCertificationService({
          now: this.now,
          closureService,
        }).buildSnapshot();
      },
    };
  }
}

function sum(receipts: ZavorthSemanticClosurePhaseReceipt[], field: NumericReceiptField): number {
  return receipts.reduce((total, receipt) => total + receipt[field], 0);
}

type NumericReceiptField =
  | 'semanticClaims'
  | 'covered'
  | 'replaced'
  | 'ownerGated'
  | 'rejected'
  | 'gaps'
  | 'p0Claims'
  | 'p1Claims'
  | 'p2Claims'
  | 'receiptBackedClaims';

function countClaimStatus(
  claims: SemanticPhaseClaim[],
  status: ZavorthSemanticClosureClaimStatus,
  fallback: unknown,
): number {
  const counted = claims.filter((claim) => claim.status === status).length;
  return counted || numberValue(fallback);
}

function countPriority(
  claims: SemanticPhaseClaim[],
  priority: 'P0' | 'P1' | 'P2',
  fallback: unknown,
): number {
  const counted = claims.filter((claim) => claim.priority === priority).length;
  return counted || numberValue(fallback);
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function anyBoolean(summary: Record<string, unknown>, fields: string[]): boolean {
  return fields.some((field) => summary[field] === true);
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}
