import type { WorkboardBoard, WorkboardCard } from '../views/panels/WorkboardPanel';
import type { RuntimeWorkboardProjection, RuntimeWorkboardTask } from './runtimeWorkboardProjection';
import { mapRuntimeWorkboardToBoard } from './runtimeWorkboardProjection';

export type WorkboardSyncMode = 'local' | 'runtime' | 'hybrid';

export type WorkboardSyncState = {
  mode: WorkboardSyncMode;
  label: string;
  detail: string;
  lastSyncedAt: string | null;
};

export function describeWorkboardSync(input: {
  hasRuntimeProjection: boolean;
  lastPushOk?: boolean | null;
  lastSyncedAt?: string | null;
  lastPushError?: string | null;
}): WorkboardSyncState {
  if (input.hasRuntimeProjection && input.lastPushOk) {
    return {
      mode: 'hybrid',
      label: 'Hybrid sync',
      detail: 'Local board + runtime projection. Mutations are saved locally and mirrored as runtime actions when possible.',
      lastSyncedAt: input.lastSyncedAt || null,
    };
  }
  if (input.lastPushOk && !input.hasRuntimeProjection) {
    return {
      mode: 'hybrid',
      label: 'Push bridge active',
      detail: 'Local board is mirrored to the runtime via workboard-sync actions. No runtime projection is visible yet.',
      lastSyncedAt: input.lastSyncedAt || null,
    };
  }
  if (input.hasRuntimeProjection && input.lastPushOk === false) {
    return {
      mode: 'runtime',
      label: 'Runtime (push failed)',
      detail: input.lastPushError
        || 'Showing runtime projection. The last local push failed — edits remain local until Sync now succeeds.',
      lastSyncedAt: input.lastSyncedAt || null,
    };
  }
  if (input.hasRuntimeProjection) {
    return {
      mode: 'runtime',
      label: 'Runtime projection',
      detail: 'Showing runtime workboard projection. Local edits stay local until a push succeeds.',
      lastSyncedAt: input.lastSyncedAt || null,
    };
  }
  if (input.lastPushOk === false) {
    return {
      mode: 'local',
      label: 'Local (push failed)',
      detail: input.lastPushError
        || 'Board is local-first. The last runtime push failed — use Sync now to retry.',
      lastSyncedAt: input.lastSyncedAt || null,
    };
  }
  return {
    mode: 'local',
    label: 'Local board',
    detail: 'No runtime workboard projection. Board is local-first on this machine; mutations still attempt a runtime push when online.',
    lastSyncedAt: input.lastSyncedAt || null,
  };
}

export function mergeBoardsForDisplay(
  localBoards: WorkboardBoard[],
  runtime: RuntimeWorkboardProjection | null,
): WorkboardBoard[] {
  if (!runtime || (!runtime.tasks?.length && !runtime.sessions?.length)) {
    return localBoards;
  }
  const runtimeBoard = mapRuntimeWorkboardToBoard(runtime);
  // Prefer runtime board first, then local boards not named the same.
  return [runtimeBoard, ...localBoards.filter(board => board.id !== runtimeBoard.id)];
}

export function buildRuntimeTaskFromCard(card: WorkboardCard, sessionId: string): RuntimeWorkboardTask {
  return {
    taskId: card.id,
    sessionId,
    parentTaskId: null,
    title: card.title,
    status: columnToRuntimeStatus(card.columnId),
    risk: card.priority === 'critical' || card.priority === 'high' ? card.priority : 'low',
    claimedBy: card.assignee || null,
    heartbeatAt: card.updatedAt || null,
    blockedReason: card.columnId === 'blocked' ? (card.description || 'Blocked on board') : null,
    summary: card.description || null,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt || card.createdAt,
  };
}

export function columnToRuntimeStatus(columnId: string): RuntimeWorkboardTask['status'] {
  const id = String(columnId || '').toLowerCase();
  if (id.includes('done') || id.includes('complete')) return 'completed';
  if (id.includes('fail')) return 'failed';
  if (id.includes('cancel')) return 'cancelled';
  if (id.includes('block')) return 'blocked';
  if (id.includes('run') || id.includes('doing') || id.includes('progress')) return 'running';
  if (id.includes('claim') || id.includes('review')) return 'claimed';
  return 'queued';
}

export function buildWorkboardRuntimeAction(input: {
  board: WorkboardBoard;
  card?: WorkboardCard | null;
  operation: 'upsert-card' | 'delete-card' | 'sync-board';
  sessionId?: string | null;
}) {
  return {
    type: 'workboard-sync',
    approved: true,
    sessionId: input.sessionId || 'desktop-main',
    source: 'zavorth-desktop-workboard',
    payload: {
      operation: input.operation,
      board: {
        id: input.board.id,
        name: input.board.name,
        description: input.board.description || null,
        columns: input.board.columns,
      },
      card: input.card
        ? buildRuntimeTaskFromCard(input.card, input.sessionId || 'desktop-main')
        : null,
      cards: input.operation === 'sync-board'
        ? input.board.cards.map(card => buildRuntimeTaskFromCard(card, input.sessionId || 'desktop-main'))
        : undefined,
      metadata: {
        trustedDesktopBridge: true,
        localFirst: true,
      },
    },
  };
}
