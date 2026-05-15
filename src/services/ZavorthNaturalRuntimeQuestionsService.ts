import {
  ZAVORTH_NATURAL_RUNTIME_QUESTIONS_CONTRACT_VERSION,
  type ZavorthNaturalRuntimeAnswerCard,
  type ZavorthNaturalRuntimeQuestionIntent,
  type ZavorthNaturalRuntimeQuestionsSnapshot,
} from '../contracts/ZavorthNaturalRuntimeQuestionsContract.js';
import { GatewaySpineService } from './GatewaySpineService.js';
import { ZavorthCapabilityStoreService } from './ZavorthCapabilityStoreService.js';
import { ZavorthProviderReadinessMatrixService } from './ZavorthProviderReadinessMatrixService.js';
import { ZavorthSatelliteApprovalCompanionService } from './ZavorthSatelliteApprovalCompanionService.js';
import { ZavorthTrustPanelService } from './ZavorthTrustPanelService.js';
import { ZavorthVisualReceiptsV2Service } from './ZavorthVisualReceiptsV2Service.js';

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
};

export class ZavorthNaturalRuntimeQuestionsService {
  private readonly now: () => Date;
  private readonly gateway: Pick<GatewaySpineService, 'buildSnapshot'>;
  private readonly providers: Pick<ZavorthProviderReadinessMatrixService, 'buildSnapshot'>;
  private readonly capabilities: Pick<ZavorthCapabilityStoreService, 'buildContract'>;
  private readonly approvals: Pick<ZavorthSatelliteApprovalCompanionService, 'buildSnapshot'>;
  private readonly receipts: Pick<ZavorthVisualReceiptsV2Service, 'buildSnapshot'>;
  private readonly trust: Pick<ZavorthTrustPanelService, 'buildContract'>;

  constructor(runtime: ZavorthNaturalRuntimeQuestionsRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.gateway = runtime.gateway || new GatewaySpineService();
    this.providers = runtime.providers || new ZavorthProviderReadinessMatrixService();
    this.capabilities = runtime.capabilities || new ZavorthCapabilityStoreService();
    this.approvals = runtime.approvals || new ZavorthSatelliteApprovalCompanionService();
    this.receipts = runtime.receipts || new ZavorthVisualReceiptsV2Service();
    this.trust = runtime.trust || new ZavorthTrustPanelService();
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
    const cards = buildCards(intent, {
      providers,
      channels,
      gateway,
      approvals,
      receipts,
      trust,
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
  if (/provider|model|openai|claude|gemini|ollama|ready/.test(question)) return 'providers_ready';
  if (/channel|telegram|whatsapp|discord|signal|slack|email/.test(question)) return 'channels_ready';
  if (/approval|approve|deny|permission|pending/.test(question)) return 'approvals_pending';
  if (/receipt|audit|evidence|what happened|done/.test(question)) return 'receipts_summary';
  if (/missing|broken|blocked|setup|configure|need/.test(question)) return 'setup_gaps';
  if (/safe|trust|allowed|blocked|permission|can do/.test(question)) return 'safety_boundary';
  if (/status|summary|runtime|everything|overall|health/.test(question)) return 'runtime_summary';
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
  if (intent === 'approvals_pending') return [approvalCard];
  if (intent === 'receipts_summary') return [receiptCard];
  if (intent === 'safety_boundary') return [trustCard];
  if (intent === 'setup_gaps') return [providerCard, channelCard, trustCard].filter((entry) => entry.status !== 'ready');
  return [gatewayCard, providerCard, channelCard, approvalCard, receiptCard, trustCard];
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
    .replace(/\b(sk|pk|ghp|gho|xox[baprs])[-_A-Za-z0-9]{8,}\b/g, '[REDACTED_SECRET]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]')
    .slice(0, 1200);
}
