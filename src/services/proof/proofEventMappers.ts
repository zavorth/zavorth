/**
 * Pure ProofEvent mappers — no Node-only APIs.
 * Safe for desktop bundlers and Node services alike.
 */

import {
  PROOF_EVENT_KINDS,
  PROOF_EVENT_STATUSES,
  PROOF_RISK_LEVELS,
  type ProofDesktopReceiptShape,
  type ProofEvent,
  type ProofEventKind,
  type ProofEventStatus,
  type ProofEvidenceRecordShape,
  type ProofRiskLevel,
} from '../../contracts/proof/ProofLedgerContract.js';

const KIND_SET = new Set<string>(PROOF_EVENT_KINDS);
const STATUS_SET = new Set<string>(PROOF_EVENT_STATUSES);
const RISK_SET = new Set<string>(PROOF_RISK_LEVELS);

/** Desktop receipt kinds that map 1:1 onto ProofEventKind. */
const DESKTOP_KIND_SET = new Set<string>([
  'chat',
  'approval',
  'memory',
  'channel',
  'marketplace',
  'workboard',
  'runtime',
  'system',
]);

export function normalizeProofEventKind(value: unknown): ProofEventKind {
  const text = String(value || '').trim().toLowerCase();
  if (KIND_SET.has(text)) {
    return text as ProofEventKind;
  }
  const aliases: Record<string, ProofEventKind> = {
    approval: 'approval', approved: 'approval',
    chat: 'chat', message: 'chat',
    channel: 'channel',
    memory: 'memory', recall: 'memory',
    market: 'marketplace', marketplace: 'marketplace',
    workboard: 'workboard', board: 'workboard', kanban: 'workboard',
    runtime: 'runtime', agent: 'runtime',
    evidence: 'evidence', proof: 'evidence',
    action: 'action', tool: 'action', exec: 'action',
    system: 'system', boot: 'system', config: 'system',
  };
  return aliases[text] || 'unknown';
}

export function normalizeProofEventStatus(value: unknown): ProofEventStatus {
  const text = String(value || '').trim().toLowerCase();
  if (STATUS_SET.has(text)) {
    return text as ProofEventStatus;
  }
  const failed = new Set(['fail', 'failed', 'failure', 'error', 'denied', 'blocked']);
  const pending = new Set(['pending', 'waiting', 'wait', 'hold', 'queued']);
  const ok = new Set(['ok', 'success', 'succeeded', 'applied', 'approved', 'pass', 'passed', 'done', 'complete', 'completed']);
  if (failed.has(text)) return 'failed';
  if (pending.has(text)) return 'pending';
  if (ok.has(text)) return 'ok';
  return 'info';
}

export function normalizeProofRiskLevel(value: unknown): ProofRiskLevel {
  const text = String(value || '').trim().toLowerCase();
  if (RISK_SET.has(text)) {
    return text as ProofRiskLevel;
  }
  const aliases: Record<string, ProofRiskLevel> = { severe: 'critical', critical: 'critical', high: 'high', medium: 'medium', med: 'medium', low: 'low' };
  return aliases[text] || 'none';
}

export function proofEventFromDesktopReceipt(
  receipt: ProofDesktopReceiptShape,
  defaults: { surface?: string; source?: string } = {},
): ProofEvent {
  const kind = normalizeProofEventKind(receipt.kind);
  const meta = receipt.metadata && typeof receipt.metadata === 'object'
    ? receipt.metadata
    : undefined;
  const runId = readNullableString(meta?.runId) ?? readNullableString(receipt.sessionId);
  const riskLevel = normalizeProofRiskLevel(meta?.riskLevel ?? meta?.risk);
  const approvalId = readNullableString(meta?.approvalId);
  const artifacts = readArtifacts(meta?.artifacts);

  return {
    id: String(receipt.id || '').trim() || `proof-desktop-${safeIdFragment()}`,
    runId,
    kind,
    surface: defaults.surface || 'desktop',
    title: String(receipt.title || 'Receipt').trim() || 'Receipt',
    summary: String(receipt.summary || '').trim() || 'No details.',
    status: normalizeProofEventStatus(receipt.status),
    riskLevel,
    approvalId,
    artifacts,
    createdAt: String(receipt.at || new Date().toISOString()),
    source: String(receipt.source || defaults.source || 'desktop-receipts').trim() || 'desktop-receipts',
    metadata: {
      ...(meta || {}),
      sessionId: receipt.sessionId ?? null,
      projectedFrom: 'desktop-receipt',
    },
  };
}

export function desktopReceiptFromProofEvent(event: ProofEvent): ProofDesktopReceiptShape {
  const kind = mapProofKindToDesktopKind(event.kind);
  return {
    id: event.id,
    kind,
    title: event.title,
    summary: event.summary,
    status: event.status,
    at: event.createdAt,
    sessionId: event.runId,
    source: event.source,
    metadata: {
      ...(event.metadata || {}),
      proofKind: event.kind,
      riskLevel: event.riskLevel,
      approvalId: event.approvalId,
      artifacts: event.artifacts,
      surface: event.surface,
      projectedFrom: 'proof-event',
    },
  };
}

export function proofEventFromEvidenceRecord(
  record: ProofEvidenceRecordShape,
  defaults: { surface?: string; source?: string } = {},
): ProofEvent {
  const snapshot = record.snapshot && typeof record.snapshot === 'object'
    ? record.snapshot
    : {};
  const titleFromSnapshot = readNullableString(snapshot.title)
    || readNullableString(snapshot.key)
    || record.key;
  const summaryFromSnapshot = readNullableString(snapshot.summary)
    || readNullableString(snapshot.detail)
    || readNullableString(snapshot.message)
    || `Evidence key: ${record.key}`;
  const status = normalizeProofEventStatus(record.status ?? snapshot.status);
  const riskLevel = normalizeProofRiskLevel(snapshot.riskLevel ?? snapshot.risk);
  const approvalId = readNullableString(snapshot.approvalId);
  const artifacts = readArtifacts(snapshot.artifacts);

  return {
    id: String(record.id || '').trim() || `proof-evidence-${safeIdFragment()}`,
    runId: String(record.runId || '').trim() || null,
    kind: 'evidence',
    surface: defaults.surface || 'runtime',
    title: String(titleFromSnapshot || 'Evidence').trim() || 'Evidence',
    summary: String(summaryFromSnapshot || 'Evidence record').trim(),
    status,
    riskLevel,
    approvalId,
    artifacts,
    createdAt: String(record.generatedAt || new Date().toISOString()),
    source: defaults.source || 'agent-run-evidence-store',
    metadata: {
      evidenceKey: record.key,
      material: record.material ?? true,
      sequence: record.sequence ?? null,
      snapshot,
      projectedFrom: 'agent-run-evidence',
    },
  };
}

export function mapProofKindToDesktopKind(kind: ProofEventKind | string): string {
  const normalized = normalizeProofEventKind(kind);
  if (DESKTOP_KIND_SET.has(normalized)) {
    return normalized;
  }
  // action / evidence / unknown collapse to system for desktop UI compatibility
  if (normalized === 'action') return 'runtime';
  if (normalized === 'evidence') return 'runtime';
  return 'system';
}

function readNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function readArtifacts(value: unknown): ProofEvent['artifacts'] {
  if (!Array.isArray(value)) return [];
  const out: ProofEvent['artifacts'] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Record<string, unknown>;
    const id = String(raw.id || '').trim();
    const type = String(raw.type || raw.kind || 'artifact').trim() || 'artifact';
    if (!id) continue;
    const label = raw.label !== undefined ? String(raw.label) : undefined;
    out.push(label !== undefined ? { id, type, label } : { id, type });
  }
  return out;
}

function safeIdFragment(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
