import type {
  MemoryWithReceiptsSnapshot,
} from './MemoryWithReceiptsService.js';
import type {
  UniversalAgentRequest,
  UniversalAgentRun,
  UniversalAgentRunResult,
} from './UniversalAgentRuntimeTypes.js';

export const NATURAL_FIRST_MEMORY_CONTINUITY_CONTRACT_VERSION = 'natural-first-memory-continuity/6' as const;

export type NaturalFirstMemoryContinuityStatus =
  | 'memory-cited'
  | 'memory-empty';

export type NaturalFirstMemoryContinuitySnapshot = {
  contractVersion: typeof NATURAL_FIRST_MEMORY_CONTINUITY_CONTRACT_VERSION;
  source: 'NaturalFirstMemoryContinuityService';
  stage: 6;
  phase: 6;
  route: 'memory-recall';
  generatedAt: string;
  status: NaturalFirstMemoryContinuityStatus;
  memoryWithReceiptsLinked: boolean;
  receiptCount: number;
  citedMemoryIds: string[];
  continuity: {
    sessionId: string;
    userId: string;
    channel: string;
    workspace: string | null;
  };
  policy: {
    noMemoryInvented: true;
    citeOnlyReceiptedMemory: true;
    canAskSource: boolean;
    canForgetOrCorrect: boolean;
    noToolExecution: true;
    noApprovalBypass: true;
  };
  nextSafeAction: string;
  summary: string;
};

export type NaturalFirstMemoryContinuityInput = {
  run: UniversalAgentRun;
  request: UniversalAgentRequest;
  generatedAt: string;
  memoryWithReceipts?: MemoryWithReceiptsSnapshot | null;
};

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function listRecords(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    const record = recordOrNull(entry);
    return record ? [record] : [];
  });
}

function isMemoryTool(toolId: string): boolean {
  const normalized = toolId.toLowerCase();
  return normalized.includes('memory')
    || normalized.includes('session')
    || normalized.includes('history')
    || normalized.includes('recall');
}

function readMemoryWithReceipts(run: UniversalAgentRun): MemoryWithReceiptsSnapshot | null {
  const snapshot = recordOrNull(run.metadata.memoryWithReceipts);
  if (!snapshot || snapshot.source !== 'MemoryWithReceiptsService') {
    return null;
  }
  return snapshot as unknown as MemoryWithReceiptsSnapshot;
}

function compact(value: unknown, maxLength = 260): string {
  const text = normalizeText(value).replace(/\s+/g, ' ');
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3)}...`;
}

export class NaturalFirstMemoryContinuityService {
  public shouldHandle(run: UniversalAgentRun, request: UniversalAgentRequest): boolean {
    const route = recordOrNull(run.metadata.naturalFirstRoute);
    if (route?.route !== 'memory-recall') {
      return false;
    }
    const requestedTools = Array.isArray(request.requestedTools)
      ? request.requestedTools.map((tool) => normalizeText(tool)).filter(Boolean)
      : [];
    return requestedTools.every(isMemoryTool)
      && run.approvals.length === 0;
  }

  public buildSnapshot(input: NaturalFirstMemoryContinuityInput): NaturalFirstMemoryContinuitySnapshot {
    const memoryWithReceipts = input.memoryWithReceipts || readMemoryWithReceipts(input.run);
    const receipts = listRecords(memoryWithReceipts?.receipts);
    const citedMemoryIds = receipts.map((receipt) => normalizeText(receipt.memoryId)).filter(Boolean);
    const hasMemory = receipts.length > 0;
    return {
      contractVersion: NATURAL_FIRST_MEMORY_CONTINUITY_CONTRACT_VERSION,
      source: 'NaturalFirstMemoryContinuityService',
      stage: 6,
      phase: 6,
      route: 'memory-recall',
      generatedAt: input.generatedAt,
      status: hasMemory ? 'memory-cited' : 'memory-empty',
      memoryWithReceiptsLinked: Boolean(memoryWithReceipts),
      receiptCount: receipts.length,
      citedMemoryIds,
      continuity: {
        sessionId: input.run.sessionId,
        userId: input.run.userId,
        channel: input.run.channel,
        workspace: input.run.workspace ?? null,
      },
      policy: {
        noMemoryInvented: true,
        citeOnlyReceiptedMemory: true,
        canAskSource: Boolean(memoryWithReceipts?.audit.canAnswerSourceQuestion),
        canForgetOrCorrect: Boolean(memoryWithReceipts?.audit.canForgetOrCorrect),
        noToolExecution: true,
        noApprovalBypass: true,
      },
      nextSafeAction: hasMemory
        ? 'Responder citando somente memorias com receipt e manter comandos de fonte/correcao disponiveis.'
        : 'Dizer que nenhuma memoria recuperada foi encontrada e pedir um detalhe ou uma fonte para continuar.',
      summary: hasMemory
        ? 'Memoria recuperada com receipts para continuidade.'
        : 'Pedido de memoria recebido sem fonte recuperada.',
    };
  }

  public buildReplyText(
    snapshot: NaturalFirstMemoryContinuitySnapshot,
    input: NaturalFirstMemoryContinuityInput,
  ): string {
    const memoryWithReceipts = input.memoryWithReceipts || readMemoryWithReceipts(input.run);
    const receipts = listRecords(memoryWithReceipts?.receipts);
    if (receipts.length === 0) {
      return [
        'Ainda nao encontrei uma memoria recuperada com fonte para responder isso com seguranca.',
        '',
        'Posso continuar se voce me der uma pista, um trecho, um arquivo, ou se quiser posso preparar uma busca de memoria governada.',
      ].join('\n');
    }

    const cited = receipts.slice(0, 4).map((receipt, index) => {
      const title = compact(receipt.title || receipt.memoryId || `memoria ${index + 1}`, 96);
      const summary = compact(receipt.summary, 220);
      const source = compact(receipt.source || receipt.sourceType || 'fonte registrada', 120);
      return `${index + 1}. ${title}: ${summary}\n   Fonte: ${source}`;
    });
    return [
      'Encontrei memoria com origem registrada para continuar:',
      '',
      ...cited,
      '',
      snapshot.policy.canAskSource
        ? 'Posso mostrar a fonte/corrigir/esquecer qualquer item citado.'
        : 'Usei apenas o contexto com receipt disponivel; nao inventei memoria ausente.',
    ].join('\n');
  }

  public apply(input: NaturalFirstMemoryContinuityInput): UniversalAgentRunResult {
    const snapshot = this.buildSnapshot(input);
    const replyText = this.buildReplyText(snapshot, input);
    const run = input.run;
    run.status = 'completed';
    run.summary = snapshot.summary;
    run.updatedAt = input.generatedAt;
    run.metadata = {
      ...run.metadata,
      naturalFirstMemoryContinuity: snapshot,
    };
    run.events.push({
      id: `${run.id}:natural-first-memory-continuity`,
      runId: run.id,
      kind: 'memory',
      title: snapshot.status === 'memory-cited'
        ? 'Memoria recuperada com receipts'
        : 'Memoria nao encontrada com receipt',
      detail: snapshot.summary,
      status: 'done',
      createdAt: input.generatedAt,
      metadata: snapshot,
    });
    const port = run.replyPorts[0] || {
      id: `${run.channel}:primary`,
      label: 'Canal de origem',
      kind: run.channel,
      status: 'available' as const,
      primary: true,
    };

    return {
      ok: true,
      run,
      replies: [
        {
          id: `${run.id}:reply:memory`,
          runId: run.id,
          port,
          text: replyText,
          createdAt: input.generatedAt,
          metadata: {
            source: snapshot.source,
            contractVersion: snapshot.contractVersion,
            status: snapshot.status,
            citedMemoryIds: snapshot.citedMemoryIds,
          },
        },
      ],
    };
  }
}
