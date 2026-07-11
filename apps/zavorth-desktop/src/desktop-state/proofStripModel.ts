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
  /** Full title for tooltip / accessibility (may be longer than `title`). */
  fullTitle: string;
  status: DesktopReceipt['status'];
  tone: ProofStripTone;
  at: string;
  kind: DesktopReceipt['kind'];
};

/** Display cap for chip labels; full string stays on `fullTitle` / DOM title. */
export const PROOF_STRIP_TITLE_MAX = 64;

export function receiptStatusTone(status: DesktopReceipt['status'] | string | null | undefined): ProofStripTone {
  const s = String(status || 'info').toLowerCase();
  if (s === 'ok' || s === 'success' || s === 'applied' || s === 'approved') return 'ok';
  if (s === 'failed' || s === 'error' || s === 'denied') return 'failed';
  if (s === 'pending' || s.includes('pend') || s.includes('wait')) return 'pending';
  return 'info';
}

/**
 * Normalize a receipt title for the compact strip.
 * Empty → kind fallback; overly long → truncated display with full kept separately.
 */
export function normalizeProofStripTitle(
  title: string | null | undefined,
  kind?: DesktopReceipt['kind'] | string | null,
  maxLen = PROOF_STRIP_TITLE_MAX,
): { title: string; fullTitle: string } {
  const raw = String(title || '').trim();
  const kindLabel = String(kind || 'system').trim() || 'system';
  const fullTitle = raw
    || `${kindLabel.charAt(0).toUpperCase()}${kindLabel.slice(1)} proof`;
  const limit = Math.max(8, Math.floor(Number(maxLen) || PROOF_STRIP_TITLE_MAX));
  if (fullTitle.length <= limit) {
    return { title: fullTitle, fullTitle };
  }
  return {
    title: `${fullTitle.slice(0, Math.max(1, limit - 1))}…`,
    fullTitle,
  };
}

/**
 * Select up to `limit` receipts for the compact proof strip (default 3).
 */
export function selectProofStripItems(
  receipts: DesktopReceipt[] | null | undefined,
  limit = 3,
): ProofStripItem[] {
  return selectLatestProof(receipts || [], limit).map((receipt) => {
    const { title, fullTitle } = normalizeProofStripTitle(receipt.title, receipt.kind);
    return {
      id: receipt.id,
      title,
      fullTitle,
      status: receipt.status,
      tone: receiptStatusTone(receipt.status),
      at: receipt.at,
      kind: receipt.kind,
    };
  });
}
