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
  const lower = normalized
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const titleMatch = normalized.match(/(?:assistente|produto|app|aplicativo|site)\s*[:\-]\s*([^\n]+)/i);
  const explicitBrand = titleMatch?.[1]?.trim() || extractFirstStitchName(normalized) || 'Zavorth';
  const focus =
    extractStitchOpeningIntent(normalized) ||
    'Create an application interface inspired by the concept described by the user.';
  const bullets: string[] = [];

  if (/\b(chat|conversa|telegram|mensagens?)\b/.test(lower)) bullets.push('chat principal para conversar com o assistente');
  if (/\b(orquestra|llm|modelos?|gemini|openai|claude|deepseek|external-executor|zavorthBridge)\b/.test(lower)) bullets.push('hub de orquestracao de agentes e modelos');
  if (/\b(permiss|secur|policy|trustedboundary|approv)\b/.test(lower)) bullets.push('clear permissions and security panel');
  if (/\b(memoria|memory|audit|auditoria|log)\b/.test(lower)) bullets.push('blocos para memoria, auditoria e historico');
  if (/\b(wsl|sistema|terminal|execu|automation|automacao|host supervisor|supervisionado)\b/.test(lower)) bullets.push('cards de automacao e controle do sistema');
  if (/\b(zavorthControl|web|site|premium|glass|glassmorphism)\b/.test(lower)) bullets.push('premium modern visual layout');

  const uniqueBullets = Array.from(new Set(bullets)).slice(0, compact ? 4 : 6);
  const aesthetic = compact
    ? 'Premium, readable, modern style.'
    : 'Estilo premium e moderno, com identidade forte, layout limpo e boa hierarquia visual.';
  const deviceHint =
    request.metadata?.stitch_device_type || request.metadata?.task_metadata?.stitch_device_type
      ? `Dispositivo alvo: ${String(request.metadata?.stitch_device_type || request.metadata?.task_metadata?.stitch_device_type).toUpperCase()}.`
      : '';

  const lines = [
    `Crie uma UI/app inspirado em ${explicitBrand}.`,
    focus,
    aesthetic,
    deviceHint,
    uniqueBullets.length > 0 ? 'Inclua:' : '',
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
    .replace(/^gere\s+/i, 'Crie ')
    .replace(/^crie\s+/i, 'Crie ')
    .trim();

  return cleaned || null;
}
