import { config } from '../config/index.js';
import type {
  ChannelMeshSnapshot,
} from '../contracts/ChannelMeshContract.js';
import type {
  ZavorthMutationRiskLevel,
  ZavorthReadinessGate,
  ZavorthResourceImpact,
} from '../contracts/ZavorthMutationPlaneContract.js';
import {
  CapabilityLifecycleService,
  type CapabilityStateSnapshot,
} from './CapabilityLifecycleService.js';
import { ZavorthChannelMeshService } from './ZavorthChannelMeshService.js';
import {
  NaturalChannelSetupTurnService,
  type NaturalChannelSetupTurnResult,
} from './NaturalChannelSetupTurnService.js';


import {
  ChannelSetupAssistantService,
  type ChannelSetupAssistantOption,
  type ChannelSetupAssistantSession,
} from './ChannelSetupAssistantService.js';

type NaturalSetupPosture = 'healthy' | 'attention' | 'critical';
type NaturalSetupSeverity = 'info' | 'warn' | 'critical';
type NaturalSetupOperationMode = 'explain' | 'preview';
type NaturalSetupRequestedAction = 'apply' | 'doctor' | 'test';

type ChannelMeshLike = {
  buildSnapshot: (input?: { selectedId?: string | null }) => ChannelMeshSnapshot;
};

type NaturalSetupDeps = {
  now?: () => Date;
  workspaceRoot?: string | null;
  channelSetupAssistantService?: Pick<ChannelSetupAssistantService, 'buildSession'> | null;
  naturalChannelSetupTurnService?: Pick<NaturalChannelSetupTurnService, 'buildTurn'> | null;
  channelMeshService?: ChannelMeshLike | null;
  capabilityLifecycleService?: Pick<CapabilityLifecycleService, 'describeCapability'> | null;
};

export type NaturalSetupPlanPreview = {
  id: string;
  kind: 'NaturalSetupPlan';
  operationMode: 'preview';
  channelId: string | null;
  channelLabel: string | null;
  setupMode: string | null;
  capabilityId: string | null;
  capability: CapabilityStateSnapshot | null;
  requestedActions: NaturalSetupRequestedAction[];
  approvalRequired: boolean;
  riskLevel: ZavorthMutationRiskLevel;
  readinessGate: ZavorthReadinessGate;
  resourceImpact: ZavorthResourceImpact;
  canApply: false;
  manualFallback: string[];
  secretPolicy: {
    rawIntentStored: false;
    snapshotsRedacted: true;
    mutationPayloadRedacted: true;
  };
};

export type ZavorthNaturalSetupControlPlaneSnapshot = {
  generatedAt: string;
  workspaceRoot: string;
  selectedChannelId: string | null;
  intentText: string | null;
  summary: {
    posture: NaturalSetupPosture;
    status: string;
    selectedReady: boolean;
    missingEnvKeys: number;
    promotionReady: boolean;
    optionCount: number;
    mutationRequested: boolean;
    operationMode: NaturalSetupOperationMode;
    previewOnly: boolean;
    secretsRedacted: boolean;
    capabilityId: string | null;
    requestedActions: NaturalSetupRequestedAction[];
  };
  actions: Array<{
    id: string;
    label: string;
    severity: NaturalSetupSeverity;
    reason: string;
    command: string | null;
  }>;
  examples: string[];
  assistant: ChannelSetupAssistantSession;
  turn: NaturalChannelSetupTurnResult | null;
  channels: ChannelMeshSnapshot;
  planPreview: NaturalSetupPlanPreview;
  safety: {
    previewFirst: true;
    rawIntentStored: false;
    applyRequiresMutationPlan: true;
    approvalRequiredForMutation: true;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};

export class ZavorthNaturalSetupControlPlaneService {
  private readonly now: () => Date;
  private readonly workspaceRoot: string;
  private readonly assistant: Pick<ChannelSetupAssistantService, 'buildSession'>;
  private readonly naturalTurn: Pick<NaturalChannelSetupTurnService, 'buildTurn'> | null;
  private readonly channels: ChannelMeshLike;
  private readonly capabilityLifecycle: Pick<CapabilityLifecycleService, 'describeCapability'> | null;

  constructor(runtime: NaturalSetupDeps = {}) {
    this.now = runtime.now || (() => new Date());
    this.workspaceRoot = this.text(runtime.workspaceRoot, config.projectRoot || process.cwd());
    this.channels = runtime.channelMeshService || new ZavorthChannelMeshService();
    this.assistant = runtime.channelSetupAssistantService || new ChannelSetupAssistantService({
      channelMeshService: this.channels,
    });
    this.naturalTurn = runtime.naturalChannelSetupTurnService || null;
    this.capabilityLifecycle = runtime.capabilityLifecycleService || new CapabilityLifecycleService();
  }

  public async buildSnapshot(input: {
    channelId?: string | null;
    mode?: string | null;
    intentText?: string | null;
    autoApply?: boolean;
    autoDoctor?: boolean;
    autoTest?: boolean;
    localOnly?: boolean;
    operationMode?: NaturalSetupOperationMode | string | null;
  } = {}): Promise<ZavorthNaturalSetupControlPlaneSnapshot> {
    const selectedChannelId = this.nullableText(input.channelId);
    const rawIntentText = this.nullableText(input.intentText);
    const intentText = this.redactSensitiveText(rawIntentText);
    const requestedActions = this.resolveRequestedActions(input);
    const mutationRequested = requestedActions.length > 0;
    const operationMode: NaturalSetupOperationMode = mutationRequested || this.normalizeOperationMode(input.operationMode) === 'preview'
      ? 'preview'
      : 'explain';
    const assistant = this.assistant.buildSession({
      channelId: selectedChannelId,
      mode: this.nullableText(input.mode),
      intentText: rawIntentText,
    });
    const turn = this.naturalTurn && rawIntentText
      ? await this.naturalTurn.buildTurn({
        intentText: rawIntentText,
        channelId: selectedChannelId,
        mode: this.nullableText(input.mode),
        autoApply: input.autoApply === true,
        autoDoctor: input.autoDoctor === true,
        autoTest: input.autoTest === true,
        localOnly: input.localOnly === true,
        previewOnly: true,
      })
      : null;
    const channels = turn?.assistant?.channels || assistant.channels || this.channels.buildSnapshot({
      selectedId: turn?.channelId || assistant.selected?.channelId || selectedChannelId,
    });
    const selected = turn?.assistant?.selected || assistant.selected || null;
    const status = this.text(turn?.assistant?.status || assistant.status, 'needs_channel');
    const missingEnvKeys = Array.isArray(turn?.remainingEnvKeys)
      ? turn.remainingEnvKeys.length
      : (Array.isArray(selected?.missingEnvKeys) ? selected.missingEnvKeys.length : 0);
    const promotionReady = turn?.promotionReady === true || (status === 'ready' && missingEnvKeys === 0);
    const resolvedChannelId = turn?.channelId || assistant.selected?.channelId || selectedChannelId;
    const capabilityId = this.resolveCapabilityId(resolvedChannelId);
    const capability = capabilityId ? this.capabilityLifecycle?.describeCapability(capabilityId) || null : null;
    const planPreview = this.buildPlanPreview({
      operationMode,
      selected,
      selectedChannelId: resolvedChannelId,
      requestedActions,
      missingEnvKeys,
      promotionReady,
      capabilityId,
      capability,
      turn,
    });
    const summary = {
      posture: this.resolvePosture(status, missingEnvKeys, promotionReady),
      status,
      selectedReady: status === 'ready',
      missingEnvKeys,
      promotionReady,
      optionCount: Array.isArray(assistant?.options) ? assistant.options.length : 0,
      mutationRequested,
      operationMode,
      previewOnly: true,
      secretsRedacted: true,
      capabilityId,
      requestedActions,
    };
    const actions = this.buildActions({ assistant, turn, selected, missingEnvKeys, promotionReady });
    return {
      generatedAt: this.now().toISOString(),
      workspaceRoot: this.workspaceRoot,
      selectedChannelId: resolvedChannelId,
      intentText,
      summary,
      actions,
      examples: [
        'Quero conectar ao Discord',
        'Configure Slack and validate the channel',
        'Aplique o scaffold do WhatsApp Cloud API',
        'have o token do Telegram; quero validate after',
      ],
      assistant: this.redactSurface(assistant),
      turn: this.redactSurface(turn),
      channels: this.redactSurface(channels),
      planPreview,
      safety: {
        previewFirst: true,
        rawIntentStored: false,
        applyRequiresMutationPlan: true,
        approvalRequiredForMutation: true,
      },
      narrative: {
        headline: 'Natural setup: Natural Setup Agent',
        operatorSummary: this.redactSensitiveText(turn?.naturalReply || assistant.naturalReply)
          || 'Natural Setup ready to receive a natural-language request.',
        nextAction: actions[0]?.label || 'Dizer em linguagem natural qual channel you quer conectar.',
      },
    };
  }

  public async renderReport(input: {
    channelId?: string | null;
    mode?: string | null;
    intentText?: string | null;
    autoApply?: boolean;
    autoDoctor?: boolean;
    autoTest?: boolean;
    localOnly?: boolean;
    operationMode?: NaturalSetupOperationMode | string | null;
  } = {}): Promise<string> {
    const snapshot = await this.buildSnapshot(input);
    const lines = [
      'Natural setup: Natural Setup Agent',
      '',
      snapshot.narrative.operatorSummary,
      `Postura: ${snapshot.summary.posture}.`,
      `Status: ${snapshot.summary.status}.`,
      `Missing env keys: ${snapshot.summary.missingEnvKeys}.`,
      `Promotion ready: ${snapshot.summary.promotionReady ? 'yes' : 'no'}.`,
      `Operational mode: ${snapshot.summary.operationMode} (previewOnly=${snapshot.summary.previewOnly ? 'yes' : 'no'}).`,
      `Capability: ${snapshot.summary.capabilityId || 'n/d'}.`,
      `Mutation plan: ${snapshot.planPreview.kind} | gate ${snapshot.planPreview.readinessGate.status} | approval=${snapshot.planPreview.approvalRequired ? 'yes' : 'no'}.`,
      '',
      'Exemplos de requests:',
      ...snapshot.examples.map((entry) => `- ${entry}`),
    ];
    if (snapshot.actions.length > 0) {
      lines.push(
        '',
        'Actions sugeridas:',
        ...snapshot.actions.map((entry) =>
          `- ${entry.label}: ${entry.reason}${entry.command ? ` | ${entry.command}` : ''}`),
      );
    }
    return lines.join('\n');
  }

  private buildActions(input: {
    assistant: ChannelSetupAssistantSession;
    turn: NaturalChannelSetupTurnResult | null;
    selected: ChannelSetupAssistantOption | null;
    missingEnvKeys: number;
    promotionReady: boolean;
  }): ZavorthNaturalSetupControlPlaneSnapshot['actions'] {
    const actions: ZavorthNaturalSetupControlPlaneSnapshot['actions'] = [];
    if (!input.selected) {
      actions.push({
        id: 'choose-channel',
        label: 'Escolher o target channel',
        severity: 'info',
        reason: 'The natural-first flow still needs an explicit channel to prepare onboarding.',
        command: 'Quero conectar ao Discord',
      });
      return actions;
    }
    if (input.missingEnvKeys > 0) {
      actions.push({
        id: 'fill-missing-env',
        label: 'Preencher what is missing',
        severity: 'warn',
        reason: `Still missing ${input.missingEnvKeys} required key(s) for ${this.text(input.selected?.label, 'the channel')}.`,
        command: this.text(input.selected?.operatorNextStep, `npm run channels:assistant -- --channel ${this.text(input.selected?.channelId, '')}`),
      });
    }
    if (input.turn?.doctorResult?.selectedItem?.status === 'failed') {
      actions.push({
        id: 'doctor-again',
        label: 'Review the channel doctor',
        severity: 'critical',
        reason: this.text(input.turn?.doctorResult?.selectedItem?.summary, 'O doctor do channel encontrou failures.'),
        command: `npm run channels:assistant -- --channel ${this.text(input.selected?.channelId, '')} --doctor`,
      });
    }
    if (input.promotionReady) {
      actions.push({
        id: 'promote-channel',
        label: 'Promote the channel in the mesh',
        severity: 'info',
        reason: `${this.text(input.selected?.label, 'Channel')} can continue to the final doctor or send test.`,
        command: `/channels send-test ${this.text(input.selected?.channelId, '')}`,
      });
    }
    if (actions.length === 0) {
      actions.push({
        id: 'review-channel',
        label: 'Review the channel next step',
        severity: 'info',
        reason: this.text(input.selected?.operatorNextStep, 'O channel ainda pede review operational.'),
        command: `npm run channels:assistant -- --channel ${this.text(input.selected?.channelId, '')}`,
      });
    }
    return actions.slice(0, 6);
  }

  private buildPlanPreview(input: {
    operationMode: NaturalSetupOperationMode;
    selected: ChannelSetupAssistantOption | null;
    selectedChannelId: string | null;
    requestedActions: NaturalSetupRequestedAction[];
    missingEnvKeys: number;
    promotionReady: boolean;
    capabilityId: string | null;
    capability: CapabilityStateSnapshot | null;
    turn: NaturalChannelSetupTurnResult | null;
  }): NaturalSetupPlanPreview {
    const setupMode = this.text(input.turn?.mode || input.selected?.setupMode || input.selected?.recommendedMode) || null;
    const riskLevel = input.requestedActions.includes('test') ? 'high'
      : input.requestedActions.length > 0 ? 'medium' : 'low';
    return {
      id: `natural-setup:${input.selectedChannelId || 'unresolved'}:${input.operationMode}`,
      kind: 'NaturalSetupPlan',
      operationMode: 'preview',
      channelId: input.selectedChannelId,
      channelLabel: this.nullableText(input.selected?.label),
      setupMode,
      capabilityId: input.capabilityId,
      capability: input.capability,
      requestedActions: input.requestedActions,
      approvalRequired: input.requestedActions.length > 0,
      riskLevel,
      readinessGate: this.buildReadinessGate({
        selectedChannelId: input.selectedChannelId,
        requestedActions: input.requestedActions,
        missingEnvKeys: input.missingEnvKeys,
        promotionReady: input.promotionReady,
        capabilityId: input.capabilityId,
        capability: input.capability,
      }),
      resourceImpact: this.resolveResourceImpact(input.requestedActions, input.capability),
      canApply: false,
      manualFallback: this.buildManualFallback(input.selected, input.missingEnvKeys),
      secretPolicy: {
        rawIntentStored: false,
        snapshotsRedacted: true,
        mutationPayloadRedacted: true,
      },
    };
  }

  private buildReadinessGate(input: {
    selectedChannelId: string | null;
    requestedActions: NaturalSetupRequestedAction[];
    missingEnvKeys: number;
    promotionReady: boolean;
    capabilityId: string | null;
    capability: CapabilityStateSnapshot | null;
  }): ZavorthReadinessGate {
    const warnings: string[] = [];
    const blockers: string[] = [];
    const reasons = [
      'Natural Setup operates preview-first: understanding and planning do not mutate the host.',
      'Real apply requires a mutation plan approved by Trust Plane.',
    ];
    if (!input.selectedChannelId) {
      blockers.push('Target channel has not been resolved yet.');
    }
    if (input.requestedActions.length > 0) {
      warnings.push(`Mutable actions detected: ${input.requestedActions.join(', ')}.`);
    }
    if ((input.requestedActions.includes('doctor') || input.requestedActions.includes('test')) && input.missingEnvKeys > 0) {
      blockers.push('Doctor/test must not run while required env vars are missing.');
    }
    if (input.capabilityId && !input.capability) {
      warnings.push(`Capability ${input.capabilityId} was not found in lifecycle; manual fallback recommended.`);
    } else if (input.capability && !['ready', 'active'].includes(input.capability.state)) {
      warnings.push(`Capability ${input.capability.capabilityId} is ${input.capability.state} and needs approval/demand before activation.`);
    }

    return {
      id: `natural-setup:${input.selectedChannelId || 'unresolved'}`,
      status: blockers.length > 0 ? 'failed' : warnings.length > 0 ? 'warning' : 'passed',
      canProceed: blockers.length === 0,
      scope: 'preview',
      reasons,
      warnings,
      blockers,
      checkedAt: this.now().toISOString(),
      budgets: {
        previewOnly: true,
        maxProcessCount: 0,
        maxDiskMbBeforeApproval: 0,
        approvalRequiredForMutation: true,
      },
      nextActions: [...blockers, ...warnings].slice(0, 6),
    };
  }

  private resolveRequestedActions(input: {
    autoApply?: boolean;
    autoDoctor?: boolean;
    autoTest?: boolean;
  }): NaturalSetupRequestedAction[] {
    return [
      input.autoApply === true ? 'apply' : null,
      input.autoDoctor === true ? 'doctor' : null,
      input.autoTest === true ? 'test' : null,
    ].filter(Boolean) as NaturalSetupRequestedAction[];
  }

  private resolveResourceImpact(
    requestedActions: NaturalSetupRequestedAction[],
    capability: CapabilityStateSnapshot | null,
  ): ZavorthResourceImpact {
    const footprint = capability?.estimatedFootprint || null;
    return {
      ramMb: Math.max(0, Math.round(Number(footprint?.ramIdleMb || 16))),
      diskMb: requestedActions.includes('apply')
        ? Math.max(1, Math.round(Number(footprint?.diskMb || 8)))
        : 0,
      processCount: requestedActions.includes('doctor')
        ? Math.max(0, Math.round(Number(footprint?.processCount || 0)))
        : 0,
      externalExposure: requestedActions.includes('test') ? 'network' : 'none',
      recurring: false,
      notes: [
        'Preview does not create a process or write a file.',
        capability?.fallbackBehavior || 'Manual fallback remains available.',
      ],
    };
  }

  private buildManualFallback(selected: ChannelSetupAssistantOption | null, missingEnvKeys: number): string[] {
    if (!selected) {
      return ['Escolha explicitmente o channel: Discord, Slack, WhatsApp, Instagram, Signal, iMessage, Teams, Email ou Telegram.'];
    }
    const steps = [this.text(selected.operatorNextStep, `review setup for ${this.text(selected.label, 'channel')}.`)];
    if (missingEnvKeys > 0 && Array.isArray(selected.missingEnvKeys)) {
      steps.push(`Fill manually: ${selected.missingEnvKeys.join(', ')}.`);
    }
    steps.push('run preview again before any apply.');
    return steps;
  }

  private resolveCapabilityId(channelId: string | null): string | null {
    const normalized = this.text(channelId).toLowerCase();
    const known = new Set(['discord', 'whatsapp', 'instagram', 'slack', 'signal', 'imessage', 'teams', 'email']);
    return known.has(normalized) ? normalized : null;
  }

  private resolvePosture(
    status: string,
    missingEnvKeys: number,
    promotionReady: boolean,
  ): NaturalSetupPosture {
    if (promotionReady || status === 'ready') {
      return 'healthy';
    }
    if (status === 'ready_to_validate') {
      return 'attention';
    }
    if (status === 'needs_channel' || status === 'needs_scaffold' || missingEnvKeys > 0) {
      return 'attention';
    }
    return 'critical';
  }

  private text(value: unknown, fallback = ''): string {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  }

  private nullableText(value: unknown): string | null {
    const normalized = this.text(value);
    return normalized || null;
  }

  private normalizeOperationMode(value: string | null | undefined): NaturalSetupOperationMode {
    return String(value || '').trim().toLowerCase() === 'preview' ? 'preview' : 'explain';
  }

  private redactSurface<T>(value: T): T {
    const visit = (entry: unknown, key = ''): unknown => {
      if (Array.isArray(entry)) {
        return entry.map((item) => visit(item, key));
      }
      if (entry && typeof entry === 'object') {
        return Object.fromEntries(
          Object.entries(entry as Record<string, unknown>).map(([childKey, childValue]) => [childKey, visit(childValue, childKey)]),
        );
      }
      if (/(token|secret|password|pass|api[_-]?key|cnetworkntial)/i.test(key) && entry !== null && entry !== undefined) {
        return '***';
      }
      if (typeof entry === 'string') {
        return this.redactSensitiveText(entry);
      }
      return entry;
    };
    return visit(value) as T;
  }

  private redactSensitiveText(value: unknown): string | null {
    const raw = this.nullableText(value);
    if (!raw) {
      return null;
    }
    return raw
      .replace(/\b([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASS|API_KEY|CREDENTIAL)[A-Z0-9_]*)\s*=\s*("[^"]+"|'[^']+'|[^\s,;]+)/gi, '$1=***')
      .replace(/\b((?:[a-z0-9_-]+\s+){0,4}(?:token|secret|password|senha|api key|cnetworkntial)(?:\s+[a-z0-9_-]+){0,4})\s*(?:=|:|e|eh|is|\u00e9)\s*("[^"]+"|'[^']+'|[^\s,;]+)/gi, '$1=***');
  }
}
