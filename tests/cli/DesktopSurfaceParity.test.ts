/**
 * Desktop surface parity: approval mapping + Do-now secondaries + cost hop types.
 */

import {
  mapChannelDecisionToTrustLoop,
  mapDesktopStatusToDecisionAction,
  presentationCardFromDesktopApproval,
} from '../../apps/zavorth-desktop/src/desktop-state/approvalBridge';
import {
  buildDesktopDoNowSecondaries,
  DESKTOP_DO_NOW_SECONDARY_IDS,
} from '../../apps/zavorth-desktop/src/components/NextActionBanner';
import type { CostOverviewData } from '../../apps/zavorth-desktop/src/apiClient';

describe('desktop approval trust-loop parity', () => {
  it('maps channel once/session/always to approve', () => {
    expect(mapChannelDecisionToTrustLoop('once')).toBe('approve');
    expect(mapChannelDecisionToTrustLoop('session')).toBe('approve');
    expect(mapChannelDecisionToTrustLoop('always')).toBe('approve');
    expect(mapChannelDecisionToTrustLoop('deny')).toBe('deny');
    expect(mapChannelDecisionToTrustLoop('defer')).toBe('defer');
  });

  it('accepts channel vocabulary on status mapper', () => {
    expect(mapDesktopStatusToDecisionAction('once')).toBe('approve');
    expect(mapDesktopStatusToDecisionAction('session')).toBe('approve');
  });

  it('projects loose approval into presentation card', () => {
    const card = presentationCardFromDesktopApproval({
      id: 'a1',
      title: 'Write file',
      risk: 'high',
      status: 'once',
      channelId: 'telegram',
      toolName: 'fs.write',
      effectsSummary: ['write src/a.ts'],
    });
    expect(card.id).toBe('a1');
    expect(card.riskLevel).toBe('high');
    expect(card.decision.action).toBe('approve');
    expect(card.surface).toBe('desktop');
  });
});

describe('desktop Do now secondaries', () => {
  it('exposes approve/doctor/channels/prove ids', () => {
    expect([...DESKTOP_DO_NOW_SECONDARY_IDS]).toEqual(
      expect.arrayContaining(['approve', 'doctor', 'channels', 'prove']),
    );
  });

  it('builds secondary chips when handlers exist', () => {
    const chips = buildDesktopDoNowSecondaries({
      approvalsCount: 0,
      onOpenReview: () => undefined,
      onDoctor: () => undefined,
      onOpenChannels: () => undefined,
      onOpenProve: () => undefined,
    });
    const ids = chips.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['approve', 'doctor', 'channels', 'prove']));
  });

  it('dedupes approve when primary is review (pending approvals)', () => {
    const chips = buildDesktopDoNowSecondaries({
      approvalsCount: 2,
      onOpenReview: () => undefined,
      onDoctor: () => undefined,
    });
    expect(chips.filter((c) => c.id === 'approve')).toHaveLength(0);
    expect(chips.some((c) => c.id === 'doctor')).toBe(true);
  });
});

describe('desktop cost hop type surface', () => {
  it('accepts cheapHop / lastCostRouteClass on CostOverviewData', () => {
    const data: CostOverviewData = {
      ok: true,
      hours: 24,
      totals: { tokens: 10, requests: 1, estimatedCostUsd: 0.01 },
      cheapHop: {
        providerName: 'gemini',
        modelName: 'gemini-2.5-flash-lite',
        source: 'env',
        reason: 'background hop',
      },
      lastCostRouteClass: { className: 'background', at: '2026-07-16T00:00:00.000Z' },
    };
    expect(data.cheapHop?.modelName).toContain('flash-lite');
    expect(data.lastCostRouteClass?.className).toBe('background');
  });
});
