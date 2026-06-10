import {
  ZAVORTH_NATURAL_RUNTIME_QUESTIONS_CONTRACT_VERSION,
  type ZavorthNaturalRuntimeAnswerCard,
  type ZavorthNaturalRuntimeQuestionIntent,
  type ZavorthNaturalRuntimeQuestionsSnapshot,
} from '../contracts/ZavorthNaturalRuntimeQuestionsContract.js';
import type { ZavorthTerminalBackendDescriptor } from '../contracts/ZavorthTerminalBackendsContract.js';
import { GatewaySpineService } from './GatewaySpineService.js';
import { ZavorthCapabilityStoreService } from './ZavorthCapabilityStoreService.js';
import { ZavorthProviderReadinessMatrixService } from './ZavorthProviderReadinessMatrixService.js';
import { ZavorthSatelliteApprovalCompanionService } from './ZavorthSatelliteApprovalCompanionService.js';
import { ZavorthTerminalBackendsService } from './ZavorthTerminalBackendsService.js';
import { ZavorthTrustPanelService } from './ZavorthTrustPanelService.js';
import { ZavorthVisualReceiptsV2Service } from './ZavorthVisualReceiptsV2Service.js';

const MAX_EXECUTION_BACKEND_LABELS = 4;

export type ZavorthNaturalRuntimeQuestionsInput = {
  question?: unknown;
};

export type ZavorthNaturalRuntimeQuestionsRuntime = {
  now?: () => Date;
  gateway?: Pick<GatewaySpineService, 'buildSnapshot'>;
  providers?: Pick<ZavorthProviderReadinessMatrixService, 'buildSnapshot'>;
  capabilities?: Pick<ZavorthCapabilityStoreService, 'buildContract'>;
  approvals?: Pick<ZavorthSatelliteApprovalCompanionService, 'buildSnapshot'>;
  receipts?: Pick<ZavorthVisualReceiptsV2Service, 'buildSnapshot'>;
  trust?: Pick<ZavorthTrustPanelService, 'buildContract'>;
  terminalBackends?: Pick<ZavorthTerminalBackendsService, 'execute'>;
};

export class ZavorthNaturalRuntimeQuestionsService {
  private readonly now: () => Date;
  private readonly gateway: Pick<GatewaySpineService, 'buildSnapshot'>;
  private readonly providers: Pick<ZavorthProviderReadinessMatrixService, 'buildSnapshot'>;
  private readonly capabilities: Pick<ZavorthCapabilityStoreService, 'buildContract'>;
  private readonly approvals: Pick<ZavorthSatelliteApprovalCompanionService, 'buildSnapshot'>;
  private readonly receipts: Pick<ZavorthVisualReceiptsV2Service, 'buildSnapshot'>;
  private readonly trust: Pick<ZavorthTrustPanelService, 'buildContract'>;
  private readonly terminalBackends: Pick<ZavorthTerminalBackendsService, 'execute'>;

  constructor(runtime: ZavorthNaturalRuntimeQuestionsRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.gateway = runtime.gateway || new GatewaySpineService();
    this.providers = runtime.providers || new ZavorthProviderReadinessMatrixService();
    this.capabilities = runtime.capabilities || new ZavorthCapabilityStoreService();
    this.approvals = runtime.approvals || new ZavorthSatelliteApprovalCompanionService();
    this.receipts = runtime.receipts || new ZavorthVisualReceiptsV2Service();
    this.trust = runtime.trust || new ZavorthTrustPanelService();
    this.terminalBackends = runtime.terminalBackends || new ZavorthTerminalBackendsService();
  }

  public buildSnapshot(input: ZavorthNaturalRuntimeQuestionsInput = {}): ZavorthNaturalRuntimeQuestionsSnapshot {
    const question = sanitizeText(input.question || 'What is the runtime status?');
    const normalizedQuestion = normalizeQuestion(question);
    const intent = classifyIntent(normalizedQuestion);
    const providers = this.providers.buildSnapshot({});
    const channels = this.capabilities.buildContract({ category: 'communication' });
    const gateway = this.gateway.buildSnapshot({});
    const approvals = this.approvals.buildSnapshot({});
    const receipts = this.receipts.buildSnapshot({});
    const trust = this.trust.buildContract({});
    const terminalBackends = intent === 'execution_backends_ready'
      ? this.terminalBackends.execute({})
      : null;
    const cards = buildCards(intent, {
      providers,
      channels,
      gateway,
      approvals,
      receipts,
      trust,
      terminalBackends,
    });

    return sanitizeValue({
      contractVersion: ZAVORTH_NATURAL_RUNTIME_QUESTIONS_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'natural-runtime-questions',
      generatedAt: this.now().toISOString(),
      question,
      normalizedQuestion,
      intent,
      confidence: intent === 'unknown' ? 'low' : normalizedQuestion.length > 8 ? 'high' : 'medium',
      answer: {
        short: buildShortAnswer(intent, cards),
        cards,
        askableFollowups: [
          'Which providers are ready?',
          'Which channels can I use now?',
          'Do I have pending approvals?',
          'Can Zavorth run this in an isolated executor?',
          'Are Docker or WSL ready?',
          'Show me the latest receipts.',
          'What is blocked or missing setup?',
          'What can Zavorth do without asking first?',
        ],
      },
      sources: [
        source('providers', 'provider-readiness-matrix', 'zavorth providers', '/dashboard'),
        source('channels', 'capability-store', 'zavorth capability-store --category communication', '/dashboard'),
        source('approvals', 'satellite-approval-companion', 'zavorth satellite-approvals', '/satellite'),
        source('receipts', 'visual-receipts-v2', 'zavorth visual-receipts', '/dashboard'),
        source('execution-backends', 'terminal-backends', 'zavorth execution-backends', null),
        source('trust', 'trust-panel', 'zavorth trust-panel', '/dashboard'),
        source('gateway', 'gateway-spine', 'zavorth gateway status', '/dashboard'),
      ],
      runtimeProjection: {
        dashboardRoute: '/dashboard',
        satelliteRoute: '/satellite',
        cliCommand: 'zavorth ask-runtime',
        executionAuthority: false,
      },
      safety: {
        projectionOnly: true,
        rawSecretsSerialized: false,
        noLiveNetworkByDefault: true,
        doesNotMutateConfiguration: true,
        policyBrokerStillRequiredForActions: true,
      },
      invariants: [
        'Natural runtime answers are read-only projections over existing runtime contracts.',
        'The answer may suggest commands, but it never performs provider tests, channel sends, approvals or configuration changes by itself.',
        'Live network probes, writes and channel actions still require explicit governed actions.',
        'Secrets remain redacted before text is returned to any surface.',
      ],
    }) as ZavorthNaturalRuntimeQuestionsSnapshot;
  }

  public renderText(snapshot: ZavorthNaturalRuntimeQuestionsSnapshot): string {
    return [
      '[zavorth-natural-runtime-questions]',
      `intent=${snapshot.intent} confidence=${snapshot.confidence}`,
      snapshot.answer.short,
      '',
      ...snapshot.answer.cards.map((card) => [
        `[${card.status}] ${card.title}`,
        card.summary,
        ...card.bullets.map((bullet) => `- ${bullet}`),
        `next=${card.nextAction}`,
        '',
      ].join('\n')),
      '[try asking]',
      ...snapshot.answer.askableFollowups.map((followup) => `- ${followup}`),
      '',
    ].join('\n');
  }
}

function classifyIntent(question: string): ZavorthNaturalRuntimeQuestionIntent {
  if (/channel|telegram|whatsapp|discord|signal|slack|email/.test(question)) return 'channels_ready';
  if (/executor|execution|backend|sandbox|docker|wsl|container|isolad|isolat|ambiente isolado|safe executor|strong backend/.test(question)) {
    return 'execution_backends_ready';
  }
  if (/approval|approve|deny|permission|pending/.test(question)) return 'approvals_pending';
  if (/receipt|audit|evidence|what happened|done/.test(question)) return 'receipts_summary';
  if (/missing|broken|blocked|setup|configure|need/.test(question)) return 'setup_gaps';
  if (/safe|trust|allowed|blocked|permission|can do/.test(question)) return 'safety_boundary';
  if (/provider|model|openai|claude|gemini|ollama/.test(question)) return 'providers_ready';
  if (/status|summary|runtime|everything|overall|health/.test(question)) return 'runtime_summary';
  if (/\bready\b/.test(question)) return 'runtime_summary';
  return 'unknown';
}

function buildCards(intent: ZavorthNaturalRuntimeQuestionIntent, data: Record<string, any>): ZavorthNaturalRuntimeAnswerCard[] {
  const providerCard = card('providers', 'Providers', providerStatus(data.providers), [
    `${data.providers.summary.ready} ready, ${data.providers.summary.missingAuth} missing auth, ${data.providers.summary.needsProbe} need a probe.`,
    `Active route: ${data.providers.activeProvider || 'not selected'} / ${data.providers.activeModel || 'not selected'}.`,
  ], 'Use `zavorth providers` or ask Zavorth to test a specific provider.');
  const channelCard = card('channels', 'Channels', countStatus(data.channels.summary.available, data.channels.summary.needsSetup), [
    `${data.channels.summary.available} available, ${data.channels.summary.needsSetup} need setup, ${data.channels.summary.blocked} blocked.`,
    'Channels are rendered through the same governed runtime, not separate agents.',
  ], 'Use `zavorth capability-store --category communication` or ask to configure a channel.');
  const approvalCard = card('approvals', 'Approvals', data.approvals.summary.pending > 0 ? 'attention' : 'ready', [
    `${data.approvals.summary.pending} pending approval card(s).`,
    'Approving from Satellite or Dashboard only resolves the decision; runtime policy still controls execution.',
  ], 'Use `zavorth satellite-approvals` or open `/satellite`.');
  const receiptCard = card('receipts', 'Receipts', data.receipts.status, [
    `${data.receipts.summary.totalReceipts} receipt card(s), ${data.receipts.summary.needsReview} need review.`,
    `Rollback previews: ${data.receipts.summary.rollbackAvailable}.`,
  ], 'Use `zavorth visual-receipts` to inspect evidence.');
  const trustCard = card('trust', 'Safety boundary', data.trust.status, [
    `${data.trust.summary.canDoAlone} can be done alone, ${data.trust.summary.asksFirst} ask first, ${data.trust.summary.blocked} blocked.`,
    'Personal mode is simpler, but it does not bypass Policy Broker.',
  ], 'Use `zavorth trust-panel` for the full boundary.');
  const gatewayCard = card('gateway', 'Runtime summary', data.gateway.status, [
    `Gateway runtime: ${data.gateway.gatewayRuntime.lifecycleStatus}.`,
    `Channels: ${data.gateway.channels.summary.total}; approvals: ${data.gateway.approvals.pending}/${data.gateway.approvals.total}.`,
  ], 'Open `/dashboard` for daily use.');

  if (intent === 'providers_ready') return [providerCard];
  if (intent === 'channels_ready') return [channelCard];
  if (intent === 'execution_backends_ready') return [buildExecutionBackendCard(data.terminalBackends)];
  if (intent === 'approvals_pending') return [approvalCard];
  if (intent === 'receipts_summary') return [receiptCard];
  if (intent === 'safety_boundary') return [trustCard];
  if (intent === 'setup_gaps') return [providerCard, channelCard, trustCard].filter((entry) => entry.status !== 'ready');
  return [gatewayCard, providerCard, channelCard, approvalCard, receiptCard, trustCard];
}

function buildExecutionBackendCard(snapshot: { backends?: ZavorthTerminalBackendDescriptor[] } | null | undefined): ZavorthNaturalRuntimeAnswerCard {
  const backends: ZavorthTerminalBackendDescriptor[] = Array.isArray(snapshot?.backends) ? snapshot.backends : [];
  const readyStrong = backends.filter((backend) =>
    backend?.liveReady === true && backend?.id !== 'local' && backend?.status === 'ready');
  const dormantStrong = backends.filter((backend) =>
    backend?.id !== 'local' && backend?.status === 'available-on-demand' && backend?.activationMode === 'on-demand');
  const localReady = backends.some((backend) => backend?.id === 'local' && backend?.liveReady === true);
  const dockerReady = readyStrong.some((backend) => backend?.id === 'docker');
  const wslReady = readyStrong.some((backend) => backend?.id === 'wsl');
  const dockerDormant = dormantStrong.some((backend) => backend?.id === 'docker');
  const wslDormant = dormantStrong.some((backend) => backend?.id === 'wsl');
  const readyLabels = readyStrong.map((backend) => String(backend.label || backend.id)).slice(0, MAX_EXECUTION_BACKEND_LABELS);
  const dormantLabels = dormantStrong.map((backend) => String(backend.label || backend.id)).slice(0, MAX_EXECUTION_BACKEND_LABELS);
  const status: ZavorthNaturalRuntimeAnswerCard['status'] = readyStrong.length > 0
    ? 'ready'
    : dormantStrong.length > 0 || localReady
      ? 'attention'
      : 'unknown';
  const availability = readyStrong.length > 0
    ? `${joinLabels(readyLabels)} ${readyStrong.length === 1 ? 'is' : 'are'} ready for isolated execution.`
    : dormantStrong.length > 0
      ? `${joinLabels(dormantLabels)} ${dormantStrong.length === 1 ? 'is' : 'are'} available on demand and kept asleep until a task asks for isolated execution.`
      : 'No isolated executor is live-ready yet; Zavorth can still preview plans and use the local supervised shell.';
  const namedReadiness = [
    `Docker: ${dockerReady ? 'ready' : dockerDormant ? 'available on demand' : 'not installed or not configured'}.`,
    `WSL: ${wslReady ? 'ready' : wslDormant ? 'available on demand' : 'not installed or not configured'}.`,
  ].join(' ');

  return card('execution-backends', 'Safe executor', status, [
    availability,
    namedReadiness,
    dormantStrong.length > 0
      ? 'Dormant executors are intentionally asleep so a notebook does not stay heavy just to advertise readiness.'
      : 'Executor probes stay lightweight unless the user asks for isolated execution.',
    'Live command execution stays off by default; risky actions still need approval and receipts.',
    'Docker plans keep network disabled by default unless a governed action explicitly allows network use.',
  ], 'Ask Zavorth to run work in an isolated executor when you need it; readiness checks do not execute your command.');
}

function buildShortAnswer(intent: ZavorthNaturalRuntimeQuestionIntent, cards: ZavorthNaturalRuntimeAnswerCard[]): string {
  if (intent === 'unknown') {
    return 'I can answer runtime, provider, channel, approval, receipt and safety questions from the current Zavorth projections.';
  }
  const attention = cards.filter((card) => card.status !== 'ready').length;
  return attention > 0
    ? `I found ${attention} area(s) that need attention.`
    : 'Everything in this answer looks ready from the current read-only projection.';
}

function card(
  id: string,
  title: string,
  status: ZavorthNaturalRuntimeAnswerCard['status'],
  bullets: string[],
  nextAction: string,
): ZavorthNaturalRuntimeAnswerCard {
  return {
    id,
    title,
    status,
    summary: bullets[0] || title,
    bullets: bullets.map(sanitizeText),
    nextAction,
  };
}

function source(id: string, surface: string, command: string, route: string | null) {
  return { id, surface, command, route, executionAuthority: false as const };
}

function providerStatus(snapshot: any): ZavorthNaturalRuntimeAnswerCard['status'] {
  if (snapshot.summary.blocked > 0) return 'blocked';
  if (snapshot.summary.ready > 0 && snapshot.summary.missingAuth === 0 && snapshot.summary.needsProbe === 0) return 'ready';
  return 'attention';
}

function countStatus(ready: number, needsSetup: number): ZavorthNaturalRuntimeAnswerCard['status'] {
  if (ready > 0 && needsSetup === 0) return 'ready';
  return needsSetup > 0 ? 'attention' : 'unknown';
}

function joinLabels(labels: string[]): string {
  if (labels.length === 0) return 'No isolated executor';
  if (labels.length === 1) return labels[0]!;
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

function normalizeQuestion(value: string): string {
  return sanitizeText(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') return sanitizeText(value);
  if (Array.isArray(value)) return value.map((entry) => sanitizeValue(entry));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, sanitizeValue(entry)]),
  );
}

function sanitizeText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/\b([A-Z0-9_]*(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)[A-Z0-9_]*)\s*=\s*[^\s"'`]+/gi, '$1=[REDACTED]')
    .replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, '[REDACTED_SECRET]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED_SECRET]')
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[REDACTED_SECRET]')
    .replace(/\bpk_(?:live|test)_[A-Za-z0-9_-]{12,}\b/g, '[REDACTED_SECRET]')
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g, '[REDACTED_SECRET]')
    .replace(/\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g, '[REDACTED_SECRET]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]')
    .slice(0, 1200);
}
