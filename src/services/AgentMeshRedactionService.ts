export function sanitizeAgentMeshText(value: unknown): string {
  return cleanText(value, '')
    .replace(/https?:\/\/\S+/gi, '[url-redacted]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[email-redacted]')
    .replace(/\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*['"]...[^,'"\s]+/gi, '[secret-redacted]')
    .replace(/secret-ref:[a-z0-9_.:-]+/gi, 'secret-ref:[redacted]')
    .slice(0, 280);
}

function cleanText(value: unknown, fallback: string): string {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}
