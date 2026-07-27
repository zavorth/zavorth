import {
  queryUniversalAgentRuns,
  type UniversalAgentRunObservatoryReceipt,
} from './RunObservatory.js';
import type {
  UniversalAgentRun,
  UniversalMemorySignal,
} from './UniversalAgentRuntimeTypes.js';

export const MEMORY_WITH_RECEIPTS_CONTRACT_VERSION = '2026-05-03.memory-receipts' as const;

export type MemoryWithReceiptSourceType =
  | 'memory-signal'
  | 'canonical-context'
  | 'run-observatory'
  | 'artifact'
  | 'chat'
  | 'file'
  | 'unknown';

export type MemoryWithReceiptOriginKind =
  | 'memory'
  | 'context'
  | 'artifact'
  | 'chat'
  | 'file'
  | 'unknown';

export type MemoryWithReceiptConfidenceLabel = 'low' | 'medium' | 'high';

export type MemoryWithReceipt = {
  id: string;
  memoryId: string;
  title: string;
  layer: UniversalMemorySignal['layer'];
  summary: string;
  source: string;
  sourceType: MemoryWithReceiptSourceType;
  createdAt: string;
  runId: string;
  traceId: string;
  sessionId: string;
  origin: {
    kind: MemoryWithReceiptOriginKind;
    ref: string | null;
    artifactId?: string;
    eventId?: string;
  };
  confidence: number;
  confidenceLabel: MemoryWithReceiptConfidenceLabel;
  observatoryReceiptId?: string;
  actions: {
    reviewCommand: string;
    askSourceCommand: string;
    forgetCommand: string;
    correctCommand: string;
  };
};

export type MemoryWithReceiptsSnapshot = {
  contractVersion: typeof MEMORY_WITH_RECEIPTS_CONTRACT_VERSION;
  source: 'MemoryWithReceiptsService';
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  summary: {
    memoryCount: number;
    receiptCount: number;
    layers: UniversalMemorySignal['layer'][];
    averageConfidence: number | null;
    lowConfidenceCount: number;
  };
  receipts: MemoryWithReceipt[];
  audit: {
    allMemoryHasReceipt: boolean;
    canAnswerSourceQuestion: boolean;
    canForgetOrCorrect: boolean;
    runObservatoryLinked: boolean;
    noMemoryInvented: true;
  };
  surface: {
    cliCommand: string;
    zavorthControlPath: string;
    sourceQuestionHint: string;
  };
  nextSafeAction: string;
};

export type MemoryWithReceiptsInput = {
  run: UniversalAgentRun;
  generatedAt?: string | null;
};

type LooseRecord = Record<string, unknown>;

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function recordOrNull(value: unknown): LooseRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as LooseRecord
    : null;
}

function clampConfidence(value: unknown, fallback = 0.64): number {
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

function confidenceLabel(value: number): MemoryWithReceiptConfidenceLabel {
  if (value >= 0.8) {
    return 'high';
  }
  if (value >= 0.5) {
    return 'medium';
  }
  return 'low';
}

function uniqueLayers(signals: UniversalMemorySignal[]): UniversalMemorySignal['layer'][] {
  const layers = new Set<UniversalMemorySignal['layer']>();
  for (const signal of signals) {
    layers.add(signal.layer);
  }
  return Array.from(layers);
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function normalizeSourceType(value: unknown, fallback: MemoryWithReceiptSourceType): MemoryWithReceiptSourceType {
  const raw = normalizeText(value).toLowerCase();
  if (
    raw === 'memory-signal'
    || raw === 'canonical-context'
    || raw === 'run-observatory'
    || raw === 'artifact'
    || raw === 'chat'
    || raw === 'file'
    || raw === 'unknown'
  ) {
    return raw;
  }
  if (raw.includes('artifact')) {
    return 'artifact';
  }
  if (raw.includes('chat') || raw.includes('message')) {
    return 'chat';
  }
  if (raw.includes('file') || raw.includes('path')) {
    return 'file';
  }
  if (raw.includes('context')) {
    return 'canonical-context';
  }
  if (raw.includes('observatory')) {
    return 'run-observatory';
  }
  return fallback;
}

function normalizeOriginKind(value: unknown, fallback: MemoryWithReceiptOriginKind): MemoryWithReceiptOriginKind {
  const raw = normalizeText(value).toLowerCase();
  if (
    raw === 'memory'
    || raw === 'context'
    || raw === 'artifact'
    || raw === 'chat'
    || raw === 'file'
    || raw === 'unknown'
  ) {
    return raw;
  }
  return fallback;
}

function resolveSignalSource(signal: UniversalMemorySignal, observatoryReceipt?: UniversalAgentRunObservatoryReceipt): string {
  const raw = recordOrNull(signal);
  return normalizeText(raw?.source)
    || normalizeText(raw?.sourceId)
    || normalizeText(raw?.sourceRef)
    || normalizeText(raw?.origin)
    || normalizeText(observatoryReceipt?.source)
    || 'memory-signal';
}

function resolveSignalOrigin(
  signal: UniversalMemorySignal,
  run: UniversalAgentRun,
): MemoryWithReceipt['origin'] {
  const raw = recordOrNull(signal) || {};
  const origin = recordOrNull(raw.origin) || {};
  const artifactId = normalizeText(raw.artifactId ?? origin.artifactId);
  const eventId = normalizeText(raw.eventId ?? origin.eventId);
  const ref = normalizeText(raw.sourceRef)
    || normalizeText(raw.file)
    || normalizeText(raw.path)
    || normalizeText(raw.chatId)
    || normalizeText(origin.ref)
    || normalizeText(origin.source)
    || run.sessionId;
  const kind = normalizeOriginKind(
    raw.originKind ?? origin.kind,
    artifactId ? 'artifact' : eventId ? 'chat' : 'memory',
  );
  return {
    kind,
    ref,
    ...(artifactId ? { artifactId } : {}),
    ...(eventId ? { eventId } : {}),
  };
}

function buildActions(run: UniversalAgentRun, memoryId: string): MemoryWithReceipt['actions'] {
  return {
    reviewCommand: `zavorth memory receipts run ${run.id}`,
    askSourceCommand: `zavorth memory source ${memoryId}`,
    forgetCommand: `zavorth memory forget ${memoryId}`,
    correctCommand: `zavorth memory correct ${memoryId} "<new value>"`,
  };
}

function resolveCanonicalMemoryPrompt(run: UniversalAgentRun): string {
  const canonicalContext = recordOrNull(run.metadata.canonicalContext);
  const coldContext = recordOrNull(run.metadata.coldContext);
  const context = recordOrNull(run.metadata.context) || recordOrNull(run.metadata.contextInput);
  const contextCold = recordOrNull(context?.cold);
  return normalizeText(canonicalContext?.memoryPrompt)
    || normalizeText(context?.memoryPrompt)
    || normalizeText(contextCold?.memoryPrompt)
    || normalizeText(coldContext?.memoryPrompt)
    || normalizeText(run.metadata.memoryPrompt);
}

function resolveCanonicalMemorySource(run: UniversalAgentRun): {
  source: string;
  sourceType: MemoryWithReceiptSourceType;
  origin: MemoryWithReceipt['origin'];
} {
  const coldContext = recordOrNull(run.metadata.coldContext);
  const memoryContext = recordOrNull(coldContext?.memoryContext);
  const sourceRef = normalizeText(memoryContext?.sourceFile)
    || normalizeText(memoryContext?.source)
    || normalizeText(memoryContext?.artifactId)
    || normalizeText(memoryContext?.chatId)
    || 'canonicalContext.memoryPrompt';
  const sourceType = normalizeSourceType(memoryContext?.sourceType, 'canonical-context');
  const artifactId = normalizeText(memoryContext?.artifactId);
  return {
    source: normalizeText(memoryContext?.label, 'canonical-context'),
    sourceType,
    origin: {
      kind: sourceType === 'artifact' ? 'artifact' : sourceType === 'chat' ? 'chat' : sourceType === 'file' ? 'file' : 'context',
      ref: sourceRef,
      ...(artifactId ? { artifactId } : {}),
    },
  };
}

export class MemoryWithReceiptsService {
  private readonly now: () => Date;

  constructor(runtime: { now?: () => Date } = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(input: MemoryWithReceiptsInput): MemoryWithReceiptsSnapshot {
    const generatedAt = normalizeText(input.generatedAt, this.now().toISOString());
    const observatory = queryUniversalAgentRuns({
      runs: [input.run],
      query: {
        runId: input.run.id,
        limit: 1,
      },
      generatedAt,
    });
    const observatoryMemoryReceipts = observatory.receipts.filter((receipt) => receipt.kind === 'memory');
    const receipts = [
      ...input.run.memorySignals.map((signal) => this.fromMemorySignal({
        run: input.run,
        signal,
        observatoryReceipt: observatoryMemoryReceipts.find((receipt) =>
          normalizeText(receipt.metadata?.memorySignalId) === signal.id),
      })),
      ...this.fromCanonicalContext(input.run, generatedAt),
    ];
    const confidences = receipts.map((receipt) => receipt.confidence);
    const layers = uniqueLayers(receipts.map((receipt) => ({
      id: receipt.memoryId,
      title: receipt.title,
      layer: receipt.layer,
      summary: receipt.summary,
      confidence: receipt.confidence,
    })));
    const allMemoryHasReceipt = receipts.length >= input.run.memorySignals.length
      && input.run.memorySignals.every((signal) => receipts.some((receipt) => receipt.memoryId === signal.id));
    const runObservatoryLinked = input.run.memorySignals.length === 0
      || input.run.memorySignals.every((signal) =>
        observatoryMemoryReceipts.some((receipt) => normalizeText(receipt.metadata?.memorySignalId) === signal.id));

    return {
      contractVersion: MEMORY_WITH_RECEIPTS_CONTRACT_VERSION,
      source: 'MemoryWithReceiptsService',
      generatedAt,
      identifiers: {
        runId: input.run.id,
        traceId: input.run.traceId,
        requestId: input.run.requestId,
        sessionId: input.run.sessionId,
      },
      summary: {
        memoryCount: receipts.length,
        receiptCount: receipts.length,
        layers,
        averageConfidence: average(confidences),
        lowConfidenceCount: receipts.filter((receipt) => receipt.confidenceLabel === 'low').length,
      },
      receipts,
      audit: {
        allMemoryHasReceipt,
        canAnswerSourceQuestion: receipts.length > 0,
        canForgetOrCorrect: receipts.every((receipt) => Boolean(receipt.actions.forgetCommand && receipt.actions.correctCommand)),
        runObservatoryLinked,
        noMemoryInvented: true,
      },
      surface: {
        cliCommand: `zavorth memory receipts run ${input.run.id} --json`,
        zavorthControlPath: '/zavorthControl...sector=dreams',
        sourceQuestionHint: 'Ask for the source to list these receipts.',
      },
      nextSafeAction: this.nextSafeAction(receipts),
    };
  }

  private fromMemorySignal(input: {
    run: UniversalAgentRun;
    signal: UniversalMemorySignal;
    observatoryReceipt?: UniversalAgentRunObservatoryReceipt;
  }): MemoryWithReceipt {
    const raw = recordOrNull(input.signal) || {};
    const confidence = clampConfidence(input.signal.confidence, 0.72);
    const source = resolveSignalSource(input.signal, input.observatoryReceipt);
    const sourceType = normalizeSourceType(raw.sourceType, input.observatoryReceipt ? 'run-observatory' : 'memory-signal');
    return {
      id: `memory-receipt:${input.signal.id}`,
      memoryId: input.signal.id,
      title: input.signal.title,
      layer: input.signal.layer,
      summary: input.signal.summary,
      source,
      sourceType,
      createdAt: input.observatoryReceipt?.createdAt || input.run.updatedAt,
      runId: input.run.id,
      traceId: input.run.traceId,
      sessionId: input.run.sessionId,
      origin: resolveSignalOrigin(input.signal, input.run),
      confidence,
      confidenceLabel: confidenceLabel(confidence),
      ...(input.observatoryReceipt ? { observatoryReceiptId: input.observatoryReceipt.id } : {}),
      actions: buildActions(input.run, input.signal.id),
    };
  }

  private fromCanonicalContext(run: UniversalAgentRun, generatedAt: string): MemoryWithReceipt[] {
    const memoryPrompt = resolveCanonicalMemoryPrompt(run);
    if (!memoryPrompt) {
      return [];
    }
    const source = resolveCanonicalMemorySource(run);
    const memoryId = `canonical-context:${run.id}`;
    const confidence = clampConfidence(recordOrNull(run.metadata.coldContext)?.confidence, 0.65);
    return [
      {
        id: `memory-receipt:${run.id}:canonical-context`,
        memoryId,
        title: 'Canonical memory context',
        layer: 'working',
        summary: memoryPrompt.length > 220 ? `${memoryPrompt.slice(0, 217)}...` : memoryPrompt,
        source: source.source,
        sourceType: source.sourceType,
        createdAt: generatedAt,
        runId: run.id,
        traceId: run.traceId,
        sessionId: run.sessionId,
        origin: source.origin,
        confidence,
        confidenceLabel: confidenceLabel(confidence),
        actions: buildActions(run, memoryId),
      },
    ];
  }

  private nextSafeAction(receipts: MemoryWithReceipt[]): string {
    if (receipts.length === 0) {
      return 'Continue without citing retrieved memory; nothing was invented.';
    }
    if (receipts.some((receipt) => receipt.confidenceLabel === 'low')) {
      return 'Answer with caveat and offer to correct or forget low-trust memories.';
    }
    return 'Can answer by citing memory while keeping source, correction, and forget commands available.';
  }
}
