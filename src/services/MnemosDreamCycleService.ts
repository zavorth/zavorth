import {
  MNEMOS_DREAM_CYCLE_VERSION,
  type MnemosDreamAction,
  type MnemosDreamCandidateMemory,
  type MnemosDreamCycleInput,
  type MnemosDreamCycleSnapshot,
  type MnemosDreamObservation,
  type MnemosDreamQuarantineItem,
  type MnemosDreamReviewActionInput,
  type MnemosDreamReviewActionResult,
  type MnemosDreamCycleScheduleDecision,
  type MnemosDreamCycleScheduleInput,
} from '../contracts/MnemosDreamCycleContract.js';
import { addDays, containsRawSecret, redactSensitiveText, stableId } from './ZavorthNativeAutonomyShared.js';

type MnemosDreamCycleDeps = {
  now?: () => Date;
};

type NormalizedMemoryBucket = {
  key: string;
  genericKey: string;
  observations: MnemosDreamObservation[];
};

const SENSITIVE_USER_MODEL_PATTERN = /\b(deprimid[ao]|depression|depressed|ansios[ao]|anxiety|fragil|vulneravel|vulnerable|suicid|trauma|diagnos|psycholog|psicolog)\b/i;
const POLICY_CHANGE_PATTERN = /\b(disable|desativ|bypass|ignorar|ignore|approval|approvals|policy|politica|shell|sempre)\b/i;
const RELATIVE_DATE_PATTERN = /\b(amanh[ãa]|tomorrow|mañana|morgen|завтра|明天|พรุ่งนี้)\b/i;

export class MnemosDreamCycleService {
  private readonly now: () => Date;

  public constructor(deps: MnemosDreamCycleDeps = {}) {
    this.now = deps.now || (() => new Date());
  }

  public buildCycle(input: MnemosDreamCycleInput): MnemosDreamCycleSnapshot {
    const observations = this.collectObservations(input);
    const actions: MnemosDreamAction[] = [];
    const quarantine: MnemosDreamQuarantineItem[] = [];
    const buckets = new Map<string, NormalizedMemoryBucket>();

    for (const observation of observations) {
      const redacted = this.redactObservation(observation);
      if (this.isSecretObservation(observation)) {
        quarantine.push(this.quarantineItem('secret', redacted, 'Secret-bearing memory was redacted and held out of candidate storage.'));
        actions.push(this.action('quarantine-secret', redacted.evidenceRefs, 'Secret-bearing observation was quarantined.'));
        continue;
      }
      if (this.isSensitiveUserModel(redacted)) {
        quarantine.push(this.quarantineItem('sensitive-user-model', redacted, 'Sensitive user-model inference requires explicit review.'));
        continue;
      }
      if (this.isPolicyChange(redacted)) {
        quarantine.push(this.quarantineItem('policy-change', redacted, 'Policy or approval changes are never dream-applied.'));
        continue;
      }
      if (this.isStaleLowConfidence(redacted, input.pruneBefore || null)) {
        actions.push(this.action('prune-stale', redacted.evidenceRefs, `Pruned stale low-confidence observation ${redacted.id}.`));
        continue;
      }

      const key = this.normalizedKey(redacted.text);
      const genericKey = this.genericPreferenceKey(redacted.text);
      const existing = buckets.get(genericKey) || {
        key,
        genericKey,
        observations: [],
      };
      existing.observations.push(redacted);
      buckets.set(genericKey, existing);
    }

    const memories: MnemosDreamCandidateMemory[] = [];
    for (const bucket of buckets.values()) {
      const sorted = [...bucket.observations].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
      const newest = sorted[0];
      if (!newest) {
        continue;
      }
      const allEvidence = Array.from(new Set(sorted.flatMap((observation) => observation.evidenceRefs)));
      if (sorted.length > 1 && new Set(sorted.map((observation) => this.normalizedKey(observation.text))).size === 1) {
        actions.push(this.action('merge-duplicate', allEvidence, `Merged ${sorted.length} duplicate memory observations.`));
      } else if (sorted.length > 1) {
        actions.push(this.action('resolve-contradiction', allEvidence, 'Resolved conflicting memory observations using recency and evidence.'));
      }

      const refreshedText = this.refreshRelativeDates(newest.text, actions, newest.evidenceRefs);
      memories.push({
        id: stableId('memory', [input.storeId, bucket.genericKey, refreshedText, allEvidence.join('|')]),
        kind: newest.kind as MnemosDreamCandidateMemory['kind'],
        text: refreshedText,
        evidenceRefs: allEvidence,
        confidence: this.mergeConfidence(sorted),
        updatedAt: newest.updatedAt,
        expiry: newest.expiry || null,
      });
    }

    for (const session of input.sessions) {
      if (RELATIVE_DATE_PATTERN.test(session.summary)) {
        actions.push(this.action(
          'refresh-relative-date',
          [session.sessionId],
          `Refreshed relative date references against ${this.now().toISOString().slice(0, 10)}.`,
        ));
      }
    }

    const candidateStoreId = stableId('mnemos-dream', [input.storeId, this.now().toISOString(), memories.length, quarantine.length]);
    const receiptId = stableId('receipt', [candidateStoreId, 'dream-cycle']);

    return {
      version: MNEMOS_DREAM_CYCLE_VERSION,
      generatedAt: this.now().toISOString(),
      status: quarantine.length > 0 ? 'needs-review' : 'ready',
      sourceStore: {
        storeId: input.storeId,
        immutable: true,
        sessionsRead: input.sessions.length,
        memoriesRead: input.existingMemories?.length || 0,
      },
      candidateStore: {
        storeId: candidateStoreId,
        status: 'candidate',
        memories,
      },
      actions: this.dedupeActions(actions),
      quarantine,
      review: {
        applyCommand: `mnemos dream apply ${candidateStoreId}`,
        rejectCommand: `mnemos dream reject ${candidateStoreId}`,
        rollbackAvailable: true,
        receiptId,
      },
      safety: {
        sourceStoreImmutable: true,
        separateCandidateStore: true,
        rawSecretsSerialized: false,
        sensitivePsychologyQuarantined: true,
        policyChangesQuarantined: true,
        redactionBeforeWrite: true,
      },
    };
  }

  public executeReviewAction(
    snapshot: MnemosDreamCycleSnapshot,
    input: MnemosDreamReviewActionInput,
  ): MnemosDreamReviewActionResult {
    if (input.action === 'apply' && !input.approvalId) {
      return {
        status: 'blocked',
        action: input.action,
        actor: input.actor,
        appliedStoreId: null,
        candidateStoreId: snapshot.candidateStore.storeId,
        rollbackReceiptId: null,
        reason: 'approval required to apply candidate memories',
      };
    }

    if (input.action === 'reject') {
      return {
        status: 'rejected',
        action: input.action,
        actor: input.actor,
        appliedStoreId: null,
        candidateStoreId: snapshot.candidateStore.storeId,
        rollbackReceiptId: null,
        reason: 'candidate store rejected by reviewer',
      };
    }

    return {
      status: 'applied',
      action: input.action,
      actor: input.actor,
      appliedStoreId: snapshot.sourceStore.storeId,
      candidateStoreId: snapshot.candidateStore.storeId,
      rollbackReceiptId: stableId('receipt', [snapshot.candidateStore.storeId, input.approvalId, 'rollback']),
      reason: null,
    };
  }

  public shouldRun(input: MnemosDreamCycleScheduleInput): MnemosDreamCycleScheduleDecision {
    const minimumIntervalHours = input.minimumIntervalHours ?? 24;
    const minimumSessions = input.minimumSessions ?? 5;
    const minimumIdleMinutes = input.minimumIdleMinutes ?? 30;
    const lastDreamAtMs = input.lastDreamAt ? Date.parse(input.lastDreamAt) : Number.NaN;
    const nextEligibleAt = Number.isFinite(lastDreamAtMs)
      ? new Date(lastDreamAtMs + minimumIntervalHours * 60 * 60 * 1000).toISOString()
      : null;
    const intervalElapsed = !nextEligibleAt || this.now().getTime() >= Date.parse(nextEligibleAt);
    const sessionsReady = input.sessionsSinceLastDream >= minimumSessions;
    const idleReady = input.idleMinutes >= minimumIdleMinutes;
    const reasons = [
      intervalElapsed ? 'minimum interval elapsed' : 'minimum interval not elapsed',
      sessionsReady ? 'session threshold reached' : 'session threshold not reached',
      idleReady ? 'idle window available' : 'idle window not available',
    ];

    return {
      shouldRun: intervalElapsed && sessionsReady && idleReady,
      reasons,
      nextEligibleAt,
      safety: {
        schedulerDecisionOnly: true,
        sourceStoreImmutable: true,
      },
    };
  }

  private collectObservations(input: MnemosDreamCycleInput): MnemosDreamObservation[] {
    return [
      ...(input.existingMemories || []),
      ...input.sessions.flatMap((session) => session.observations || []),
    ].map((observation) => ({ ...observation, evidenceRefs: [...observation.evidenceRefs] }));
  }

  private redactObservation(observation: MnemosDreamObservation): MnemosDreamObservation {
    return {
      ...observation,
      text: redactSensitiveText(observation.text),
      evidenceRefs: [...observation.evidenceRefs],
    };
  }

  private isSecretObservation(observation: MnemosDreamObservation): boolean {
    return containsRawSecret(observation.text) || redactSensitiveText(observation.text) !== observation.text;
  }

  private isSensitiveUserModel(observation: MnemosDreamObservation): boolean {
    return observation.kind === 'user-model' || SENSITIVE_USER_MODEL_PATTERN.test(observation.text);
  }

  private isPolicyChange(observation: MnemosDreamObservation): boolean {
    return observation.kind === 'policy' || POLICY_CHANGE_PATTERN.test(observation.text) && /approval|policy|shell|bypass|desativ|disable/i.test(observation.text);
  }

  private isStaleLowConfidence(observation: MnemosDreamObservation, pruneBefore: string | null): boolean {
    const cutoff = pruneBefore ? Date.parse(pruneBefore) : this.now().getTime() - 180 * 24 * 60 * 60 * 1000;
    return observation.confidence < 0.35 && Date.parse(observation.updatedAt) < cutoff;
  }

  private normalizedKey(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\d+/g, '#')
      .replace(/[^a-z0-9#]+/g, ' ')
      .trim();
  }

  private genericPreferenceKey(text: string): string {
    const normalized = this.normalizedKey(text);
    return normalized
      .replace(/\b(com|with)\s+#\s+(bullets?|topicos?)\b/g, 'with # bullets')
      .replace(/\b#\s+(bullets?|topicos?)\b/g, '# bullets');
  }

  private refreshRelativeDates(text: string, actions: MnemosDreamAction[], evidenceRefs: string[]): string {
    if (!RELATIVE_DATE_PATTERN.test(text)) {
      return text;
    }
    actions.push(this.action(
      'refresh-relative-date',
      evidenceRefs,
      `Resolved relative date to ${addDays(this.now(), 1).slice(0, 10)}.`,
    ));
    return text.replace(RELATIVE_DATE_PATTERN, addDays(this.now(), 1).slice(0, 10));
  }

  private mergeConfidence(observations: MnemosDreamObservation[]): number {
    const total = observations.reduce((sum, observation) => sum + observation.confidence, 0);
    return Number(Math.min(0.99, total / Math.max(1, observations.length) + (observations.length > 1 ? 0.05 : 0)).toFixed(2));
  }

  private quarantineItem(
    kind: MnemosDreamQuarantineItem['kind'],
    observation: MnemosDreamObservation,
    summary: string,
  ): MnemosDreamQuarantineItem {
    return {
      id: stableId('quarantine', [kind, observation.id, observation.text]),
      kind,
      evidenceRefs: [...observation.evidenceRefs],
      approvalRequired: true,
      summary,
    };
  }

  private action(kind: MnemosDreamAction['kind'], evidenceRefs: string[], summary: string): MnemosDreamAction {
    return {
      actionId: stableId('dream-action', [kind, evidenceRefs.join('|'), summary]),
      kind,
      evidenceRefs: [...evidenceRefs],
      summary,
    };
  }

  private dedupeActions(actions: MnemosDreamAction[]): MnemosDreamAction[] {
    const seen = new Set<string>();
    return actions.filter((action) => {
      if (seen.has(action.actionId)) {
        return false;
      }
      seen.add(action.actionId);
      return true;
    });
  }
}
