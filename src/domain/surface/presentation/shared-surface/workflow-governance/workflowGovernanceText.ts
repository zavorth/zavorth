export function normalizeNaturalText(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function extractWorkflowSearchKeywords(text: string): string[] {
  const normalized = normalizeNaturalText(text);
  return normalized ? [normalized].slice(0, 1) : [];
}
