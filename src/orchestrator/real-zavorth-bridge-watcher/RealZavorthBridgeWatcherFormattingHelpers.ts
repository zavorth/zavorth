import type { FinalResponseFormattingService } from '../../services/FinalResponseFormattingService.js';
import {
  doesZavorthBridgeUiResponseMatchPrompt,
  isZavorthBridgeUiResponseReadyForDelivery,
  isZavorthBridgeUiSurfaceReady,
  normalizeZavorthBridgeUiText,
  sanitizeZavorthBridgeUiResponse,
} from '../../services/ZavorthBridgeUiResponseHeuristics.js';
import type { ZavorthBridgeArtifact } from './RealZavorthBridgeWatcherArtifactLogHelpers.js';
import type { PendingZavorthBridgeSession } from '../AgentBridgeManager.js';
import type { ZavorthBridgeUiSnapshot } from '../../services/ZavorthBridgeUiCaptureService.js';
import { logger } from '../../logger.js';

export function normalizeVisibleResponse(value: string | null | undefined): string {
  return normalizeZavorthBridgeUiText(value);
}

export function sanitizeVisibleResponse(value: string | null | undefined, promptText: string | null | undefined): string {
  return sanitizeZavorthBridgeUiResponse(value, promptText);
}

export function isVisibleResponseCaptureReady(
  snapshot: ZavorthBridgeUiSnapshot,
  visibleResponse: string,
  promptText: string | null | undefined,
): boolean {
  return (
    isZavorthBridgeUiSurfaceReady(snapshot) &&
    isZavorthBridgeUiResponseReadyForDelivery(snapshot, visibleResponse) &&
    doesZavorthBridgeUiResponseMatchPrompt(visibleResponse, promptText)
  );
}

export function formatFinalResponseBroadcast(
  formatter: FinalResponseFormattingService,
  session: PendingZavorthBridgeSession,
  content: string,
  source: string,
): string {
  const formattedContent = formatTelegramFriendlyResponse(session, content);
  return formatter.formatZavorthBridgeCompletion({
    shortId: session.taskId.substring(0, 8),
    source,
    content: truncate(formattedContent, 3200),
  });
}

export function formatArtifactCompletion(
  formatter: FinalResponseFormattingService,
  session: PendingZavorthBridgeSession,
  artifact: ZavorthBridgeArtifact,
): string {
  return formatter.formatZavorthBridgeCompletion({
    shortId: session.taskId.substring(0, 8),
    source: humanizeArtifactType(artifact.artifactType),
    summary: artifact.summary,
    content: truncate(artifact.content, 3200),
  });
}

export function humanizeArtifactType(artifactType: string): string {
  switch (artifactType) {
    case 'ARTIFACT_TYPE_WALKTHROUGH':
      return 'Walkthrough';
    case 'ARTIFACT_TYPE_IMPLEMENTATION_PLAN':
      return 'Implementation Plan';
    case 'ARTIFACT_TYPE_TASK':
      return 'Task';
    default:
      return artifactType.replace(/^ARTIFACT_TYPE_/i, '').replace(/_/g, ' ');
  }
}

export function truncate(content: string, maxLength: number): string {
  if (content.length <= maxLength) {
    return content;
  }

  return `${content.slice(0, maxLength)}\n[...]`;
}

export function formatTelegramFriendlyResponse(
  session: PendingZavorthBridgeSession,
  content: string,
): string {
  const normalized = normalizeTelegramFriendlyText(content);
  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !isDiscardableZavorthBridgeClosingLine(line));

  while (lines.length > 0 && /^[):\]\[>.-]+$/.test(lines[0] || '')) {
    lines.shift();
  }

  if (lines.length === 0) {
    return normalized.trim();
  }

  const structuredInventory = tryFormatStructuredInventory(session, lines);
  if (structuredInventory) {
    return structuredInventory;
  }

  return lines.join('\n').trim();
}

export function tryFormatStructuredInventory(
  session: PendingZavorthBridgeSession,
  lines: string[],
): string | null {
  const prompt = normalizeZavorthBridgeUiText(session.prompt);
  const inventoryHint =
    prompt.includes('pasta') ||
    prompt.includes('diretorio') ||
    prompt.includes('directory') ||
    prompt.includes('folder') ||
    prompt.includes('arquivo') ||
    prompt.includes('file');

  const groups: Array<{ heading: string; items: string[] }> = [];
  const prose: string[] = [];
  let currentGroup: { heading: string; items: string[] } | null = null;

  for (const line of lines) {
    const heading = extractInventoryHeading(line);
    if (heading) {
      if (currentGroup && currentGroup.items.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = { heading, items: [] };
      continue;
    }

    const item = extractInventoryItem(line);
    if (item) {
      if (!currentGroup) {
        currentGroup = { heading: 'Found items', items: [] };
      }
      currentGroup.items.push(item);
      continue;
    }

    if (currentGroup && currentGroup.items.length > 0) {
      groups.push(currentGroup);
      currentGroup = null;
    }
    prose.push(line);
  }

  if (currentGroup && currentGroup.items.length > 0) {
    groups.push(currentGroup);
  }

  const totalItems = groups.reduce((acc, group) => acc + group.items.length, 0);
  if (!inventoryHint && totalItems < 3) {
    return null;
  }

  if (totalItems === 0) {
    return null;
  }

  const linesOut: string[] = [];
  if (prose.length > 0) {
    linesOut.push(...prose, '');
  } else if (inventoryHint) {
    linesOut.push('Found content:', '');
  }

  groups.forEach((group, index) => {
    linesOut.push(`${group.heading}:`);
    group.items.forEach((item) => {
      linesOut.push(`- \`${item}\``);
    });
    if (index < groups.length - 1) {
      linesOut.push('');
    }
  });

  return linesOut.join('\n').trim();
}

export function extractInventoryHeading(line: string): string | null {
  const trimmed = String(line || '').trim();
  if (!trimmed || !trimmed.endsWith(':')) {
    return null;
  }

  const candidate = trimmed.slice(0, -1).trim();
  if (!candidate || candidate.length > 80) {
    return null;
  }

  const normalized = normalizeZavorthBridgeUiText(candidate);
  if (looksLikeInventoryItem(candidate)) {
    return null;
  }

  if (normalized === 'arquivos de texto/log') {
    return 'Text and log files';
  }

  if (normalized === 'arquivos de texto e log') {
    return 'Text and log files';
  }

  if (normalized === 'pastas e scripts') {
    return 'Folders and scripts';
  }

  return candidate.charAt(0).toUpperCase() + candidate.slice(1);
}

export function extractInventoryItem(line: string): string | null {
  const trimmed = String(line || '').trim();
  if (!trimmed) {
    return null;
  }

  const taggedMatch = trimmed.match(/^[-*\u2022]\s+\[(DIR|FILE|OTHER)\]\s+(.+)$/i);
  if (taggedMatch) {
    return taggedMatch[2].trim();
  }

  if (!looksLikeInventoryItem(trimmed)) {
    return null;
  }

  return trimmed.replace(/^[-*\u2022]\s+/, '').trim();
}

export function looksLikeInventoryItem(line: string): boolean {
  const trimmed = String(line || '').trim();
  if (!trimmed) {
    return false;
  }

  if (/^[-*\u2022]\s+\[(DIR|FILE|OTHER)\]\s+/i.test(trimmed)) {
    return true;
  }

  if (/^[):\]\[>.-]+$/.test(trimmed)) {
    return false;
  }

  if (trimmed.length > 120) {
    return false;
  }

  if (/[?!]$/.test(trimmed)) {
    return false;
  }

  if (/\s{2,}/.test(trimmed)) {
    return false;
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length > 4) {
    return false;
  }

  if (/^[A-Za-z]:[\\/]/.test(trimmed)) {
    return true;
  }

  if (/^[./\\][\w .-]+$/.test(trimmed)) {
    return true;
  }

  if (/^[\w .-]+\.[A-Za-z0-9_-]{1,12}$/.test(trimmed)) {
    return true;
  }

  if (/^[\w .-]+$/.test(trimmed) && !/\s/.test(trimmed)) {
    return true;
  }

  return false;
}

export function isDiscardableZavorthBridgeClosingLine(line: string): boolean {
  const normalized = normalizeZavorthBridgeUiText(line);
  if (!normalized) {
    return true;
  }

  return [
    'se precisar de detalhes',
    'if you need more details',
    'fico a disposicao',
    'estou a disposicao',
    'i am available',
  ].some((pattern) => normalized.startsWith(pattern));
}

export function normalizeTelegramFriendlyText(value: string): string {
  let normalized = String(value || '').replace(/\r\n/g, '\n').trim();

  if (/[\u00c3\u00c2]/.test(normalized) && !/\uFFFD/.test(normalized)) {
    try {
      const decoded = Buffer.from(normalized, 'latin1').toString('utf8');
      if (decoded && decoded.includes(' ') && !decoded.includes('\u00c3')) {
        normalized = decoded;
      }
    } catch (error: any) { const err = error; const e = error;
      // Ignore decode failures and keep original text.
      logger.warn('[Real Zavorth Bridge Watcher Formatting Helpers] encoding failed', error);
    }
  }

  return normalized;
}
