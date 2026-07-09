import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TokenCounter } from '../../monitoring/TokenCounter.js';
import type {
  ChatMessage,
  LlmResponse,
  ToolDefinition,
} from '../../providers/ILlmProvider.js';
import {
  containsUntrustedContentMarker,
  withUntrustedInputMetadata,
} from '../../security/UntrustedContent.js';
import { wrapToolOutputForLlm } from '../../security/ToolOutputTrust.js';
import { logger } from '../../logger.js';export type SupervisorGraphStatus = 'approved' | 'max_iterations' | 'failed';

export type SupervisorGraphResult = {
  messages: ChatMessage[];
  task_goal: string;
  critic_feedback: string | null;
  is_approved: boolean;
  status: SupervisorGraphStatus;
  iterations: number;
  error: string | null;
};

export type SupervisorGraphInput = {
  task_goal: string;
  initial_messages?: ChatMessage[];
};

export type SupervisorGraphDependencies = {
  llmRuntime: {
    chat(
      messages: ChatMessage[],
      tools?: ToolDefinition[],
      options?: {
        providerName?: string;
        modelName?: string;
        allowFallback?: boolean;
        fallbackOrder?: string[];
      },
    ): Promise<LlmResponse>;
  };
  toolRuntime?: {
    getToolDefinitions(): ToolDefinition[];
    executeTool(toolName: string, args: unknown): Promise<string>;
  };
  providerName?: string;
  maxIterations?: number;
  maxToolRounds?: number;
  generatorDirectives?: string[];
  criticDirectives?: string[];
};

export type SupervisorGraphApp = {
  invoke(input: SupervisorGraphInput): Promise<SupervisorGraphResult>;
};

type GeneratorStepResult = {
  emittedMessages: ChatMessage[];
  error: string | null;
};

const DEFAULT_MAX_ITERATIONS = 5;
const DEFAULT_MAX_TOOL_ROUNDS = 4;

export function buildSupervisorGraph(dependencies: SupervisorGraphDependencies): SupervisorGraphApp {
  const maxIterations = Math.max(1, dependencies.maxIterations ?? DEFAULT_MAX_ITERATIONS);
  const maxToolRounds = Math.max(0, dependencies.maxToolRounds ?? DEFAULT_MAX_TOOL_ROUNDS);

  return {
    invoke: async (input: SupervisorGraphInput): Promise<SupervisorGraphResult> => {
      const state: SupervisorGraphResult = {
        messages: [...(input.initial_messages || [])],
        task_goal: input.task_goal,
        critic_feedback: null,
        is_approved: false,
        status: 'failed',
        iterations: 0,
        error: null,
      };

      for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
        state.iterations = iteration;

        const generatorStep = await runGeneratorStep(state, dependencies, maxToolRounds);
        state.messages.push(...generatorStep.emittedMessages);

        if (generatorStep.error) {
          state.status = 'failed';
          state.error = generatorStep.error;
          return state;
        }

        state.critic_feedback = null;

        const criticStep = await runCriticStep(state, dependencies);
        if (criticStep.error) {
          state.status = 'failed';
          state.error = criticStep.error;
          return state;
        }

        state.is_approved = criticStep.isApproved;
        state.critic_feedback = criticStep.feedback;

        if (criticStep.isApproved) {
          state.status = 'approved';
          return state;
        }
      }

      state.status = 'max_iterations';
      return state;
    },
  };
}

async function runGeneratorStep(
  state: SupervisorGraphResult,
  dependencies: SupervisorGraphDependencies,
  maxToolRounds: number,
): Promise<GeneratorStepResult> {
  const toolDefinitions = dependencies.toolRuntime?.getToolDefinitions() || [];
  const workingMessages = trimMessagesForContext([
    {
      role: 'system',
      content: buildGeneratorPrompt(state.task_goal, dependencies.generatorDirectives),
    },
    ...state.messages,
    ...(state.critic_feedback
      ? [
          {
            role: 'user' as const,
            content: `Feedback do critico: ${state.critic_feedback}\nCorrija o trabalho e entregue uma nova resposta completa.`,
          },
        ]
      : []),
  ]);

  const emittedMessages: ChatMessage[] = [];
  let toolRounds = 0;
  let response = await dependencies.llmRuntime.chat(
    workingMessages,
    toolDefinitions.length > 0 ? toolDefinitions : undefined,
    {
      providerName: dependencies.providerName,
    },
  );

  while (response.toolCalls.length > 0) {
    if (toolRounds >= maxToolRounds) {
      emittedMessages.push(toAssistantMessage(response));
      return {
        emittedMessages,
        error: 'Limite de execucao de ferramentas atingido antes da resposta final.',
      };
    }

    const assistantMessage = toAssistantMessage(response);
    emittedMessages.push(assistantMessage);
    workingMessages.push(assistantMessage);

    for (const toolCall of response.toolCalls) {
      const toolResult = await executeToolCall(
        toolCall.name,
        toolCall.arguments,
        toolCall.id,
        dependencies,
        containsUntrustedContentMarker(workingMessages) || containsUntrustedContentMarker(toolCall.arguments),
      );
      emittedMessages.push(toolResult);
      workingMessages.push(toolResult);
    }

    toolRounds += 1;
    response = await dependencies.llmRuntime.chat(
      workingMessages,
      toolDefinitions.length > 0 ? toolDefinitions : undefined,
      {
        providerName: dependencies.providerName,
      },
    );
  }

  emittedMessages.push(toAssistantMessage(response));

  return {
    emittedMessages,
    error: null,
  };
}

async function runCriticStep(
  state: SupervisorGraphResult,
  dependencies: SupervisorGraphDependencies,
): Promise<{ isApproved: boolean; feedback: string | null; error: string | null }> {
  const generatorOutput =
    [...state.messages]
      .reverse()
      .find((message) => message.role === 'assistant' && String(message.content || '').trim().length > 0)
      ?.content || '';

  const response = await dependencies.llmRuntime.chat(
    [
      {
        role: 'system',
        content: buildCriticPrompt(dependencies.criticDirectives),
      },
      {
        role: 'user',
        content: [
          `Objetivo original: ${state.task_goal}`,
          '',
          'Trabalho entregue:',
          String(generatorOutput || ''),
          '',
          'Responda exatamente com "APROVADO" se estiver correto.',
          'Se houver problema, responda com o que precisa ser corrigido, de forma objetiva e acionavel.',
        ].join('\n'),
      },
    ],
    undefined,
    {
      providerName: dependencies.providerName,
    },
  );

  const criticContent = String(response.content || '').trim();
  if (!criticContent) {
    return {
      isApproved: false,
      feedback: 'O critico nao retornou feedback utilizavel.',
      error: null,
    };
  }

  return {
    isApproved: criticContent.toUpperCase() === 'APROVADO',
    feedback: criticContent.toUpperCase() === 'APROVADO' ? null : criticContent,
    error: null,
  };
}

/**
 * ZavorthControl controls — Vision In The Loop.
 *
 * Extrai referências de imagem do output textual de ferramentas e converte
 * em InlineData para o pipeline VLM do provedor (Gemini, etc.).
 *
 * Padrões reconhecidos:
 *   Screenshot: C:\caminho\arquivo.png (1920x1080px)
 *   Screenshot local: /tmp/capture.jpg
 *
 * Limites de segurança:
 *   - Máximo 10 MB por imagem (proteção contra payload explosion).
 *   - Somente extensões de imagem conhecidas (.png, .jpg, .jpeg, .webp, .bmp).
 *   - Operação silenciosa: falhas de I/O nunca interrompem a tool chain.
 */
const VISION_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const VISION_MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
};

export function extractVisionPayload(
  toolOutput: string,
): { mimeType: string; data: string } | null {
  // Captura: Screenshot: <path>  ou  Screenshot local: <path>
  const match = toolOutput.match(/Screenshot(?:\s+local)?:\s*([^\n(]+)/i);
  if (!match || !match[1]) return null;

  const rawPath = match[1].trim();
  const ext = rawPath.slice(rawPath.lastIndexOf('.')).toLowerCase();
  const mimeType = VISION_MIME_MAP[ext];
  if (!mimeType) return null;

  try {
    if (!fs.existsSync(rawPath)) return null;
    if (!isAllowedVisionPath(rawPath)) return null;

    const stats = fs.statSync(rawPath);
    if (stats.size === 0 || stats.size > VISION_MAX_BYTES) return null;

    const buffer = fs.readFileSync(rawPath);
    return { mimeType, data: buffer.toString('base64') };
  } catch (error: unknown) {logger.warn('[Supervisor Graph] filesystem operation failed', error); return null; }
}

async function executeToolCall(
  toolName: string,
  args: unknown,
  toolCallId: string,
  dependencies: SupervisorGraphDependencies,
  influencedByUntrustedContent = false,
): Promise<ChatMessage> {
  if (!dependencies.toolRuntime) {
    return {
      role: 'tool',
      content: wrapToolOutputForLlm(toolName, 'Tool runtime indisponivel nesta execucao.', {
        source: 'supervisor_graph_tool_result',
        tool_call_id: toolCallId,
      }),
      toolCallId,
      toolName,
    };
  }

  try {
    const toolArgs = influencedByUntrustedContent
      ? withUntrustedInputMetadata(args, 'supervisor-graph-contained-untrusted-tool-output')
      : args;
    const result = await dependencies.toolRuntime.executeTool(toolName, toolArgs);
    const contentStr = String(result ?? '');
    const chatMsg: ChatMessage = {
      role: 'tool',
      content: wrapToolOutputForLlm(toolName, contentStr, {
        source: 'supervisor_graph_tool_result',
        tool_call_id: toolCallId,
      }),
      toolCallId,
      toolName,
    };

    // ZavorthControl controls: Injeção de visão computacional
    const visionPayload = extractVisionPayload(contentStr);
    if (visionPayload) {
      chatMsg.inlineData = [visionPayload];
    }

    return chatMsg;
  } catch (error: unknown) {logger.warn('[Supervisor Graph] load operation failed', error);
    return {
      role: 'tool',
      content: wrapToolOutputForLlm(toolName, `TOOL EXECUTION ERROR: ${error?.message || error}`, {
        source: 'supervisor_graph_tool_result',
        tool_call_id: toolCallId,
      }),
      toolCallId,
      toolName,
    };
  }
}

function toAssistantMessage(response: LlmResponse): ChatMessage {
  return {
    role: 'assistant',
    content: response.content,
    toolCalls: response.toolCalls,
  };
}

function trimMessagesForContext(messages: ChatMessage[]): ChatMessage[] {
  const trimmed = [...messages];

  while (
    trimmed.length > 6 &&
    TokenCounter.isApproachingLimit(
      trimmed.map((message) => String(message.content || '')).join('\n'),
      64_000,
    )
  ) {
    // ZavorthControl controls: Encontrar um par de mensagens para remover que NÃO contenha
    // inlineData (screenshots), para não perder o payload visual.
    let spliceIndex = 1;
    while (spliceIndex < trimmed.length - 2) {
      const hasVision =
        trimmed[spliceIndex]?.inlineData?.length ||
        trimmed[spliceIndex + 1]?.inlineData?.length;
      if (!hasVision) break;
      spliceIndex += 1;
    }
    // Se todas as mensagens restantes tiverem visão, removemos mesmo assim
    // para não entrar em loop infinito.
    trimmed.splice(spliceIndex, 2);
  }

  return trimmed;
}

function resolveAllowedVisionRoots(): string[] {
  const envRoots = String(process.env.ZAVORTH_GRAPH_VISION_ALLOWED_ROOTS || '')
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
  return Array.from(new Set([
    process.cwd(),
    os.tmpdir(),
    ...envRoots,
  ])).flatMap((root) => {
    try {
      return [fs.realpathSync(root)];
    } catch (error: unknown) {logger.warn('[Supervisor Graph] path resolution failed', error);
    return [path.resolve(root)];
  }
  });
}

function isAllowedVisionPath(candidatePath: string): boolean {
  let resolvedCandidate = '';
  try {
    resolvedCandidate = fs.realpathSync(candidatePath);
  } catch (error: unknown) {logger.warn('[Supervisor Graph] path resolution failed', error);
    resolvedCandidate = path.resolve(candidatePath);
  }

  return resolveAllowedVisionRoots().some((root) => {
    const relative = path.relative(root, resolvedCandidate);
    return relative === '' || (Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative));
  });
}

function buildGeneratorPrompt(taskGoal: string, directives: string[] = []): string {
  const lines = [
    'Voce e o agente gerador do Zavorth.',
    `Objetivo: "${taskGoal}".`,
    'Construa a melhor resposta ou solucao possivel para esse objetivo.',
    'Se receber feedback do critico, corrija completamente a entrega.',
    'Use ferramentas apenas quando elas realmente ajudarem a concluir a tarefa.',
    'Se houver mensagens de sistema com heuristicas operacionais do workspace, trate-as como sinal prioritario para escolher estrategia, caminhos, verificacoes e estilo final da entrega.',
  ];

  if (directives.length > 0) {
    lines.push('Siga tambem estas diretivas adicionais do perfil atual:');
    lines.push(...directives.map((directive) => `- ${directive}`));
  }

  return lines.join('\n');
}

function buildCriticPrompt(directives: string[] = []): string {
  const lines = [
    'Voce e o agente critico do Zavorth.',
    'Avalie se o trabalho atende o objetivo com clareza, logica e sem alucinacoes.',
  ];

  if (directives.length > 0) {
    lines.push('Use este rigor adicional ao decidir a aprovacao:');
    lines.push(...directives.map((directive) => `- ${directive}`));
  }

  return lines.join('\n');
}
