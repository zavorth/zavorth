import type { UniversalMemorySignal, UniversalToolRiskLevel } from './UniversalAgentRuntimeTypes.js';
import type { AgentSelfConfigCard, AgentSelfConfigSectionId } from './AgentSelfConfigService.js';

export type LooseRecord = Record<string, unknown>;

export function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

export function normalizeKey(value: unknown, fallback = 'item'): string {
  return normalizeText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
}

export function recordOrNull(value: unknown): LooseRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as LooseRecord
    : null;
}

export function listRecords(value: unknown): LooseRecord[] {
  return Array.isArray(value)
    ? value.flatMap((entry) => {
      const record = recordOrNull(entry);
      return record ? [record] : [];
    })
    : [];
}

export function listStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.map((entry) => normalizeText(entry)).filter(Boolean)));
}

export function clampConfidence(value: unknown, fallback = 0.72): number {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  if (number <= 0) {
    return 0;
  }
  if (number >= 1) {
    return 1;
  }
  return Number(number.toFixed(2));
}

export function redactAndShorten(value: unknown, fallback: string, maxLength = 220): string {
  const text = normalizeText(value, fallback)
    .replace(/((?:api[_-]?key|token|secret|password)\s*[:=]\s*)\S+/gi, '$1[redacted]')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

export function normalizeMemoryLayer(value: unknown): UniversalMemorySignal['layer'] {
  const raw = normalizeText(value).toLowerCase();
  if (raw === 'episodic' || raw === 'semantic' || raw === 'procedural' || raw === 'working') {
    return raw;
  }
  return 'working';
}

export function normalizeRisk(value: unknown): UniversalToolRiskLevel {
  const raw = normalizeText(value).toLowerCase();
  if (raw === 'safe' || raw === 'attention' || raw === 'danger' || raw === 'unknown') {
    return raw;
  }
  return 'unknown';
}

export function sourceRefFromIdentityFile(file: LooseRecord): string | null {
  return normalizeText(file.path)
    || normalizeText(file.source)
    || normalizeText(file.ref)
    || null;
}

export function sectionFromIdentityFile(path: string): AgentSelfConfigSectionId {
  const fileName = path.split(/[\\/]/).pop()?.toUpperCase() || path.toUpperCase();
  if (fileName.includes('USER')) {
    return 'user';
  }
  if (fileName.includes('TOOLS')) {
    return 'environment';
  }
  if (fileName.includes('MEMORY')) {
    return 'memory';
  }
  if (fileName.includes('TONE')) {
    return 'tone';
  }
  return 'identity';
}

export function titleFromIdentityFile(path: string): string {
  const fileName = path.split(/[\\/]/).pop()?.toUpperCase() || path.toUpperCase();
  if (fileName.includes('SOUL')) {
    return 'SOUL.md';
  }
  if (fileName.includes('IDENTITY')) {
    return 'IDENTITY.md';
  }
  if (fileName.includes('USER')) {
    return 'USER.md';
  }
  if (fileName.includes('TOOLS')) {
    return 'TOOLS.md';
  }
  if (fileName.includes('MEMORY')) {
    return 'MEMORY.md';
  }
  return path.split(/[\\/]/).pop() || 'Identity file';
}

export function cardActions(section: AgentSelfConfigSectionId, cardId: string): AgentSelfConfigCard['actions'] {
  return {
    reviewCommand: `zavorth selfing review ${section}`,
    previewCommand: `zavorth selfing preview ${section} ${cardId}`,
    historyCommand: `zavorth selfing history ${section}`,
  };
}

export function uniqueCards(cards: AgentSelfConfigCard[]): AgentSelfConfigCard[] {
  const seen = new Set<string>();
  return cards.filter((card) => {
    if (seen.has(card.id)) {
      return false;
    }
    seen.add(card.id);
    return true;
  });
}
