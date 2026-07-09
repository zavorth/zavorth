export type DesktopReceiptKind =
  | 'chat'
  | 'approval'
  | 'memory'
  | 'channel'
  | 'marketplace'
  | 'workboard'
  | 'runtime'
  | 'system';

export type DesktopReceipt = {
  id: string;
  kind: DesktopReceiptKind;
  title: string;
  summary: string;
  status: 'ok' | 'failed' | 'pending' | 'info';
  at: string;
  sessionId?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown>;
};

export const RECEIPTS_STORAGE_KEY = 'zvd:receipts-ledger:v1';
const MAX_RECEIPTS = 200;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function storageOrNull(): StorageLike | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

export function loadReceipts(storage: StorageLike | null = storageOrNull()): DesktopReceipt[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(RECEIPTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(sanitizeReceipt)
      .filter((item): item is DesktopReceipt => Boolean(item))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  } catch {
    return [];
  }
}

export function persistReceipts(
  receipts: DesktopReceipt[],
  storage: StorageLike | null = storageOrNull(),
): DesktopReceipt[] {
  const next = receipts.slice(0, MAX_RECEIPTS);
  storage?.setItem(RECEIPTS_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function appendReceipt(
  current: DesktopReceipt[],
  input: Omit<DesktopReceipt, 'id' | 'at'> & { id?: string; at?: string },
  storage: StorageLike | null = storageOrNull(),
): DesktopReceipt[] {
  const receipt: DesktopReceipt = {
    id: input.id || `rcpt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    kind: input.kind,
    title: input.title,
    summary: input.summary,
    status: input.status,
    at: input.at || new Date().toISOString(),
    sessionId: input.sessionId || null,
    source: input.source || null,
    metadata: input.metadata,
  };
  return persistReceipts([receipt, ...current], storage);
}

export function extractReceiptsFromSnapshot(snapshot: unknown): DesktopReceipt[] {
  if (!snapshot || typeof snapshot !== 'object') return [];
  const root = snapshot as Record<string, unknown>;
  const bags = [
    root.receipts,
    (root.memory as Record<string, unknown> | undefined)?.receipts,
    (root.runtime as Record<string, unknown> | undefined)?.receipts,
    (root.projections as Record<string, unknown> | undefined)?.receipts,
  ];
  const out: DesktopReceipt[] = [];
  for (const bag of bags) {
    if (!Array.isArray(bag)) continue;
    for (const item of bag) {
      const receipt = sanitizeReceipt(normalizeLooseReceipt(item));
      if (receipt) out.push(receipt);
    }
  }
  return out;
}

function normalizeLooseReceipt(value: unknown): Partial<DesktopReceipt> | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  return {
    id: String(raw.id || raw.receiptId || '').trim() || undefined,
    kind: (String(raw.kind || raw.type || 'system') as DesktopReceiptKind),
    title: String(raw.title || raw.action || raw.name || 'Receipt'),
    summary: String(raw.summary || raw.description || raw.message || raw.reason || ''),
    status: mapStatus(raw.status || raw.outcome),
    at: String(raw.at || raw.createdAt || raw.generatedAt || new Date().toISOString()),
    sessionId: raw.sessionId ? String(raw.sessionId) : null,
    source: raw.source ? String(raw.source) : null,
    metadata: raw,
  };
}

function mapStatus(value: unknown): DesktopReceipt['status'] {
  const text = String(value || '').toLowerCase();
  if (text.includes('fail') || text.includes('error') || text.includes('denied')) return 'failed';
  if (text.includes('pend') || text.includes('wait')) return 'pending';
  if (text.includes('ok') || text.includes('success') || text.includes('applied') || text.includes('approved')) return 'ok';
  return 'info';
}

function sanitizeReceipt(value: Partial<DesktopReceipt> | null | undefined): DesktopReceipt | null {
  if (!value) return null;
  const title = String(value.title || '').trim();
  if (!title) return null;
  const kind = (['chat', 'approval', 'memory', 'channel', 'marketplace', 'workboard', 'runtime', 'system'] as const)
    .includes(value.kind as DesktopReceiptKind)
    ? (value.kind as DesktopReceiptKind)
    : 'system';
  return {
    id: String(value.id || `rcpt-${Math.random().toString(36).slice(2, 10)}`),
    kind,
    title,
    summary: String(value.summary || '').trim() || 'No details.',
    status: value.status === 'ok' || value.status === 'failed' || value.status === 'pending' || value.status === 'info'
      ? value.status
      : 'info',
    at: String(value.at || new Date().toISOString()),
    sessionId: value.sessionId || null,
    source: value.source || null,
    metadata: value.metadata,
  };
}
