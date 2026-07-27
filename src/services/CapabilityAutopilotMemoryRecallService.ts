import { createHash } from 'crypto';
import type {
  CapabilityMemoryOutcome,
  CapabilityMemoryRecord,
  CapabilityReceipt,
  OriginalIntentEnvelope,
} from '../contracts/CapabilityAutopilotContract.js';

export type CapabilityMemoryRecallReasonKind =
  | 'capability'
  | 'workspace'
  | 'intent'
  | 'outcome'
  | 'replayable'
  | 'failure';

export type CapabilityMemoryRecallReason = {
  kind: CapabilityMemoryRecallReasonKind;
  score: number;
  summary: string;
};

export type CapabilityMemoryRecallQuery = {
  capabilityId?: string | null;
  workspace?: string | null;
  rawIntentText?: string | null;
  workspaceHash?: string | null;
  intentFingerprint?: string | null;
  failureKind?: string | null;
  preferredOutcomes?: CapabilityMemoryOutcome[];
  includeNonReplayable?: boolean;
  maxResults?: number;
};

export type CapabilityMemoryRecallMatch = {
  memoryId: string;
  capabilityId: string;
  outcome: CapabilityMemoryOutcome;
  score: number;
  replayable: boolean;
  lesson: string;
  recommendedNextAction: string;
  reasons: CapabilityMemoryRecallReason[];
  record: CapabilityMemoryRecord;
};

export type CapabilityMemoryRecallResult = {
  generatedAt: string;
  status: 'match_found' | 'no_match' | 'insufficient_signal';
  query: {
    capabilityId: string | null;
    workspaceHash: string | null;
    intentFingerprint: string | null;
    failureKind: string | null;
  };
  matches: CapabilityMemoryRecallMatch[];
  bestMatch: CapabilityMemoryRecallMatch | null;
  shouldPreloadHint: boolean;
  recommendedNextAction: string | null;
  safeSummary: string;
  metadata: Record<string, unknown>;
};

export type CapabilityAutopilotMemoryRecallRuntime = {
  now?: () => Date;
};

export class CapabilityAutopilotMemoryRecallService {
  private readonly now: () => Date;

  constructor(runtime: CapabilityAutopilotMemoryRecallRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildQueryFromReceipt(
    receipt: CapabilityReceipt,
    options: {
      workspace?: string | null;
      rawIntentText?: string | null;
      preferredOutcomes?: CapabilityMemoryOutcome[];
      includeNonReplayable?: boolean;
      maxResults?: number;
    } = {},
  ): CapabilityMemoryRecallQuery {
    const resumeIntent = receipt.resumeIntent || receipt.repairPlan?.resumeIntent || null;
    const workspace = this.resolveWorkspace(options.workspace, resumeIntent);
    const rawIntent = options.rawIntentText || resumeIntent?.normalizedText || resumeIntent?.rawText || null;

    return {
      capabilityId: receipt.capabilityId,
      workspaceHash: workspace ? this.hashValue('workspace', workspace) : null,
      intentFingerprint: rawIntent ? this.hashValue('intent', this.normalizeIntent(rawIntent)) : null,
      failureKind: receipt.diagnosis?.failureKind || null,
      preferredOutcomes: options.preferredOutcomes,
      includeNonReplayable: options.includeNonReplayable,
      maxResults: options.maxResults,
    };
  }

  public recall(
    records: CapabilityMemoryRecord[],
    query: CapabilityMemoryRecallQuery,
  ): CapabilityMemoryRecallResult {
    const generatedAt = this.now().toISOString();
    const normalizedQuery = this.normalizeQuery(query);

    if (!this.hasSignal(normalizedQuery)) {
      return this.emptyResult({
        generatedAt,
        status: 'insufficient_signal',
        query: normalizedQuery,
        safeSummary: 'There is not enough signal for safe procedural recall.',
      });
    }

    const matches = records
      .map((record) => this.scoreRecord(record, normalizedQuery))
      .filter((match): match is CapabilityMemoryRecallMatch => Boolean(match))
      .sort((a, b) => b.score - a.score)
      .slice(0, normalizedQuery.maxResults || 5);

    if (matches.length === 0) {
      return this.emptyResult({
        generatedAt,
        status: 'no_match',
        query: normalizedQuery,
        safeSummary: 'No safe procedural memory found for this context.',
      });
    }

    const bestMatch = matches[0];
    return {
      generatedAt,
      status: 'match_found',
      query: {
        capabilityId: normalizedQuery.capabilityId || null,
        workspaceHash: normalizedQuery.workspaceHash || null,
        intentFingerprint: normalizedQuery.intentFingerprint || null,
        failureKind: normalizedQuery.failureKind || null,
      },
      matches,
      bestMatch,
      shouldPreloadHint: bestMatch.score >= 60 && bestMatch.replayable,
      recommendedNextAction: bestMatch.recommendedNextAction,
      safeSummary: this.buildSafeSummary(bestMatch),
      metadata: {
        gate: 'capability-autopilot-memory-recall',
        totalRecords: records.length,
        matchCount: matches.length,
        autoExecute: false,
        rawIntentStored: false,
        rawWorkspaceStored: false,
      },
    };
  }

  private normalizeQuery(query: CapabilityMemoryRecallQuery): Required<Pick<
    CapabilityMemoryRecallQuery,
    'includeNonReplayable' | 'maxResults'
  >> & CapabilityMemoryRecallQuery {
    const workspaceHash = query.workspaceHash ||
      (query.workspace ? this.hashValue('workspace', query.workspace) : null);
    const intentFingerprint = query.intentFingerprint ||
      (query.rawIntentText ? this.hashValue('intent', this.normalizeIntent(query.rawIntentText)) : null);

    return {
      ...query,
      capabilityId: this.clean(query.capabilityId),
      workspaceHash,
      intentFingerprint,
      failureKind: this.clean(query.failureKind),
      preferredOutcomes: query.preferredOutcomes || ['ready', 'fallback_selected', 'permission_required'],
      includeNonReplayable: query.includeNonReplayable === true,
      maxResults: Math.max(1, Math.min(20, query.maxResults || 5)),
    };
  }

  private hasSignal(query: CapabilityMemoryRecallQuery): boolean {
    return Boolean(query.capabilityId || query.workspaceHash || query.intentFingerprint || query.failureKind);
  }

  private scoreRecord(
    record: CapabilityMemoryRecord,
    query: ReturnType<CapabilityAutopilotMemoryRecallService['normalizeQuery']>,
  ): CapabilityMemoryRecallMatch | null {
    if (!query.includeNonReplayable && !record.replayable) {
      return null;
    }

    const reasons: CapabilityMemoryRecallReason[] = [];
    if (query.capabilityId && record.capabilityId === query.capabilityId) {
      reasons.push(this.reason('capability', 40, 'Mesma capability.'));
    }
    if (query.workspaceHash && record.workspaceHash === query.workspaceHash) {
      reasons.push(this.reason('workspace', 25, 'Same workspace redacted by hash.'));
    }
    if (query.intentFingerprint && record.intentFingerprint === query.intentFingerprint) {
      reasons.push(this.reason('intent', 25, 'Similar intent by redacted fingerprint.'));
    }
    if (query.failureKind && record.failureKind === query.failureKind) {
      reasons.push(this.reason('failure', 15, 'Mesmo tipo de failure anterior.'));
    }
    if (query.preferredOutcomes?.includes(record.outcome)) {
      reasons.push(this.reason('outcome', 12, `Outcome anterior util: ${record.outcome}.`));
    }
    if (record.replayable) {
      reasons.push(this.reason('replayable', 8, 'Registro pode virar replay seguro.'));
    }

    const score = reasons.reduce((sum, reason) => sum + reason.score, 0) - (record.outcome === 'failed' ? 30 : 0);
    if (score <= 0 || reasons.length === 0) {
      return null;
    }

    return {
      memoryId: record.memoryId,
      capabilityId: record.capabilityId,
      outcome: record.outcome,
      score,
      replayable: record.replayable,
      lesson: record.lesson,
      recommendedNextAction: this.recommendedNextAction(record),
      reasons,
      record,
    };
  }

  private reason(
    kind: CapabilityMemoryRecallReasonKind,
    score: number,
    summary: string,
  ): CapabilityMemoryRecallReason {
    return { kind, score, summary };
  }

  private buildSafeSummary(bestMatch: CapabilityMemoryRecallMatch): string {
    return [
      `Procedural memory found for ${bestMatch.capabilityId}.`,
      `Action sugerida: ${bestMatch.recommendedNextAction}.`,
      `Licao safe: ${bestMatch.lesson}`,
      'Nothing should be executed automatically because of this memory.',
    ].join(' ');
  }

  private recommendedNextAction(record: CapabilityMemoryRecord): string {
    switch (record.outcome) {
      case 'ready':
        return 'resume_original_intent_after_readiness_check';
      case 'permission_required':
        return 'ask_for_explicit_approval_with_scoped_permissions';
      case 'fallback_selected':
        return 'continue_selected_fallback_with_audit_receipt';
      case 'failed':
        return 'offer_visible_fallback_or_manual_operator_review';
      case 'needs_repair':
      default:
        return 'rebuild_preview_first_repair_plan';
    }
  }

  private emptyResult(input: {
    generatedAt: string;
    status: 'no_match' | 'insufficient_signal';
    query: CapabilityMemoryRecallQuery;
    safeSummary: string;
  }): CapabilityMemoryRecallResult {
    return {
      generatedAt: input.generatedAt,
      status: input.status,
      query: {
        capabilityId: input.query.capabilityId || null,
        workspaceHash: input.query.workspaceHash || null,
        intentFingerprint: input.query.intentFingerprint || null,
        failureKind: input.query.failureKind || null,
      },
      matches: [],
      bestMatch: null,
      shouldPreloadHint: false,
      recommendedNextAction: null,
      safeSummary: input.safeSummary,
      metadata: {
        gate: 'capability-autopilot-memory-recall',
        autoExecute: false,
        rawIntentStored: false,
        rawWorkspaceStored: false,
      },
    };
  }

  private resolveWorkspace(
    explicitWorkspace: string | null | undefined,
    resumeIntent: OriginalIntentEnvelope | null,
  ): string | null {
    return explicitWorkspace ||
      resumeIntent?.workspace ||
      resumeIntent?.executionRequest?.workspace ||
      resumeIntent?.task?.workspace ||
      resumeIntent?.plan?.workspace_recommendation ||
      null;
  }

  private normalizeIntent(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private hashValue(namespace: string, value: string): string {
    return createHash('sha256')
      .update(`${namespace}:${value}`, 'utf8')
      .digest('hex');
  }

  private clean(value: string | null | undefined): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
  }
}
