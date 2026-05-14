export function normalizeNaturalText(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

const WORKFLOW_SEARCH_STOP_WORDS = new Set([
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
]);

export function extractWorkflowSearchKeywords(text: string): string[] {
  const normalized = normalizeNaturalText(text);
  return Array.from(
    new Set(
      normalized
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3 && !WORKFLOW_SEARCH_STOP_WORDS.has(token)),
    ),
  ).slice(0, 6);
}
