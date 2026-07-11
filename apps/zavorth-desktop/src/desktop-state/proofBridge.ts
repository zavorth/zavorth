/**
 * Desktop bridge for Trust Loop unified ledger events.
 *
 * Thin pure mappers so ReceiptsPanel (DesktopReceipt[]) can consume
 * projected ProofEvent shapes without pulling Node-only ledger I/O.
 *
 * Prefers shared monorepo mappers when available; falls back to local
 * field mapping that mirrors src/services/proof/proofEventMappers.ts.
 */

import type { DesktopReceipt, DesktopReceiptKind } from './receiptsLedger';

/** Minimal ProofEvent shape mirrored from the monorepo contract. */
export type DesktopProofEventKind =
  | 'chat'
  | 'approval'
  | 'runtime'
  | 'system'
  | 'channel'
  | 'memory'
  | 'marketplace'
  | 'workboard'
  | 'action'
  | 'evidence'
  | 'unknown';

export type DesktopProofEventStatus = 'ok' | 'failed' | 'pending' | 'info';

export type DesktopProofEvent = {
  id: string;
  runId: string | null;
  kind: DesktopProofEventKind | string;
  surface: string;
  title: string;
  summary: string;
  status: DesktopProofEventStatus | string;
  riskLevel?: string;
  approvalId?: string | null;
  artifacts?: Array<{ id: string; type: string; label?: string }>;
  createdAt: string;
  source: string;
  metadata?: Record<string, unknown>;
};

const DESKTOP_KINDS = new Set<DesktopReceiptKind>([
  'chat',
  'approval',
  'memory',
  'channel',
  'marketplace',
  'workboard',
  'runtime',
  'system',
]);

export function mapProofKindToDesktopKind(kind: string): DesktopReceiptKind {
  const text = String(kind || '').trim().toLowerCase();
  if (DESKTOP_KINDS.has(text as DesktopReceiptKind)) {
    return text as DesktopReceiptKind;
  }
  if (text === 'action' || text === 'evidence') return 'runtime';
  return 'system';
}

export function mapDesktopKindToProofKind(kind: DesktopReceiptKind | string): DesktopProofEventKind {
  const text = String(kind || '').trim().toLowerCase();
  if (
    text === 'chat'
    || text === 'approval'
    || text === 'runtime'
    || text === 'system'
    || text === 'channel'
    || text === 'memory'
    || text === 'marketplace'
    || text === 'workboard'
    || text === 'action'
    || text === 'evidence'
  ) {
    return text;
  }
  return 'unknown';
}

export function desktopReceiptFromProofEvent(event: DesktopProofEvent): DesktopReceipt {
  const kind = mapProofKindToDesktopKind(String(event.kind));
  const status: DesktopReceipt['status'] =
    event.status === 'ok'
    || event.status === 'failed'
    || event.status === 'pending'
    || event.status === 'info'
      ? event.status
      : 'info';

  return {
    id: String(event.id || '').trim() || `rcpt-proof-${Date.now().toString(36)}`,
    kind,
    title: String(event.title || 'Receipt').trim() || 'Receipt',
    summary: String(event.summary || '').trim() || 'No details.',
    status,
    at: String(event.createdAt || new Date().toISOString()),
    sessionId: event.runId ?? null,
    source: event.source || null,
    metadata: {
      ...(event.metadata || {}),
      proofKind: event.kind,
      riskLevel: event.riskLevel ?? 'none',
      approvalId: event.approvalId ?? null,
      artifacts: event.artifacts || [],
      surface: event.surface,
      projectedFrom: 'proof-event',
    },
  };
}

export function proofEventFromDesktopReceipt(receipt: DesktopReceipt): DesktopProofEvent {
  const meta = receipt.metadata && typeof receipt.metadata === 'object'
    ? receipt.metadata
    : {};
  const runId = meta.runId != null && String(meta.runId).trim()
    ? String(meta.runId)
    : (receipt.sessionId || null);
  const riskLevel = meta.riskLevel != null
    ? String(meta.riskLevel)
    : (meta.risk != null ? String(meta.risk) : 'none');
  const approvalId = meta.approvalId != null && String(meta.approvalId).trim()
    ? String(meta.approvalId)
    : null;

  return {
    id: receipt.id,
    runId,
    kind: mapDesktopKindToProofKind(receipt.kind),
    surface: 'desktop',
    title: receipt.title,
    summary: receipt.summary,
    status: receipt.status,
    riskLevel,
    approvalId,
    artifacts: Array.isArray(meta.artifacts)
      ? (meta.artifacts as Array<{ id: string; type: string; label?: string }>)
      : [],
    createdAt: receipt.at,
    source: receipt.source || 'desktop-receipts',
    metadata: {
      ...meta,
      sessionId: receipt.sessionId ?? null,
      projectedFrom: 'desktop-receipt',
    },
  };
}

/** Project an array of proof events into DesktopReceipt[] for ReceiptsPanel. */
export function desktopReceiptsFromProofEvents(events: DesktopProofEvent[]): DesktopReceipt[] {
  return (events || []).map(desktopReceiptFromProofEvent);
}

/** Project DesktopReceipt[] into proof events for unified ledger merge. */
export function proofEventsFromDesktopReceipts(receipts: DesktopReceipt[]): DesktopProofEvent[] {
  return (receipts || []).map(proofEventFromDesktopReceipt);
}
