import type {
  SalesMemoryScope,
  ScopedMemoryEntry,
} from '../../../../contracts/SalesPackContract.js';

type SalesPackScopedMemoryRuntime = {
  now?: () => Date;
  idFactory?: (prefix: string) => string;
};

type RememberScopedMemoryInput = {
  scope: SalesMemoryScope;
  ownerId: string;
  key: string;
  value: string;
  sensitive?: boolean;
  metadata?: Record<string, unknown> | null;
};

export class SalesPackScopedMemoryService {
  private readonly now: () => Date;
  private readonly idFactory: (prefix: string) => string;
  private readonly entries = new Map<string, ScopedMemoryEntry>();

  constructor(runtime: SalesPackScopedMemoryRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.idFactory = runtime.idFactory || defaultIdFactory;
  }

  public remember(input: RememberScopedMemoryInput): ScopedMemoryEntry {
    const scope = input.scope;
    const ownerId = clean(input.ownerId, 'unknown-owner');
    const key = clean(input.key, 'note').toLowerCase();
    const value = clean(input.value);
    if (!value) {
      throw new Error('ScopedMemoryEntry exige value preenchido.');
    }
    const storageKey = this.storageKey(scope, ownerId, key);
    const existing = this.entries.get(storageKey);
    const now = this.now().toISOString();
    const entry: ScopedMemoryEntry = {
      id: existing?.id || this.idFactory('sales-memory'),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      scope,
      ownerId,
      key,
      value,
      sensitive: input.sensitive === true,
      redactedValue: input.sensitive === true ? redact(value) : value,
      metadata: sanitizeMetadata(input.metadata),
    };
    this.entries.set(storageKey, entry);
    return cloneEntry(entry);
  }

  public recall(input: {
    scope: SalesMemoryScope;
    ownerId: string;
    key: string;
  }): ScopedMemoryEntry | null {
    const entry = this.entries.get(this.storageKey(input.scope, clean(input.ownerId), clean(input.key).toLowerCase()));
    return entry ? cloneEntry(entry) : null;
  }

  public listByScope(input: {
    scope: SalesMemoryScope;
    ownerId: string;
    redacted?: boolean;
  }): ScopedMemoryEntry[] {
    const ownerId = clean(input.ownerId);
    return Array.from(this.entries.values())
      .filter((entry) => entry.scope === input.scope && entry.ownerId === ownerId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((entry) => input.redacted ? redactEntry(entry) : cloneEntry(entry));
  }

  public listRelevant(input: {
    query: string;
    scopes: SalesMemoryScope[];
    ownerIds: string[];
    limit?: number;
    redacted?: boolean;
  }): ScopedMemoryEntry[] {
    const tokens = tokenize(input.query);
    if (tokens.length === 0) {
      return [];
    }
    const scopeSet = new Set(input.scopes);
    const ownerSet = new Set(input.ownerIds.map((ownerId) => clean(ownerId)).filter(Boolean));
    return Array.from(this.entries.values())
      .filter((entry) => scopeSet.has(entry.scope) && ownerSet.has(entry.ownerId))
      .map((entry) => ({ entry, score: scoreEntry(entry, tokens) }))
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return right.entry.updatedAt.localeCompare(left.entry.updatedAt);
      })
      .slice(0, Math.max(1, input.limit || 6))
      .map((candidate) => input.redacted ? redactEntry(candidate.entry) : cloneEntry(candidate.entry));
  }

  public buildSnapshot(): {
    total: number;
    byScope: Record<SalesMemoryScope, number>;
    redactedEntries: ScopedMemoryEntry[];
  } {
    const byScope = Array.from(this.entries.values()).reduce<Record<SalesMemoryScope, number>>((acc, entry) => {
      acc[entry.scope] += 1;
      return acc;
    }, {
      operator: 0,
      organization: 0,
      customer: 0,
      conversation: 0,
      knowledge: 0,
      procedural: 0,
    });
    return {
      total: this.entries.size,
      byScope,
      redactedEntries: Array.from(this.entries.values()).slice(-12).map(redactEntry),
    };
  }

  private storageKey(scope: SalesMemoryScope, ownerId: string, key: string): string {
    return `${scope}:${ownerId}:${key}`;
  }
}

function defaultIdFactory(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clean(value: unknown, fallback = ''): string {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function sanitizeMetadata(input: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input || {})) {
    if (key && value !== undefined) {
      output[key] = value;
    }
  }
  return output;
}

function tokenize(value: string): string[] {
  const stop = new Set(['para', 'com', 'que', 'uma', 'esse', 'essa', 'isso', 'meu', 'minha', 'seu', 'sua']);
  return Array.from(new Set(
    clean(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/[^a-z0-9_]+/i)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !stop.has(token)),
  ));
}

function scoreEntry(entry: ScopedMemoryEntry, tokens: string[]): number {
  const haystack = `${entry.key} ${entry.value}`.toLowerCase();
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
}

function redact(value: string): string {
  const normalized = clean(value);
  if (!normalized) {
    return '';
  }
  if (normalized.length <= 8) {
    return '[redacted]';
  }
  return `${normalized.slice(0, 4)}...[redacted]`;
}

function redactEntry(entry: ScopedMemoryEntry): ScopedMemoryEntry {
  return {
    ...entry,
    value: entry.redactedValue,
    metadata: { ...entry.metadata, redacted: entry.sensitive },
  };
}

function cloneEntry(entry: ScopedMemoryEntry): ScopedMemoryEntry {
  return {
    ...entry,
    metadata: { ...entry.metadata },
  };
}
