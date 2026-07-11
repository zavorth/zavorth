import { describe, expect, it } from 'vitest';
import {
  buildHomeTrustSummary,
  selectLatestProof,
  selectNextApproval,
} from '../src/desktop-state/homeTrustModel';
import type { DesktopReceipt } from '../src/desktop-state/receiptsLedger';

function receipt(
  partial: Partial<DesktopReceipt> & Pick<DesktopReceipt, 'id' | 'title'>,
): DesktopReceipt {
  return {
    kind: 'system',
    summary: 'summary',
    status: 'ok',
    at: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('homeTrustModel', () => {
  it('selectNextApproval returns first pending approval', () => {
    expect(selectNextApproval([])).toBeNull();
    expect(
      selectNextApproval([
        { id: 'a1', status: 'approved', title: 'Done' },
        { id: 'a2', status: 'pending', title: 'Needs review' },
      ])?.id,
    ).toBe('a2');
    expect(
      selectNextApproval([{ approvalId: 'x1', title: 'Implicit pending' }])?.approvalId,
    ).toBe('x1');
  });

  it('selectLatestProof returns newest n receipts', () => {
    const receipts = [
      receipt({ id: 'r1', title: 'Old', at: '2026-01-01T00:00:00.000Z' }),
      receipt({ id: 'r2', title: 'Mid', at: '2026-01-02T00:00:00.000Z' }),
      receipt({ id: 'r3', title: 'New', at: '2026-01-03T00:00:00.000Z' }),
      receipt({ id: 'r4', title: 'Newest', at: '2026-01-04T00:00:00.000Z' }),
    ];
    const latest = selectLatestProof(receipts, 3);
    expect(latest.map((r) => r.id)).toEqual(['r4', 'r3', 'r2']);
    expect(selectLatestProof([], 3)).toEqual([]);
    expect(selectLatestProof(receipts, 0)).toEqual([]);
  });

  it('buildHomeTrustSummary combines next approval and proof', () => {
    const summary = buildHomeTrustSummary({
      approvals: [
        { id: 'a1', status: 'pending', title: 'Write file' },
        { id: 'a2', status: 'approved', title: 'Old' },
      ],
      receipts: [
        receipt({ id: 'r1', title: 'Write applied', at: '2026-02-01T00:00:00.000Z' }),
      ],
      proofLimit: 2,
    });
    expect(summary.pendingApprovalCount).toBe(1);
    expect(summary.nextApproval?.id).toBe('a1');
    expect(summary.hasProof).toBe(true);
    expect(summary.latestProof).toHaveLength(1);
    expect(summary.latestProof[0].title).toBe('Write applied');
  });

  it('buildHomeTrustSummary handles empty inputs', () => {
    const summary = buildHomeTrustSummary({});
    expect(summary.nextApproval).toBeNull();
    expect(summary.pendingApprovalCount).toBe(0);
    expect(summary.latestProof).toEqual([]);
    expect(summary.hasProof).toBe(false);
  });
});
