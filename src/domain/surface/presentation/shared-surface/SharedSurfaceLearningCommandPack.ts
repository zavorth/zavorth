/**
 * Learning plane (`/learning`) — candidates with explicit gates.
 * Distinct from `/learn` (experience skill drafts). Same ordinal UX: list 1..n;
 * approve/reject/promote/forget accept 1, #2, short prefix, or full id.
 */

import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type { ZavorthLearningPlaneService } from '../../../../services/ZavorthLearningPlaneService.js';
import { errorMessage } from '../../../../utils/errorLike.js';
import { tSurface } from '../../../../i18n/surface.js';

type LearningCandidate = {
  id?: string;
  candidateId?: string;
  title?: string;
  kind?: string;
  score?: number;
  reviewState?: string;
  lifecycle?: string;
  summary?: string;
};

type SharedSurfaceLearningCommandPackDeps = {
  learningPlaneService: Pick<ZavorthLearningPlaneService, 'buildSnapshot' | 'executeAction'>;
};

export class SharedSurfaceLearningCommandPack {
  constructor(private readonly deps: SharedSurfaceLearningCommandPackDeps) {}

  public async maybeHandle(ctx: IMessageContext, commandType: string, args: string): Promise<boolean> {
    if (commandType !== '/learning') {
      return false;
    }

    await this.handleLearning(ctx, args);
    return true;
  }

  private async handleLearning(ctx: IMessageContext, args: string): Promise<void> {
    const normalizedArgs = String(args || '').trim();
    const tokens = normalizedArgs.split(/\s+/).filter(Boolean);
    const head = String(tokens[0] || '').toLowerCase();

    if (head === 'help' || head === '-h' || head === '--help') {
      await ctx.reply(
        [
          'Learning plane — candidates with explicit gates (approve/reject/promote/forget).',
          '',
          '/learn = skill drafts · /learning = candidates',
          'Use /learn for multi-tool experience skill drafts (promote with /learn promote 1).',
          '',
          '/learning · /learning list',
          '/learning approve 1',
          '/learning reject 1',
          '/learning promote 1',
          '/learning forget 1',
          '/learning promote-skill 1',
          '/learning promote-procedure 1',
          '',
          'Numbers come from /learning list. Prefer ordinals (1), not long ids.',
        ].join('\n'),
      );
      return;
    }

    const actionId = this.normalizeActionId(tokens[0]);
    const ref = tokens.slice(1).join(' ').trim();

    try {
      if (actionId) {
        if (!ref) {
          await ctx.reply(
            'Use /learning approve 1 (from /learning list), not a long id.\n' +
              'Also: reject 1 · promote 1 · forget 1 · promote-skill 1 · promote-procedure 1\n' +
              '/learn = skill drafts · /learning = candidates',
          );
          return;
        }
        const snapshot = this.deps.learningPlaneService.buildSnapshot();
        const candidates = this.listCandidates(snapshot);
        const candidateId = this.resolveCandidateRef(ref, candidates);
        if (!candidateId) {
          await ctx.reply(`Use /learning ${this.actionLabel(actionId)} 1 (from /learning list), not a long id.`);
          return;
        }
        const execution = await this.deps.learningPlaneService.executeAction({
          candidateId,
          actionId,
        });
        const lines = [
          'Learning plane (candidates)',
          '',
          execution.summary,
          `Status: ${execution.status}.`,
          `Candidate: ${this.shortId(execution.candidateId)}.`,
          `Action: ${execution.actionId}.`,
          ...execution.details.slice(0, 4),
        ];
        if (execution.silentInstallBlocked) {
          lines.push('silentInstallBlocked: true');
        }
        if (execution.skillCandidateId) {
          lines.push(`Skill candidate: ${this.shortId(execution.skillCandidateId)}`);
        }
        lines.push('', 'Tip: /learning list · /learning promote 1', '/learn = skill drafts · /learning = candidates');
        await ctx.reply(lines.join('\n'));
        return;
      }

      const snapshot = this.deps.learningPlaneService.buildSnapshot();
      const candidates = this.listCandidates(snapshot);
      const focus = tokens[0]?.toLowerCase() === 'candidates' || tokens[0]?.toLowerCase() === 'list' ? 'list' : 'home';

      const lines = [
        'Learning plane (candidates)',
        '/learn = skill drafts · /learning = candidates',
        '',
        snapshot.narrative.headline,
        snapshot.narrative.operatorSummary,
        '',
        `Candidates: ${snapshot.summary.total} | pending: ${snapshot.summary.pending} | approved: ${snapshot.summary.approved}.`,
        `Promoted: ${snapshot.summary.promoted} | published: ${snapshot.summary.published} | quarantine: ${snapshot.summary.quarantined}.`,
      ];

      if (candidates.length > 0) {
        lines.push('', focus === 'list' ? 'Candidates:' : 'Top candidates:');
        candidates.slice(0, 8).forEach((candidate, index) => {
          const n = index + 1;
          const id = this.candidateIdOf(candidate);
          const short = this.shortId(id);
          const score = typeof candidate.score === 'number' ? candidate.score.toFixed(2) : 'n/a';
          lines.push(
            `${n}. ${candidate.title || short} [${candidate.kind || 'item'}] score=${score}`,
            `   review=${candidate.reviewState || 'n/a'} lifecycle=${candidate.lifecycle || 'n/a'} ref=${short}`,
          );
          if (candidate.summary) {
            lines.push(`   ${String(candidate.summary).slice(0, 140)}`);
          }
        });
        lines.push(
          '',
          'Tip: /learning approve 1 · /learning reject 1 · /learning promote 1 · /learning forget 1',
          'Skill drafts: /learn list · /learn promote 1',
        );
      } else {
        lines.push('', 'No candidates yet.', 'Skill drafts (separate plane): /learn list · /learn promote 1');
      }

      await ctx.reply(lines.filter((line) => line !== null).join('\n'));
    } catch (error: unknown) {
      await ctx.reply(errorMessage(error, tSurface('error_learning_plane')));
    }
  }

  private listCandidates(snapshot: { candidates?: LearningCandidate[] }): LearningCandidate[] {
    return Array.isArray(snapshot.candidates) ? snapshot.candidates : [];
  }

  private candidateIdOf(candidate: LearningCandidate): string {
    return String(candidate.candidateId || candidate.id || '').trim();
  }

  private shortId(id: string): string {
    const raw = String(id || '').trim();
    if (!raw) return 'n/a';
    return raw.length <= 10 ? raw : raw.slice(0, 8);
  }

  private resolveCandidateRef(ref: string, candidates: LearningCandidate[]): string | null {
    const normalized = String(ref || '').trim();
    if (!normalized) return null;

    const ordinal = normalized.match(/^#...(\d{1,2})$/)?.[1];
    if (ordinal) {
      const index = Number(ordinal) - 1;
      if (Number.isFinite(index) && index >= 0 && index < candidates.length) {
        const id = this.candidateIdOf(candidates[index]);
        return id || null;
      }
      return null;
    }

    const exact = candidates.find((c) => this.candidateIdOf(c) === normalized);
    if (exact) return this.candidateIdOf(exact);

    const prefix = candidates.filter((c) => this.candidateIdOf(c).startsWith(normalized));
    if (prefix.length === 1) return this.candidateIdOf(prefix[0]);
    return null;
  }

  private actionLabel(actionId: string): string {
    if (actionId === 'promoteProcedure') return 'promote-procedure';
    if (actionId === 'promoteSkill') return 'promote-skill';
    return actionId;
  }

  private normalizeActionId(
    value: unknown,
  ): 'approve' | 'reject' | 'promote' | 'forget' | 'promoteProcedure' | 'promoteSkill' | null {
    const normalized = String(value || '')
      .trim()
      .replace(/_/g, '-')
      .toLowerCase();
    if (normalized === 'list' || normalized === 'status' || normalized === 'candidates' || normalized === 'home') {
      return null;
    }
    if (normalized === 'approve' || normalized === 'reject' || normalized === 'promote' || normalized === 'forget') {
      return normalized;
    }
    if (normalized === 'promote-procedure' || normalized === 'promoteprocedure') {
      return 'promoteProcedure';
    }
    if (normalized === 'promote-skill' || normalized === 'promoteskill') {
      return 'promoteSkill';
    }
    return null;
  }
}
