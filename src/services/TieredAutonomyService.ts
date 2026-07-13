/**
 * Tiered Autonomy — Maps learning candidates to autonomous action tiers.
 *
 * Instead of requiring approval for every improvement (the current behavior),
 * this module classifies candidates into three tiers:
 *
 * - auto:     Apply immediately, record receipt. No user intervention.
 * - notify:   Apply immediately, notify user, allow 30s undo window.
 * - approve:  Queue for user approval before applying (current behavior).
 *
 * This keeps Zavorth's governance where it matters (security, memory, core
 * behavior) while matching fast-cycle speed for low-risk improvements (style,
 * formatting, minor optimizations).
 */

import type {
  ZavorthNativeLearningLoopCandidate,
  ZavorthNativeLearningLoopRisk,
} from '../contracts/native/ZavorthNativeLearningLoopContract.js';
import type { ZavorthExperienceProfileId } from '../contracts/ui/ZavorthExperienceProfileContract.js';
import { ProfileTieredAutonomyService } from './ProfileTieredAutonomyService.js';

// ── Tier Definitions ──────────────────────────────────────────

export type AutonomyTier = 'auto' | 'notify' | 'approve';

export interface TierDecision {
  tier: AutonomyTier;
  reason: string;
  risk: ZavorthNativeLearningLoopRisk;
  reversible: boolean;
  undoWindowMs: number;
}

export interface TieredAutonomyConfig {
  /** Auto-apply window for notify tier before commit. Default: 30000 (30s) */
  notifyUndoWindowMs?: number;
  /** Auto-apply risk threshold. Candidates at or below this risk get auto tier. Default: 'low' */
  autoRiskThreshold?: ZavorthNativeLearningLoopRisk;
  /** Notify risk threshold. Candidates at or below this risk get notify tier. Default: 'medium' */
  notifyRiskThreshold?: ZavorthNativeLearningLoopRisk;
  /** Always force approval for these candidate kinds regardless of risk. */
  forceApprovalKinds?: string[];
  /** Always force approval for these keywords in title/summary. */
  forceApprovalPatterns?: RegExp[];
}

// ── Risk Level Ordering ───────────────────────────────────────

const RISK_ORDER: Record<ZavorthNativeLearningLoopRisk, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

// ── Default Patterns That Always Require Approval ─────────────

const SECURITY_SENSITIVE_PATTERNS: RegExp[] = [
  /\b(security|safety|policy|approval|allowlist|denylist|sandbox|firewall|secret|permission|trust|encrypt|auth)\b/i,
  /\b(effect\s*boundary|policy\s*broker|egress|guard|blocker)\b/i,
  /\b(memory|recall|session|user\s*model|preference|procedure)\b/i,
  /\b(behavior|personality|tone|identity|soul)\b/i,
];

const ALWAYS_FORCE_APPROVAL_KINDS = new Set([
  'approved-nudge',
  'user-model-update',
]);

// ── Tier Classifier ───────────────────────────────────────────

export class TieredAutonomyClassifier {
  private readonly config: Required<TieredAutonomyConfig>;

  constructor(config?: TieredAutonomyConfig) {
    this.config = {
      notifyUndoWindowMs: config?.notifyUndoWindowMs ?? 30_000,
      autoRiskThreshold: config?.autoRiskThreshold ?? 'low',
      notifyRiskThreshold: config?.notifyRiskThreshold ?? 'medium',
      forceApprovalKinds: config?.forceApprovalKinds ?? [],
      forceApprovalPatterns: config?.forceApprovalPatterns ?? SECURITY_SENSITIVE_PATTERNS,
    };
  }

  /**
   * Creates a classifier pre-configured for a specific experience profile.
   * Uses the profile's tiered autonomy config from ProfileTieredAutonomyService.
   */
  static fromProfile(profileId: ZavorthExperienceProfileId): TieredAutonomyClassifier {
    const service = new ProfileTieredAutonomyService();
    const profileConfig = service.getConfig(profileId);
    return new TieredAutonomyClassifier(profileConfig);
  }

  /**
   * Classifies a candidate into an autonomy tier based on risk, kind, and content.
   */
  classify(candidate: ZavorthNativeLearningLoopCandidate): TierDecision {
    // Check 1: Forced approval kinds (security, user model, nudges)
    if (this.isForceApprovalKind(candidate.kind)) {
      return this.decision('approve', candidate.risk, 'Candidate kind requires explicit approval.');
    }

    // Check 2: Forced approval patterns (security-sensitive content)
    if (this.hasForceApprovalPatterns(candidate)) {
      return this.decision('approve', candidate.risk, 'Candidate contains security-sensitive content.');
    }

    // Check 3: Safety fields — security policy modification always requires approval
    if (candidate.safety.canModifySecurityPolicy) {
      return this.decision('approve', candidate.risk, 'Candidate can modify security policy.');
    }

    // Check 4: Critical risk always requires approval
    if (candidate.risk === 'critical') {
      return this.decision('approve', candidate.risk, 'Critical risk candidates always require approval.');
    }

    // Check 5: Risk-based tier assignment
    const riskLevel = RISK_ORDER[candidate.risk];
    const autoThreshold = RISK_ORDER[this.config.autoRiskThreshold];
    const notifyThreshold = RISK_ORDER[this.config.notifyRiskThreshold];

    if (riskLevel <= autoThreshold) {
      return this.decision('auto', candidate.risk, `Risk '${candidate.risk}' is at or below auto threshold.`);
    }

    if (riskLevel <= notifyThreshold) {
      return this.decision('notify', candidate.risk, `Risk '${candidate.risk}' is at or below notify threshold.`);
    }

    return this.decision('approve', candidate.risk, `Risk '${candidate.risk}' exceeds notify threshold.`);
  }

  /**
   * Batch-classifies multiple candidates.
   */
  classifyAll(candidates: ZavorthNativeLearningLoopCandidate[]): Map<string, TierDecision> {
    const results = new Map<string, TierDecision>();
    for (const candidate of candidates) {
      results.set(candidate.id, this.classify(candidate));
    }
    return results;
  }

  /**
   * Returns true if the candidate should be force-approved regardless of risk.
   */
  private isForceApprovalKind(kind: string): boolean {
    if (ALWAYS_FORCE_APPROVAL_KINDS.has(kind)) return true;
    return this.config.forceApprovalKinds.includes(kind);
  }

  /**
   * Checks if the candidate's title or summary matches force-approval patterns.
   */
  private hasForceApprovalPatterns(candidate: ZavorthNativeLearningLoopCandidate): boolean {
    const text = `${candidate.title} ${candidate.summary}`;
    return this.config.forceApprovalPatterns.some((pattern) => pattern.test(text));
  }

  /**
   * Creates a tier decision with the appropriate undo window.
   */
  private decision(
    tier: AutonomyTier,
    risk: ZavorthNativeLearningLoopRisk,
    reason: string,
  ): TierDecision {
    return {
      tier,
      reason,
      risk,
      reversible: risk !== 'critical',
      undoWindowMs: tier === 'notify' ? this.config.notifyUndoWindowMs : 0,
    };
  }
}

// ── Tiered Applier ────────────────────────────────────────────

export interface TieredApplierReceipt {
  id: string;
  candidateId: string;
  tier: AutonomyTier;
  appliedAt: string;
  reversible: boolean;
  undoDeadlineMs: number;
  status: 'applied' | 'undone' | 'expired' | 'pending' | 'queued' | 'failed';
}

export interface TieredApplyInput {
  candidate: ZavorthNativeLearningLoopCandidate;
  decision: TierDecision;
}

export interface TieredApplyResult {
  receipt: TieredApplierReceipt;
  applied: boolean;
  notifyUser: boolean;
  undoAvailable: boolean;
}

export class TieredApplier {
  private readonly pendingUndos: Map<string, { receipt: TieredApplierReceipt; candidate: ZavorthNativeLearningLoopCandidate; deadline: ReturnType<typeof setTimeout> }> = new Map();
  private readonly receipts: TieredApplierReceipt[] = [];
  private readonly MAX_RECEIPTS = 1000;

  constructor(
    private readonly onApply: (candidate: ZavorthNativeLearningLoopCandidate) => Promise<void> | void,
    private readonly onNotify?: (candidate: ZavorthNativeLearningLoopCandidate, undoWindowMs: number) => void,
    private readonly onUndo?: (candidate: ZavorthNativeLearningLoopCandidate) => Promise<void> | void,
  ) {}

  /**
   * Applies a candidate according to its tier decision.
   * Returns a receipt for audit trails.
   */
  async apply(input: TieredApplyInput): Promise<TieredApplyResult> {
    const { candidate, decision } = input;

    const receipt: TieredApplierReceipt = {
      id: crypto.randomUUID(),
      candidateId: candidate.id,
      tier: decision.tier,
      appliedAt: new Date().toISOString(),
      reversible: decision.reversible,
      undoDeadlineMs: decision.undoWindowMs,
      status: decision.tier === 'approve' ? 'queued' : 'pending',
    };

    if (decision.tier === 'approve') {
      this.pushReceipt(receipt);
      return { receipt, applied: false, notifyUser: false, undoAvailable: false };
    }

    // Apply the candidate (auto or notify tier)
    try {
      await this.onApply(candidate);
      receipt.status = 'applied';
    } catch {
      receipt.status = 'failed';
      this.pushReceipt(receipt);
      return { receipt, applied: false, notifyUser: false, undoAvailable: false };
    }

    this.pushReceipt(receipt);

    if (decision.tier === 'notify') {
      this.onNotify?.(candidate, decision.undoWindowMs);
      this.scheduleUndo(candidate, receipt, decision.undoWindowMs);
      return { receipt, applied: true, notifyUser: true, undoAvailable: true };
    }

    return { receipt, applied: true, notifyUser: false, undoAvailable: false };
  }

  /**
   * Attempts to undo a candidate within the undo window.
   * Returns true if undo was successful, false if window expired.
   */
  async undo(candidateId: string): Promise<boolean> {
    const pending = this.pendingUndos.get(candidateId);
    if (!pending) return false;

    clearTimeout(pending.deadline);
    this.pendingUndos.delete(candidateId);
    pending.receipt.status = 'undone';

    await this.onUndo?.(pending.candidate);

    return true;
  }

  /**
   * Returns all receipts for audit trails.
   */
  getReceipts(): TieredApplierReceipt[] {
    return [...this.receipts];
  }

  /**
   * Returns pending undos count.
   */
  getPendingUndoCount(): number {
    return this.pendingUndos.size;
  }

  /**
   * Cleans up expired undo windows.
   */
  cleanup(): void {
    for (const [id, entry] of this.pendingUndos) {
      clearTimeout(entry.deadline);
      entry.receipt.status = 'expired';
      this.pendingUndos.delete(id);
    }
  }

  private pushReceipt(receipt: TieredApplierReceipt): void {
    this.receipts.push(receipt);
    // Evict oldest receipts if exceeding limit
    while (this.receipts.length > this.MAX_RECEIPTS) {
      this.receipts.shift();
    }
  }

  private scheduleUndo(
    candidate: ZavorthNativeLearningLoopCandidate,
    receipt: TieredApplierReceipt,
    windowMs: number,
  ): void {
    const deadline = setTimeout(() => {
      receipt.status = 'expired';
      this.pendingUndos.delete(candidate.id);
    }, windowMs);

    this.pendingUndos.set(candidate.id, { receipt, candidate, deadline });
  }
}
