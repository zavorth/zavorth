import fs from 'node:fs';
import path from 'node:path';
import {
  type ZavorthRuntimeStateBusActionInput,
  type ZavorthRuntimeStateBusState,
  type ZavorthRuntimeCapabilitiesProjection,
  type ZavorthRuntimeDynamicRoute,
  type ZavorthRuntimeMcpTrustServer,
  type ZavorthRuntimeModelSpec,
  type ZavorthRuntimePermissionsMatrix,
  type ZavorthRuntimePersonalConnector,
  type ZavorthRuntimeProviderConnection,
  type ZavorthRuntimeSkillHistoryEntry,
  type ZavorthRuntimeStreamSession,
  type ZavorthRuntimeWorkspaceKnowledge,
  type ZavorthRuntimeStateDomain,
  type ZavorthRuntimeStateDomainState,
  type ZavorthRuntimeStateReceipt,
  type ZavorthRuntimeStateReceiptStatus,
  type ZavorthRuntimeStateSkill,
  type ZavorthRuntimeStateStatus,
  type ZavorthRuntimeStateWorkspace,
  type ZavorthRuntimeWorkboardState,
  type ZavorthRuntimeWorkboardTask,
  type ZavorthRuntimeWorkboardTaskStatus,
} from '../contracts/ZavorthRuntimeStateBusContract.js';
import { logger } from '../logger.js';

type RuntimeRecord = Record<string, unknown>;

import * as normalizationHelpers from './ZavorthRuntimeStateNormalizationHelpers.js';

export function defaultWorkboardState(now: string): ZavorthRuntimeWorkboardState {
  return {
    updatedAt: now,
    source: null,
    selectedTaskId: null,
    selectedTask: null,
    sessions: [],
    tasks: [],
    workers: [],
    receipts: [],
    boards: [],
    summary: {
      sessions: 0,
      queued: 0,
      running: 0,
      completed: 0,
      blocked: 0,
    },
    safety: {
      sqliteDurable: true,
      mutationRequiresApproval: true,
      retryBounded: true,
      spawnDepthBounded: true,
    },
  };
}

export function coerceWorkboardState(value: unknown, fallback: ZavorthRuntimeWorkboardState): ZavorthRuntimeWorkboardState {
  const raw = normalizationHelpers.record(value);
  if (!raw) return fallback;
  const tasks = Array.isArray(raw.tasks)
    ? raw.tasks.map((entry) => coerceWorkboardTask(entry)).filter((entry): entry is ZavorthRuntimeWorkboardTask => Boolean(entry))
    : fallback.tasks;
  const sessions = Array.isArray(raw.sessions)
    ? raw.sessions.map((entry) => {
      const item = normalizationHelpers.record(entry) || {};
      const sessionId = normalizationHelpers.clean(item.sessionId) || normalizationHelpers.clean(item.id);
      if (!sessionId) return null;
      return {
        sessionId,
        objective: normalizationHelpers.clean(item.objective) || 'Desktop workboard session',
        status: normalizationHelpers.clean(item.status) || 'running',
        maxDepth: Math.max(1, Number(item.maxDepth || 3) || 3),
        maxChildren: Math.max(1, Number(item.maxChildren || 8) || 8),
      };
    }).filter((entry): entry is ZavorthRuntimeWorkboardState['sessions'][number] => Boolean(entry))
    : fallback.sessions;
  return {
    updatedAt: normalizationHelpers.clean(raw.updatedAt) || fallback.updatedAt,
    source: normalizationHelpers.clean(raw.source),
    selectedTaskId: normalizationHelpers.clean(raw.selectedTaskId),
    selectedTask: coerceWorkboardTask(raw.selectedTask),
    sessions,
    tasks,
    workers: Array.isArray(raw.workers)
      ? raw.workers.map((entry) => {
        const item = normalizationHelpers.record(entry) || {};
        const workerId = normalizationHelpers.clean(item.workerId) || normalizationHelpers.clean(item.id);
        if (!workerId) return null;
        const status = normalizationHelpers.clean(item.status);
        return {
          workerId,
          status: status === 'busy' || status === 'expired' ? status : 'idle',
          currentTaskId: normalizationHelpers.clean(item.currentTaskId),
        };
      }).filter((entry): entry is ZavorthRuntimeWorkboardState['workers'][number] => Boolean(entry))
      : fallback.workers,
    receipts: Array.isArray(raw.receipts)
      ? raw.receipts.map((entry) => {
        const item = normalizationHelpers.record(entry) || {};
        const receiptId = normalizationHelpers.clean(item.receiptId) || normalizationHelpers.clean(item.id);
        if (!receiptId) return null;
        return {
          receiptId,
          action: normalizationHelpers.clean(item.action) || 'workboard-sync',
          taskId: normalizationHelpers.clean(item.taskId),
          workerId: normalizationHelpers.clean(item.workerId),
          status: normalizationHelpers.clean(item.status) || 'applied',
        };
      }).filter((entry): entry is ZavorthRuntimeWorkboardState['receipts'][number] => Boolean(entry)).slice(0, 40)
      : fallback.receipts,
    boards: Array.isArray(raw.boards)
      ? raw.boards.flatMap((entry) => {
        const item = normalizationHelpers.record(entry) || {};
        const id = normalizationHelpers.clean(item.id);
        const name = normalizationHelpers.clean(item.name);
        if (!id || !name) return [];
        const columns: ZavorthRuntimeWorkboardState['boards'][number]['columns'] = Array.isArray(item.columns)
          ? item.columns.flatMap((column, order) => {
            const col = normalizationHelpers.record(column) || {};
            const columnId = normalizationHelpers.clean(col.id);
            const columnName = normalizationHelpers.clean(col.name);
            if (!columnId || !columnName) return [];
            const color = normalizationHelpers.clean(col.color) || undefined;
            return [{
              id: columnId,
              name: columnName,
              order: Number(col.order ?? order) || order,
              ...(color ? { color } : {}),
            }];
          })
          : [];
        return [{
          id,
          name,
          description: normalizationHelpers.clean(item.description),
          columns,
        }];
      })
      : fallback.boards,
    summary: summarizeWorkboardTasks(tasks, sessions.length),
    safety: {
      sqliteDurable: true,
      mutationRequiresApproval: true,
      retryBounded: true,
      spawnDepthBounded: true,
    },
  };
}

export function coerceWorkboardTask(value: unknown): ZavorthRuntimeWorkboardTask | null {
  const raw = normalizationHelpers.record(value);
  if (!raw) return null;
  const taskId = normalizationHelpers.clean(raw.taskId) || normalizationHelpers.clean(raw.id);
  const title = normalizationHelpers.clean(raw.title) || normalizationHelpers.clean(raw.name);
  if (!taskId || !title) return null;
  return {
    taskId,
    sessionId: normalizationHelpers.clean(raw.sessionId) || 'desktop-main',
    parentTaskId: normalizationHelpers.clean(raw.parentTaskId),
    title,
    status: normalizeWorkboardTaskStatus(raw.status),
    risk: normalizationHelpers.clean(raw.risk),
    claimedBy: normalizationHelpers.clean(raw.claimedBy),
    heartbeatAt: normalizationHelpers.clean(raw.heartbeatAt),
    blockedReason: normalizationHelpers.clean(raw.blockedReason),
    summary: normalizationHelpers.clean(raw.summary) || normalizationHelpers.clean(raw.description),
    createdAt: normalizationHelpers.clean(raw.createdAt),
    updatedAt: normalizationHelpers.clean(raw.updatedAt),
  };
}

export function normalizeWorkboardTaskStatus(value: unknown): ZavorthRuntimeWorkboardTaskStatus {
  const status = String(value || '').trim().toLowerCase();
  if (status.includes('block')) return 'blocked';
  if (status.includes('fail')) return 'failed';
  if (status.includes('cancel')) return 'cancelled';
  if (status.includes('complete') || status.includes('done')) return 'completed';
  if (status.includes('claim') || status.includes('review')) return 'claimed';
  if (status.includes('run') || status.includes('doing') || status.includes('progress')) return 'running';
  return 'queued';
}

export function summarizeWorkboardTasks(tasks: ZavorthRuntimeWorkboardTask[], sessions: number): ZavorthRuntimeWorkboardState['summary'] {
  return {
    sessions,
    queued: tasks.filter((task) => task.status === 'queued').length,
    running: tasks.filter((task) => task.status === 'running' || task.status === 'claimed').length,
    completed: tasks.filter((task) => task.status === 'completed').length,
    blocked: tasks.filter((task) => task.status === 'blocked' || task.status === 'failed').length,
  };
}

export function applyWorkboardSync(
  current: ZavorthRuntimeWorkboardState,
  payload: RuntimeRecord,
  meta: { sessionId: string; source: string; now: string; receiptId: string },
): { ok: boolean; workboard?: ZavorthRuntimeWorkboardState; error?: string } {
  const operation = normalizationHelpers.clean(payload.operation) || 'sync-board';
  if (!['upsert-card', 'delete-card', 'sync-board'].includes(operation)) {
    return { ok: false, error: `workboard_operation_unsupported:${operation}` };
  }

  const boardRaw = normalizationHelpers.record(payload.board);
  const boardId = normalizationHelpers.clean(boardRaw?.id) || 'desktop-board';
  const boardName = normalizationHelpers.clean(boardRaw?.name) || 'Desktop Workboard';
  const boardDescription = normalizationHelpers.clean(boardRaw?.description);
  const boardColumns: ZavorthRuntimeWorkboardState['boards'][number]['columns'] = Array.isArray(boardRaw?.columns)
    ? boardRaw!.columns.flatMap((column, order) => {
      const col = normalizationHelpers.record(column) || {};
      const id = normalizationHelpers.clean(col.id);
      const name = normalizationHelpers.clean(col.name);
      if (!id || !name) return [];
      const color = normalizationHelpers.clean(col.color) || undefined;
      return [{
        id,
        name,
        order: Number(col.order ?? order) || order,
        ...(color ? { color } : {}),
      }];
    })
    : (current.boards.find((board) => board.id === boardId)?.columns || []);

  let tasks = [...current.tasks];
  const card = coerceWorkboardTask(payload.card);
  const cards = Array.isArray(payload.cards)
    ? payload.cards.flatMap((candidate) => {
        const normalized = coerceWorkboardTask(candidate);
        return normalized ? [normalized] : [];
      })
    : [];

  const upsertTask = (candidate: ZavorthRuntimeWorkboardTask) => {
    const nextCard: ZavorthRuntimeWorkboardTask = {
      ...candidate,
      sessionId: candidate.sessionId || meta.sessionId,
      updatedAt: meta.now,
      createdAt: candidate.createdAt || meta.now,
    };
    const existingIndex = tasks.findIndex((task) => task.taskId === nextCard.taskId);
    if (existingIndex >= 0) tasks[existingIndex] = { ...tasks[existingIndex], ...nextCard };
    else tasks.push(nextCard);
  };

  if (operation === 'upsert-card') {
    if (!card) return { ok: false, error: 'workboard_card_required' };
    upsertTask(card);
  } else if (operation === 'delete-card') {
    const taskId = card?.taskId || normalizationHelpers.clean(normalizationHelpers.record(payload.card)?.taskId) || normalizationHelpers.clean(normalizationHelpers.record(payload.card)?.id);
    if (!taskId) return { ok: false, error: 'workboard_card_id_required' };
    tasks = tasks.filter((task) => task.taskId !== taskId);
  } else if (operation === 'sync-board') {
    // A full board is applied in one runtime action. This avoids one request per
    // card while retaining the same upsert semantics as the former N+1 flow.
    const incoming = card ? [card, ...cards.filter(item => item.taskId !== card.taskId)] : cards;
    incoming.forEach(upsertTask);
  }

  const sessions = (() => {
    const existing = current.sessions.find((session) => session.sessionId === meta.sessionId);
    const nextSession = {
      sessionId: meta.sessionId,
      objective: boardName,
      status: 'running',
      maxDepth: existing?.maxDepth || 3,
      maxChildren: existing?.maxChildren || 8,
    };
    return [nextSession, ...current.sessions.filter((session) => session.sessionId !== meta.sessionId)].slice(0, 12);
  })();

  const boards = [
    {
      id: boardId,
      name: boardName,
      description: boardDescription,
      columns: boardColumns,
    },
    ...current.boards.filter((board) => board.id !== boardId),
  ].slice(0, 12);

  const selectedTaskId = card?.taskId || current.selectedTaskId;
  const selectedTask = selectedTaskId
    ? tasks.find((task) => task.taskId === selectedTaskId) || null
    : null;

  const receipts = [
    {
      receiptId: meta.receiptId,
      action: `workboard-${operation}`,
      taskId: card?.taskId || null,
      workerId: null,
      status: 'applied',
    },
    ...current.receipts,
  ].slice(0, 40);

  const workboard: ZavorthRuntimeWorkboardState = {
    updatedAt: meta.now,
    source: meta.source,
    selectedTaskId,
    selectedTask,
    sessions,
    tasks: tasks.slice(0, 200),
    workers: current.workers,
    receipts,
    boards,
    summary: summarizeWorkboardTasks(tasks, sessions.length),
    safety: {
      sqliteDurable: true,
      mutationRequiresApproval: true,
      retryBounded: true,
      spawnDepthBounded: true,
    },
  };

  return { ok: true, workboard };
}
