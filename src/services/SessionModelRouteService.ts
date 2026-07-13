/**
 * Mid-session model route + per-model usage ledger.
 * Extends the intent of LLMModelSwitcherService for durable session overrides.
 */

import fs from 'node:fs';
import path from 'node:path';

export type SessionModelRoute = {
  sessionId: string;
  providerName: string | null;
  modelName: string;
  setAt: string;
  source: 'user' | 'cli' | 'slash' | 'system';
};

export type SessionModelUsageEntry = {
  at: string;
  providerName: string | null;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  note: string | null;
};

export type SessionModelLedger = {
  sessionId: string;
  route: SessionModelRoute | null;
  usage: SessionModelUsageEntry[];
  totalsByModel: Record<string, {
    calls: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
  }>;
  updatedAt: string;
};

type Runtime = {
  storageDir?: string;
  now?: () => Date;
};

export class SessionModelRouteService {
  private static instance: SessionModelRouteService | null = null;
  private readonly storageDir: string;
  private readonly now: () => Date;

  public constructor(runtime: Runtime = {}) {
    this.storageDir = runtime.storageDir
      || path.join(process.cwd(), 'data', 'runtime', 'session-model-routes');
    this.now = runtime.now || (() => new Date());
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  public static getInstance(): SessionModelRouteService {
    if (!SessionModelRouteService.instance) {
      SessionModelRouteService.instance = new SessionModelRouteService();
    }
    return SessionModelRouteService.instance;
  }

  public setSessionModel(input: {
    sessionId: string;
    modelName: string;
    providerName?: string | null;
    source?: SessionModelRoute['source'];
  }): SessionModelLedger {
    const sessionId = normalizeId(input.sessionId);
    const modelName = String(input.modelName || '').trim();
    if (!sessionId || !modelName) {
      throw new Error('sessionId and modelName are required');
    }
    const ledger = this.readLedger(sessionId);
    ledger.route = {
      sessionId,
      modelName,
      providerName: clean(input.providerName),
      setAt: this.now().toISOString(),
      source: input.source || 'user',
    };
    ledger.updatedAt = this.now().toISOString();
    this.writeLedger(ledger);
    return ledger;
  }

  public clearSessionModel(sessionId: string): SessionModelLedger {
    const ledger = this.readLedger(normalizeId(sessionId));
    ledger.route = null;
    ledger.updatedAt = this.now().toISOString();
    this.writeLedger(ledger);
    return ledger;
  }

  public getSessionModel(sessionId: string): SessionModelRoute | null {
    return this.readLedger(normalizeId(sessionId)).route;
  }

  public recordUsage(input: {
    sessionId: string;
    modelName: string;
    providerName?: string | null;
    inputTokens?: number;
    outputTokens?: number;
    estimatedCostUsd?: number;
    note?: string | null;
  }): SessionModelLedger {
    const sessionId = normalizeId(input.sessionId);
    const modelName = String(input.modelName || '').trim() || 'unknown';
    const ledger = this.readLedger(sessionId);
    const entry: SessionModelUsageEntry = {
      at: this.now().toISOString(),
      modelName,
      providerName: clean(input.providerName),
      inputTokens: Math.max(0, Number(input.inputTokens || 0) || 0),
      outputTokens: Math.max(0, Number(input.outputTokens || 0) || 0),
      estimatedCostUsd: Math.max(0, Number(input.estimatedCostUsd || 0) || 0),
      note: clean(input.note),
    };
    ledger.usage.push(entry);
    if (ledger.usage.length > 500) {
      ledger.usage = ledger.usage.slice(-500);
    }
    const key = `${entry.providerName || 'any'}/${entry.modelName}`;
    const totals = ledger.totalsByModel[key] || {
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
    };
    totals.calls += 1;
    totals.inputTokens += entry.inputTokens;
    totals.outputTokens += entry.outputTokens;
    totals.estimatedCostUsd += entry.estimatedCostUsd;
    ledger.totalsByModel[key] = totals;
    ledger.updatedAt = this.now().toISOString();
    this.writeLedger(ledger);
    return ledger;
  }

  public getLedger(sessionId: string): SessionModelLedger {
    return this.readLedger(normalizeId(sessionId));
  }

  private readLedger(sessionId: string): SessionModelLedger {
    const id = normalizeId(sessionId) || 'default';
    const filePath = this.ledgerPath(id);
    if (!fs.existsSync(filePath)) {
      return {
        sessionId: id,
        route: null,
        usage: [],
        totalsByModel: {},
        updatedAt: this.now().toISOString(),
      };
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as SessionModelLedger;
      return {
        sessionId: id,
        route: parsed.route || null,
        usage: Array.isArray(parsed.usage) ? parsed.usage : [],
        totalsByModel: parsed.totalsByModel && typeof parsed.totalsByModel === 'object'
          ? parsed.totalsByModel
          : {},
        updatedAt: parsed.updatedAt || this.now().toISOString(),
      };
    } catch {
      return {
        sessionId: id,
        route: null,
        usage: [],
        totalsByModel: {},
        updatedAt: this.now().toISOString(),
      };
    }
  }

  private writeLedger(ledger: SessionModelLedger): void {
    const filePath = this.ledgerPath(ledger.sessionId);
    fs.writeFileSync(filePath, JSON.stringify(ledger, null, 2), 'utf8');
  }

  private ledgerPath(sessionId: string): string {
    const safe = sessionId.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'default';
    return path.join(this.storageDir, `${safe}.json`);
  }
}

function normalizeId(value: unknown): string {
  return String(value || '').trim();
}

function clean(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}
