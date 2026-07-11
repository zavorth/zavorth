/**
 * Proof strip display model for chat home.
 * Pure selection / mapping — no React, no I/O.
 */

import type { DesktopReceipt } from './receiptsLedger';
import { selectLatestProof } from './homeTrustModel';

export type ProofStripTone = 'ok' | 'failed' | 'pending' | 'info';

export type ProofStripItem = {
  id: string;
  title: string;
  status: DesktopReceipt['status'];
  tone: ProofStripTone;
  at: string;
  kind: DesktopReceipt['kind'];
};

export function receiptStatusTone(status: DesktopReceipt['status'] | string | null | undefined): ProofStripTone {
  const s = String(status || 'info').toLowerCase();
  if (s === 'ok' || s === 'success' || s === 'applied' || s === 'approved') return 'ok';
  if (s === 'failed' || s === 'error' || s === 'denied') return 'failed';
  if (s === 'pending' || s.includes('pend') || s.includes('wait')) return 'pending';
  return 'info';
}

/**
 * Select up to `limit` receipts for the compact proof strip (default 3).
 */
export function selectProofStripItems(
  receipts: DesktopReceipt[] | null | undefined,
  limit = 3,
): ProofStripItem[] {
  return selectLatestProof(receipts || [], limit).map((receipt) => ({
    id: receipt.id,
    title: receipt.title,
    status: receipt.status,
    tone: receiptStatusTone(receipt.status),
    at: receipt.at,
    kind: receipt.kind,
  }));
}
