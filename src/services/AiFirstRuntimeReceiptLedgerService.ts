
import fs from 'node:fs';
import path from 'node:path';
import {
  AI_FIRST_RUNTIME_RECEIPT_LEDGER_CONTRACT_VERSION,
  type AiFirstRuntimeReceiptComparisonIndexEntry,
  type AiFirstRuntimeReceiptLedgerEntry,
  type AiFirstRuntimeReceiptLedgerPersistence,
  type AiFirstRuntimeReceiptLedgerSnapshot,
  type AiFirstRuntimeReceiptReplayIndexEntry,
} from '../contracts/AiFirstRuntimeReceiptLedgerContract.js';
import type { AiFirstRuntimeEntrypointAdapterSnapshot } from '../contracts/AiFirstRuntimeEntrypointAdapterContract.js';
import { redactSensitiveText } from './AiFirstRoutePlanContractService.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

type AiFirstRuntimeReceiptLedgerRuntime = {
  now?: () => Date;
  idFactory?: (prefix: string) => string;
};

export type AiFirstRuntimeReceiptLedgerInput = {
  ledgerName?: string | null;
  adapterSnapshots: AiFirstRuntimeEntrypointAdapterSnapshot[];
  persistence?: {
    enabled?: boolean | null;
    filePath?: string | null;
    append?: boolean | null;
  } | null;
};

export class AiFirstRuntimeReceiptLedgerService {
  private readonly now: () => Date;
  private readonly idFactory: (prefix: string) => string;
  private sequence = 0;

  constructor(runtime: AiFirstRuntimeReceiptLedgerRuntime = {}) {
    this.now = runtime.now ?? (() => new Date());
    this.idFactory = runtime.idFactory ?? ((prefix) => `${prefix}-${this.now().getTime().toString(36)}-${++this.sequence}`);
  }

  public buildLedger(input: AiFirstRuntimeReceiptLedgerInput): AiFirstRuntimeReceiptLedgerSnapshot {
    const entries = input.adapterSnapshots.map((snapshot) => this.toEntry(snapshot));
    const replayIndex = buildReplayIndex(entries);
    const comparisonIndex = buildComparisonIndex(entries);
    const invariants = buildInvariants(input.adapterSnapshots);
    const summary = buildSummary(entries);
    const fallbackReasons = buildFallbackReasons(entries);
    const persistence = this.persistIfRequested({
      entries,
      persistence: input.persistence || null,
    });
    const recommendation = invariants.sourceViolations.length > 0
      ? {
          readiness: 'review-source-violations' as const,
          action: 'review-ledger' as const,
          reason: 'One or more source adapter snapshots violated Surface controls invariants.',
          defaultRuntimeChanged: false as const,
          keepCurrentRuntimeDecision: true as const,
          canExecuteNow: false as const,
        }
      : {
          readiness: 'ledger-clean' as const,
          action: 'ready-for-replay' as const,
          reason: 'Ledger entries are replayable and preserve runtime fallback invariants.',
          defaultRuntimeChanged: false as const,
          keepCurrentRuntimeDecision: true as const,
          canExecuteNow: false as const,
        };

    return {
      contractVersion: AI_FIRST_RUNTIME_RECEIPT_LEDGER_CONTRACT_VERSION,
      source: 'ai-first-runtime-receipt-ledger',
      generatedAt: this.now().toISOString(),
      ledgerId: this.idFactory('ledger'),
      input: {
        ledgerName: safeText(input.ledgerName || 'ai-first-runtime-receipt-ledger'),
        adapterSnapshotCount: input.adapterSnapshots.length,
      },
      entries,
      replayIndex,
      comparisonIndex,
      summary,
      fallbackReasons,
      invariants,
      persistence,
      recommendation,
      receipts: [
        {
          id: this.idFactory('receipt'),
          kind: 'ledger',
          detail: `${entries.length} adapter receipt(s) captured in the runtime ledger.`,
        },
        {
          id: this.idFactory('receipt'),
          kind: 'entry',
          detail: `${summary.canarySelected} canary selection(s), ${summary.currentRuntimeSelected} current-runtime selection(s).`,
        },
        {
          id: this.idFactory('receipt'),
          kind: 'replay-index',
          detail: `${replayIndex.length} replay key(s) and ${comparisonIndex.length} comparison key(s) generated.`,
        },
        {
          id: this.idFactory('receipt'),
          kind: 'persistence',
          detail: persistence.attempted
            ? `JSONL persistence ${persistence.succeeded ? 'succeeded' : 'failed'} for ${persistence.entriesWritten} entrie(s).`
            : 'Persistence was not requested; ledger remains memory-only.',
        },
        {
          id: this.idFactory('receipt'),
          kind: 'no-runtime-change',
          detail: 'Receipt ledger does not change the default runtime route.',
        },
      ],
      gates: [
        {
          id: 'gate-8-receipt-ledger-only',
          status: 'passed',
          detail: 'Ledger captures receipts without changing routing behavior.',
        },
        {
          id: 'gate-8-replay-index-built',
          status: 'passed',
          detail: 'Replay and comparison indexes were generated from Surface controls snapshots.',
        },
        {
          id: 'gate-8-no-execution',
          status: 'passed',
          detail: 'Ledger entries preserve canExecuteNow=false.',
        },
        {
          id: 'gate-8-current-runtime-preserved',
          status: 'passed',
          detail: 'defaultRuntimeChanged is false and keepCurrentRuntimeDecision is true.',
        },
      ],
    };
  }

  public toJsonl(snapshot: AiFirstRuntimeReceiptLedgerSnapshot): string {
    if (snapshot.entries.length === 0) {
      return '';
    }
    return `${snapshot.entries.map((entry) => redactSensitiveText(JSON.stringify(entry))).join('\n')}\n`;
  }

  public renderMarkdown(snapshot: AiFirstRuntimeReceiptLedgerSnapshot): string {
    const lines: string[] = [];
    lines.push('# Zavorth AI-first Router ZavorthControl controls');
    lines.push('');
    lines.push(`- contract: ${snapshot.contractVersion}`);
    lines.push(`- ledgerId: ${snapshot.ledgerId}`);
    lines.push(`- entries: ${snapshot.summary.totalEntries}`);
    lines.push(`- canarySelected: ${snapshot.summary.canarySelected}`);
    lines.push(`- currentRuntimeSelected: ${snapshot.summary.currentRuntimeSelected}`);
    lines.push(`- readiness: ${snapshot.recommendation.readiness}`);
    lines.push(`- persistence: ${snapshot.persistence.mode}`);
    lines.push(`- persistenceSucceeded: ${String(snapshot.persistence.succeeded)}`);
    lines.push(`- defaultRuntimeChanged: ${String(snapshot.recommendation.defaultRuntimeChanged)}`);
    lines.push(`- canExecuteNow: ${String(snapshot.recommendation.canExecuteNow)}`);
    lines.push('');
    lines.push('## Replay index');
    if (snapshot.replayIndex.length === 0) {
      lines.push('- none');
    } else {
      for (const entry of snapshot.replayIndex) {
        lines.push(`- ${entry.requestId}: entries=${entry.entryIds.length}, last=${entry.lastSelectedPath}`);
      }
    }
    lines.push('');
    lines.push('## Fallback reasons');
    if (snapshot.fallbackReasons.length === 0) {
      lines.push('- none');
    } else {
      for (const entry of snapshot.fallbackReasons) {
        lines.push(`- ${entry.reason}: ${entry.count}`);
      }
    }
    return lines.join('\n');
  }

  private toEntry(snapshot: AiFirstRuntimeEntrypointAdapterSnapshot): AiFirstRuntimeReceiptLedgerEntry {
    const requestId = safeId(snapshot.input.requestId);
    const comparisonKey = [
      snapshot.input.surface,
      snapshot.currentRuntime.responsePath,
      snapshot.effective.selectedPath,
      snapshot.canary.matchedRouteKey || 'no-route',
    ].map(safeId).join(':');

    return {
      entryId: this.idFactory('entry'),
      adapterId: safeId(snapshot.adapterId),
      requestId,
      surface: safeText(snapshot.input.surface),
      generatedAt: snapshot.generatedAt,
      selectedPath: snapshot.effective.selectedPath,
      status: snapshot.effective.status,
      canarySelected: snapshot.effective.canarySelected,
      currentRuntime: {
        mode: snapshot.currentRuntime.mode,
        responsePath: snapshot.currentRuntime.responsePath,
        shouldExecute: snapshot.currentRuntime.shouldExecute,
        requestedTools: uniqueStrings(snapshot.currentRuntime.requestedTools),
        retainedAsFallback: true,
      },
      canary: {
        switchboardId: nullableText(snapshot.canary.switchboardId),
        decision: safeText(snapshot.canary.decision),
        matchedRouteKey: nullableText(snapshot.canary.matchedRouteKey),
        fallbackReason: snapshot.canary.fallbackReason,
      },
      replay: {
        replayKey: requestId,
        comparisonKey,
        selectedDecisionRecordedBesideCurrent: true,
      },
      invariants: {
        fallbackAvailable: true,
        defaultRuntimeChanged: false,
        keepCurrentRuntimeDecision: true,
        adapterOnly: true,
        canExecuteNow: false,
      },
    };
  }

  private persistIfRequested(input: {
    entries: AiFirstRuntimeReceiptLedgerEntry[];
    persistence: AiFirstRuntimeReceiptLedgerInput['persistence'];
  }): AiFirstRuntimeReceiptLedgerPersistence {
    const enabled = input.persistence?.enabled === true;
    const filePath = input.persistence?.filePath ? path.resolve(input.persistence.filePath) : null;
    const append = input.persistence?.append === true;
    if (!enabled) {
      return {
        mode: 'memory-only',
        attempted: false,
        succeeded: true,
        targetPath: null,
        append: false,
        entriesWritten: 0,
        error: null,
      };
    }
    if (!filePath || path.extname(filePath).toLowerCase() !== '.jsonl') {
      return {
        mode: 'jsonl-file',
        attempted: true,
        succeeded: false,
        targetPath: filePath,
        append,
        entriesWritten: 0,
        error: 'A JSONL filePath with .jsonl extension is required.',
      };
    }
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const payload = input.entries.length > 0
        ? `${input.entries.map((entry) => redactSensitiveText(JSON.stringify(entry))).join('\n')}\n`
        : '';
      if (append) {
        fs.appendFileSync(filePath, payload, 'utf8');
      } else {
        fs.writeFileSync(filePath, payload, 'utf8');
      }
      return {
        mode: 'jsonl-file',
        attempted: true,
        succeeded: true,
        targetPath: filePath,
        append,
        entriesWritten: input.entries.length,
        error: null,
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Ai First Runtime Receipt Ledger] filesystem operation failed', error);
    return {
        mode: 'jsonl-file',
        attempted: true,
        succeeded: false,
        targetPath: filePath,
        append,
        entriesWritten: 0,
        error: error instanceof Error ? err.message : String(error),
      };
  }
  }
}

function buildReplayIndex(entries: AiFirstRuntimeReceiptLedgerEntry[]): AiFirstRuntimeReceiptReplayIndexEntry[] {
  const byRequest = new Map<string, AiFirstRuntimeReceiptReplayIndexEntry>();
  for (const entry of entries) {
    const current = byRequest.get(entry.requestId) || {
      requestId: entry.requestId,
      entryIds: [],
      selectedPaths: [],
      lastSelectedPath: entry.selectedPath,
    };
    current.entryIds.push(entry.entryId);
    current.selectedPaths.push(entry.selectedPath);
    current.lastSelectedPath = entry.selectedPath;
    byRequest.set(entry.requestId, current);
  }
  return Array.from(byRequest.values()).sort((left, right) => left.requestId.localeCompare(right.requestId));
}

function buildComparisonIndex(entries: AiFirstRuntimeReceiptLedgerEntry[]): AiFirstRuntimeReceiptComparisonIndexEntry[] {
  const byComparison = new Map<string, AiFirstRuntimeReceiptComparisonIndexEntry>();
  for (const entry of entries) {
    const current = byComparison.get(entry.replay.comparisonKey) || {
      comparisonKey: entry.replay.comparisonKey,
      entries: 0,
      canarySelections: 0,
      fallbackSelections: 0,
    };
    current.entries += 1;
    current.canarySelections += entry.selectedPath === 'ai-first-canary' ? 1 : 0;
    current.fallbackSelections += entry.selectedPath === 'current-runtime' ? 1 : 0;
    byComparison.set(entry.replay.comparisonKey, current);
  }
  return Array.from(byComparison.values()).sort((left, right) => right.entries - left.entries || left.comparisonKey.localeCompare(right.comparisonKey));
}

function buildInvariants(snapshots: AiFirstRuntimeEntrypointAdapterSnapshot[]): AiFirstRuntimeReceiptLedgerSnapshot['invariants'] {
  const sourceViolations: string[] = [];
  for (const snapshot of snapshots) {
    const prefix = snapshot.input.requestId;
    if (snapshot.effective.fallbackAvailable !== true) {
      sourceViolations.push(`${prefix}:fallbackAvailable`);
    }
    if (snapshot.effective.defaultRuntimeChanged !== false) {
      sourceViolations.push(`${prefix}:defaultRuntimeChanged`);
    }
    if (snapshot.effective.keepCurrentRuntimeDecision !== true) {
      sourceViolations.push(`${prefix}:keepCurrentRuntimeDecision`);
    }
    if (snapshot.effective.adapterOnly !== true) {
      sourceViolations.push(`${prefix}:adapterOnly`);
    }
    if (snapshot.effective.canExecuteNow !== false) {
      sourceViolations.push(`${prefix}:canExecuteNow`);
    }
    if (snapshot.currentRuntime.retainedAsFallback !== true) {
      sourceViolations.push(`${prefix}:retainedAsFallback`);
    }
  }
  return {
    allFallbackAvailable: !sourceViolations.some((value) => value.endsWith(':fallbackAvailable')),
    allDefaultRuntimePreserved: !sourceViolations.some((value) => value.endsWith(':defaultRuntimeChanged')),
    allCurrentRuntimeRetained: !sourceViolations.some((value) => value.endsWith(':retainedAsFallback') || value.endsWith(':keepCurrentRuntimeDecision')),
    allAdapterOnly: !sourceViolations.some((value) => value.endsWith(':adapterOnly')),
    allCanExecuteNowFalse: !sourceViolations.some((value) => value.endsWith(':canExecuteNow')),
    sourceViolations,
  };
}

function buildSummary(entries: AiFirstRuntimeReceiptLedgerEntry[]): AiFirstRuntimeReceiptLedgerSnapshot['summary'] {
  const serialized = JSON.stringify(entries);
  return {
    totalEntries: entries.length,
    canarySelected: entries.filter((entry) => entry.selectedPath === 'ai-first-canary').length,
    currentRuntimeSelected: entries.filter((entry) => entry.selectedPath === 'current-runtime').length,
    fallbackCurrentRuntime: entries.filter((entry) => entry.status === 'fallback-current-runtime').length,
    currentRuntimeOnly: entries.filter((entry) => entry.status === 'current-runtime-only').length,
    secretLeakDetected: hasSecretLeak(serialized),
  };
}

function buildFallbackReasons(entries: AiFirstRuntimeReceiptLedgerEntry[]): AiFirstRuntimeReceiptLedgerSnapshot['fallbackReasons'] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.canary.fallbackReason) {
      continue;
    }
    counts.set(entry.canary.fallbackReason, (counts.get(entry.canary.fallbackReason) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([reason, count]) => ({
      reason: reason as AiFirstRuntimeReceiptLedgerSnapshot['fallbackReasons'][number]['reason'],
      count,
    }))
    .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason));
}

function hasSecretLeak(value: string): boolean {
  return /\bxox[pbarfs]-[A-Za-z0-9-]{6,}\b/i.test(value)
    || /\bsk-[A-Za-z0-9_-]{12,}\b/.test(value)
    || /\bgh[pousr]_[A-Za-z0-9_]{12,}\b/.test(value);
}

function safeText(value: unknown): string {
  return redactSensitiveText(String(value || '').trim() || 'unknown');
}

function nullableText(value: unknown): string | null {
  const text = String(value || '').trim();
  return text ? redactSensitiveText(text) : null;
}

function safeId(value: unknown): string {
  const text = safeText(value).toLowerCase();
  const id = text.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  return id || 'id';
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    const normalized = safeText(value);
    const key = normalized.toLowerCase();
    if (key === 'unknown' || seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(normalized);
  }
  return unique;
}
