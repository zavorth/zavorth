export type PromptQueueItem = {
  id: string;
  text: string;
  attachments: any[];
  selectedSkills: any[];
  voice: any | null;
  guidedFlow: string;
  workspaceSelection: any | null;
  createdAt: number;
  attempts: number;
  maxAttempts: number;
  backoffMs: number;
  nextRetryAt?: number | null;
  status: 'queued' | 'sending' | 'failed' | 'steered';
  kind: 'message' | 'local-command';
  sessionId: string;
  localCommandName?: string | null;
  localCommandArgs?: string | null;
  pendingRunId?: string | null;
  steeringAckId?: string | null;
  lastError?: string | null;
};

export type PromptQueueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null | undefined;

export const DEFAULT_PROMPT_QUEUE_STORAGE_KEY = 'zavorth.zavorthControl.promptQueueBySession.v1';

export function cloneQueueValue<T>(value: T, fallback: T): T {
  try {
    return JSON.parse(JSON.stringify(value ?? fallback));
  } catch {
    return fallback;
  }
}

export function createPromptQueueItem(input: {
  text: string;
  attachments?: any[];
  selectedSkills?: any[];
  voice?: any | null;
  guidedFlow?: string | null;
  workspaceSelection?: any | null;
  sessionId?: string | null;
  localCommandName?: string | null;
  localCommandArgs?: string | null;
  kind?: 'message' | 'local-command';
  maxAttempts?: number | null;
  backoffMs?: number | null;
  nextRetryAt?: number | null;
  createdAt?: number;
  id?: string;
}): PromptQueueItem {
  const now = input.createdAt || Date.now();
  const id = String(input.id || `queue-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`).trim();
  return {
    id,
    text: String(input.text || '').trim(),
    attachments: cloneQueueValue(input.attachments || [], []),
    selectedSkills: cloneQueueValue(input.selectedSkills || [], []),
    voice: input.voice ? cloneQueueValue(input.voice, null) : null,
    guidedFlow: String(input.guidedFlow || '').trim(),
    workspaceSelection: input.workspaceSelection ? cloneQueueValue(input.workspaceSelection, null) : null,
    createdAt: now,
    attempts: 0,
    maxAttempts: Math.max(1, Number(input.maxAttempts || 3)),
    backoffMs: Math.max(0, Number(input.backoffMs || 1200)),
    nextRetryAt: Number(input.nextRetryAt || 0) > 0 ? Number(input.nextRetryAt) : null,
    status: 'queued',
    kind: input.kind || (input.localCommandName ? 'local-command' : 'message'),
    sessionId: String(input.sessionId || 'local').trim() || 'local',
    localCommandName: input.localCommandName || null,
    localCommandArgs: input.localCommandArgs || null,
    pendingRunId: null,
    steeringAckId: null,
    lastError: null,
  };
}

export function promptSubmitKey(input: {
  text?: string | null;
  attachments?: any[] | null;
  selectedSkills?: any[] | null;
  localCommandName?: string | null;
  localCommandArgs?: string | null;
  kind?: string | null;
}) {
  const attachmentSignature = (input.attachments || []).map((file) => ({
    name: String(file?.name || ''),
    type: String(file?.type || ''),
    size: Number(file?.size || 0),
    textLength: String(file?.text || '').length,
    contentLength: String(file?.content || '').length,
    mediaKind: String(file?.media?.kind || ''),
  }));
  const skillSignature = (input.selectedSkills || []).map((skill) => ({
    id: String(skill?.id || skill?.key || skill?.title || ''),
  }));
  return JSON.stringify({
    kind: String(input.kind || 'message'),
    command: String(input.localCommandName || ''),
    args: String(input.localCommandArgs || '').trim(),
    text: String(input.text || '').trim(),
    attachments: attachmentSignature,
    selectedSkills: skillSignature,
  });
}

export function serializePromptQueueItem(item: PromptQueueItem): PromptQueueItem {
  return {
    ...item,
    text: String(item.text || '').trim(),
    attachments: cloneQueueValue(item.attachments || [], []),
    selectedSkills: cloneQueueValue(item.selectedSkills || [], []),
    voice: item.voice ? cloneQueueValue(item.voice, null) : null,
    workspaceSelection: item.workspaceSelection ? cloneQueueValue(item.workspaceSelection, null) : null,
    attempts: Math.max(0, Number(item.attempts || 0)),
    maxAttempts: Math.max(1, Number(item.maxAttempts || 3)),
    backoffMs: Math.max(0, Number(item.backoffMs || 1200)),
    nextRetryAt: Number(item.nextRetryAt || 0) > 0 ? Number(item.nextRetryAt) : null,
    status: item.status || 'queued',
    kind: item.kind || (item.localCommandName ? 'local-command' : 'message'),
    sessionId: String(item.sessionId || 'local').trim() || 'local',
    localCommandName: item.localCommandName || null,
    localCommandArgs: item.localCommandArgs || null,
    pendingRunId: item.pendingRunId || null,
    steeringAckId: item.steeringAckId || null,
    lastError: item.lastError || null,
  };
}

export function readPromptQueueForSession(
  storage: PromptQueueStorage,
  sessionId: string,
  storageKey = DEFAULT_PROMPT_QUEUE_STORAGE_KEY,
): PromptQueueItem[] {
  const key = String(sessionId || 'local').trim() || 'local';
  if (!storage) return [];
  try {
    const parsed = JSON.parse(String(storage.getItem(storageKey) || '{}'));
    const items = Array.isArray(parsed?.[key]) ? parsed[key] : [];
    return items
      .filter((item: any) => item && typeof item === 'object')
      .map((item: PromptQueueItem) => serializePromptQueueItem({ ...item, sessionId: key }))
      .filter((item: PromptQueueItem) => item.text || item.attachments.length > 0 || item.localCommandName);
  } catch {
    return [];
  }
}

export function writePromptQueueForSession(
  storage: PromptQueueStorage,
  sessionId: string,
  queue: PromptQueueItem[],
  storageKey = DEFAULT_PROMPT_QUEUE_STORAGE_KEY,
) {
  if (!storage) return false;
  const key = String(sessionId || 'local').trim() || 'local';
  try {
    const parsed = JSON.parse(String(storage.getItem(storageKey) || '{}'));
    const next = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    const normalized = queue.map((item) => serializePromptQueueItem({ ...item, sessionId: key }));
    if (normalized.length > 0) {
      next[key] = normalized;
    } else {
      delete next[key];
    }
    storage.setItem(storageKey, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export function hasDuplicateQueuedPrompt(queue: PromptQueueItem[], item: PromptQueueItem) {
  const key = promptSubmitKey(item);
  return queue.some((candidate) => candidate.status !== 'failed' && promptSubmitKey(candidate) === key);
}
