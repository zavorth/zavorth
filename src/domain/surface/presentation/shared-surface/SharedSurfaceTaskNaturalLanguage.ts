/**
 * Shared helpers for task-id / keyword matching used by slash task control.
 * Free-text intent parsers were removed (agent-first).
 */

export function extractRecentTaskContextKeywords(rawText: string): string[] {
  const taskReferenceMatch = String(rawText || '').match(
    /^task:\s*(.+)$/i,
  );
  if (taskReferenceMatch?.[1]) {
    return extractWorkflowSearchKeywords(taskReferenceMatch[1]);
  }
  return [];
}

export function extractWorkflowSearchKeywords(text: string): string[] {
  const normalized = normalizeNaturalTaskText(text);
  return normalized ? [normalized].slice(0, 1) : [];
}

export function normalizeNaturalTaskText(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}
