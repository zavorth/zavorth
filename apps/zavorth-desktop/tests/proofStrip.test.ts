import { describe, expect, it } from 'vitest';
import {
  receiptStatusTone,
  selectProofStripItems,
} from '../src/desktop-state/proofStripModel';
import type { DesktopReceipt } from '../src/desktop-state/receiptsLedger';

function receipt(
  partial: Partial<DesktopReceipt> & Pick<DesktopReceipt, 'id' | 'title'>,
): DesktopReceipt {
  return {
    kind: 'chat',
    summary: 'summary',
    status: 'ok',
    at: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('proofStripModel', () => {
  it('maps receipt status to strip tone', () => {
    expect(receiptStatusTone('ok')).toBe('ok');
    expect(receiptStatusTone('failed')).toBe('failed');
    expect(receiptStatusTone('pending')).toBe('pending');
    expect(receiptStatusTone('info')).toBe('info');
    expect(receiptStatusTone(null)).toBe('info');
  });

  it('selectProofStripItems limits to n with title + tone', () => {
    const items = selectProofStripItems(
      [
        receipt({ id: '1', title: 'A', status: 'ok', at: '2026-01-03T00:00:00.000Z' }),
        receipt({ id: '2', title: 'B', status: 'failed', at: '2026-01-02T00:00:00.000Z' }),
        receipt({ id: '3', title: 'C', status: 'pending', at: '2026-01-01T00:00:00.000Z' }),
        receipt({ id: '4', title: 'D', status: 'info', at: '2025-12-31T00:00:00.000Z' }),
      ],
      3,
    );
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ id: '1', title: 'A', tone: 'ok' });
    expect(items[1]).toMatchObject({ id: '2', title: 'B', tone: 'failed' });
    expect(items[2]).toMatchObject({ id: '3', title: 'C', tone: 'pending' });
  });

  it('selectProofStripItems handles empty', () => {
    expect(selectProofStripItems(undefined, 3)).toEqual([]);
    expect(selectProofStripItems([], 3)).toEqual([]);
  });
});
