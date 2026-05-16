import { createHash } from 'node:crypto';
import {
  renderUniversalApprovalIntentDecisionResult,
  RunArtifactReceiptReplayService,
  type UniversalAgentModelProfile,
  type UniversalAgentRequest,
  type UniversalAgentRun,
  type UniversalApprovalIntentDecisionResult,
  type ZavorthAgentGateway,
} from '../runtime/agent/index.js';

type AgentGatewayLike = Pick<ZavorthAgentGateway, 'handle' | 'buildSnapshot' | 'resolveApprovalIntent'>;

export type TelegramDailyAssistantReceipt = {
  id: string;
  source: 'TelegramDailyAssistantService';
  channel: 'telegram';
  action: 'task-received' | 'approval-decision';
  status: UniversalAgentRun['status'] | 'approval-not-found' | 'approval-ambiguous';
  createdAt: string;
  runId: string | null;
  approvalId: string | null;
  approvalStatus: string | null;
  sessionId: string;
  userId: string;
  eventCount: number;
  artifactCount: number;
  memorySignalCount: number;
  replayCommand: string | null;
  replayFrameCount: number;
  replayReceiptCount: number;
  externalMutationBeforeApproval: false;
  receiptReturnedToTelegram: true;
};

export type TelegramDailyAssistantTurnResult = {
  handled: boolean;
  text: string;
  receipt: TelegramDailyAssistantReceipt;
  run: UniversalAgentRun | null;
};

export type TelegramDailyAssistantTaskInput = {
  text: string;
  userId: string;
  sessionId: string;
  requestedTools?: string[];
  workspace?: string | null;
  modelProfile?: Partial<UniversalAgentModelProfile>;
  metadata?: Record<string, unknown>;
};

export type TelegramDailyAssistantApprovalInput = {
  text: string;
  userId: string;
  sessionId: string;
};

export class TelegramDailyAssistantService {
  private readonly now: () => Date;
  private readonly receiptReplay: RunArtifactReceiptReplayService;

  public constructor(private readonly runtime: {
    agentGateway: AgentGatewayLike;
    now?: () => Date;
    receiptReplay?: RunArtifactReceiptReplayService;
  }) {
    this.now = runtime.now || (() => new Date());
    this.receiptReplay = runtime.receiptReplay || new RunArtifactReceiptReplayService({
      now: this.now,
    });
  }

  public async handleApprovalIntent(
    input: TelegramDailyAssistantApprovalInput,
  ): Promise<TelegramDailyAssistantTurnResult | null> {
    const approvalIntent = await this.runtime.agentGateway.resolveApprovalIntent({
      text: input.text,
      source: 'text',
      channel: 'telegram',
      userId: input.userId,
      sessionId: input.sessionId,
    });
    if (approvalIntent.resolution.status === 'not_approval_intent') {
      return null;
    }

    const run = approvalIntent.result?.run
      || approvalIntent.resolution.target?.run
      || null;
    const receipt = this.buildReceipt({
      action: 'approval-decision',
      run,
      userId: input.userId,
      sessionId: input.sessionId,
      approvalResult: approvalIntent,
    });
    return {
      handled: true,
      text: this.decorateWithReceipt(
        renderUniversalApprovalIntentDecisionResult(approvalIntent),
        receipt,
      ),
      receipt,
      run,
    };
  }

  public async handleTask(
    input: TelegramDailyAssistantTaskInput,
  ): Promise<TelegramDailyAssistantTurnResult> {
    const request: UniversalAgentRequest = {
      userId: input.userId,
      channel: 'telegram',
      sessionId: input.sessionId,
      text: input.text,
      workspace: input.workspace || null,
      requestedTools: input.requestedTools,
      modelProfile: input.modelProfile,
      metadata: {
        ...(input.metadata || {}),
        telegramDailyAssistant: {
          source: 'TelegramDailyAssistantService',
          phase: 'C',
          approvalAware: true,
          receiptsReturnedToChannel: true,
        },
      },
    };
    const result = await this.runtime.agentGateway.handle(request);
    const reply = String(result.replies[0]?.text || '').trim()
      || result.run.summary
      || 'Pedido processado pelo runtime universal.';
    const receipt = this.buildReceipt({
      action: 'task-received',
      run: result.run,
      userId: input.userId,
      sessionId: input.sessionId,
    });
    return {
      handled: true,
      text: this.decorateWithReceipt(reply, receipt),
      receipt,
      run: result.run,
    };
  }

  private buildReceipt(input: {
    action: TelegramDailyAssistantReceipt['action'];
    run: UniversalAgentRun | null;
    userId: string;
    sessionId: string;
    approvalResult?: UniversalApprovalIntentDecisionResult | null;
  }): TelegramDailyAssistantReceipt {
    const generatedAt = this.now().toISOString();
    const run = input.run;
    const approval = run?.approvals.find((entry) => entry.status === 'pending')
      || run?.approvals.at(-1)
      || input.approvalResult?.resolution.target?.approval
      || null;
    const replay = run
      ? this.receiptReplay.buildSnapshot({
        run,
        relatedRuns: this.runtime.agentGateway.buildSnapshot({
          activeSessionId: input.sessionId,
        }).runs,
        generatedAt,
      })
      : null;
    const status = run?.status
      || (
        input.approvalResult?.resolution.status === 'ambiguous'
          ? 'approval-ambiguous'
          : 'approval-not-found'
      );
    return {
      id: createReceiptId({
        action: input.action,
        runId: run?.id || null,
        approvalId: approval?.id || null,
        status,
        generatedAt,
      }),
      source: 'TelegramDailyAssistantService',
      channel: 'telegram',
      action: input.action,
      status,
      createdAt: generatedAt,
      runId: run?.id || null,
      approvalId: approval?.id || null,
      approvalStatus: approval?.status || null,
      sessionId: input.sessionId,
      userId: input.userId,
      eventCount: run?.events.length || 0,
      artifactCount: run?.artifacts.length || 0,
      memorySignalCount: run?.memorySignals.length || 0,
      replayCommand: run ? `zavorth replay run ${run.id} --json` : null,
      replayFrameCount: replay?.summary.frameCount || 0,
      replayReceiptCount: replay
        ? replay.summary.featureReceiptCount + replay.summary.observatoryReceiptCount
        : 0,
      externalMutationBeforeApproval: false,
      receiptReturnedToTelegram: true,
    };
  }

  private decorateWithReceipt(text: string, receipt: TelegramDailyAssistantReceipt): string {
    const lines = [
      normalizeReply(text),
      '',
      'Recibo Zavorth',
      `- id: ${receipt.id}`,
      `- run: ${receipt.runId || 'nao criada'}`,
      `- status: ${receipt.status}`,
      receipt.approvalId
        ? `- approval: ${receipt.approvalId} (${receipt.approvalStatus || 'unknown'})`
        : '- approval: nao requerido',
      `- eventos: ${receipt.eventCount}; artifacts: ${receipt.artifactCount}; memory: ${receipt.memorySignalCount}`,
      `- replay: ${receipt.replayCommand || 'indisponivel'}`,
      '- policy: sem mutacao externa antes de approval; recibo retornado no Telegram',
    ];
    return lines.join('\n');
  }
}

function normalizeReply(value: unknown): string {
  return String(value ?? '').trim() || 'Pedido processado pelo Zavorth.';
}

function createReceiptId(input: {
  action: string;
  runId: string | null;
  approvalId: string | null;
  status: string;
  generatedAt: string;
}): string {
  const digest = createHash('sha256')
    .update(input.action)
    .update('\n')
    .update(input.runId || '')
    .update('\n')
    .update(input.approvalId || '')
    .update('\n')
    .update(input.status)
    .update('\n')
    .update(input.generatedAt)
    .digest('hex')
    .slice(0, 14);
  return `tdr_${digest}`;
}
