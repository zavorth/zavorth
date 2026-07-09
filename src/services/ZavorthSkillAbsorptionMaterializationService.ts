import crypto from 'crypto';
import path from 'path';
import { config } from '../config/index.js';
import {
  ZAVORTH_SKILL_ABSORPTION_MATERIALIZATION_CONTRACT_VERSION,
  type ZavorthSkillAbsorptionMaterializationBatchDecision,
  type ZavorthSkillAbsorptionMaterializationInput,
  type ZavorthSkillAbsorptionMaterializationSnapshot,
  type ZavorthSkillAbsorptionMaterializationStatus,
} from '../contracts/ZavorthSkillAbsorptionMaterializationContract.js';
import type {
  ZavorthLargeSkillAbsorptionCandidateIndexEntry,
  ZavorthLargeSkillAbsorptionSnapshot,
} from '../contracts/native/ZavorthLargeSkillAbsorptionContract.js';
import {
  ZAVORTH_INVOCATION_RECEIPT_CONTRACT_VERSION,
  type ZavorthInvocationReceipt,
} from '../contracts/runtime/ZavorthInvocationReceiptContract.js';
import {
  decideSecurityPolicy,
  type SecurityPolicyBrokerDecision,
  type SecurityPolicyBrokerRequest,
} from '../security/SecurityPolicyBroker.js';
import {
  UniversalSkillTrustImportService,
  type UniversalSkillTrustImportInput,
} from '../skills/UniversalSkillTrustImportService.js';
import { UniversalSkillBridgeRuntimeService } from '../skills/UniversalSkillBridgeRuntimeService.js';




import {
  ZavorthLargeSkillAbsorptionService,
  type ZavorthLargeSkillAbsorptionInput,
} from './ZavorthLargeSkillAbsorptionService.js';

type DecideSecurityPolicy = (
  request: SecurityPolicyBrokerRequest,
  runtime?: { now?: () => Date },
) => SecurityPolicyBrokerDecision;

type Runtime = {
  now?: () => Date;
  projectRoot?: string;
  largeAbsorptionService?: Pick<ZavorthLargeSkillAbsorptionService, 'buildSnapshot'>;
  importService?: Pick<UniversalSkillTrustImportService, 'buildSnapshot'>;
  bridgeRuntimeService?: Pick<UniversalSkillBridgeRuntimeService, 'invoke'>;
  decidePolicy?: DecideSecurityPolicy;
};

export class ZavorthSkillAbsorptionMaterializationService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly largeAbsorption: Pick<ZavorthLargeSkillAbsorptionService, 'buildSnapshot'>;
  private readonly importService: Pick<UniversalSkillTrustImportService, 'buildSnapshot'>;
  private readonly bridgeRuntime: Pick<UniversalSkillBridgeRuntimeService, 'invoke'>;
  private readonly decidePolicy: DecideSecurityPolicy;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = runtime.projectRoot || config.projectRoot;
    this.largeAbsorption = runtime.largeAbsorptionService || new ZavorthLargeSkillAbsorptionService({
      now: this.now,
      projectRoot: this.projectRoot,
    });
    this.importService = runtime.importService || new UniversalSkillTrustImportService({
      now: this.now,
      projectRoot: this.projectRoot,
    });
    this.bridgeRuntime = runtime.bridgeRuntimeService || new UniversalSkillBridgeRuntimeService({
      now: this.now,
      projectRoot: this.projectRoot,
    });
    this.decidePolicy = runtime.decidePolicy || decideSecurityPolicy;
  }

  public async buildSnapshot(
    input: ZavorthSkillAbsorptionMaterializationInput,
  ): Promise<ZavorthSkillAbsorptionMaterializationSnapshot> {
    const generatedAt = this.now().toISOString();
    const projectRoot = path.resolve(input.projectRoot || this.projectRoot);
    const targetRootPath = path.resolve(input.targetRootPath || path.join(projectRoot, 'skill-library', 'imported'));
    const apply = input.apply === true;
    const approvalId = normalizeNullable(input.approvalId);
    const absorption = await this.largeAbsorption.buildSnapshot(this.buildAbsorptionInput({
      input,
      projectRoot,
    }));
    const selectedBatches = this.selectBatches(absorption, input);
    const sourceSkillMap = buildSourceSkillMap(absorption, selectedBatches);
    const approvalMissing = apply && !approvalId;
    const policy = this.decidePolicy({
      surface: 'skill',
      operation: 'skill-absorption-materialization',
      target: targetRootPath,
      workspace: projectRoot,
      sourceTrust: 'untrusted-content',
      risk: approvalMissing ? 'review' : 'safe',
      userConfirmationRequired: approvalMissing,
      blocked: selectedBatches.length === 0,
      reasons: [
        'Skill absorption materialization uses preview batches before importing.',
        apply ? 'Apply requested; source and skill allowlists are required.' : 'Preview-only mode; no workspace mutation will be performed.',
        approvalMissing ? 'Owner approval id is missing for materialization.' : 'Approval gate satisfied or not required for preview.',
      ],
      metadata: {
        selectedBatches: selectedBatches.length,
        selectedSkills: Array.from(sourceSkillMap.values()).reduce((sum, names) => sum + names.length, 0),
      },
    }, { now: this.now });
    const receipts: ZavorthInvocationReceipt[] = [
      this.buildReceipt({
        generatedAt,
        policy,
        status: approvalMissing ? 'approval-required' : policy.allowed ? 'pass' : 'deny',
        approvalId,
        target: targetRootPath,
        apply,
      }),
    ];

    if (!policy.allowed || approvalMissing || !apply) {
      return this.buildSnapshotFromParts({
        generatedAt,
        apply,
        approvalId,
        targetRootPath,
        absorption,
        selectedBatches,
        importSnapshots: [],
        bridgeHandoffs: [],
        receipts,
        forcedStatus: approvalMissing ? 'approval-required' : !apply ? 'preview-only' : 'blocked',
      });
    }

    const importSnapshots = [];
    for (const source of absorption.sourceResults) {
      const skillNames = sourceSkillMap.get(source.sourceId) || [];
      if (skillNames.length === 0) {
        continue;
      }
      const sourceAllowed = isSourceAllowed(input.allowedSourceIds || [], source.sourceId, source.sourcePath);
      const importInput: UniversalSkillTrustImportInput = {
        sourcePath: source.sourcePath,
        sourceKind: source.intakePreview.source.kind,
        sourceLabel: source.sourceLabel,
        targetRootPath,
        apply: true,
        overwrite: input.overwrite === true,
        allowSource: sourceAllowed,
        allowedSkillNames: input.allowAllSkills === true ? [] : allowedSkillNames(input.allowedSkillNames || [], skillNames),
        allowAllCandidates: input.allowAllSkills === true,
      };
      importSnapshots.push(await this.importService.buildSnapshot(importInput));
    }

    const materializedSkillNames = uniqueStrings(
      importSnapshots
        .flatMap((snapshot) => snapshot.decisions)
        .filter((decision) => decision.materialized)
        .map((decision) => decision.skillName),
    );
    const bridgeHandoffs = [];
    if (input.bridgeDryRun !== false) {
      for (const skillName of materializedSkillNames) {
        bridgeHandoffs.push(await this.bridgeRuntime.invoke({
          skillName,
          intent: `Materialized skill ${skillName} is ready for governed bridge dry-run.`,
          mode: 'dry-run',
          channel: 'materialization',
          persistReceipt: false,
        }));
      }
    }

    return this.buildSnapshotFromParts({
      generatedAt,
      apply,
      approvalId,
      targetRootPath,
      absorption,
      selectedBatches,
      importSnapshots,
      bridgeHandoffs,
      receipts,
      forcedStatus: null,
    });
  }

  public formatSnapshotText(snapshot: ZavorthSkillAbsorptionMaterializationSnapshot): string {
    const lines = [
      'Zavorth Skill Absorption Materialization - Runtime gateway',
      '',
      `Status: ${snapshot.status}`,
      `Apply: ${snapshot.apply}`,
      `Target: ${snapshot.targetRootPath}`,
      `Batches selected: ${snapshot.summary.batchesSelected}`,
      `Skills selected: ${snapshot.summary.skillsSelected}`,
      `Materialized: ${snapshot.summary.skillsMaterialized} skill(s), ${snapshot.summary.filesWritten} file(s)`,
      `Bridge handoffs: ${snapshot.summary.bridgeHandoffs}`,
      '',
      'Batch decisions:',
    ];
    for (const batch of snapshot.selectedBatches.slice(0, 12)) {
      lines.push(`- ${batch.batchId}: ${batch.status} | skills=${batch.skillNames.join(', ') || 'none'} | ${batch.reasons.join(' ')}`);
    }
    if (snapshot.importDecisions.length > 0) {
      lines.push('', 'Import decisions:');
      for (const decision of snapshot.importDecisions.slice(0, 12)) {
        lines.push(`- ${decision.skillName}: ${decision.mode} | materialized=${decision.materialized}`);
      }
    }
    lines.push('', 'Policy: imported skills are governed instructions; support files are not executable tools.');
    lines.push(`Next: ${snapshot.commands.nextStage}`);
    return lines.join('\n');
  }

  private buildAbsorptionInput(input: {
    input: ZavorthSkillAbsorptionMaterializationInput;
    projectRoot: string;
  }): ZavorthLargeSkillAbsorptionInput {
    return {
      projectRoot: input.projectRoot,
      sources: input.input.sources,
      maxSources: input.input.maxSources,
      maxCandidates: input.input.maxCandidates,
      maxCandidatesPerBatch: input.input.maxCandidatesPerBatch,
      maxPromptCharsPerChunk: input.input.maxPromptCharsPerChunk,
    };
  }

  private selectBatches(
    absorption: ZavorthLargeSkillAbsorptionSnapshot,
    input: ZavorthSkillAbsorptionMaterializationInput,
  ): ZavorthSkillAbsorptionMaterializationBatchDecision[] {
    const requested = new Set((input.batchIds || []).map((entry) => normalizeText(entry)));
    return absorption.batches
      .filter((batch) => requested.size === 0 || requested.has(batch.batchId))
      .map((batch) => {
        const candidates = batch.candidateIndexIds
          .map((indexId) => absorption.candidateIndex.find((entry) => entry.indexId === indexId))
          .filter((entry): entry is ZavorthLargeSkillAbsorptionCandidateIndexEntry => Boolean(entry));
        const quarantined = batch.status === 'quarantined' || candidates.every((candidate) => candidate.quarantineRequired);
        const blocked = batch.status === 'blocked';
        const reviewAllowed = input.includeReviewRequiredBatches === true;
        const selected = !blocked && !quarantined && (batch.status === 'ready' || reviewAllowed);
        const status: ZavorthSkillAbsorptionMaterializationBatchDecision['status'] =
          selected ? 'selected' : quarantined ? 'quarantined' : blocked ? 'blocked' : 'skipped';
        return {
          batchId: batch.batchId,
          status,
          sourceIds: uniqueStrings(candidates.map((candidate) => candidate.sourceId)),
          skillNames: selected ? uniqueStrings(candidates.map((candidate) => candidate.name)) : [],
          reasons: selected
            ? ['Batch selected for governed materialization.']
            : quarantined
              ? ['Batch remains quarantined and cannot be materialized.']
              : blocked
                ? ['Batch is blocked.']
                : ['Review-required batch skipped; pass includeReviewRequiredBatches to include.'],
          originalBatch: batch,
        };
      })
      .filter((decision) => decision.status === 'selected' || decision.status === 'quarantined' || decision.status === 'blocked');
  }

  private buildSnapshotFromParts(input: {
    generatedAt: string;
    apply: boolean;
    approvalId: string | null;
    targetRootPath: string;
    absorption: ZavorthLargeSkillAbsorptionSnapshot;
    selectedBatches: ZavorthSkillAbsorptionMaterializationBatchDecision[];
    importSnapshots: Awaited<ReturnType<UniversalSkillTrustImportService['buildSnapshot']>>[];
    bridgeHandoffs: Awaited<ReturnType<UniversalSkillBridgeRuntimeService['invoke']>>[];
    receipts: ZavorthInvocationReceipt[];
    forcedStatus: ZavorthSkillAbsorptionMaterializationStatus | null;
  }): ZavorthSkillAbsorptionMaterializationSnapshot {
    const importDecisions = input.importSnapshots.flatMap((snapshot) => snapshot.decisions);
    const materializedFiles = input.importSnapshots.flatMap((snapshot) => snapshot.materializedFiles);
    const materializedSkillNames = uniqueStrings(
      importDecisions.filter((decision) => decision.materialized).map((decision) => decision.skillName),
    );
    const deniedDecisions = importDecisions.filter((decision) => decision.mode === 'deny').length;
    const status = input.forcedStatus || resolveStatus({
      apply: input.apply,
      selectedBatches: input.selectedBatches,
      materializedSkills: materializedSkillNames.length,
      deniedDecisions,
    });
    const affectedPaths = uniqueStrings(
      importDecisions
        .filter((decision) => decision.materialized)
        .map((decision) => decision.targetSkillDirPath),
    );

    return {
      generatedAt: input.generatedAt,
      contractVersion: ZAVORTH_SKILL_ABSORPTION_MATERIALIZATION_CONTRACT_VERSION,
      source: 'ZavorthSkillAbsorptionMaterializationService',
      status,
      apply: input.apply,
      approvalId: input.approvalId,
      targetRootPath: input.targetRootPath,
      absorption: input.absorption,
      selectedBatches: input.selectedBatches,
      importSnapshots: input.importSnapshots,
      importDecisions,
      materializedFiles,
      bridgeHandoffs: input.bridgeHandoffs,
      receipts: input.receipts,
      summary: {
        sources: input.absorption.summary.sources,
        batchesSelected: input.selectedBatches.filter((batch) => batch.status === 'selected').length,
        skillsSelected: uniqueStrings(input.selectedBatches.flatMap((batch) => batch.skillNames)).length,
        importsAttempted: input.importSnapshots.length,
        skillsMaterialized: materializedSkillNames.length,
        filesWritten: materializedFiles.length,
        bridgeHandoffs: input.bridgeHandoffs.length,
        quarantinedBatches: input.selectedBatches.filter((batch) => batch.status === 'quarantined').length,
        deniedDecisions,
        rollbackAvailable: affectedPaths.length > 0,
        workspaceMutationPerformed: materializedFiles.length > 0,
        externalIoPerformed: false,
        upstreamRuntimeCodeExecuted: false,
      },
      policy: {
        previewRequiredBeforeApply: true,
        approvalRequiredBeforeMaterialization: true,
        sourceAllowlistRequired: true,
        skillAllowlistRequired: true,
        importedSkillsAreInstructionsOnly: true,
        supportFilesAreNotExecutableTools: true,
        bridgeHandoffIsDryRunByDefault: true,
        rollbackReceiptRequired: true,
      },
      rollback: {
        available: affectedPaths.length > 0,
        command: affectedPaths.length > 0
          ? 'Remove affected imported skill directories only after reviewing the receipt affectedPaths.'
          : null,
        affectedPaths,
      },
      commands: {
        preview: 'npm run zavorth:skill-absorption-materialize -- --source <path>',
        apply: 'npm run zavorth:skill-absorption-materialize -- --source <path> --apply --approval-id <approval-id> --allow-source --skills <name>',
        check: 'npm run zavorth:skill-absorption-materialize:check --silent',
        nextStage: 'Surface controls - Natural Cross-Surface Commands',
      },
    };
  }

  private buildReceipt(input: {
    generatedAt: string;
    policy: SecurityPolicyBrokerDecision;
    status: ZavorthInvocationReceipt['status'];
    approvalId: string | null;
    target: string;
    apply: boolean;
  }): ZavorthInvocationReceipt {
    return {
      id: `zavorth.invocation.skill-materialization.${stableId(input.generatedAt, input.target)}`,
      contractVersion: ZAVORTH_INVOCATION_RECEIPT_CONTRACT_VERSION,
      kind: input.apply ? 'skill-materialization' : 'skill-import',
      status: input.status,
      generatedAt: input.generatedAt,
      actorId: null,
      channel: 'materialization',
      target: input.target,
      action: input.apply ? 'skill-absorption.apply' : 'skill-absorption.preview',
      policyBrokerReceipt: input.policy.receipt,
      approvalId: input.approvalId,
      risk: input.apply ? 'review' : 'safe',
      reasons: input.policy.reasons,
      guarantees: {
        policyBrokerEvaluated: true,
        noSecretValuesSerialized: true,
        untrustedContentDelimited: true,
        workspaceMutationPerformed: input.apply && input.policy.allowed,
        externalIoPerformed: false,
        upstreamCodeExecuted: false,
      },
      evidence: {
        apply: input.apply,
      },
    };
  }
}

function buildSourceSkillMap(
  absorption: ZavorthLargeSkillAbsorptionSnapshot,
  selectedBatches: ZavorthSkillAbsorptionMaterializationBatchDecision[],
): Map<string, string[]> {
  const selectedIds = new Set(
    selectedBatches
      .filter((batch) => batch.status === 'selected')
      .flatMap((batch) => batch.originalBatch.candidateIndexIds),
  );
  const map = new Map<string, string[]>();
  for (const candidate of absorption.candidateIndex) {
    if (!selectedIds.has(candidate.indexId)) {
      continue;
    }
    const current = map.get(candidate.sourceId) || [];
    current.push(candidate.name);
    map.set(candidate.sourceId, uniqueStrings(current));
  }
  return map;
}

function isSourceAllowed(allowed: string[], sourceId: string, sourcePath: string): boolean {
  const normalized = allowed.map((entry) => normalizeText(entry).toLowerCase());
  return normalized.includes('*')
    || normalized.includes(sourceId.toLowerCase())
    || normalized.includes(sourcePath.toLowerCase());
}

function allowedSkillNames(allowed: string[], selected: string[]): string[] {
  const normalizedAllowed = new Set(allowed.map((entry) => normalizeText(entry).toLowerCase()));
  if (normalizedAllowed.has('*')) {
    return selected;
  }
  return selected.filter((name) => normalizedAllowed.has(name.toLowerCase()));
}

function resolveStatus(input: {
  apply: boolean;
  selectedBatches: ZavorthSkillAbsorptionMaterializationBatchDecision[];
  materializedSkills: number;
  deniedDecisions: number;
}): ZavorthSkillAbsorptionMaterializationStatus {
  if (!input.apply) {
    return 'preview-only';
  }
  if (input.selectedBatches.filter((batch) => batch.status === 'selected').length === 0) {
    return 'blocked';
  }
  if (input.materializedSkills === 0) {
    return 'blocked';
  }
  if (input.deniedDecisions > 0) {
    return 'partial';
  }
  return 'materialized';
}

function normalizeText(value: unknown): string {
  return String(value || '').trim();
}

function normalizeNullable(value: unknown): string | null {
  const text = normalizeText(value);
  return text || null;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean))).sort((left, right) => left.localeCompare(right, 'en-US'));
}

function stableId(...parts: string[]): string {
  return crypto.createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 16);
}
