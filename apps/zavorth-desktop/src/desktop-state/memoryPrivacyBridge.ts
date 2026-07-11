/**
 * Desktop bridge for Memory Privacy OS (Mnemos product narrative).
 *
 * Pure mappers so MemoryPanel can show origin + whyIKnowThis without
 * pulling Node-only MemoryPrivacyService / demo store I/O.
 * Mirrors src/contracts/memory/MemoryPrivacyContract.ts + service heuristics.
 */

export type DesktopMemoryPrivacyOrigin =
  | 'conversation'
  | 'skill'
  | 'import'
  | 'dream-cycle'
  | 'user-stated'
  | 'system'
  | 'unknown';

export type DesktopMemoryPrivacyConsent =
  | 'granted'
  | 'implied'
  | 'review'
  | 'unknown';

export type DesktopMemoryPrivacyItemView = {
  id: string;
  title: string;
  summary: string;
  origin: DesktopMemoryPrivacyOrigin;
  originLabel: string;
  whyIKnowThis: string;
  proofEventId: string | null;
  consentState: DesktopMemoryPrivacyConsent;
  canForget: boolean;
  secretLike: boolean;
  createdAt: string | null;
  metadata?: Record<string, unknown>;
};

/** Loose MemoryItem / API shape from desktop home snapshot. */
export type DesktopLooseMemoryItem = {
  id?: string | null;
  key?: string | null;
  title?: string | null;
  summary?: string | null;
  description?: string | null;
  kind?: string | null;
  type?: string | null;
  source?: string | null;
  origin?: string | null;
  content?: string | null;
  contentPreview?: string | null;
  consentState?: string | null;
  proofEventId?: string | null;
  canForget?: boolean | null;
  secretLike?: boolean | null;
  systemCritical?: boolean | null;
  critical?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  expiry?: string | null;
  metadata?: Record<string, unknown> | null;
  receiptId?: string | null;
  [key: string]: unknown;
};

const ORIGIN_LABELS: Record<DesktopMemoryPrivacyOrigin, string> = {
  conversation: 'Conversation',
  skill: 'Skill',
  import: 'Import',
  'dream-cycle': 'Dream cycle',
  'user-stated': 'User stated',
  system: 'System',
  unknown: 'Unknown',
};

const WHY_BY_ORIGIN: Record<DesktopMemoryPrivacyOrigin, string> = {
  conversation: 'Stored from a past conversation in this workspace.',
  skill: 'Captured while running or installing a skill.',
  import: 'Imported from workspace migration or external memory pack.',
  'dream-cycle': 'Learning candidate pending review from the Mnemos dream cycle.',
  'user-stated': 'You explicitly asked Zavorth to remember this.',
  system: 'System-critical memory used for safe operation (not user content).',
  unknown: 'Origin is not fully known; inspect or forget if it should not stay.',
};

const SECRET_PATTERNS: RegExp[] = [
  /\b(api[_-]?key|secret|password|passwd|token|bearer|private[_-]?key|credential)\b/i,
  /\bsk-[a-zA-Z0-9]{10,}\b/,
  /\bAIza[0-9A-Za-z_-]{20,}\b/,
  /-----BEGIN[ A-Z]+PRIVATE KEY-----/,
  /\b[a-fA-F0-9]{40,}\b/,
];

const SYSTEM_CRITICAL_MARKERS = [
  'system-critical',
  'system_critical',
  'bootstrap',
  'identity-core',
  'runtime-identity',
];

export function formatOriginLabel(origin: DesktopMemoryPrivacyOrigin | string): string {
  const key = String(origin || 'unknown').trim().toLowerCase() as DesktopMemoryPrivacyOrigin;
  return ORIGIN_LABELS[key] || ORIGIN_LABELS.unknown;
}

export function formatWhyIKnowThis(
  item: DesktopLooseMemoryItem,
  origin?: DesktopMemoryPrivacyOrigin,
): string {
  const resolved = origin || inferDesktopMemoryOrigin(item);
  const meta = item.metadata && typeof item.metadata === 'object' ? item.metadata : null;
  const custom = meta
    ? (meta.whyIKnowThis ?? meta.why)
    : null;
  if (custom != null && String(custom).trim()) {
    return sanitizeDisplay(String(custom).trim());
  }
  return WHY_BY_ORIGIN[resolved] || WHY_BY_ORIGIN.unknown;
}

export function inferDesktopMemoryOrigin(item: DesktopLooseMemoryItem): DesktopMemoryPrivacyOrigin {
  const hay = [
    item.origin,
    item.source,
    item.kind,
    item.type,
    item.title,
  ].map((v) => String(v || '').toLowerCase()).join(' ');

  if (/\b(user-stated|user_stated|explicit|remember this)\b/.test(hay)) return 'user-stated';
  if (/\b(dream|dream-cycle|dream_cycle|consolidation|mnemos-dream)\b/.test(hay)) return 'dream-cycle';
  if (/\b(skill|skill-memory|skill_memory)\b/.test(hay)) return 'skill';
  if (/\b(import|migrat|wiki-import|external-pack)\b/.test(hay)) return 'import';
  if (/\b(system|bootstrap|identity-core|runtime-identity)\b/.test(hay)) return 'system';
  if (/\b(conversation|chat|session|dialogue|thread)\b/.test(hay)) return 'conversation';
  if (/\bpreferences?\b/.test(hay)) return 'user-stated';
  if (/\b(project-facts?|procedures?|user-model)\b/.test(hay)) return 'conversation';
  return 'unknown';
}

export function detectDesktopSecretLike(item: DesktopLooseMemoryItem): boolean {
  if (item.secretLike === true) return true;
  const kind = String(item.kind || item.type || '').toLowerCase();
  if (/\b(secret|credential|password|token|api[_-]?key)\b/.test(kind)) return true;
  const blobs = [item.title, item.summary, item.description, item.content, item.contentPreview]
    .map((v) => String(v || ''));
  for (const blob of blobs) {
    for (const re of SECRET_PATTERNS) {
      if (re.test(blob)) return true;
    }
  }
  return false;
}

function isSystemCritical(item: DesktopLooseMemoryItem): boolean {
  if (item.systemCritical === true || item.critical === true) return true;
  const hay = [item.kind, item.type, item.origin, item.source, item.title, item.id]
    .map((v) => String(v || '').toLowerCase()).join(' ');
  return SYSTEM_CRITICAL_MARKERS.some((m) => hay.includes(m));
}

function sanitizeDisplay(text: string): string {
  let cleaned = String(text || '');
  cleaned = cleaned.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (cleaned.length > 240) {
    cleaned = `${cleaned.slice(0, 237)}...`;
  }
  return cleaned;
}

/**
 * Map a desktop MemoryItem (or loose memory-like object) into a privacy view.
 */
export function mapMemoryItemToPrivacyView(
  item: DesktopLooseMemoryItem,
  index = 0,
): DesktopMemoryPrivacyItemView {
  const id = String(item.id || item.key || `memory-${index + 1}`).trim() || `memory-${index + 1}`;
  const title = sanitizeDisplay(String(item.title || item.kind || item.type || 'Memory item').trim() || 'Memory item');
  const origin = inferDesktopMemoryOrigin(item);
  const originLabel = formatOriginLabel(origin);
  const whyIKnowThis = formatWhyIKnowThis(item, origin);
  const secretLike = detectDesktopSecretLike(item);
  const rawSummary = String(item.summary || item.description || item.contentPreview || '').trim();
  const summary = secretLike
    ? sanitizeDisplay(rawSummary.replace(/\bsk-[a-zA-Z0-9]{10,}\b/g, '[redacted token]') || 'Sensitive memory (details redacted).')
    : sanitizeDisplay(rawSummary || 'No summary.');

  const systemCritical = isSystemCritical(item);
  const canForget = item.canForget === false || systemCritical
    ? false
    : item.canForget === true
      ? true
      : !systemCritical;

  const consentRaw = String(item.consentState || '').toLowerCase();
  let consentState: DesktopMemoryPrivacyConsent = 'unknown';
  if (consentRaw === 'granted' || consentRaw === 'implied' || consentRaw === 'review' || consentRaw === 'unknown') {
    consentState = consentRaw;
  } else if (origin === 'user-stated') {
    consentState = 'granted';
  } else if (origin === 'dream-cycle') {
    consentState = 'review';
  } else if (origin === 'system' || origin === 'conversation' || origin === 'skill' || origin === 'import') {
    consentState = 'implied';
  }

  const proofEventId = item.proofEventId != null && String(item.proofEventId).trim()
    ? String(item.proofEventId).trim()
    : item.receiptId != null && String(item.receiptId).trim()
      ? String(item.receiptId).trim()
      : null;

  const createdAt = item.createdAt != null && String(item.createdAt).trim()
    ? String(item.createdAt)
    : item.updatedAt != null && String(item.updatedAt).trim()
      ? String(item.updatedAt)
      : null;

  return {
    id,
    title,
    summary,
    origin,
    originLabel,
    whyIKnowThis,
    proofEventId,
    consentState,
    canForget,
    secretLike,
    createdAt,
    ...(item.metadata && typeof item.metadata === 'object' ? { metadata: { ...item.metadata } } : {}),
  };
}

export function mapMemoryItemsToPrivacyViews(
  items: DesktopLooseMemoryItem[] | null | undefined,
): DesktopMemoryPrivacyItemView[] {
  return (items || []).map((item, index) => mapMemoryItemToPrivacyView(item, index));
}
