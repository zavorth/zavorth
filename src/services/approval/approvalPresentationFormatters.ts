/**
 * Pure formatters for the unified approval presentation model.
 * No Node I/O — safe for desktop bundlers and Node services alike.
 */

import type {
  ApprovalPresentationRiskLevel,
  ApprovalPresentationScope,
} from '../../contracts/approval/ApprovalPresentationContract.js';
import type { ProofRiskLevel } from '../../contracts/proof/ProofLedgerContract.js';

export type LeaseLikeForEffects = {
  toolQualifiedName?: string | null;
  toolName?: string | null;
  allowedOperations?: string[] | null;
  riskClassAtGrant?: string | null;
  riskClass?: string | null;
  riskLevel?: string | null;
  grantReason?: string | null;
  workspaceId?: string | null;
  channelId?: string | null;
  subjectId?: string | null;
  expiresAt?: string | null;
};

export type LeaseExpiryFormat = {
  label: string;
  expired: boolean;
  remainingMs: number;
};

const RISK_LABELS: Record<ApprovalPresentationRiskLevel, string> = {
  none: 'None',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
  unknown: 'Unknown',
};

/**
 * Format lease/card expiry relative to `now`.
 */
export function formatLeaseExpiry(
  expiresAt: string | null | undefined,
  now: Date | number | (() => Date) = () => new Date(),
): LeaseExpiryFormat {
  const nowMs = resolveNowMs(now);
  if (expiresAt == null || !String(expiresAt).trim()) {
    return { label: 'No expiry', expired: false, remainingMs: Number.POSITIVE_INFINITY };
  }

  const expMs = Date.parse(String(expiresAt));
  if (!Number.isFinite(expMs)) {
    return { label: 'Invalid expiry', expired: false, remainingMs: 0 };
  }

  const remainingMs = expMs - nowMs;
  if (remainingMs <= 0) {
    const ago = formatDuration(-remainingMs);
    return { label: `Expired ${ago} ago`, expired: true, remainingMs };
  }

  return {
    label: `Expires in ${formatDuration(remainingMs)}`,
    expired: false,
    remainingMs,
  };
}

/**
 * Human label for presentation risk levels (and common lease aliases).
 */
export function formatRiskLabel(risk: string | null | undefined): string {
  const normalized = normalizePresentationRisk(risk);
  return RISK_LABELS[normalized];
}

/**
 * Single-line scope summary for cards / CLI.
 */
export function formatScopeLine(scope: Partial<ApprovalPresentationScope> | null | undefined): string {
  if (!scope) return 'scope: (none)';
  const parts: string[] = [];
  if (scope.toolName) parts.push(`tool=${scope.toolName}`);
  if (scope.workspaceId) parts.push(`workspace=${scope.workspaceId}`);
  if (scope.channelId) parts.push(`channel=${scope.channelId}`);
  if (scope.subjectId) parts.push(`subject=${scope.subjectId}`);
  const ops = Array.isArray(scope.allowedOperations) ? scope.allowedOperations.filter(Boolean) : [];
  if (ops.length) parts.push(`ops=${ops.join(',')}`);
  return parts.length ? parts.join(' · ') : 'scope: (empty)';
}

/**
 * Map approval-lease riskClass to Proof OS risk levels.
 * Lease `safe` → proof `none`; `unknown` → proof `none` (ProofRiskLevel has no unknown).
 */
export function mapLeaseRiskToProofRisk(
  riskClass: string | null | undefined,
): ProofRiskLevel {
  const text = String(riskClass || '').trim().toLowerCase();
  if (text === 'critical' || text.includes('critical') || text.includes('severe')) return 'critical';
  if (text === 'high' || text.includes('high')) return 'high';
  if (text === 'medium' || text === 'med' || text.includes('med')) return 'medium';
  if (text === 'low' || text.includes('low')) return 'low';
  // safe, none, unknown, empty → none for proof ledger
  return 'none';
}

/**
 * Map lease / loose risk strings onto presentation risk (includes unknown).
 */
export function normalizePresentationRisk(
  risk: string | null | undefined,
): ApprovalPresentationRiskLevel {
  const text = String(risk || '').trim().toLowerCase();
  if (!text) return 'unknown';
  if (text === 'safe' || text === 'none' || text === 'none risk') return 'none';
  if (text === 'low') return 'low';
  if (text === 'medium' || text === 'med') return 'medium';
  if (text === 'high') return 'high';
  if (text === 'critical' || text === 'severe') return 'critical';
  if (text === 'unknown') return 'unknown';
  if (text.includes('critical') || text.includes('severe')) return 'critical';
  if (text.includes('high')) return 'high';
  if (text.includes('med')) return 'medium';
  if (text.includes('low')) return 'low';
  if (text.includes('safe') || text.includes('none')) return 'none';
  return 'unknown';
}

/**
 * Build short effect bullets from a lease-like object for card UI.
 */
export function buildEffectsSummaryFromLease(lease: LeaseLikeForEffects | null | undefined): string[] {
  if (!lease) return [];
  const effects: string[] = [];
  const tool = String(lease.toolQualifiedName || lease.toolName || '').trim();
  if (tool) {
    effects.push(`Tool: ${tool}`);
  }
  const ops = Array.isArray(lease.allowedOperations)
    ? lease.allowedOperations.map((o) => String(o || '').trim()).filter(Boolean)
    : [];
  if (ops.length === 1) {
    effects.push(`Operation: ${ops[0]}`);
  } else if (ops.length > 1) {
    effects.push(`Operations: ${ops.slice(0, 4).join(', ')}${ops.length > 4 ? '…' : ''}`);
  }
  const risk = lease.riskClassAtGrant || lease.riskClass || lease.riskLevel;
  if (risk) {
    effects.push(`Risk: ${formatRiskLabel(String(risk))}`);
  }
  if (lease.workspaceId) {
    effects.push(`Workspace: ${lease.workspaceId}`);
  }
  if (lease.channelId) {
    effects.push(`Channel: ${lease.channelId}`);
  }
  if (lease.grantReason && String(lease.grantReason).trim()) {
    const reason = String(lease.grantReason).trim();
    effects.push(`Reason: ${reason.length > 80 ? `${reason.slice(0, 77)}…` : reason}`);
  }
  if (lease.expiresAt) {
    const exp = formatLeaseExpiry(lease.expiresAt);
    effects.push(exp.label);
  }
  return effects;
}

function resolveNowMs(now: Date | number | (() => Date)): number {
  if (typeof now === 'function') return now().getTime();
  if (now instanceof Date) return now.getTime();
  if (typeof now === 'number' && Number.isFinite(now)) return now;
  return Date.now();
}

function formatDuration(ms: number): string {
  const abs = Math.max(0, Math.floor(ms));
  const sec = Math.floor(abs / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) {
    const rem = sec % 60;
    return rem ? `${min}m ${rem}s` : `${min}m`;
  }
  const hr = Math.floor(min / 60);
  if (hr < 48) {
    const remMin = min % 60;
    return remMin ? `${hr}h ${remMin}m` : `${hr}h`;
  }
  const days = Math.floor(hr / 24);
  return `${days}d`;
}
