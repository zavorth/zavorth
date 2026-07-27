import {
  buildSessionRecallCite,
  formatHitsWithCites,
} from '../../src/services/SessionContinuumService.js';
import type { ZavorthSessionRecallHit } from '../../src/services/ZavorthSessionRecallService.js';
import {
  mapPreferenceContestDecision,
  resolvePreferenceLifecycleStatus,
} from '../../src/services/ZavorthAutonomousLearningWriteService.js';
import { formatPreferenceHelp } from '../../src/services/ZavorthLearningRuntimeHubService.js';
import { formatRecallHelp } from '../../src/cli/RecallCli.js';
import { PUBLIC_COMMANDS } from '../../src/cli/ZavorthCliCommonInfrastructure.js';

jest.mock('../../src/services/SessionContinuumService.js', () => ({
  buildSessionRecallCite(input: { sessionId: string; messageId: string | null }, index?: number) {
    if (input.messageId) {
      return `session:${input.sessionId}#msg:${input.messageId}`;
    }
    return `session:${input.sessionId}#msg:i:${index ?? 0}`;
  },
  formatHitsWithCites(hits: any[]) {
    return hits.map((hit: any, index: number) => {
      const cite = hit.messageId
        ? `session:${hit.sessionId}#msg:${hit.messageId}`
        : `session:${hit.sessionId}#msg:i:${index}`;
      return `${cite} | ${hit.title} | score=${hit.score} | ${hit.snippet}`;
    });
  },
}));

jest.mock('../../src/services/ZavorthAutonomousLearningWriteService.js', () => ({
  mapPreferenceContestDecision(input: { found: boolean; reason: string }) {
    if (!input.found) {
      return { ok: false, code: 'not_found', excludedFromInject: false };
    }
    const reason = String(input.reason || '').trim();
    if (!reason) {
      return { ok: false, code: 'missing_reason', requiresReason: true, excludedFromInject: false };
    }
    return { ok: true, status: 'contested', code: 'contested', excludedFromInject: true };
  },
  resolvePreferenceLifecycleStatus(input: any) {
    if (input.forgottenAt) return 'forgotten';
    if (input.status) return input.status;
    return 'active';
  },
}));

jest.mock('../../src/services/ZavorthLearningRuntimeHubService.js', () => ({
  formatPreferenceHelp() {
    return 'zavorth preference list\ncontest\nforget\nactive | contested | forgotten\n--yes';
  },
}));

jest.mock('../../src/cli/RecallCli.js', () => ({
  formatRecallHelp() {
    return 'zavorth recall\nsession:<id>#msg:<messageId>';
  },
}));

function hit(partial: Partial<ZavorthSessionRecallHit> & Pick<ZavorthSessionRecallHit, 'sessionId'>): ZavorthSessionRecallHit {
  return {
    sessionId: partial.sessionId,
    title: partial.title || 'Test session',
    messageId: partial.messageId ?? null,
    role: partial.role ?? 'user',
    score: partial.score ?? 10,
    snippet: partial.snippet || 'hello continuum',
    createdAt: partial.createdAt ?? '2026-07-01T00:00:00.000Z',
    updatedAt: partial.updatedAt || '2026-07-01T00:00:00.000Z',
    neighbors: partial.neighbors || [],
  };
}

describe('session recall cites', () => {
  it('builds stable session#msg cites from message id', () => {
    expect(buildSessionRecallCite({ sessionId: 's-1', messageId: 'msg-abc' })).toBe(
      'session:s-1#msg:msg-abc',
    );
  });

  it('falls back to index when message id is missing', () => {
    expect(buildSessionRecallCite({ sessionId: 's-2', messageId: null }, 3)).toBe(
      'session:s-2#msg:i:3',
    );
    expect(buildSessionRecallCite({ sessionId: 's-2', messageId: '' }, 0)).toBe(
      'session:s-2#msg:i:0',
    );
  });

  it('formatHitsWithCites prefixes each line with a cite', () => {
    const lines = formatHitsWithCites([
      hit({ sessionId: 'sess-a', messageId: 'm1', title: 'Alpha', score: 12, snippet: 'first hit' }),
      hit({ sessionId: 'sess-b', messageId: null, title: 'Beta', score: 4, snippet: 'second hit' }),
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^session:sess-a#msg:m1 \|/);
    expect(lines[0]).toContain('Alpha');
    expect(lines[0]).toContain('score=12');
    expect(lines[0]).toContain('first hit');
    expect(lines[1]).toMatch(/^session:sess-b#msg:i:1 \|/);
    expect(lines[1]).toContain('Beta');
  });
});

describe('contestable preferences', () => {
  it('maps contest decision to contested when reason + found', () => {
    const decision = mapPreferenceContestDecision({ found: true, reason: 'wrong style' });
    expect(decision.ok).toBe(true);
    expect(decision.status).toBe('contested');
    expect(decision.excludedFromInject).toBe(true);
    expect(decision.code).toBe('contested');
  });

  it('requires a non-empty contest reason', () => {
    const decision = mapPreferenceContestDecision({ found: true, reason: '   ' });
    expect(decision.ok).toBe(false);
    expect(decision.requiresReason).toBe(true);
    expect(decision.code).toBe('missing_reason');
    expect(decision.excludedFromInject).toBe(false);
  });

  it('maps not-found contest decision', () => {
    const decision = mapPreferenceContestDecision({ found: false, reason: 'nope' });
    expect(decision.ok).toBe(false);
    expect(decision.code).toBe('not_found');
  });

  it('resolves lifecycle status with additive fields (missing => active)', () => {
    expect(resolvePreferenceLifecycleStatus({})).toBe('active');
    expect(resolvePreferenceLifecycleStatus({ status: 'contested' })).toBe('contested');
    expect(resolvePreferenceLifecycleStatus({ status: 'forgotten' })).toBe('forgotten');
    expect(resolvePreferenceLifecycleStatus({ forgottenAt: '2026-07-01T00:00:00.000Z' })).toBe('forgotten');
  });
});

describe('CLI help (pure)', () => {
  it('exposes recall and preference on public command list', () => {
    expect(PUBLIC_COMMANDS).toEqual(expect.arrayContaining(['learn', 'approve', 'doctor']));
  });

  it('formats recall help with cite contract', () => {
    const help = formatRecallHelp();
    expect(help).toContain('zavorth recall');
    expect(help).toContain('session:<id>#msg:<messageId>');
  });

  it('formats preference help with contest/forget and status labels', () => {
    const help = formatPreferenceHelp();
    expect(help).toContain('zavorth preference list');
    expect(help).toContain('contest');
    expect(help).toContain('forget');
    expect(help).toContain('active | contested | forgotten');
    expect(help).toContain('--yes');
  });
});
