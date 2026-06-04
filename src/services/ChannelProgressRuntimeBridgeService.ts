import type { CanonicalChannelPlatform } from '../channels/contracts/ChannelMessageContract.js';
import type { ChannelProgressEvent, ChannelProgressStage } from '../contracts/ChannelProgressContract.js';
import type {
  AgentRunRuntimeEventBus,
  AgentRunRuntimeEventType,
} from '../runtime/agent/index.js';
import { ChannelProgressSurfaceService } from './ChannelProgressSurfaceService.js';

type ChannelProgressRuntimeBridgeRuntime = {
  progressSurface?: Pick<ChannelProgressSurfaceService, 'publish' | 'snapshot'> | null;
  enabledChannels?: CanonicalChannelPlatform[];
  now?: () => Date;
};

const DEFAULT_CHANNELS: CanonicalChannelPlatform[] = [
  'telegram',
  'discord',
  'slack',
  'teams',
  'whatsapp',
  'signal',
  'imessage',
  'email',
];

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function isChannel(value: unknown): value is CanonicalChannelPlatform {
  return DEFAULT_CHANNELS.includes(String(value || '').trim().toLowerCase() as CanonicalChannelPlatform);
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function compactDetail(value: unknown, fallback: string): string {
  const text = normalizeText(value, fallback).replace(/\s+/g, ' ');
  return text.length > 240 ? `${text.slice(0, 237).trimEnd()}...` : text;
}

function inferToolName(payload: Record<string, unknown>): string | null {
  const direct = normalizeText(payload.toolName || payload.tool || payload.actionId || payload.integrationId);
  if (direct) {
    return direct;
  }
  const delta = recordOrNull(payload.toolCallDelta);
  return normalizeText(delta?.name || delta?.toolName || delta?.functionName) || null;
}

export class ChannelProgressRuntimeBridgeService implements AgentRunRuntimeEventBus {
  private readonly progressSurface: Pick<ChannelProgressSurfaceService, 'publish' | 'snapshot'>;
  private readonly enabledChannels: Set<CanonicalChannelPlatform>;
  private readonly now: () => Date;

  public constructor(runtime: ChannelProgressRuntimeBridgeRuntime = {}) {
    this.progressSurface = runtime.progressSurface || new ChannelProgressSurfaceService();
    this.enabledChannels = new Set(runtime.enabledChannels || DEFAULT_CHANNELS);
    this.now = runtime.now || (() => new Date());
  }

  public async emit(type: AgentRunRuntimeEventType, payload: Record<string, unknown> = {}): Promise<void> {
    const event = this.toProgressEvent(type, payload);
    if (!event) {
      return;
    }
    await this.progressSurface.publish(event);
  }

  public snapshot(): unknown {
    const snapshot = this.progressSurface.snapshot();
    return {
      source: 'ChannelProgressRuntimeBridgeService',
      bridge: 'agent-runtime-events-to-channel-progress',
      enabledChannels: Array.from(this.enabledChannels),
      activeSessions: snapshot.sessions.length,
      receipts: snapshot.receipts.length,
    };
  }

  private toProgressEvent(
    type: AgentRunRuntimeEventType,
    payload: Record<string, unknown>,
  ): ChannelProgressEvent | null {
    const channel = String(payload.channel || '').trim().toLowerCase();
    if (!isChannel(channel) || !this.enabledChannels.has(channel)) {
      return null;
    }
    const runId = normalizeText(payload.runId);
    const chatId = normalizeText(payload.surfaceChatId || payload.chatId || payload.sessionId);
    if (!runId || !chatId) {
      return null;
    }
    const stage = this.resolveStage(type, payload);
    if (!stage) {
      return null;
    }
    const toolName = inferToolName(payload);
    return {
      runId,
      channel,
      chatId,
      stage,
      title: this.resolveTitle(stage, type, payload),
      detail: this.resolveDetail(stage, type, payload),
      toolName,
      actionId: normalizeText(payload.actionId) || null,
      integrationId: normalizeText(payload.integrationId) || null,
      link: normalizeText(payload.link) || null,
      finalText: stage === 'final' ? 'Resposta pronta. Vou enviar o resultado logo abaixo.' : null,
      createdAt: this.now().toISOString(),
    };
  }

  private resolveStage(
    type: AgentRunRuntimeEventType,
    payload: Record<string, unknown>,
  ): ChannelProgressStage | null {
    if (type === 'agent.run.created') return 'accepted';
    if (type === 'agent.policy.evaluated') return 'planning';
    if (type === 'agent.execution.started') return 'planning';
    if (type === 'agent.approval.requested') return 'approval_waiting';
    if (type === 'agent.stream.tool') return 'tool_progress';
    if (type === 'agent.skill.evolution.candidate') return 'tool_completed';
    if (type === 'agent.adapter.proof.required') return 'tool_progress';
    if (type === 'agent.execution.failed') return 'failed';
    if (type === 'agent.execution.completed' || type === 'agent.run.completed') return 'final';
    if (type === 'agent.stream.lifecycle') {
      return normalizeText(payload.streamStatus) === 'failed' ? 'failed' : 'planning';
    }
    if (type === 'agent.stream.assistant') {
      return payload.done === true || normalizeText(payload.phase) === 'done'
        ? 'final'
        : 'tool_progress';
    }
    return null;
  }

  private resolveTitle(
    stage: ChannelProgressStage,
    type: AgentRunRuntimeEventType,
    payload: Record<string, unknown>,
  ): string {
    if (stage === 'accepted') return 'Pedido recebido.';
    if (stage === 'planning') return compactDetail(payload.title, 'Preparando execucao governada.');
    if (stage === 'approval_waiting') return 'Aguardando aprovacao.';
    if (stage === 'tool_progress') {
      const toolName = inferToolName(payload);
      return toolName ? `Trabalhando com ${toolName}.` : 'Trabalhando no pedido.';
    }
    if (stage === 'tool_completed') return 'Proposta gerada.';
    if (stage === 'failed') return 'Falha durante a execucao.';
    if (stage === 'final') return type === 'agent.run.completed' ? 'Run finalizada.' : 'Resposta pronta.';
    return compactDetail(payload.title, 'Atualizando progresso.');
  }

  private resolveDetail(
    stage: ChannelProgressStage,
    type: AgentRunRuntimeEventType,
    payload: Record<string, unknown>,
  ): string {
    if (stage === 'accepted') {
      return 'Vou manter esta mensagem atualizada enquanto o runtime trabalha.';
    }
    if (stage === 'approval_waiting') {
      return compactDetail(
        payload.risk ? `Risco ${payload.risk}. Use o approval card para continuar.` : null,
        'O runtime pausou ate uma decisao explicita.',
      );
    }
    if (stage === 'failed') {
      return compactDetail(payload.error, 'O runtime registrou a falha em recibo.');
    }
    if (stage === 'final') {
      return 'Resposta pronta. O recibo do run foi registrado.';
    }
    if (type === 'agent.stream.assistant') {
      return 'Gerando resposta sem expor raciocinio interno.';
    }
    return compactDetail(payload.summary || payload.detail || payload.phase, 'Executando pelo Action Harness e policies do Zavorth.');
  }
}
