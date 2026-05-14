import type { WorkspaceTaskKind } from '../WorkspaceTaskKind.js';

export function normalizeExecutor(value: unknown): string | null {
  const normalized = String(value || '').trim().toLowerCase();
  const allowed = new Set([
    'codex',
    'external_executor',
    'gemini_cli',
    'aistudio',
    'jules',
    'stitch',
    'zavorthBridge',
    'web_research',
  ]);

  return allowed.has(normalized) ? normalized : null;
}

export function formatDurationMs(value: number): string {
  const totalMs = Math.max(0, Math.round(Number(value || 0)));
  if (!totalMs) {
    return '0s';
  }
  const totalMinutes = Math.round(totalMs / 60000);
  if (totalMinutes < 1) {
    return `${Math.max(1, Math.round(totalMs / 1000))}s`;
  }
  if (totalMinutes < 60) {
    return `${totalMinutes}min`;
  }
  const hours = totalMinutes / 60;
  if (hours < 24) {
    return `${hours.toFixed(hours >= 10 ? 0 : 1)}h`;
  }
  const days = hours / 24;
  return `${days.toFixed(days >= 10 ? 0 : 1)}d`;
}

export function getProfileExecutor(preferredExecutors: Record<string, any>, kind: WorkspaceTaskKind): string | null {
  if (kind === 'code') {
    return normalizeExecutor(preferredExecutors.code_editing);
  }
  if (kind === 'research') {
    return normalizeExecutor(preferredExecutors.research);
  }
  if (kind === 'design') {
    return normalizeExecutor(preferredExecutors.design);
  }
  if (kind === 'automation') {
    return normalizeExecutor(preferredExecutors.automation);
  }
  return null;
}
