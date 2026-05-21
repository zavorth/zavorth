import type {
  UniversalAgentRequest,
  UniversalAgentRun,
  UniversalAgentRunResult,
  UniversalMemorySignal,
} from './UniversalAgentRuntimeTypes.js';

export const NATURAL_FIRST_LIGHT_REPLY_CONTRACT_VERSION = 'natural-first-light-reply/4' as const;

export type NaturalFirstLightReplyKind =
  | 'empty'
  | 'greeting'
  | 'ack'
  | 'follow-up';

export type NaturalFirstLightReplySnapshot = {
  contractVersion: typeof NATURAL_FIRST_LIGHT_REPLY_CONTRACT_VERSION;
  source: 'NaturalFirstLightReplyService';
  stage: 4;
  phase: 4;
  route: 'light-chat';
  kind: NaturalFirstLightReplyKind;
  generatedAt: string;
  summary: string;
  replyText: string;
  continuity: {
    recorded: true;
    layer: 'working';
    sessionId: string;
    userId: string;
  };
  safety: {
    noExecutorCalled: true;
    noToolExecution: true;
    noLlmRequired: true;
    approvalBypass: false;
  };
  cost: {
    tier: 'cheap';
    contextBudget: 'minimal';
  };
  reason: string;
};

export type NaturalFirstLightReplyInput = {
  run: UniversalAgentRun;
  request: UniversalAgentRequest;
  generatedAt: string;
};

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeSearchText(value: unknown): string {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function resolveKind(text: string): NaturalFirstLightReplyKind {
  if (!text) {
    return 'empty';
  }
  if (/^(oi|ola|hey|hello|bom dia|boa tarde|boa noite|tudo bem)[!.?\s]*$/.test(text)) {
    return 'greeting';
  }
  if (/^(valeu|obrigado|obrigada|thanks|ok|beleza|show|perfeito|certo|pode ser|sim|nao)[!.?\s]*$/.test(text)) {
    return 'ack';
  }
  return 'follow-up';
}

function buildReplyText(kind: NaturalFirstLightReplyKind, run: UniversalAgentRun): string {
  if (kind === 'empty') {
    return 'Estou aqui. Me diga o que voce quer fazer e eu sigo pelo runtime certo.';
  }
  if (kind === 'greeting') {
    return 'Oi. Estou aqui, pronto para continuar pelo Zavorth.';
  }
  if (kind === 'ack') {
    return 'Fechado. Sigo por aqui.';
  }
  return run.sessionId
    ? 'Claro. Posso detalhar o ponto anterior; me diga qual parte quer abrir.'
    : 'Claro. Me diga qual parte voce quer que eu detalhe.';
}

export class NaturalFirstLightReplyService {
  public shouldHandle(run: UniversalAgentRun, request: UniversalAgentRequest): boolean {
    const route = recordOrNull(run.metadata.naturalFirstRoute);
    const risk = recordOrNull(route?.risk);
    const requestedTools = Array.isArray(request.requestedTools)
      ? request.requestedTools.filter((tool) => normalizeText(tool))
      : [];

    return route?.route === 'light-chat'
      && risk?.requiresApproval !== true
      && requestedTools.length === 0
      && run.toolExposure.tools.length === 0
      && run.approvals.length === 0;
  }

  public buildSnapshot(input: NaturalFirstLightReplyInput): NaturalFirstLightReplySnapshot {
    const text = normalizeSearchText(input.request.text);
    const kind = resolveKind(text);
    const replyText = buildReplyText(kind, input.run);
    return {
      contractVersion: NATURAL_FIRST_LIGHT_REPLY_CONTRACT_VERSION,
      source: 'NaturalFirstLightReplyService',
      stage: 4,
      phase: 4,
      route: 'light-chat',
      kind,
      generatedAt: input.generatedAt,
      summary: 'Resposta leve governada concluida sem executor.',
      replyText,
      continuity: {
        recorded: true,
        layer: 'working',
        sessionId: input.run.sessionId,
        userId: input.run.userId,
      },
      safety: {
        noExecutorCalled: true,
        noToolExecution: true,
        noLlmRequired: true,
        approvalBypass: false,
      },
      cost: {
        tier: 'cheap',
        contextBudget: 'minimal',
      },
      reason: 'Light chat responde com contexto minimo, registra continuidade e nao aciona executor/tool/LLM.',
    };
  }

  public buildMemorySignal(
    run: UniversalAgentRun,
    snapshot: NaturalFirstLightReplySnapshot,
  ): UniversalMemorySignal {
    return {
      id: `natural-first-light:${run.id}`,
      title: 'Continuidade leve registrada',
      layer: 'working',
      summary: `Light chat ${snapshot.kind} preservado na sessao ${run.sessionId}.`,
      confidence: 0.72,
    };
  }

  public apply(
    input: NaturalFirstLightReplyInput,
  ): UniversalAgentRunResult {
    const snapshot = this.buildSnapshot(input);
    const run = input.run;
    run.status = 'completed';
    run.summary = snapshot.summary;
    run.updatedAt = input.generatedAt;
    run.metadata = {
      ...run.metadata,
      naturalFirstLightReply: snapshot,
    };
    run.memorySignals = [
      ...run.memorySignals,
      this.buildMemorySignal(run, snapshot),
    ];
    run.events.push({
      id: `${run.id}:natural-first-light-reply`,
      runId: run.id,
      kind: 'reply',
      title: 'Resposta leve governada',
      detail: snapshot.replyText,
      status: 'done',
      createdAt: input.generatedAt,
      metadata: snapshot,
    });
    const port = run.replyPorts[0] || {
      id: `${run.channel}:primary`,
      label: 'Canal de origem',
      kind: run.channel,
      status: 'available',
      primary: true,
    };

    return {
      ok: true,
      run,
      replies: [
        {
          id: `${run.id}:reply:light`,
          runId: run.id,
          port,
          text: snapshot.replyText,
          createdAt: input.generatedAt,
          metadata: {
            source: snapshot.source,
            contractVersion: snapshot.contractVersion,
            noExecutorCalled: true,
          },
        },
      ],
    };
  }
}
