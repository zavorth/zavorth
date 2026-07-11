/**
 * Per-session composer drafts with a localStorage-like interface.
 * Pure and unit-testable: pass a Storage shim or null (no-op).
 */

export const DRAFT_STORAGE_KEY = 'zvd:composer-drafts';

export function shouldClearComposerAfterSend(rawText: string, currentInput: string): boolean {
  return rawText === currentInput;
}

type StorageReader = Pick<Storage, 'getItem'>;
type StorageWriter = Pick<Storage, 'getItem' | 'setItem'>;
type StorageMutator = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function safeParseDrafts(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'string') out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

function writeDrafts(
  storage: Pick<Storage, 'setItem' | 'removeItem'> | null,
  drafts: Record<string, string>,
): void {
  if (!storage) return;
  const keys = Object.keys(drafts);
  if (keys.length === 0) {
    if ('removeItem' in storage && typeof storage.removeItem === 'function') {
      storage.removeItem(DRAFT_STORAGE_KEY);
    } else {
      storage.setItem(DRAFT_STORAGE_KEY, '{}');
    }
    return;
  }
  storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
}

export function loadDrafts(storage: StorageReader | null): Record<string, string> {
  if (!storage) return {};
  try {
    return safeParseDrafts(storage.getItem(DRAFT_STORAGE_KEY));
  } catch {
    return {};
  }
}

/**
 * Save a draft for a session. Empty/whitespace text deletes the draft.
 */
export function saveDraft(
  storage: StorageWriter | null,
  sessionId: string,
  text: string,
): void {
  if (!storage) return;
  const sid = String(sessionId ?? '').trim();
  if (!sid) return;

  const drafts = loadDrafts(storage);
  const trimmed = String(text ?? '');
  if (!trimmed.trim()) {
    if (!(sid in drafts)) return;
    delete drafts[sid];
    writeDrafts(storage as StorageMutator, drafts);
    return;
  }

  drafts[sid] = trimmed;
  writeDrafts(storage as StorageMutator, drafts);
}

export function getDraft(
  storage: StorageReader | null,
  sessionId: string,
): string {
  const sid = String(sessionId ?? '').trim();
  if (!sid) return '';
  const drafts = loadDrafts(storage);
  return drafts[sid] ?? '';
}

export function clearDraft(
  storage: StorageWriter | null,
  sessionId: string,
): void {
  if (!storage) return;
  const sid = String(sessionId ?? '').trim();
  if (!sid) return;
  const drafts = loadDrafts(storage);
  if (!(sid in drafts)) return;
  delete drafts[sid];
  writeDrafts(storage as StorageMutator, drafts);
}
