import crypto from 'crypto';
import type { ChatMessage, ToolDefinition } from '../providers/ILlmProvider.js';
import { LlmRuntimeService, type LlmRuntimeResult } from './llm/LlmRuntimeService.js';
import type {
  ZavorthSubagentRuntimeExecutionMode,
  ZavorthSubagentRuntimeMode,
  ZavorthSubagentRuntimeWorkerResult,
} from '../contracts/runtime/ZavorthSubagentRuntimeContract.js';
import type { ZavorthGovernedSubagentProfile } from '../contracts/runtime/ZavorthGovernedSubagentContract.js';
import { buildUntrustedContentFirewallInstruction } from '../security/UntrustedContent.js';
import { wrapToolOutputForLlm } from '../security/ToolOutputTrust.js';
import { logger } from '../logger.js';
import {
decideSecurityPolicy,
  type SecurityPolicyBrokerDecision,
} from '../security/SecurityPolicyBroker.js';

type LlmRuntimeLike = Pick<LlmRuntimeService, 'chatDetailed' | 'getPreferredProviderName'>;
type SubagentToolRuntimeLike = {
  getToolDefinitions(): ToolDefinition[];
  executeTool(toolName: string, args: unknown): Promise<string>;
};

export type ZavorthLiveSubagentWorkerInput = {
  workerId: string;
  runId: string;
  sessionId: string;
  task: string;
  mode: ZavorthSubagentRuntimeMode;
  channel: string;
  actorId: string | null;
  profile: ZavorthGovernedSubagentProfile;
  providerName?: string | null;
  modelName?: string | null;
  maxOutputChars: number;
  maxToolCalls: number;
};

export type ZavorthLiveSubagentBackend = {
  id: string;
  externalIoPerformed: boolean;
  runWorker(input: ZavorthLiveSubagentWorkerInput): Promise<ZavorthSubagentRuntimeWorkerResult>;
};

export type ZavorthLiveSubagentExecutionInput = {
  executionMode: ZavorthSubagentRuntimeExecutionMode;
  runId: string;
  sessionId: string;
  task: string;
  mode: ZavorthSubagentRuntimeMode;
  channel: string;
  actorId: string | null;
  profiles: ZavorthGovernedSubagentProfile[];
  providerName?: string | null;
  modelName?: string | null;
  maxWorkers: number;
  maxOutputChars: number;
  maxToolCalls: number;
};

export type ZavorthLiveSubagentExecutionResult = {
  executionMode: ZavorthSubagentRuntimeExecutionMode;
  backend: string;
  startedAt: string;
  completedAt: string;
  workerResults: ZavorthSubagentRuntimeWorkerResult[];
  summary: string;
  output: string;
  externalIoPerformed: boolean;
  upstreamRuntimeCodeExecuted: false;
};

type Runtime = {
  now?: () => Date;
  llmRuntime?: LlmRuntimeLike | null;
  toolRuntime?: SubagentToolRuntimeLike | null;
  backend?: ZavorthLiveSubagentBackend | null;
};

export class ZavorthLiveSubagentExecutionService {
  private readonly now: () => Date;
  private readonly llmRuntime: LlmRuntimeLike;
  private readonly toolRuntime: SubagentToolRuntimeLike | null;
  private readonly backend: ZavorthLiveSubagentBackend | null;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.llmRuntime = runtime.llmRuntime || new LlmRuntimeService();
    this.toolRuntime = runtime.toolRuntime || null;
    this.backend = runtime.backend || null;
  }

  public async executeTeam(input: ZavorthLiveSubagentExecutionInput): Promise<ZavorthLiveSubagentExecutionResult> {
    const startedAt = this.now().toISOString();
    const backend = this.resolveBackend(input.executionMode);
    const profiles = input.profiles.slice(0, Math.max(1, input.maxWorkers));
    const workerResults = await Promise.all(profiles.map(async (profile) => {
      const workerId = `subagent-worker:${stableId(input.runId, profile.id)}`;
      try {
        return await backend.runWorker({
          workerId,
          runId: input.runId,
          sessionId: input.sessionId,
          task: input.task,
          mode: input.mode,
          channel: input.channel,
          actorId: input.actorId,
          profile,
          providerName: input.providerName,
          modelName: input.modelName,
          maxOutputChars: input.maxOutputChars,
          maxToolCalls: input.maxToolCalls,
        });
      } catch (error: unknown) {
        const completedAt = this.now().toISOString();
        return {
          workerId,
          roleId: profile.id,
          status: 'failed' as const,
          backend: backend.id,
          startedAt,
          completedAt,
          providerName: input.providerName || null,
          modelName: input.modelName || null,
          summary: `Worker ${profile.id} failed before producing a governed answer.`,
          output: '',
          error: error instanceof Error ? error.message : String(error),
          receiptId: null,
          metadata: {
            channel: input.channel,
            mode: input.mode,
          },
        };
      }
    }));
    const completedAt = this.now().toISOString();
    const completed = workerResults.filter((entry) => entry.status === 'completed').length;
    const failed = workerResults.length - completed;
    return {
      executionMode: input.executionMode,
      backend: backend.id,
      startedAt,
      completedAt,
      workerResults,
      summary: `Live subagent workers completed=${completed}, failed=${failed}, backend=${backend.id}.`,
      output: formatWorkerOutput(input.task, workerResults),
      externalIoPerformed: backend.externalIoPerformed,
      upstreamRuntimeCodeExecuted: false,
    };
  }

  private resolveBackend(executionMode: ZavorthSubagentRuntimeExecutionMode): ZavorthLiveSubagentBackend {
    if (executionMode === 'mock-live') {
      return createDeterministicLiveSubagentBackend({ now: this.now });
    }
      return this.backend || new LlmRuntimeSubagentBackend({
        now: this.now,
        llmRuntime: this.llmRuntime,
        toolRuntime: this.toolRuntime,
      });
  }
}

export function createDeterministicLiveSubagentBackend(runtime: { now?: () => Date } = {}): ZavorthLiveSubagentBackend {
  const now = runtime.now || (() => new Date());
  return {
    id: 'mock-live-subagent-backend',
    externalIoPerformed: false,
    async runWorker(input: ZavorthLiveSubagentWorkerInput): Promise<ZavorthSubagentRuntimeWorkerResult> {
      const startedAt = now().toISOString();
      const completedAt = now().toISOString();
      const output = [
        `${input.profile.label} result`,
        `Task: ${firstLine(input.task)}`,
        `Scope: read-only, governed, concurrent worker.`,
      ].join('\n');
      return {
        workerId: input.workerId,
        roleId: input.profile.id,
        status: 'completed',
        backend: 'mock-live-subagent-backend',
        startedAt,
        completedAt,
        providerName: null,
        modelName: null,
        summary: `${input.profile.label} produced a deterministic governed result.`,
        output,
        error: null,
        receiptId: null,
        metadata: {
          deterministic: true,
          channel: input.channel,
          mode: input.mode,
        },
      };
    },
  };
}

class LlmRuntimeSubagentBackend implements ZavorthLiveSubagentBackend {
  public readonly id = 'zavorth-llm-runtime-subagent-backend';
  public readonly externalIoPerformed = true;
  private readonly now: () => Date;
  private readonly llmRuntime: LlmRuntimeLike;
  private readonly toolRuntime: SubagentToolRuntimeLike | null;

  public constructor(runtime: { now: () => Date; llmRuntime: LlmRuntimeLike; toolRuntime?: SubagentToolRuntimeLike | null }) {
    this.now = runtime.now;
    this.llmRuntime = runtime.llmRuntime;
    this.toolRuntime = runtime.toolRuntime || null;
  }

  public async runWorker(input: ZavorthLiveSubagentWorkerInput): Promise<ZavorthSubagentRuntimeWorkerResult> {
    const startedAt = this.now().toISOString();
    const messages = this.buildMessages(input);
    const tools = this.selectReadOnlyTools(input);
    const toolStats = {
      requested: 0,
      approved: 0,
      denied: 0,
      executed: 0,
      policyReceiptId: null as string | null,
    };
    let result = await this.llmRuntime.chatDetailed(messages, tools.length > 0 ? tools : [], {
      providerName: input.providerName || undefined,
      modelName: input.modelName || undefined,
      allowFallback: true,
      telemetry: {
        runId: input.runId,
        sessionId: input.sessionId,
        surface: `subagent:${input.channel}`,
      },
      toolPolicy: {
        requestedTools: tools.map((tool) => tool.name),
        approvedToolIds: tools.map((tool) => tool.name),
        approvalGranted: false,
        exposedTools: tools.map((tool) => ({
          id: tool.name,
          risk: tool.name === 'web_search' ? 'review' : 'safe',
          requiresApproval: false,
        })),
      },
    });
    for (let round = 0; round < Math.max(0, input.maxToolCalls); round += 1) {
      const toolCalls = result.response.toolCalls || [];
      if (toolCalls.length === 0 || !this.toolRuntime || tools.length === 0) {
        break;
      }
      const knownTools = new Set(tools.map((tool) => tool.name));
      const toolMessages: ChatMessage[] = [];
      for (const toolCall of toolCalls.slice(0, Math.max(1, input.maxToolCalls - toolStats.requested))) {
        toolStats.requested += 1;
        const toolDecision = this.decideToolCall(input, toolCall.name, toolCall.arguments, knownTools);
        toolStats.policyReceiptId = toolDecision.receipt.receiptId;
        if (!toolDecision.allowed) {
          toolStats.denied += 1;
          toolMessages.push({
            role: 'tool',
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            content: wrapToolOutputForLlm(toolCall.name, `Denied by Policy Broker: ${toolDecision.reasons.join(' ')}`, {
              source: 'subagent_readonly_tool_result',
              policy_receipt_id: toolDecision.receipt.receiptId,
            }),
          });
          continue;
        }
        toolStats.approved += 1;
        let toolResult = '';
        try {
          toolResult = await this.toolRuntime.executeTool(toolCall.name, toolCall.arguments);
          toolStats.executed += 1;
        } catch (error: unknown) {
          logger.warn('[Zavorth Live Subagent Execution] process execution failed', error);
    toolResult = `Tool ${toolCall.name} failed: ${error instanceof Error ? error.message : String(error)}`;
  }
        toolMessages.push({
          role: 'tool',
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          content: wrapToolOutputForLlm(toolCall.name, clampText(toolResult, 6000), {
            source: 'subagent_readonly_tool_result',
            policy_receipt_id: toolDecision.receipt.receiptId,
          }),
        });
      }
      if (toolMessages.length === 0) {
        break;
      }
      messages.push({
        role: 'assistant',
        content: result.response.content || '',
        toolCalls: result.response.toolCalls,
      });
      messages.push(...toolMessages);
      result = await this.llmRuntime.chatDetailed(messages, tools.length > 0 ? tools : [], {
        providerName: input.providerName || undefined,
        modelName: input.modelName || undefined,
        allowFallback: true,
        telemetry: {
          runId: input.runId,
          sessionId: input.sessionId,
          surface: `subagent:${input.channel}`,
        },
        toolPolicy: {
          requestedTools: tools.map((tool) => tool.name),
          approvedToolIds: tools.map((tool) => tool.name),
          approvalGranted: false,
          exposedTools: tools.map((tool) => ({
            id: tool.name,
            risk: tool.name === 'web_search' ? 'review' : 'safe',
            requiresApproval: false,
          })),
        },
      });
      if (toolStats.requested >= input.maxToolCalls) {
        break;
      }
    }
    const completedAt = this.now().toISOString();
    const output = clampText(
      appendToolUseSummary(String(result.response.content || '').trim() || 'Worker completed with an empty provider response.', toolStats),
      input.maxOutputChars,
    );
    return {
      workerId: input.workerId,
      roleId: input.profile.id,
      status: 'completed',
      backend: this.id,
      startedAt,
      completedAt,
      providerName: result.providerName,
      modelName: result.modelName || null,
      summary: summarizeLlmResult(input.profile.label, output, result),
      output,
      error: null,
      receiptId: toolStats.policyReceiptId,
      metadata: {
        channel: input.channel,
        mode: input.mode,
        fallbackUsed: result.route.fallbackUsed,
        attempts: result.route.attempts.length,
        readOnlyToolsExposed: tools.length,
        toolCallsRequested: toolStats.requested,
        toolCallsApproved: toolStats.approved,
        toolCallsDenied: toolStats.denied,
        toolCallsExecuted: toolStats.executed,
      },
    };
  }

  private buildMessages(input: ZavorthLiveSubagentWorkerInput): ChatMessage[] {
    const system = [
      'Voce e um subagente vivo do Zavorth, executado pelo runtime LLM governado.',
      `Papel: ${input.profile.label}. Objetivo: ${input.profile.objective}.`,
      'Responda somente dentro do escopo read-only: analisar, pesquisar, ler arquivos permitidos, listar diretorios permitidos, sintetizar e recomendar.',
      'Ferramentas read-only podem estar disponiveis. Use-as quando ajudarem, mas nunca solicite escrita, shell, automacao de desktop, envio externo ou segredos.',
      'Se a tarefa exigir escrita, rede sensivel, envio externo ou ferramenta fora da allowlist read-only, diga qual approval/policy e necessario.',
      buildUntrustedContentFirewallInstruction(),
      'Formato de saida: Findings, Risks, Recommended next step.',
    ].join('\n');
    const user = [
      `Canal: ${input.channel}. Modo: ${input.mode}.`,
      `Tarefa do subagente: ${input.task}`,
    ].join('\n');
    return [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ];
  }

  private selectReadOnlyTools(input: ZavorthLiveSubagentWorkerInput): ToolDefinition[] {
    if (!this.toolRuntime) {
      return [];
    }
    const task = stripAccents(input.task.toLowerCase());
    const definitions = this.toolRuntime.getToolDefinitions();
    const allowedNames = new Set(['read_file', 'list_directory', 'workspace.read', 'workspace.list', 'web_search', 'get_datetime']);
    return definitions
      .filter((tool) => allowedNames.has(tool.name))
      .filter((tool) => {
        if (tool.name === 'web_search') {
          return /\b(web|internet|noticia|noticias|news|fonte|fontes|link|links|pesquis|busc|research|atual|current)\b/.test(task);
        }
        return true;
      })
      .slice(0, 6);
  }

  private decideToolCall(
    input: ZavorthLiveSubagentWorkerInput,
    toolName: string,
    args: unknown,
    knownTools: Set<string>,
  ): SecurityPolicyBrokerDecision {
    const risk = classifyToolCallRisk(toolName, args, knownTools);
    return decideSecurityPolicy({
      surface: risk.surface,
      operation: 'subagent-readonly-tool-call',
      target: `${toolName}:${firstLine(JSON.stringify(args || {}))}`,
      sourceTrust: 'trusted',
      risk: risk.blocked ? 'forbidden' : risk.requiresApproval ? 'review' : 'safe',
      blocked: risk.blocked,
      userConfirmationRequired: risk.requiresApproval,
      reasons: [
        'Subagent tool call evaluated by central Policy Broker.',
        ...risk.reasons,
      ],
      metadata: {
        runId: input.runId,
        sessionId: input.sessionId,
        workerId: input.workerId,
        roleId: input.profile.id,
        toolName,
      },
    }, { now: this.now });
  }
}

type ToolCallRisk = {
  surface: 'workspace' | 'web-fetch' | 'provider' | 'desktop-automation' | 'skill';
  blocked: boolean;
  requiresApproval: boolean;
  reasons: string[];
};

function classifyToolCallRisk(toolName: string, args: unknown, knownTools: Set<string>): ToolCallRisk {
  const normalized = String(toolName || '').trim();
  const serializedArgs = stripAccents(JSON.stringify(args || {}).toLowerCase());
  if (!knownTools.has(normalized)) {
    return {
      surface: 'skill',
      blocked: true,
      requiresApproval: false,
      reasons: [`tool-not-exposed-to-subagent:${normalized || 'unknown'}`],
    };
  }
  if (['read_file', 'workspace.read', 'list_directory', 'workspace.list'].includes(normalized)) {
    if (/\b(\.env|id_rsa|private[_-]?key|secret|token|credential|credencial|senha|password|\.ssh)\b/.test(serializedArgs)) {
      return {
        surface: 'workspace',
        blocked: true,
        requiresApproval: false,
        reasons: ['secret-like-path-blocked-for-subagent-tool'],
      };
    }
    return {
      surface: 'workspace',
      blocked: false,
      requiresApproval: false,
      reasons: ['workspace-readonly-tool-allowed'],
    };
  }
  if (normalized === 'web_search') {
    if (/\b(localhost|127\.0\.0\.1|169\.254|0\.0\.0\.0|metadata|internal api|webhook|file:\/\/|ftp:\/\/)\b/.test(serializedArgs)) {
      return {
        surface: 'web-fetch',
        blocked: true,
        requiresApproval: false,
        reasons: ['sensitive-network-target-blocked-for-subagent-tool'],
      };
    }
    return {
      surface: 'web-fetch',
      blocked: false,
      requiresApproval: false,
      reasons: ['public-web-search-readonly-tool-allowed'],
    };
  }
  if (normalized === 'get_datetime') {
    return {
      surface: 'provider',
      blocked: false,
      requiresApproval: false,
      reasons: ['datetime-readonly-tool-allowed'],
    };
  }
  return {
    surface: 'skill',
    blocked: true,
    requiresApproval: false,
    reasons: [`mutating-or-unknown-tool-blocked:${normalized}`],
  };
}

function appendToolUseSummary(output: string, stats: {
  requested: number;
  approved: number;
  denied: number;
  executed: number;
}): string {
  if (stats.requested === 0) {
    return output;
  }
  return [
    output,
    '',
    `Tool policy: requested=${stats.requested}, approved=${stats.approved}, executed=${stats.executed}, denied=${stats.denied}.`,
  ].join('\n');
}

function summarizeLlmResult(label: string, output: string, result: LlmRuntimeResult): string {
  const provider = [result.providerName, result.modelName].filter(Boolean).join('/') || result.providerName;
  return `${label} respondeu via ${provider}: ${firstLine(output)}`;
}

function formatWorkerOutput(task: string, results: ZavorthSubagentRuntimeWorkerResult[]): string {
  const lines = [
    'Live governed subagent result.',
    `Task: ${firstLine(task)}`,
    '',
    'Workers:',
  ];
  for (const result of results) {
    lines.push(`- ${result.roleId}: ${result.status} via ${result.backend}`);
    if (result.output) {
      lines.push(indent(clampText(result.output, 1800)));
    }
    if (result.error) {
      lines.push(indent(`Error: ${result.error}`));
    }
  }
  return lines.join('\n');
}

function indent(value: string): string {
  return value.split(/\r?\n/).map((line) => `  ${line}`).join('\n');
}

function clampText(value: string, maxChars: number): string {
  const limit = Math.max(120, maxChars || 4000);
  const text = String(value || '').trim();
  return text.length <= limit ? text : `${text.slice(0, limit - 20).trim()}\n[truncated]`;
}

function firstLine(value: string): string {
  return String(value || '').split(/\r?\n/)[0]?.trim().slice(0, 220) || 'n/d';
}

function stripAccents(value: string): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function stableId(...parts: string[]): string {
  return crypto.createHash('sha256').update(parts.join('\n')).digest('hex').slice(0, 16);
}
