/**
 * Shared helpers for task-id / keyword matching used by slash task control.
 * Free-text intent parsers were removed (agent-first).
 */

export function extractRecentTaskContextKeywords(rawText: string): string[] {
  const taskReferenceMatch = String(rawText || '').match(
    /\b(?:task|tarefa|trabalho|pedido)(?:\s+(?:de|do|da|para|sobre))\s+(.+)$/i,
  );
  if (taskReferenceMatch?.[1]) {
    return extractWorkflowSearchKeywords(taskReferenceMatch[1]);
  }
  return [];
}

export function extractWorkflowSearchKeywords(text: string): string[] {
  const normalized = normalizeNaturalTaskText(text);
  return Array.from(
    new Set(
      normalized
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(
          (token) =>
            token.length >= 3 &&
            ![
              'workflow',
              'retomar',
              'retome',
              'resume',
              'continuar',
              'continue',
              'ultimo',
              'ultima',
              'anterior',
              'mais',
              'recente',
              'sobre',
              'para',
              'de',
              'do',
              'da',
              'com',
              'sem',
              'uma',
              'uns',
              'umas',
              'dos',
              'das',
              'que',
            ].includes(token),
        ),
    ),
  ).slice(0, 6);
}

export function normalizeNaturalTaskText(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}
