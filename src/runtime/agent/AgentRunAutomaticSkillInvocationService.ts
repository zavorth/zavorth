import type { ILlmProvider, LlmResponse } from '../../providers/ILlmProvider.js';
import type { UniversalAgentRequest, UniversalAgentRun } from './UniversalAgentRuntimeTypes.js';
import { SkillRouter } from '../../skills/SkillRouter.js';
import { SkillLoader } from '../../skills/SkillLoader.js';
import { UniversalSkillBridgeRuntimeService } from '../../skills/UniversalSkillBridgeRuntimeService.js';
import { asErrorLike } from '../../utils/errorLike.js';

export type AgentRunAutomaticSkillInvocationSnapshot = {
  contractVersion: 'agent-run-automatic-skill-invocation/1';
  source: 'AgentRunAutomaticSkillInvocationService';
  generatedAt: string;
  status: 'selected' | 'skipped' | 'blocked' | 'failed';
  selectedSkillName: string | null;
  supportSkillName: string | null;
  mode: 'dry-run';
  bridgeStatus: string | null;
  receiptIds: string[];
  promptEnvelopeText: string | null;
  rawSecretsSerialized: false;
  reason: string;
  skillCount: number;
};

type Runtime = {
  now?: () => Date;
  skillLoader?: Pick<SkillLoader, 'loadAll'>;
  skillRouter?: Pick<SkillRouter, 'routeSelection'>;
  skillBridge?: Pick<UniversalSkillBridgeRuntimeService, 'invoke'>;
};

type ApplyInput = {
  run: UniversalAgentRun;
  request: UniversalAgentRequest;
};

const DEFAULT_ROUTER_PROVIDER: ILlmProvider = {
  name: 'zavorth-auto-skill-router',
  async chat(): Promise<LlmResponse> {
    return {
      content: '{"primarySkillName":null,"supportSkillName":null}',
      toolCalls: [],
      finishReason: 'stop',
    };
  },
};

export class AgentRunAutomaticSkillInvocationService {
  private readonly now: () => Date;
  private readonly skillLoader: Pick<SkillLoader, 'loadAll'>;
  private readonly skillRouter: Pick<SkillRouter, 'routeSelection'>;
  private readonly skillBridge: Pick<UniversalSkillBridgeRuntimeService, 'invoke'>;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.skillLoader = runtime.skillLoader || new SkillLoader({ quiet: true });
    this.skillRouter = runtime.skillRouter || new SkillRouter(DEFAULT_ROUTER_PROVIDER);
    this.skillBridge = runtime.skillBridge || new UniversalSkillBridgeRuntimeService({ now: this.now });
  }

  public async apply(input: ApplyInput): Promise<AgentRunAutomaticSkillInvocationSnapshot> {
    const generatedAt = this.now().toISOString();
    const existing = readSnapshot(input.run.metadata.autoSkillInvocation);
    if (existing && (existing.status === 'selected' || existing.status === 'blocked' || existing.status === 'failed')) {
      return existing;
    }

    const skills = this.skillLoader.loadAll({ includeSupportFiles: false, quiet: true });
    if (skills.length === 0) {
      return this.finalizeSnapshot({
        run: input.run,
        generatedAt,
        status: 'skipped',
        selectedSkillName: null,
        supportSkillName: null,
        bridgeStatus: null,
        receiptIds: [],
        promptEnvelopeText: null,
        reason: 'Nenhuma skill nativa disponivel para auto-selecao.',
        skillCount: 0,
      });
    }

    const selection = await this.skillRouter.routeSelection(input.request.text, skills);
    const selectedSkill = selection.primarySkillName
      ? skills.find((skill) => skill.name === selection.primarySkillName) || null
      : null;

    if (!selectedSkill) {
      return this.finalizeSnapshot({
        run: input.run,
        generatedAt,
        status: 'skipped',
        selectedSkillName: null,
        supportSkillName: selection.supportSkillName || null,
        bridgeStatus: null,
        receiptIds: [],
        promptEnvelopeText: null,
        reason: 'Nenhuma skill governada foi selecionada para este turno.',
        skillCount: skills.length,
      });
    }

    try {
      const bridgeSnapshot = await this.skillBridge.invoke({
        skillName: selectedSkill.name,
        intent: input.request.text,
        mode: 'dry-run',
        channel: input.request.channel,
        sessionId: input.run.sessionId,
        actorId: input.run.userId,
        persistReceipt: true,
      });
      const receiptIds = Array.isArray((bridgeSnapshot as { receipts?: Array<{ id?: string }> }).receipts)
        ? ((bridgeSnapshot as { receipts?: Array<{ id?: string }> }).receipts || [])
          .map((receipt) => String(receipt?.id || '').trim())
          .filter(Boolean)
        : [];

      const bridgeStatus = normalizeText((bridgeSnapshot as { status?: unknown }).status);
      const blockedByBridge = ['denied', 'not-found', 'approval-required'].includes(bridgeStatus);

      return this.finalizeSnapshot({
        run: input.run,
        generatedAt,
        status: blockedByBridge ? 'blocked' : 'selected',
        selectedSkillName: selectedSkill.name,
        supportSkillName: selection.supportSkillName || null,
        bridgeStatus: bridgeStatus || (blockedByBridge ? 'blocked' : 'selected'),
        receiptIds,
        promptEnvelopeText: blockedByBridge
          ? null
          : normalizeText((bridgeSnapshot as { promptEnvelope?: { text?: unknown } | null }).promptEnvelope?.text) || null,
        reason: blockedByBridge
          ? `Auto-skill invocation blocked by governed bridge (${bridgeStatus || 'blocked'}).`
          : `Auto-selected governed skill "${selectedSkill.name}" em modo dry-run.`,
        skillCount: skills.length,
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      return this.finalizeSnapshot({
        run: input.run,
        generatedAt,
        status: 'failed',
        selectedSkillName: selectedSkill.name,
        supportSkillName: selection.supportSkillName || null,
        bridgeStatus: 'error',
        receiptIds: [],
        promptEnvelopeText: null,
        reason: error instanceof Error ? err.message : String(error),
        skillCount: skills.length,
      });
    }
  }

  private finalizeSnapshot(input: {
    run: UniversalAgentRun;
    generatedAt: string;
    status: AgentRunAutomaticSkillInvocationSnapshot['status'];
    selectedSkillName: string | null;
    supportSkillName: string | null;
    bridgeStatus: string | null;
    receiptIds: string[];
    promptEnvelopeText: string | null;
    reason: string;
    skillCount: number;
  }): AgentRunAutomaticSkillInvocationSnapshot {
    const snapshot: AgentRunAutomaticSkillInvocationSnapshot = {
      contractVersion: 'agent-run-automatic-skill-invocation/1',
      source: 'AgentRunAutomaticSkillInvocationService',
      generatedAt: input.generatedAt,
      status: input.status,
      selectedSkillName: input.selectedSkillName,
      supportSkillName: input.supportSkillName,
      mode: 'dry-run',
      bridgeStatus: input.bridgeStatus,
      receiptIds: input.receiptIds,
      promptEnvelopeText: input.promptEnvelopeText,
      rawSecretsSerialized: false,
      reason: input.reason,
      skillCount: input.skillCount,
    };

    input.run.metadata = {
      ...input.run.metadata,
      autoSkillInvocation: snapshot,
    };

    if (!input.run.events.some((event) => event.kind === 'planning' && event.title === 'Skill auto-selected')) {
      input.run.events.push({
        id: `${input.run.id}:auto-skill`,
        runId: input.run.id,
        kind: 'planning',
        title: 'Skill auto-selected',
        detail: snapshot.reason,
        status: snapshot.status === 'failed' ? 'pending' : 'done',
        createdAt: input.generatedAt,
        metadata: {
          source: snapshot.source,
          contractVersion: snapshot.contractVersion,
          status: snapshot.status,
          selectedSkillName: snapshot.selectedSkillName,
          supportSkillName: snapshot.supportSkillName,
          bridgeStatus: snapshot.bridgeStatus,
          receiptIds: snapshot.receiptIds,
          skillCount: snapshot.skillCount,
          rawSecretsSerialized: false,
        },
      });
    }

    return snapshot;
  }
}

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function readSnapshot(value: unknown): AgentRunAutomaticSkillInvocationSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const status = normalizeStatus(record.status);
  if (!status) {
    return null;
  }
  return {
    contractVersion: 'agent-run-automatic-skill-invocation/1',
    source: 'AgentRunAutomaticSkillInvocationService',
    generatedAt: String(record.generatedAt || '').trim() || new Date().toISOString(),
    status,
    selectedSkillName: normalizeNullable(record.selectedSkillName),
    supportSkillName: normalizeNullable(record.supportSkillName),
    mode: 'dry-run',
    bridgeStatus: normalizeNullable(record.bridgeStatus),
    receiptIds: Array.isArray(record.receiptIds) ? record.receiptIds.map((item) => String(item ?? '').trim()).filter(Boolean) : [],
    promptEnvelopeText: normalizeNullable(record.promptEnvelopeText),
    rawSecretsSerialized: false,
    reason: String(record.reason || '').trim() || 'existing snapshot',
    skillCount: Number.isFinite(Number(record.skillCount)) ? Number(record.skillCount) : 0,
  };
}

function normalizeNullable(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text || null;
}

function normalizeStatus(value: unknown): AgentRunAutomaticSkillInvocationSnapshot['status'] | null {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  if (text === 'selected' || text === 'skipped' || text === 'blocked' || text === 'failed') {
    return text;
  }
  return null;
}
