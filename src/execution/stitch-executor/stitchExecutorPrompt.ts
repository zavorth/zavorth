import { ExecutionRequest } from '../../contracts/ExecutionContract.js';

export function buildStitchProjectTitle(prompt: string, taskId: string): string {
  const safePrompt = prompt.replace(/\s+/g, ' ').trim().slice(0, 48);
  return `Zavorth ${taskId.substring(0, 8)} - ${safePrompt || 'UI generation'}`;
}

export function buildStitchGenerationPrompt(prompt: string, request: ExecutionRequest): string {
  const stripped = stripStitchCommandPrefix(prompt);
  const normalized = stripped.replace(/\r/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const forceCompact = Boolean(
    request.metadata?.stitch_force_compact_prompt || request.metadata?.task_metadata?.stitch_force_compact_prompt,
  );

  if (!forceCompact && normalized.length <= 900) {
    return normalized;
  }

  return buildStructuredStitchBrief(normalized, request, forceCompact);
}

export function buildStitchTimeoutFallbackPrompt(
  prompt: string,
  currentPrompt: string,
  request: ExecutionRequest,
): string {
  const condensed = buildStructuredStitchBrief(stripStitchCommandPrefix(prompt), request, true);
  if (condensed && condensed.length < currentPrompt.length) {
    return condensed;
  }

  return currentPrompt.length > 700 ? currentPrompt.slice(0, 700).trim() : currentPrompt;
}

export function stripStitchCommandPrefix(prompt: string): string {
  return String(prompt || '').replace(/^\/stitch\s+/i, '').trim();
}

export function buildStructuredStitchBrief(
  prompt: string,
  request: ExecutionRequest,
  compact: boolean,
): string {
  const normalized = String(prompt || '').replace(/\r/g, '\n').replace(/\n+/g, '\n').trim();
  const explicitBrand = extractFirstStitchName(normalized) || 'Zavorth';
  const focus =
    extractStitchOpeningIntent(normalized) ||
    'Create an application interface inspired by the concept described by the user.';
  const bullets: string[] = [];

  bullets.push('primary interaction surface for the requested experience');
  bullets.push('clear actions, state, and safety affordances');

  const uniqueBullets = Array.from(new Set(bullets)).slice(0, compact ? 4 : 6);
  const aesthetic = compact ? 'Premium, readable, modern style.'
    : 'Premium modern style, strong identity, clean layout, and clear visual hierarchy.';
  const deviceHint =
    request.metadata?.stitch_device_type || request.metadata?.task_metadata?.stitch_device_type ? `Target device: ${String(request.metadata?.stitch_device_type || request.metadata?.task_metadata?.stitch_device_type).toUpperCase()}.`
      : '';

  const lines = [
    `Create a UI/app inspired by ${explicitBrand}.`,
    focus,
    aesthetic,
    deviceHint,
    uniqueBullets.length > 0 ? 'Include:' : '',
    ...uniqueBullets.map((item) => `- ${item}`),
  ].filter(Boolean);

  return lines.join('\n').trim().slice(0, compact ? 650 : 1100);
}

export function extractFirstStitchName(prompt: string): string | null {
  const match = String(prompt || '').match(/\b([A-Z][A-Za-z0-9_-]{2,30})\s*[:\-]/);
  return match?.[1]?.trim() || null;
}

export function extractStitchOpeningIntent(prompt: string): string | null {
  const firstLine = String(prompt || '')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return null;
  }

  const cleaned = firstLine
    .replace(/^\/stitch\s+/i, '')
    .trim();

  return cleaned || null;
}
