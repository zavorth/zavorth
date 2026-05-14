import path from 'path';
import { config } from '../config/index.js';
import {
  ZAVORTH_LARGE_SKILL_ABSORPTION_CONTRACT_VERSION,
  type ZavorthLargeSkillAbsorptionBatch,
  type ZavorthLargeSkillAbsorptionBatchStatus,
  type ZavorthLargeSkillAbsorptionCandidateIndexEntry,
  type ZavorthLargeSkillAbsorptionChunk,
  type ZavorthLargeSkillAbsorptionQuarantineEntry,
  type ZavorthLargeSkillAbsorptionRiskBand,
  type ZavorthLargeSkillAbsorptionSnapshot,
  type ZavorthLargeSkillAbsorptionSourceInput,
  type ZavorthLargeSkillAbsorptionSourceResult,
  type ZavorthLargeSkillAbsorptionStatus,
} from '../contracts/ZavorthLargeSkillAbsorptionContract.js';
import type {
  ZavorthGovernedSubagentProfileId,
} from '../contracts/ZavorthGovernedSubagentContract.js';
import type {
  ZavorthUniversalSkillCandidate,
  ZavorthUniversalSkillIntakePreview,
  ZavorthUniversalSkillSourceKind,
} from '../contracts/ZavorthUniversalSkillIntakeContract.js';
import {
  decideSecurityPolicy,
  type SecurityPolicyBrokerDecision,
  type SecurityPolicyBrokerRequest,
} from '../security/SecurityPolicyBroker.js';
import type { SecurityProfileId } from '../security/SecurityProfile.js';
import { UniversalSkillIntakeService } from '../skills/UniversalSkillIntakeService.js';
import { ZavorthGovernedSubagentService } from './ZavorthGovernedSubagentService.js';

type DecideSecurityPolicy = (
  request: SecurityPolicyBrokerRequest,
  runtime?: { now?: () => Date },
) => SecurityPolicyBrokerDecision;

type Runtime = {
  now?: () => Date;
  projectRoot?: string;
  intakeService?: Pick<UniversalSkillIntakeService, 'previewSource'>;
  governedSubagentService?: Pick<ZavorthGovernedSubagentService, 'buildSnapshot'>;
  decidePolicy?: DecideSecurityPolicy;
};

export type ZavorthLargeSkillAbsorptionInput = {
  projectRoot?: string | null;
  sources: ZavorthLargeSkillAbsorptionSourceInput[];
  maxSources?: number | null;
  maxCandidates?: number | null;
  maxCandidatesPerBatch?: number | null;
  maxPromptCharsPerChunk?: number | null;
  maxArchiveBytes?: number | null;
  maxFileBytes?: number | null;
  maxFiles?: number | null;
  securityProfile?: SecurityProfileId | string | null;
};

type NormalizedSource = {
  sourceId: string;
  sourcePath: string;
  sourceKind: 'auto' | ZavorthUniversalSkillSourceKind;
  sourceLabel: string;
};

const DEFAULT_MAX_SOURCES = 50;
const DEFAULT_MAX_CANDIDATES = 5000;
const DEFAULT_MAX_CANDIDATES_PER_BATCH = 50;
const DEFAULT_MAX_PROMPT_CHARS_PER_CHUNK = 16000;
const ABSORPTION_ROLE_IDS: ZavorthGovernedSubagentProfileId[] = [
  'planner',
  'researcher',
  'auditor',
  'coder',
  'qa',
  'memory-curator',
];

export class ZavorthLargeSkillAbsorptionService {
  private readonly now: () => Date;
  private readonly defaultProjectRoot: string;
  private readonly intakeService: Pick<UniversalSkillIntakeService, 'previewSource'>;
  private readonly governedSubagentService: Pick<ZavorthGovernedSubagentService, 'buildSnapshot'>;
  private readonly decidePolicy: DecideSecurityPolicy;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.defaultProjectRoot = runtime.projectRoot || config.projectRoot;
    this.intakeService = runtime.intakeService || new UniversalSkillIntakeService({
      now: this.now,
    });
    this.governedSubagentService = runtime.governedSubagentService || new ZavorthGovernedSubagentService({
      now: this.now,
      projectRoot: this.defaultProjectRoot,
    });
    this.decidePolicy = runtime.decidePolicy || decideSecurityPolicy;
  }

  public async buildSnapshot(
    input: ZavorthLargeSkillAbsorptionInput,
  ): Promise<ZavorthLargeSkillAbsorptionSnapshot> {
    const projectRoot = path.resolve(input.projectRoot || this.defaultProjectRoot);
    const maxSources = normalizePositiveInteger(input.maxSources, DEFAULT_MAX_SOURCES);
    const maxCandidates = normalizePositiveInteger(input.maxCandidates, DEFAULT_MAX_CANDIDATES);
    const maxCandidatesPerBatch = normalizePositiveInteger(input.maxCandidatesPerBatch, DEFAULT_MAX_CANDIDATES_PER_BATCH);
    const maxPromptCharsPerChunk = normalizePositiveInteger(input.maxPromptCharsPerChunk, DEFAULT_MAX_PROMPT_CHARS_PER_CHUNK);
    const sources = this.normalizeSources(input.sources || []).slice(0, maxSources);
    const sourceOverflow = (input.sources || []).length > maxSources;
    const sourceResults = await this.buildSourceResults({
      sources,
      input,
      projectRoot,
    });
    const governedSubagents = this.governedSubagentService.buildSnapshot({
      projectRoot,
      presetId: 'power-user',
      task: 'Large Skill Absorption Pipeline chunking indexing summarization validation governed skills',
      roleIds: ABSORPTION_ROLE_IDS,
      prepare: true,
      maxRoles: ABSORPTION_ROLE_IDS.length,
      securityProfile: input.securityProfile,
    });
    const candidateIndex = this.buildCandidateIndex({
      sourceResults,
      maxPromptCharsPerChunk,
    }).slice(0, maxCandidates);
    const candidateOverflow = sourceResults.reduce((total, result) => total + result.summary.candidates, 0) > maxCandidates;
    const chunks = this.buildChunks({
      candidateIndex,
      maxPromptCharsPerChunk,
    });
    const batches = this.buildBatches({
      candidateIndex,
      chunks,
      maxCandidatesPerBatch,
    });
    const quarantine = this.buildQuarantine(sourceResults, candidateIndex);
    const summary = this.buildSummary({
      sourceResults,
      governedSubagents,
      candidateIndex,
      chunks,
      batches,
      quarantine,
    });
    const status = this.resolveStatus({
      sourceOverflow,
      candidateOverflow,
      summary,
      sourceResults,
      governedStatus: governedSubagents.status,
    });

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_LARGE_SKILL_ABSORPTION_CONTRACT_VERSION,
      status,
      source: 'ZavorthLargeSkillAbsorptionService',
      projectRoot,
      mode: 'preview',
      sourceResults,
      governedSubagents,
      candidateIndex,
      chunks,
      batches,
      quarantine,
      summary,
      pipeline: {
        stages: this.buildStages(governedSubagents.summary.approvalRequiredRoles > 0),
        maxCandidatesPerBatch,
        maxPromptCharsPerChunk,
        maxSources,
        maxCandidates,
      },
      policy: {
        previewOnly: true,
        noImportPerformed: true,
        noExecutionPerformed: true,
        noUpstreamRuntimeUse: true,
        everyCandidateIndexedOrQuarantined: true,
        chunkingBeforeLlmContext: true,
        governedSubagentsRequired: true,
        policyReceiptsRequired: true,
        quarantineForBlockedCandidates: true,
        ownerApprovalRequiredBeforeMaterialization: true,
      },
      commands: {
        preview: 'npm run zavorth:large-skill-absorption -- --source <path>',
        previewJson: 'npm run zavorth:large-skill-absorption:json -- --source <path>',
        check: 'npm run zavorth:large-skill-absorption:check --silent',
        nextPhase: 'Phase 4 - Absorption Materialization and Bridge Handoff',
      },
    };
  }

  public formatSnapshotText(snapshot: ZavorthLargeSkillAbsorptionSnapshot): string {
    const lines = [
      'Zavorth Large Skill Absorption Pipeline - Phase 3',
      '',
      `Status: ${snapshot.status}`,
      `Sources: ${snapshot.summary.sources} | candidates: ${snapshot.summary.candidates} | indexed: ${snapshot.summary.indexedCandidates}`,
      `Chunks: ${snapshot.summary.chunks} | batches: ${snapshot.summary.batches} | quarantine: ${snapshot.summary.quarantinedCandidates}`,
      `Coverage: ${snapshot.summary.maxCoveragePercent}% | policy receipts: ${snapshot.summary.policyReceipts} | subagent receipts: ${snapshot.summary.subagentReceipts}`,
      `Execution: ${snapshot.summary.executionPerformed} | import: ${snapshot.summary.importPerformed} | upstream runtime: ${snapshot.summary.upstreamRuntimeUsed}`,
      '',
      'Batches:',
    ];

    for (const batch of snapshot.batches.slice(0, 12)) {
      lines.push(
        `- ${batch.batchId}: ${batch.status} | candidates=${batch.candidateIndexIds.length} | chunks=${batch.chunkIds.length} | roles=${batch.roleIds.join(', ')}`,
      );
    }

    if (snapshot.quarantine.length > 0) {
      lines.push('', 'Quarantine:');
      for (const entry of snapshot.quarantine.slice(0, 12)) {
        lines.push(`- ${entry.name}: ${entry.riskBand} | ${entry.nextSafeAction}`);
      }
    }

    lines.push('', 'Policy: preview-only; chunking before LLM context; no import; no execution; no upstream runtime trust.');
    lines.push(`Next: ${snapshot.commands.nextPhase}`);
    return lines.join('\n');
  }

  private normalizeSources(sources: ZavorthLargeSkillAbsorptionSourceInput[]): NormalizedSource[] {
    return sources
      .map((source, index) => {
        const sourcePath = String(source.sourcePath || '').trim();
        if (!sourcePath) {
          return null;
        }
        const absolutePath = path.resolve(sourcePath);
        return {
          sourceId: `source-${index + 1}`,
          sourcePath: absolutePath,
          sourceKind: normalizeSourceKind(source.sourceKind),
          sourceLabel: String(source.sourceLabel || path.basename(absolutePath) || `source-${index + 1}`).trim(),
        };
      })
      .filter((entry): entry is NormalizedSource => Boolean(entry));
  }

  private async buildSourceResults(input: {
    sources: NormalizedSource[];
    input: ZavorthLargeSkillAbsorptionInput;
    projectRoot: string;
  }): Promise<ZavorthLargeSkillAbsorptionSourceResult[]> {
    const results: ZavorthLargeSkillAbsorptionSourceResult[] = [];
    for (const source of input.sources) {
      const preview = await this.intakeService.previewSource({
        sourcePath: source.sourcePath,
        sourceKind: source.sourceKind,
        sourceLabel: source.sourceLabel,
        maxArchiveBytes: input.input.maxArchiveBytes || undefined,
        maxFileBytes: input.input.maxFileBytes || undefined,
        maxFiles: input.input.maxFiles || undefined,
      });
      const policyDecision = this.decidePolicy({
        surface: 'skill',
        operation: 'large-skill-absorption-preview',
        target: source.sourcePath,
        profile: input.input.securityProfile || undefined,
        workspace: input.projectRoot,
        sourceTrust: 'untrusted-content',
        risk: preview.summary.blockedCandidates > 0 || preview.summary.errors > 0 ? 'review' : 'safe',
        userConfirmationRequired: false,
        reasons: [
          'Large Skill Absorption only previews, indexes and chunks source skills.',
          'No import, execution or upstream runtime use is allowed in Phase 3.',
          `Source ${source.sourceId} produced ${preview.summary.candidates} candidate(s).`,
        ],
        metadata: {
          sourceId: source.sourceId,
          sourceKind: source.sourceKind,
          candidateCount: preview.summary.candidates,
          blockedCandidates: preview.summary.blockedCandidates,
        },
      }, {
        now: this.now,
      });

      results.push({
        sourceId: source.sourceId,
        sourcePath: source.sourcePath,
        sourceLabel: source.sourceLabel,
        intakeStatus: preview.status,
        intakePreview: preview,
        policyReceipt: policyDecision.receipt,
        summary: {
          candidates: preview.summary.candidates,
          blockedCandidates: preview.summary.blockedCandidates,
          filesScanned: preview.summary.filesScanned,
          warnings: preview.summary.warnings,
          errors: preview.summary.errors,
        },
      });
    }
    return results;
  }

  private buildCandidateIndex(input: {
    sourceResults: ZavorthLargeSkillAbsorptionSourceResult[];
    maxPromptCharsPerChunk: number;
  }): ZavorthLargeSkillAbsorptionCandidateIndexEntry[] {
    const entries: ZavorthLargeSkillAbsorptionCandidateIndexEntry[] = [];
    for (const source of input.sourceResults) {
      for (const candidate of source.intakePreview.candidates) {
        const estimatedPromptChars = estimatePromptChars(candidate);
        const riskScore = scoreCandidateRisk(candidate);
        const riskBand = resolveRiskBand(candidate, riskScore);
        const chunkCount = Math.max(1, Math.ceil(estimatedPromptChars / input.maxPromptCharsPerChunk));
        const indexId = `${source.sourceId}:${candidate.id}`;
        entries.push({
          indexId,
          sourceId: source.sourceId,
          candidateId: candidate.id,
          name: candidate.manifest.name,
          description: candidate.manifest.description,
          relativeSkillPath: candidate.manifest.relativeSkillPath,
          status: candidate.status,
          blockedReason: candidate.blockedReason,
          contentHash: candidate.manifest.contentHash,
          permissionProfileId: candidate.manifest.permissionProfileId,
          capabilityTags: [...candidate.manifest.capabilityTags],
          supportFileCount: candidate.manifest.supportFiles.length,
          issueCount: candidate.issues.length,
          riskScore,
          riskBand,
          assignedSubagentRoleIds: assignRoles(candidate, riskBand),
          estimatedPromptChars,
          chunkCount,
          quarantineRequired: candidate.status === 'blocked' || riskBand === 'blocked',
        });
      }
    }
    return entries.sort((left, right) => left.indexId.localeCompare(right.indexId));
  }

  private buildChunks(input: {
    candidateIndex: ZavorthLargeSkillAbsorptionCandidateIndexEntry[];
    maxPromptCharsPerChunk: number;
  }): ZavorthLargeSkillAbsorptionChunk[] {
    const chunks: ZavorthLargeSkillAbsorptionChunk[] = [];
    for (const candidate of input.candidateIndex) {
      for (let index = 0; index < candidate.chunkCount; index += 1) {
        chunks.push({
          chunkId: `${candidate.indexId}:chunk-${index + 1}`,
          sourceId: candidate.sourceId,
          candidateIndexId: candidate.indexId,
          ordinal: index + 1,
          totalForCandidate: candidate.chunkCount,
          maxPromptChars: input.maxPromptCharsPerChunk,
          estimatedPromptChars: Math.min(
            input.maxPromptCharsPerChunk,
            Math.max(1, candidate.estimatedPromptChars - (index * input.maxPromptCharsPerChunk)),
          ),
          roleIds: candidate.quarantineRequired
            ? ['auditor', 'qa']
            : candidate.assignedSubagentRoleIds,
          purpose: resolveChunkPurpose(candidate, index),
        });
      }
    }
    return chunks;
  }

  private buildBatches(input: {
    candidateIndex: ZavorthLargeSkillAbsorptionCandidateIndexEntry[];
    chunks: ZavorthLargeSkillAbsorptionChunk[];
    maxCandidatesPerBatch: number;
  }): ZavorthLargeSkillAbsorptionBatch[] {
    const batches: ZavorthLargeSkillAbsorptionBatch[] = [];
    const candidates = [...input.candidateIndex];
    for (let index = 0; index < candidates.length; index += input.maxCandidatesPerBatch) {
      const slice = candidates.slice(index, index + input.maxCandidatesPerBatch);
      const candidateIds = slice.map((candidate) => candidate.indexId);
      const batchChunks = input.chunks.filter((chunk) => candidateIds.includes(chunk.candidateIndexId));
      const status = resolveBatchStatus(slice);
      batches.push({
        batchId: `absorption-batch-${batches.length + 1}`,
        ordinal: batches.length + 1,
        status,
        candidateIndexIds: candidateIds,
        chunkIds: batchChunks.map((chunk) => chunk.chunkId),
        roleIds: uniqueRoles(batchChunks.flatMap((chunk) => chunk.roleIds)),
        maxCandidates: input.maxCandidatesPerBatch,
        estimatedPromptChars: batchChunks.reduce((sum, chunk) => sum + chunk.estimatedPromptChars, 0),
        reasons: buildBatchReasons(slice, status),
      });
    }
    return batches;
  }

  private buildQuarantine(
    sourceResults: ZavorthLargeSkillAbsorptionSourceResult[],
    candidateIndex: ZavorthLargeSkillAbsorptionCandidateIndexEntry[],
  ): ZavorthLargeSkillAbsorptionQuarantineEntry[] {
    const byIndex = new Map(candidateIndex.map((entry) => [entry.indexId, entry]));
    const entries: ZavorthLargeSkillAbsorptionQuarantineEntry[] = [];
    for (const source of sourceResults) {
      for (const candidate of source.intakePreview.candidates) {
        const indexEntry = byIndex.get(`${source.sourceId}:${candidate.id}`);
        if (!indexEntry?.quarantineRequired) {
          continue;
        }
        entries.push({
          indexId: indexEntry.indexId,
          sourceId: source.sourceId,
          candidateId: candidate.id,
          name: candidate.manifest.name,
          riskBand: indexEntry.riskBand,
          issues: candidate.issues,
          blockedReason: candidate.blockedReason,
          nextSafeAction: 'Keep quarantined until auditor review clears issues and owner approves any materialization.',
        });
      }
    }
    return entries;
  }

  private buildSummary(input: {
    sourceResults: ZavorthLargeSkillAbsorptionSourceResult[];
    governedSubagents: ReturnType<ZavorthGovernedSubagentService['buildSnapshot']>;
    candidateIndex: ZavorthLargeSkillAbsorptionCandidateIndexEntry[];
    chunks: ZavorthLargeSkillAbsorptionChunk[];
    batches: ZavorthLargeSkillAbsorptionBatch[];
    quarantine: ZavorthLargeSkillAbsorptionQuarantineEntry[];
  }): ZavorthLargeSkillAbsorptionSnapshot['summary'] {
    const candidates = input.sourceResults.reduce((sum, source) => sum + source.summary.candidates, 0);
    const indexedCandidates = input.candidateIndex.length;
    return {
      sources: input.sourceResults.length,
      candidates,
      indexedCandidates,
      blockedCandidates: input.sourceResults.reduce((sum, source) => sum + source.summary.blockedCandidates, 0),
      quarantinedCandidates: input.quarantine.length,
      chunks: input.chunks.length,
      batches: input.batches.length,
      readyBatches: input.batches.filter((batch) => batch.status === 'ready').length,
      reviewRequiredBatches: input.batches.filter((batch) => batch.status === 'review-required').length,
      blockedBatches: input.batches.filter((batch) => batch.status === 'blocked' || batch.status === 'quarantined').length,
      maxCoveragePercent: candidates === 0 ? 0 : Math.round((indexedCandidates / candidates) * 100),
      policyReceipts: input.sourceResults.filter((source) => Boolean(source.policyReceipt)).length,
      subagentReceipts: input.governedSubagents.summary.subagentReceipts,
      importPerformed: false,
      executionPerformed: false,
      upstreamRuntimeUsed: false,
      workspaceMutationPerformed: false,
    };
  }

  private buildStages(approvalRequired: boolean): ZavorthLargeSkillAbsorptionSnapshot['pipeline']['stages'] {
    return [
      {
        id: 'source-preview',
        label: 'Preview every source with Universal Skill Intake',
        roleIds: ['planner', 'researcher'],
        status: approvalRequired ? 'approval-required' : 'ready',
        output: 'Source preview receipts and candidate list.',
      },
      {
        id: 'candidate-index',
        label: 'Create deterministic candidate index and chunk plan',
        roleIds: ['planner', 'memory-curator'],
        status: 'ready',
        output: 'Index entries, chunk ids, coverage metrics.',
      },
      {
        id: 'risk-review',
        label: 'Quarantine unsafe or high-risk candidates',
        roleIds: ['auditor', 'qa'],
        status: 'ready',
        output: 'Risk bands, quarantine queue, safe next action.',
      },
      {
        id: 'normalization-plan',
        label: 'Prepare normalization and materialization plan only after approval',
        roleIds: ['coder', 'qa'],
        status: 'approval-required',
        output: 'Batch plan for future materialization without applying it in Phase 3.',
      },
      {
        id: 'bridge-handoff',
        label: 'Hand off clean batches to bridge/import phases',
        roleIds: ['qa', 'memory-curator'],
        status: 'ready',
        output: 'Dry-run handoff contract for Phase 4.',
      },
    ];
  }

  private resolveStatus(input: {
    sourceOverflow: boolean;
    candidateOverflow: boolean;
    summary: ZavorthLargeSkillAbsorptionSnapshot['summary'];
    sourceResults: ZavorthLargeSkillAbsorptionSourceResult[];
    governedStatus: string;
  }): ZavorthLargeSkillAbsorptionStatus {
    if (
      input.sourceOverflow
      || input.candidateOverflow
      || input.summary.sources === 0
      || input.summary.candidates === 0
      || input.governedStatus === 'blocked'
      || input.summary.maxCoveragePercent < 100
    ) {
      return 'blocked';
    }
    if (
      input.summary.quarantinedCandidates > 0
      || input.summary.reviewRequiredBatches > 0
      || input.sourceResults.some((source) => source.intakeStatus !== 'pass')
      || input.governedStatus === 'attention'
    ) {
      return 'attention';
    }
    return 'passed';
  }
}

function estimatePromptChars(candidate: ZavorthUniversalSkillCandidate): number {
  const manifest = candidate.manifest;
  const base = [
    manifest.name,
    manifest.description,
    manifest.catalogProjection.searchText,
    manifest.notes.join('\n'),
  ].join('\n').length;
  return Math.max(1200, base + (manifest.supportFiles.length * 1200) + (candidate.issues.length * 600));
}

function scoreCandidateRisk(candidate: ZavorthUniversalSkillCandidate): number {
  const issueScore = candidate.issues.reduce((sum, issue) => {
    if (issue.severity === 'error') {
      return sum + 35;
    }
    if (issue.severity === 'warn') {
      return sum + 12;
    }
    return sum + 4;
  }, 0);
  const permissionScore: Record<string, number> = {
    'local-readonly': 0,
    'workspace-read': 6,
    'workspace-write-approval': 18,
    'network-read-approval': 22,
    'tool-execution-approval': 32,
    'connector-live-secretref': 36,
    blocked: 100,
  };
  return Math.min(
    100,
    (candidate.status === 'blocked' ? 50 : 0)
      + issueScore
      + (permissionScore[candidate.manifest.permissionProfileId] ?? 20),
  );
}

function resolveRiskBand(
  candidate: ZavorthUniversalSkillCandidate,
  riskScore: number,
): ZavorthLargeSkillAbsorptionRiskBand {
  if (candidate.status === 'blocked' || candidate.manifest.permissionProfileId === 'blocked') {
    return 'blocked';
  }
  if (riskScore >= 70) {
    return 'high';
  }
  if (riskScore >= 30) {
    return 'medium';
  }
  return 'low';
}

function assignRoles(
  candidate: ZavorthUniversalSkillCandidate,
  riskBand: ZavorthLargeSkillAbsorptionRiskBand,
): ZavorthGovernedSubagentProfileId[] {
  const roles: ZavorthGovernedSubagentProfileId[] = ['planner', 'qa'];
  const tags = new Set(candidate.manifest.capabilityTags);
  if (tags.has('research') || tags.has('document') || candidate.manifest.supportFiles.length > 0) {
    roles.push('researcher');
  }
  if (tags.has('security') || riskBand === 'medium' || riskBand === 'high' || riskBand === 'blocked') {
    roles.push('auditor');
  }
  if (candidate.status !== 'blocked') {
    roles.push('coder');
  }
  if (tags.has('data') || tags.has('document') || tags.has('workflow')) {
    roles.push('memory-curator');
  }
  return uniqueRoles(roles);
}

function resolveChunkPurpose(
  candidate: ZavorthLargeSkillAbsorptionCandidateIndexEntry,
  ordinalZeroBased: number,
): ZavorthLargeSkillAbsorptionChunk['purpose'] {
  if (candidate.quarantineRequired || candidate.riskBand === 'high') {
    return 'risk-review';
  }
  if (ordinalZeroBased === candidate.chunkCount - 1) {
    return 'qa';
  }
  if (candidate.permissionProfileId === 'workspace-write-approval') {
    return 'normalize-plan';
  }
  return 'summarize';
}

function resolveBatchStatus(
  candidates: ZavorthLargeSkillAbsorptionCandidateIndexEntry[],
): ZavorthLargeSkillAbsorptionBatchStatus {
  if (candidates.length === 0) {
    return 'blocked';
  }
  if (candidates.every((candidate) => candidate.quarantineRequired)) {
    return 'quarantined';
  }
  if (candidates.some((candidate) => candidate.quarantineRequired || candidate.riskBand === 'high' || candidate.riskBand === 'medium')) {
    return 'review-required';
  }
  return 'ready';
}

function buildBatchReasons(
  candidates: ZavorthLargeSkillAbsorptionCandidateIndexEntry[],
  status: ZavorthLargeSkillAbsorptionBatchStatus,
): string[] {
  if (status === 'ready') {
    return ['All candidates are low-risk and indexed for preview-only absorption.'];
  }
  if (status === 'quarantined') {
    return ['All candidates in this batch are quarantined and cannot be materialized.'];
  }
  if (status === 'blocked') {
    return ['Batch has no candidates and cannot be processed.'];
  }
  return [
    `${candidates.filter((candidate) => candidate.quarantineRequired).length} candidate(s) require quarantine.`,
    `${candidates.filter((candidate) => candidate.riskBand === 'medium' || candidate.riskBand === 'high').length} candidate(s) require auditor review.`,
  ];
}

function normalizeSourceKind(value: unknown): 'auto' | ZavorthUniversalSkillSourceKind {
  const normalized = String(value || 'auto').trim().toLowerCase();
  if (normalized === 'directory' || normalized === 'zip') {
    return normalized;
  }
  return 'auto';
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.max(1, Math.floor(parsed));
}

function uniqueRoles(values: ZavorthGovernedSubagentProfileId[]): ZavorthGovernedSubagentProfileId[] {
  return Array.from(new Set(values));
}
