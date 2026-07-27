/**
 * Memory Privacy OS - product narrative over Mnemos / dream / forget.
 *
 * Answers: What does it remember... Why... Forget it.
 * Does not replace MnemosDreamCycleService or product memory stores.
 * Forget records a proof event and can mark demo-store items; live wipe
 * only happens when a storage wire is provided by the host.
 */

import fs from 'node:fs';
import path from 'node:path';

import {
  MEMORY_PRIVACY_CONTRACT_VERSION,
  type MemoryPrivacyConsentState,
  type MemoryPrivacyDreamCandidateView,
  type MemoryPrivacyItemView,
  type MemoryPrivacyOrigin,
  type MemoryPrivacySnapshot,
} from '../../contracts/memory/MemoryPrivacyContract.js';
import type { ProofEventAppendInput } from '../proof/ProofLedgerService.js';

/** Loose memory-like row from desktop, Mnemos, wiki, or demo seed. */
export type LooseMemoryItem = {
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
  consent?: string | null;
  proofEventId?: string | null;
  canForget?: boolean | null;
  secretLike?: boolean | null;
  systemCritical?: boolean | null;
  critical?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  expiry?: string | null;
  metadata?: Record<string, unknown> | null;
  forgotten?: boolean | null;
  [key: string]: unknown;
};

/** Loose learning / dream-cycle candidate. */
export type LooseLearningCandidate = {
  id?: string | null;
  candidateId?: string | null;
  title?: string | null;
  kind?: string | null;
  lane?: string | null;
  status?: string | null;
  needsReview?: boolean | null;
  summary?: string | null;
  [key: string]: unknown;
};

export type MemoryPrivacyDemoStore = {
  version: typeof MEMORY_PRIVACY_CONTRACT_VERSION;
  items: Array<LooseMemoryItem & { id: string; forgotten?: boolean }>;
  learning: LooseLearningCandidate[];
  updatedAt: string;
};

export type MemoryPrivacyServiceOptions = {
  now?: () => Date;
  idFactory?: (prefix: string) => string;
  demoStorePath?: string | null;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
};

const ORIGIN_LABELS: Record<MemoryPrivacyOrigin, string> = {
  conversation: 'Conversation',
  skill: 'Skill',
  import: 'Import',
  'dream-cycle': 'Dream cycle',
  'user-stated': 'User stated',
  system: 'System',
  unknown: 'Unknown',
};

const WHY_BY_ORIGIN: Record<MemoryPrivacyOrigin, string> = {
  conversation: 'Stored from a past conversation in this workspace.',
  skill: 'Captured while running or installing a skill.',
  import: 'Imported from workspace migration or external memory pack.',
  'dream-cycle': 'Learning candidate proposed by the Mnemos dream cycle.',
  'user-stated': 'You explicitly asked Zavorth to remember this.',
  system: 'System-critical memory used for safe operation (not user content).',
  unknown: 'Origin is not fully known; inspect or forget if it should not stay.',
};

/** Patterns that suggest secret-like content without echoing values. */
const SECRET_PATTERNS: RegExp[] = [
  /\b(api[_-]...key|secret|password|passwd|token|bearer|private[_-]...key|credential)\b/i,
  /\bsk-[a-zA-Z0-9]{10,}\b/,
  /\bAIza[0-9A-Za-z_-]{20,}\b/,
  /-----BEGIN[ A-Z]+PRIVATE KEY-----/,
  /\b[a-fA-F0-9]{40,}\b/,
  /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/i,
  /\bghp_[0-9A-Za-z]{20,}\b/,
];

const SYSTEM_CRITICAL_MARKERS = [
  'system-critical',
  'system_critical',
  'critical-system',
  'bootstrap',
  'identity-core',
  'runtime-identity',
];

export function defaultMemoryPrivacyDemoPath(cwd: string = process.cwd()): string {
  return path.join(cwd, '.zavorth', 'memory-privacy-demo.json');
}

export class MemoryPrivacyService {
  private readonly now: () => Date;
  private readonly idFactory: (prefix: string) => string;
  private readonly demoStorePath: string | null;
  private readonly existsSync: typeof fs.existsSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private sequence = 0;

  constructor(options: MemoryPrivacyServiceOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.idFactory = options.idFactory
      ?? ((prefix) => `${prefix}-${this.now().getTime().toString(36)}-${++this.sequence}`);
    this.demoStorePath = options.demoStorePath === undefined
      ? defaultMemoryPrivacyDemoPath(process.cwd())
      : options.demoStorePath;
    this.existsSync = options.existsSync || fs.existsSync.bind(fs);
    this.mkdirSync = options.mkdirSync || fs.mkdirSync.bind(fs);
    this.readFileSync = options.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = options.writeFileSync || fs.writeFileSync.bind(fs);
  }

  public fromLooseItems(items: LooseMemoryItem[] | null | undefined): MemoryPrivacyItemView[] {
    const list = Array.isArray(items) ? items : [];
    const views: MemoryPrivacyItemView[] = [];
    let index = 0;
    for (const raw of list) {
      if (!raw || typeof raw !== 'object') continue;
      if (raw.forgotten === true) continue;
      views.push(this.mapLooseItem(raw, index));
      index += 1;
    }
    return views;
  }

  public fromLearningCandidates(
    learning: LooseLearningCandidate[] | null | undefined,
  ): MemoryPrivacyDreamCandidateView[] {
    const list = Array.isArray(learning) ? learning : [];
    return list
      .filter((c) => c && typeof c === 'object')
      .map((c, i) => {
        const id = String(c.id || c.candidateId || `learning-${i + 1}`).trim() || `learning-${i + 1}`;
        const title = String(c.title || c.kind || 'Learning candidate').trim() || 'Learning candidate';
        const lane = c.lane != null && String(c.lane).trim() ? String(c.lane).trim() : undefined;
        const status = String(c.status || '').toLowerCase();
        const needsReview = c.needsReview === true
          || status === 'review'
          || status === 'pending'
          || status === 'yellow'
          || lane === 'yellow'
          || lane === 'red'
          || !lane
          || lane === 'unknown';
        return {
          id,
          title,
          ...(lane ? { lane } : {}),
          needsReview: Boolean(needsReview),
        };
      });
  }

  public buildSnapshot(input: {
    items?: LooseMemoryItem[] | null;
    learning?: LooseLearningCandidate[] | null;
  } = {}): MemoryPrivacySnapshot {
    const items = this.fromLooseItems(input.items);
    const dreamCandidates = this.fromLearningCandidates(input.learning);
    const forgettable = items.filter((i) => i.canForget).length;
    const reviewQueue = items.filter((i) => i.consentState === 'review').length
      + dreamCandidates.filter((c) => c.needsReview).length;
    const secretLike = items.filter((i) => i.secretLike).length;

    let nextSafeAction: string;
    if (items.length === 0 && dreamCandidates.length === 0) {
      nextSafeAction = 'Seed demo memories or open the desktop Memory panel to inspect what Zavorth remembers.';
    } else if (reviewQueue > 0) {
      nextSafeAction = 'Review learning candidates and consent-review items before they become lasting memory.';
    } else if (secretLike > 0) {
      nextSafeAction = 'Inspect secret-like flags and forget any item that should not be retained.';
    } else if (forgettable > 0) {
      nextSafeAction = 'Use explain <id> to see why an item exists, or forget <id> --yes to record a forget proof event.';
    } else {
      nextSafeAction = 'All visible items are system-critical or already reviewed. Nothing safe to forget right now.';
    }

    return {
      contractVersion: MEMORY_PRIVACY_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      items,
      dreamCandidates,
      summary: {
        total: items.length,
        forgettable,
        reviewQueue,
        secretLike,
      },
      nextSafeAction,
    };
  }

  /**
   * Build append input for ProofLedgerService (kind=memory, title "Memory forgotten").
   * Does not append by itself; caller decides whether to persist.
   */
  public buildForgetProofEvent(
    item: MemoryPrivacyItemView | LooseMemoryItem,
    decidedBy?: string | null,
  ): ProofEventAppendInput {
    const view = isPrivacyView(item) ? item : this.mapLooseItem(item as LooseMemoryItem, 0);
    const who = String(decidedBy || 'owner').trim() || 'owner';
    const secretNote = view.secretLike ? ' Item was flagged secret-like; raw secret values are not recorded in this receipt.'
      : '';
    return {
      runId: null,
      kind: 'memory',
      surface: 'cli',
      title: 'Memory forgotten',
      summary: `Memory "${view.title}" (${view.id}) forgotten by ${who}. Origin: ${view.origin}.${secretNote}`,
      status: 'ok',
      riskLevel: view.secretLike ? 'medium' : 'low',
      approvalId: null,
      artifacts: [
        {
          id: view.id,
          type: 'memory-item',
          label: view.title,
        },
      ],
      source: 'memory-privacy-os',
      metadata: {
        memoryId: view.id,
        origin: view.origin,
        consentState: view.consentState,
        secretLike: view.secretLike,
        decidedBy: who,
        action: 'forget',
        // Never include raw content or secret values in proof metadata.
      },
    };
  }

  public toMarkdown(snapshot: MemoryPrivacySnapshot): string {
    const lines: string[] = [];
    lines.push('# Zavorth Memory Privacy');
    lines.push('');
    lines.push(`- contract: ${snapshot.contractVersion}`);
    lines.push(`- generatedAt: ${snapshot.generatedAt}`);
    lines.push(`- total: ${snapshot.summary.total}`);
    lines.push(`- forgettable: ${snapshot.summary.forgettable}`);
    lines.push(`- reviewQueue: ${snapshot.summary.reviewQueue}`);
    lines.push(`- secretLike: ${snapshot.summary.secretLike}`);
    lines.push(`- nextSafeAction: ${snapshot.nextSafeAction}`);
    lines.push('');
    lines.push('## What it remembers');
    if (snapshot.items.length === 0) {
      lines.push('- none');
    } else {
      for (const item of snapshot.items) {
        const flags = [
          item.canForget ? 'forgettable' : 'locked',
          item.secretLike ? 'secret-like' : null,
          item.consentState,
        ].filter(Boolean).join(', ');
        lines.push(`- **${item.title}** - \`${item.id}\` - ${item.originLabel} - ${flags}`);
        lines.push(`  - why: ${item.whyIKnowThis}`);
        if (item.summary) {
          lines.push(`  - summary: ${item.summary}`);
        }
      }
    }
    lines.push('');
    lines.push('## Dream / learning candidates');
    if (snapshot.dreamCandidates.length === 0) {
      lines.push('- none');
    } else {
      for (const c of snapshot.dreamCandidates) {
        const lane = c.lane ? ` ? lane=${c.lane}` : '';
        const review = c.needsReview ? ' ? needs review' : '';
        lines.push(`- **${c.title}** - \`${c.id}\`${lane}${review}`);
      }
    }
    lines.push('');
    return lines.join('\n');
  }

  public toJson(snapshot: MemoryPrivacySnapshot): string {
    return JSON.stringify(snapshot, null, 2);
  }

  // Demo store (list/explain/forget without live memory backend)

  public loadDemoStore(): MemoryPrivacyDemoStore | null {
    if (!this.demoStorePath || !this.existsSync(this.demoStorePath)) {
      return null;
    }
    try {
      const raw = JSON.parse(this.readFileSync(this.demoStorePath, 'utf8')) as MemoryPrivacyDemoStore;
      if (!raw || typeof raw !== 'object' || !Array.isArray(raw.items)) {
        return null;
      }
      return {
        version: MEMORY_PRIVACY_CONTRACT_VERSION,
        items: raw.items.map((i) => ({ ...i })),
        learning: Array.isArray(raw.learning) ? raw.learning.map((c) => ({ ...c })) : [],
        updatedAt: String(raw.updatedAt || this.now().toISOString()),
      };
    } catch {
      return null;
    }
  }

  public saveDemoStore(store: MemoryPrivacyDemoStore): void {
    if (!this.demoStorePath) {
      throw new Error('Demo store path is not configured.');
    }
    this.mkdirSync(path.dirname(this.demoStorePath), { recursive: true });
    const payload: MemoryPrivacyDemoStore = {
      version: MEMORY_PRIVACY_CONTRACT_VERSION,
      items: store.items.map((i) => ({ ...i })),
      learning: (store.learning || []).map((c) => ({ ...c })),
      updatedAt: this.now().toISOString(),
    };
    this.writeFileSync(this.demoStorePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }

  public seedDemo(): MemoryPrivacyDemoStore {
    const ts = this.now().toISOString();
    const store: MemoryPrivacyDemoStore = {
      version: MEMORY_PRIVACY_CONTRACT_VERSION,
      updatedAt: ts,
      items: [
        {
          id: 'mem-demo-pref-tabs',
          title: 'Prefer tabs over spaces',
          summary: 'Owner prefers tab indentation in this workspace.',
          kind: 'preference',
          origin: 'user-stated',
          consentState: 'granted',
          createdAt: ts,
        },
        {
          id: 'mem-demo-stack-postgres',
          title: 'Project uses Postgres',
          summary: 'Architecture note: primary database is Postgres, not SQLite for prod.',
          kind: 'project-fact',
          source: 'conversation',
          createdAt: ts,
        },
        {
          id: 'mem-demo-skill-deploy',
          title: 'Deploy skill notes',
          summary: 'Notes captured while running the deploy skill.',
          kind: 'skill-memory',
          source: 'skill',
          createdAt: ts,
        },
        {
          id: 'mem-demo-import-wiki',
          title: 'Imported wiki topic: networking',
          summary: 'Topic imported from an external memory pack.',
          kind: 'import',
          origin: 'import',
          createdAt: ts,
        },
        {
          id: 'mem-demo-secret-flag',
          title: 'API credential hint',
          // Intentionally includes a secret-like token pattern for redaction tests;
          // service must flag secretLike and never echo the raw value in views.
          summary: 'Rotated token reference for vendor integration (value redacted).',
          content: 'api_key=sk-demoSECRETVALUE0001',
          kind: 'secret-reference',
          origin: 'conversation',
          createdAt: ts,
        },
        {
          id: 'mem-demo-system-identity',
          title: 'Runtime identity core',
          summary: 'Local identity markers for safe session continuity.',
          kind: 'system',
          origin: 'system',
          systemCritical: true,
          canForget: false,
          createdAt: ts,
        },
      ],
      learning: [
        {
          id: 'learn-demo-short-answers',
          title: 'Prefer short answers by default',
          lane: 'yellow',
          status: 'pending',
          kind: 'preference',
        },
        {
          id: 'learn-demo-green-lane',
          title: 'Use conventional commits',
          lane: 'green',
          status: 'approved',
          kind: 'procedure',
        },
      ],
    };
    this.saveDemoStore(store);
    return store;
  }

  public buildSnapshotFromDemo(): MemoryPrivacySnapshot {
    const store = this.loadDemoStore();
    if (!store) {
      return this.buildSnapshot({ items: [], learning: [] });
    }
    const active = store.items.filter((i) => !i.forgotten);
    return this.buildSnapshot({ items: active, learning: store.learning });
  }

  public explainFromDemo(id: string): MemoryPrivacyItemView | null {
    const store = this.loadDemoStore();
    if (!store) return null;
    const found = store.items.find((i) => i.id === id && !i.forgotten);
    if (!found) return null;
    return this.mapLooseItem(found, 0);
  }

  /**
   * Mark demo item forgotten. Returns the privacy view + proof append input.
   * Does not wipe live Mnemos product stores.
   */
  public forgetInDemo(
    id: string,
    decidedBy?: string | null,
  ): { item: MemoryPrivacyItemView; proof: ProofEventAppendInput } | null {
    const store = this.loadDemoStore();
    if (!store) return null;
    const found = store.items.find((i) => i.id === id && !i.forgotten);
    if (!found) return null;
    const view = this.mapLooseItem(found, 0);
    if (!view.canForget) {
      return null;
    }
    found.forgotten = true;
    this.saveDemoStore(store);
    const proof = this.buildForgetProofEvent(view, decidedBy);
    return { item: view, proof };
  }

  // Mapping helpers

  private mapLooseItem(raw: LooseMemoryItem, index: number): MemoryPrivacyItemView {
    const id = String(raw.id || raw.key || `memory-${index + 1}`).trim() || `memory-${index + 1}`;
    const rawTitle = String(raw.title || raw.kind || raw.type || 'Memory item').trim() || 'Memory item';
    const rawSummary = String(
      raw.summary || raw.description || raw.contentPreview || '',
    ).trim();
    const secretLike = raw.secretLike === true || detectSecretLike(raw);
    // Never surface secret-like tokens in operator-facing title/summary.
    const title = secretLike
      ? redactSecretLikeText(rawTitle)
      : sanitizeDisplay(rawTitle);
    const summary = secretLike
      ? redactSecretLikeText(rawSummary || 'Sensitive memory (details redacted).')
      : sanitizeDisplay(rawSummary || 'No summary.');

    const origin = inferOrigin(raw);
    const originLabel = ORIGIN_LABELS[origin];
    const whyRaw = buildWhyIKnowThis(raw, origin);
    // Always run presence-only redaction so custom why text cannot leak tokens.
    const whyIKnowThis = redactSecretLikeText(whyRaw);
    const consentState = inferConsent(raw, origin);
    const systemCritical = isSystemCritical(raw);
    const canForget = raw.canForget === false || systemCritical
      ? false
      : raw.canForget === true
        ? true
        : !systemCritical;

    const proofEventId = raw.proofEventId != null && String(raw.proofEventId).trim()
      ? String(raw.proofEventId).trim()
      : null;
    const createdAt = raw.createdAt != null && String(raw.createdAt).trim()
      ? String(raw.createdAt)
      : raw.updatedAt != null && String(raw.updatedAt).trim()
        ? String(raw.updatedAt)
        : null;

    const metadata: Record<string, unknown> = {
      ...(raw.metadata && typeof raw.metadata === 'object' ? { ...raw.metadata } : {}),
    };
    // Strip accidental secret-bearing keys/values from metadata projection.
    for (const key of Object.keys(metadata)) {
      if (hasAnyMemoryToken(splitMemoryTokens(key), ['secret', 'password', 'token', 'api', 'key', 'credential'])) {
        metadata[key] = '[redacted]';
        continue;
      }
      const value = metadata[key];
      if (typeof value === 'string' && detectSecretLike({ content: value, summary: value })) {
        metadata[key] = redactSecretLikeText(value);
      }
    }

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
      ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    };
  }
}

function isPrivacyView(item: MemoryPrivacyItemView | LooseMemoryItem): item is MemoryPrivacyItemView {
  return Boolean(
    item
    && typeof item === 'object'
    && 'whyIKnowThis' in item
    && 'originLabel' in item
    && 'canForget' in item
    && typeof (item as MemoryPrivacyItemView).whyIKnowThis === 'string',
  );
}

export function inferOrigin(raw: LooseMemoryItem): MemoryPrivacyOrigin {
  const tokens = splitMemoryTokens([
    raw.origin,
    raw.source,
    raw.kind,
    raw.type,
    raw.title,
  ].map((v) => String(v || '')).join(' '));

  if (hasAnyMemoryToken(tokens, ['user-stated', 'user_stated', 'explicit'])) {
    return 'user-stated';
  }
  if (hasAnyMemoryToken(tokens, ['dream', 'dream-cycle', 'dream_cycle', 'consolidation', 'mnemos-dream'])) {
    return 'dream-cycle';
  }
  if (hasAnyMemoryToken(tokens, ['skill', 'skill-memory', 'skill_memory'])) {
    return 'skill';
  }
  if (hasAnyMemoryToken(tokens, ['import', 'migration', 'migrated', 'wiki-import', 'external-pack'])) {
    return 'import';
  }
  if (hasAnyMemoryToken(tokens, ['system', 'bootstrap', 'identity-core', 'runtime-identity'])) {
    return 'system';
  }
  if (hasAnyMemoryToken(tokens, ['conversation', 'chat', 'session', 'dialogue', 'thread'])) {
    return 'conversation';
  }
  if (hasAnyMemoryToken(tokens, ['preference', 'preferences', 'project-fact', 'project-facts', 'procedure', 'procedures', 'user-model'])) {
    if (hasAnyMemoryToken(tokens, ['preference', 'preferences'])) return 'user-stated';
    return 'conversation';
  }
  return 'unknown';
}
function buildWhyIKnowThis(raw: LooseMemoryItem, origin: MemoryPrivacyOrigin): string {
  const custom = raw.metadata && typeof raw.metadata === 'object'
    ? (raw.metadata as Record<string, unknown>).whyIKnowThis
      || (raw.metadata as Record<string, unknown>).why
    : null;
  if (custom != null && String(custom).trim()) {
    // Custom explanations still pass through secret redaction at the call site when needed.
    return sanitizeDisplay(String(custom).trim());
  }
  if (origin === 'dream-cycle') {
    const consent = String(raw.consentState || raw.consent || '').trim().toLowerCase();
    if (consent === 'granted' || consent === 'implied') {
      return 'Accepted from the Mnemos dream cycle after review.';
    }
    // Default / review / unknown -> pending review narrative
    return 'Learning candidate pending review from the Mnemos dream cycle.';
  }
  return WHY_BY_ORIGIN[origin];
}

function inferConsent(raw: LooseMemoryItem, origin: MemoryPrivacyOrigin): MemoryPrivacyConsentState {
  const explicit = String(raw.consentState || raw.consent || '').trim().toLowerCase();
  if (explicit === 'granted' || explicit === 'implied' || explicit === 'review' || explicit === 'unknown') {
    return explicit;
  }
  if (origin === 'user-stated') return 'granted';
  if (origin === 'dream-cycle') return 'review';
  if (origin === 'system') return 'implied';
  if (origin === 'conversation' || origin === 'skill' || origin === 'import') return 'implied';
  return 'unknown';
}

function isSystemCritical(raw: LooseMemoryItem): boolean {
  if (raw.systemCritical === true || raw.critical === true) return true;
  if (raw.canForget === false && (raw.origin === 'system' || raw.kind === 'system')) return true;
  const hay = [
    raw.kind,
    raw.type,
    raw.origin,
    raw.source,
    raw.title,
    raw.id,
  ].map((v) => String(v || '').toLowerCase()).join(' ');
  return SYSTEM_CRITICAL_MARKERS.some((m) => hay.includes(m));
}

export function detectSecretLike(raw: LooseMemoryItem): boolean {
  if (raw.secretLike === true) return true;
  const kind = String(raw.kind || raw.type || '').toLowerCase();
  if (hasAnyMemoryToken(splitMemoryTokens(kind), ['secret', 'credential', 'password', 'token', 'api', 'key'])) return true;
  const blobs = [
    raw.title,
    raw.summary,
    raw.description,
    raw.content,
    raw.contentPreview,
  ].map((v) => String(v || ''));
  for (const blob of blobs) {
    if (!blob) continue;
    for (const re of SECRET_PATTERNS) {
      if (re.test(blob)) return true;
    }
  }
  return false;
}

/** Redact secret-like substrings; never leave raw high-entropy tokens. */
export function redactSecretLikeText(text: string): string {
  let out = String(text || '');
  out = out.replace(/sk-[a-zA-Z0-9]{10,}/g, '[redacted token]');
  out = out.replace(/AIza[0-9A-Za-z_-]{20,}/g, '[redacted api key]');
  out = out.replace(/-----BEGIN[ A-Z]+PRIVATE KEY-----[\s\S]*...-----END[ A-Z]+PRIVATE KEY-----/g, '[redacted private key]');
  out = out.replace(/\b[a-fA-F0-9]{40,}\b/g, '[redacted hex]');
  out = out.replace(/(api[_-]...key|secret|password|token)\s*[:=]\s*\S+/gi, '$1=[redacted]');
  out = out.replace(/\bxox[baprs]-[0-9A-Za-z-]{10,}/gi, '[redacted slack token]');
  out = out.replace(/\bghp_[0-9A-Za-z]{20,}/g, '[redacted github token]');
  return sanitizeDisplay(out);
}

function sanitizeDisplay(text: string): string {
  let cleaned = String(text || '');
  cleaned = cleaned.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (cleaned.length > 240) {
    cleaned = `${cleaned.slice(0, 237)}...`;
  }
  return cleaned;
}

function splitMemoryTokens(value: string): Set<string> {
  const tokens = new Set<string>();
  let current = '';
  for (const char of String(value || '').toLowerCase()) {
    const keep = (char >= 'a' && char <= 'z') || (char >= '0' && char <= '9') || char === '-' || char === '_';
    if (keep) {
      current += char;
      continue;
    }
    if (current) {
      tokens.add(current);
      current = '';
    }
  }
  if (current) {
    tokens.add(current);
  }
  return tokens;
}

function hasAnyMemoryToken(tokens: Set<string>, candidates: string[]): boolean {
  return candidates.some((candidate) => tokens.has(candidate));
}

/** Demo fixtures for unit tests (no disk). */
export function createMemoryPrivacyDemoLooseItems(): LooseMemoryItem[] {
  return [
    {
      id: 'mem-conv-1',
      title: 'Uses conventional commits',
      summary: 'Team agreed on conventional commits.',
      kind: 'project-fact',
      source: 'conversation',
      createdAt: '2026-07-11T10:00:00.000Z',
    },
    {
      id: 'mem-secret-1',
      title: 'Vendor API credential',
      summary: 'api_key=sk-leakedvalueSHOULDNOTAPPEAR',
      content: 'sk-leakedvalueSHOULDNOTAPPEAR',
      kind: 'secret-reference',
      origin: 'conversation',
      createdAt: '2026-07-11T10:05:00.000Z',
    },
    {
      id: 'mem-system-1',
      title: 'Bootstrap identity',
      kind: 'system',
      origin: 'system',
      systemCritical: true,
      summary: 'System bootstrap markers.',
      createdAt: '2026-07-11T09:00:00.000Z',
    },
  ];
}
