import type {
  UniversalAgentExecutorResult,
  UniversalAgentRequest,
  UniversalAgentRun,
} from './UniversalAgentRuntimeTypes.js';

export const NATURAL_FIRST_LLM_RUNTIME_CONTRACT_VERSION = 'natural-first-llm-runtime/5' as const;

export type NaturalFirstLlmRuntimeSnapshot = {
  contractVersion: typeof NATURAL_FIRST_LLM_RUNTIME_CONTRACT_VERSION;
  source: 'NaturalFirstLlmRuntime';
  phase: 5;
  route: 'llm-reply';
  providerConfigured: boolean;
  providerUsed: boolean;
  fallbackUsed: boolean;
  generatedBy: 'llm-runtime' | 'honest-local-fallback';
  summary: string;
  nextSafeAction: string;
  safety: {
    noToolExecution: true;
    noApprovalBypass: true;
    noExternalProviderCall: boolean;
    didNotClaimExecution: true;
  };
};

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function isNaturalFirstLlmReplyRun(run: UniversalAgentRun): boolean {
  return recordOrNull(run.metadata.naturalFirstRoute)?.route === 'llm-reply';
}

export function buildNaturalFirstLlmRuntimeSnapshot(input: {
  providerConfigured: boolean;
  providerUsed: boolean;
  fallbackUsed: boolean;
  generatedBy: NaturalFirstLlmRuntimeSnapshot['generatedBy'];
  providerName?: string | null;
  modelName?: string | null;
}): NaturalFirstLlmRuntimeSnapshot & {
  providerName?: string | null;
  modelName?: string | null;
} {
  const providerName = normalizeText(input.providerName) || null;
  const modelName = normalizeText(input.modelName) || null;
  return {
    contractVersion: NATURAL_FIRST_LLM_RUNTIME_CONTRACT_VERSION,
    source: 'NaturalFirstLlmRuntime',
    phase: 5,
    route: 'llm-reply',
    providerConfigured: input.providerConfigured,
    providerUsed: input.providerUsed,
    fallbackUsed: input.fallbackUsed,
    generatedBy: input.generatedBy,
    ...(providerName ? { providerName } : {}),
    ...(modelName ? { modelName } : {}),
    summary: input.providerUsed
      ? 'Pergunta livre respondida pelo provider runtime governado.'
      : 'Pergunta livre recebeu fallback local honesto porque nenhum provider esta configurado.',
    nextSafeAction: input.providerUsed
      ? 'Manter resposta natural pelo runtime LLM; tools continuam fora desse caminho.'
      : 'Configurar um provider LLM ou transformar o pedido em uma acao governada com escopo claro.',
    safety: {
      noToolExecution: true,
      noApprovalBypass: true,
      noExternalProviderCall: !input.providerUsed,
      didNotClaimExecution: true,
    },
  };
}

export class NaturalFirstLlmFallbackService {
  public shouldHandle(run: UniversalAgentRun): boolean {
    return isNaturalFirstLlmReplyRun(run);
  }

  public buildResult(
    run: UniversalAgentRun,
    request: UniversalAgentRequest,
  ): UniversalAgentExecutorResult {
    const snapshot = buildNaturalFirstLlmRuntimeSnapshot({
      providerConfigured: false,
      providerUsed: false,
      fallbackUsed: true,
      generatedBy: 'honest-local-fallback',
    });
    const text = normalizeText(request.text || run.input);
    const replyText = [
      'Consigo receber essa pergunta pelo runtime natural, mas ainda nao ha provider LLM configurado para gerar uma resposta de modelo.',
      '',
      text
        ? `Pedido recebido: "${text}".`
        : 'Pedido recebido sem texto suficiente para responder com precisao.',
      '',
      'Proximo passo util: configure um provider LLM ou me peca uma acao governada especifica, como descobrir capabilities, consultar memoria ou preparar um preview de ferramenta.',
    ].join('\n');

    return {
      status: 'completed',
      summary: snapshot.summary,
      replyText,
      events: [
        {
          kind: 'reply',
          title: 'Fallback LLM natural',
          detail: 'Nenhum provider LLM configurado; resposta local honesta enviada sem executar ferramentas.',
          status: 'done',
          metadata: snapshot,
        },
      ],
      metadata: {
        naturalFirstLlmRuntime: snapshot,
        executorResolution: {
          source: 'NaturalFirstLlmFallbackService',
          status: 'missing-llm-provider',
          route: 'llm-reply',
          gracefulFallback: true,
          requires: ['llmRuntime'],
        },
      },
    };
  }
}
