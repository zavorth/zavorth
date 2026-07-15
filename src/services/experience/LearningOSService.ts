import { logger } from '../../logger.js';
import {
  LEARNING_CANDIDATE_CONTRACT_VERSION,
  type ExperienceLearningCandidate,
  type ExperienceLearningCandidateState,
  type ExperienceLearningDecision,
} from './ExperienceContracts.js';

import type { LearningPlaneActionExecution, LearningPlaneSnapshot } from '../ZavorthLearningPlaneService.js';
import { ZavorthLearningPlaneService } from '../ZavorthLearningPlaneService.js';
import { errorMessage } from '../../utils/errorLike.js';

export type LearningOSExport = {
  generatedAt: string;
  candidates: ExperienceLearningCandidate[];
  summary: string;
};

export type LearningOSDecisionResult = {
  ok: boolean;
  status: 'applied' | 'blocked' | 'noop' | 'exported' | 'reset';
  summary: string;
  candidates: ExperienceLearningCandidate[];
  raw?: LearningPlaneActionExecution | LearningOSExport | null;
};

export type LearningOSRuntime = {
  now?: () => Date;
  learningPlane?:
    | (Pick<ZavorthLearningPlaneService, 'buildSnapshot' | 'executeAction'> &
        Partial<Pick<ZavorthLearningPlaneService, 'resetState' | 'exportState'>>)
    | null;
};

export class LearningOSService {
  private readonly now: () => Date;
  private readonly learningPlane: LearningOSRuntime['learningPlane'];

  constructor(runtime: LearningOSRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.learningPlane = runtime.learningPlane || null;
  }

  public buildCandidates(input: { workspace?: string | null } = {}): ExperienceLearningCandidate[] {
    const snapshot = this.safeSnapshot(input);
    return snapshot.candidates.map((candidate) => {
      const securityBlocked = this.isSecurityPolicyCandidate(candidate);
      const state = securityBlocked ? 'quarantined' : this.resolveState(candidate.reviewState, candidate.lifecycle);
      return {
        contractVersion: LEARNING_CANDIDATE_CONTRACT_VERSION,
        id: candidate.id,
        title: candidate.title,
        origin: candidate.source.sourceSurface || candidate.source.workflow || 'runtime',
        observedPattern: candidate.summary,
        recommendation: securityBlocked
          ? 'Blocked: Learning OS cannot change policy, sandbox, firewall, allowlists, or fundamental approvals.'
          : candidate.steps[0] || candidate.summary,
        confidence: candidate.score,
        impact: this.impactFor(state),
        dataUsed: candidate.details.slice(0, 6),
        suggestedAction: securityBlocked
          ? 'Reject or keep quarantined. Security adjustments require reviewed code changes.'
          : this.suggestedActionFor(state, candidate.score),
        state,
        createdAt: candidate.createdAt,
        updatedAt: candidate.updatedAt,
      };
    });
  }

  public buildSummary(input: { workspace?: string | null } = {}): { summary: string; pending: number } {
    const snapshot = this.safeSnapshot(input);
    return {
      summary: snapshot.narrative.operatorSummary,
      pending: snapshot.summary.pending,
    };
  }

  public async decide(input: {
    candidateId?: string | null;
    decision: ExperienceLearningDecision;
    workspace?: string | null;
  }): Promise<LearningOSDecisionResult> {
    const decision = input.decision;
    if (decision === 'export') {
      const exported = this.export(input);
      return {
        ok: true,
        status: 'exported',
        summary: exported.summary,
        candidates: exported.candidates,
        raw: exported,
      };
    }

    if (decision === 'reset') {
      if (this.learningPlane?.resetState) {
        this.learningPlane.resetState();
        const candidates = this.buildCandidates(input);
        return {
          ok: true,
          status: 'reset',
          summary: 'Learning OS reset. Future candidates will need a fresh review.',
          candidates,
        };
      }
      return {
        ok: false,
        status: 'blocked',
        summary: 'Current learning plane does not expose resetState.',
        candidates: this.buildCandidates(input),
      };
    }

    const candidateId = String(input.candidateId || '').trim();
    if (!candidateId) {
      return {
        ok: false,
        status: 'blocked',
        summary: 'Provide the learning candidate id.',
        candidates: this.buildCandidates(input),
      };
    }

    if (!this.learningPlane?.executeAction) {
      return {
        ok: false,
        status: 'blocked',
        summary: 'Learning plane is unavailable in this runtime.',
        candidates: this.buildCandidates(input),
      };
    }

    const snapshot = this.safeSnapshot(input);
    const candidate = snapshot.candidates.find((entry) => entry.id === candidateId) || null;
    if ((decision === 'approve' || decision === 'promote') && candidate && this.isSecurityPolicyCandidate(candidate)) {
      const candidates = this.buildCandidates(input);
      return {
        ok: false,
        status: 'blocked',
        summary:
          'Learning blocked: candidates that change security policy, sandbox, egress, filesystem, shell, or fundamental approvals cannot be approved or promoted.',
        candidates,
      };
    }

    const actionId =
      decision === 'revoke'
        ? 'forget'
        : decision === 'promote'
          ? 'promote'
          : decision === 'approve'
            ? 'approve'
            : 'reject';
    const raw = await Promise.resolve(this.learningPlane.executeAction({ candidateId, actionId }));
    return {
      ok: raw.ok,
      status: raw.status,
      summary: raw.summary,
      candidates: this.buildCandidates(input),
      raw,
    };
  }

  public export(input: { workspace?: string | null } = {}): LearningOSExport {
    const candidates = this.buildCandidates(input);
    return {
      generatedAt: this.now().toISOString(),
      candidates,
      summary: `${candidates.length} candidate(s) exported without raw secrets.`,
    };
  }

  private safeSnapshot(input: { workspace?: string | null }): LearningPlaneSnapshot {
    if (!this.learningPlane?.buildSnapshot) {
      return {
        generatedAt: this.now().toISOString(),
        summary: {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          promoted: 0,
          published: 0,
          quarantined: 0,
          highConfidence: 0,
        },
        candidates: [],
        narrative: {
          headline: 'Learning OS waiting for runtime.',
          operatorSummary: 'No learning plane is connected to this surface.',
        },
      };
    }
    try {
      return this.learningPlane.buildSnapshot({ workspace: input.workspace || null });
    } catch (error: unknown) {
      logger.warn('[Learning O S] creation failed', error);
      return {
        generatedAt: this.now().toISOString(),
        summary: {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          promoted: 0,
          published: 0,
          quarantined: 0,
          highConfidence: 0,
        },
        candidates: [],
        narrative: {
          headline: 'Learning OS unavailable.',
          operatorSummary: `Failed to read learning plane: ${errorMessage(error, 'unknown error')}.`,
        },
      };
    }
  }

  private resolveState(reviewState: string, lifecycle: string): ExperienceLearningCandidateState {
    if (lifecycle === 'trusted_local' || lifecycle === 'published') return 'promoted';
    if (lifecycle === 'quarantined') return 'quarantined';
    if (reviewState === 'rejected') return 'rejected';
    return 'pending';
  }

  private impactFor(state: ExperienceLearningCandidateState): string {
    if (state === 'promoted') return 'May influence future routes, preferences, and local procedures.';
    if (state === 'quarantined' || state === 'rejected') return 'Does not change future behavior.';
    return 'Waiting for review before changing behavior.';
  }

  private suggestedActionFor(state: ExperienceLearningCandidateState, confidence: number): string {
    if (state === 'promoted') return 'Keep, revoke, or export when you want to audit.';
    if (state === 'quarantined' || state === 'rejected') return 'Review only if the pattern becomes useful again.';
    if (confidence >= 0.8) return 'Approve and promote if this pattern matches your real workflow.';
    return 'Approve as draft or reject to keep the runtime clean.';
  }

  private isSecurityPolicyCandidate(candidate: LearningPlaneSnapshot['candidates'][number]): boolean {
    const haystack = [
      candidate.id,
      candidate.platformEntryId,
      candidate.title,
      candidate.kind,
      candidate.summary,
      candidate.source.workflow,
      candidate.source.objective,
      ...candidate.steps,
      ...candidate.details,
    ]
      .join('\n')
      .toLowerCase();

    const protectedSignals = [
      'workspacefspolicy',
      'intent safety',
      'intentsafetyclassifier',
      'policy broker',
      'securitypolicybroker',
      'sandboxpolicy',
      'shell policy',
      'egress',
      'allowlist',
      'blocklist',
      'approval',
      'permissions',
      'seguranca',
      'security',
      'bypass',
      'disable safety',
      'desativar seguranca',
      'sempre permitir shell',
      'never ask approval',
      'sem approval',
    ];
    return protectedSignals.some((signal) => haystack.includes(signal));
  }
}
