/**
 * Chat-home trust model: next approval + latest proof receipts.
 * Pure helpers — no I/O. Used by DesktopShell / ProofStrip / NextActionBanner.
 */

import type { DesktopReceipt } from './receiptsLedger';

export type HomeApprovalLike = {
  id?: string;
  approvalId?: string;
  status?: string;
  title?: string;
  summary?: string;
  action?: string;
};

export type HomeTrustSummary = {
  nextApproval: HomeApprovalLike | null;
  pendingApprovalCount: number;
  latestProof: DesktopReceipt[];
  hasProof: boolean;
};

function approvalId(item: HomeApprovalLike): string {
  return String(item.id || item.approvalId || '').trim();
}

function isPendingApproval(item: HomeApprovalLike): boolean {
  const status = String(item.status || 'pending').trim().toLowerCase();
  if (!status) return true;
  if (status === 'approved' || status === 'rejected' || status === 'denied' || status === 'resolved' || status === 'cancelled') {
    return false;
  }
  return new Set(['pending', 'waiting', 'wait', 'open', 'required', 'queued']).has(status);
}

/**
 * First pending approval for the home "next action" strip.
 */
export function selectNextApproval(
  approvals: Array<HomeApprovalLike>,
): HomeApprovalLike | null {
  if (!Array.isArray(approvals) || approvals.length === 0) return null;
  for (const item of approvals) {
    if (!item || typeof item !== 'object') continue;
    if (!isPendingApproval(item)) continue;
    if (!approvalId(item) && !String(item.title || item.summary || item.action || '').trim()) {
      continue;
    }
    return item;
  }
  return null;
}

/**
 * Newest N proof receipts (ledger is typically newest-first already).
 */
export function selectLatestProof(
  receipts: DesktopReceipt[],
  n = 3,
): DesktopReceipt[] {
  if (!Array.isArray(receipts) || receipts.length === 0) return [];
  const limit = Math.max(0, Math.floor(Number(n) || 0));
  if (limit === 0) return [];
  return [...receipts]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}

/**
 * Compact home summary: next approval + latest proof items.
 */
export function buildHomeTrustSummary(input: {
  approvals?: Array<HomeApprovalLike> | null;
  receipts?: DesktopReceipt[] | null;
  proofLimit?: number;
}): HomeTrustSummary {
  const approvals = Array.isArray(input.approvals) ? input.approvals : [];
  const pending = approvals.filter(isPendingApproval);
  const nextApproval = selectNextApproval(approvals);
  const latestProof = selectLatestProof(input.receipts || [], input.proofLimit ?? 3);
  return {
    nextApproval,
    pendingApprovalCount: pending.length,
    latestProof,
    hasProof: latestProof.length > 0,
  };
}
