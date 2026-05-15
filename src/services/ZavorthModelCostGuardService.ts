import {
  type ZavorthAutonomySliderLevel,
} from '../contracts/ZavorthAutonomySliderContract.js';
import {
  ZAVORTH_MODEL_COST_GUARD_CONTRACT_VERSION,
  type ZavorthModelCostGuardContract,
  type ZavorthModelCostGuardDecision,
  type ZavorthModelCostGuardProviderCard,
  type ZavorthModelCostTier,
} from '../contracts/ZavorthModelCostGuardContract.js';
import {
  ZavorthAutonomySliderService,
  type ZavorthAutonomySliderInput,
} from './ZavorthAutonomySliderService.js';
import {
  ZavorthProviderReadinessMatrixService,
  type ZavorthProviderReadinessMatrixInput,
} from './ZavorthProviderReadinessMatrixService.js';

export type ZavorthModelCostGuardInput = {
  profile?: unknown;
  autonomy?: unknown;
  request?: unknown;
  maxCents?: unknown;
  provider?: unknown;
};

export type ZavorthModelCostGuardRuntime = {
  autonomySlider?: Pick<ZavorthAutonomySliderService, 'buildContract'>;
  providerReadiness?: Pick<ZavorthProviderReadinessMatrixService, 'buildSnapshot'>;
};

const PROVIDER_TIERS: Record<string, Omit<ZavorthModelCostGuardProviderCard, 'readiness' | 'liveUseNeedsApproval'>> = {
  ollama: {
    id: 'ollama',
    label: 'Ollama',
    tier: 'free_or_local',
    bestFor: ['Local/private drafts', 'low-cost routine work', 'offline experimentation'],
    privacy: 'local',
    costKnown: true,
    note: 'Local runtime cost depends on the host machine, not per-token billing.',
  },
  'custom-openai-compatible': {
    id: 'custom-openai-compatible',
    label: 'OpenAI-compatible endpoint',
    tier: 'unknown',
    bestFor: ['Custom gateways', 'local proxies', 'provider aggregation'],
    privacy: 'proxy',
    costKnown: false,
    note: 'Cost depends on the configured endpoint; require explicit budget before live use.',
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    tier: 'standard',
    bestFor: ['Model choice', 'fallback routing', 'provider comparison'],
    privacy: 'proxy',
    costKnown: false,
    note: 'Provider/model price varies by selected route; show budget before live calls.',
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    tier: 'low',
    bestFor: ['Fast summaries', 'daily help', 'large-context practical work'],
    privacy: 'hosted',
    costKnown: false,
    note: 'Usually useful for fast/cheap paths, but live price must be treated as provider policy.',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    tier: 'standard',
    bestFor: ['General reasoning', 'tool use', 'agentic workflows'],
    privacy: 'hosted',
    costKnown: false,
    note: 'Good default hosted route when configured; budget guard should track usage evidence.',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    tier: 'premium',
    bestFor: ['Deep review', 'long reasoning', 'careful code analysis'],
    privacy: 'hosted',
    costKnown: false,
    note: 'Treat as premium for cost guard unless a local policy says otherwise.',
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    tier: 'low',
    bestFor: ['Fast low-latency tasks', 'drafting', 'routing'],
    privacy: 'hosted',
    costKnown: false,
    note: 'Fast hosted route; pricing/readiness still need live/provider confirmation.',
  },
  mistral: {
    id: 'mistral',
    label: 'Mistral',
    tier: 'standard',
    bestFor: ['European hosted workflows', 'general assistant tasks'],
    privacy: 'hosted',
    costKnown: false,
    note: 'Use as standard hosted route with budget approval.',
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    tier: 'low',
    bestFor: ['Cost-sensitive coding', 'reasoning drafts'],
    privacy: 'hosted',
    costKnown: false,
    note: 'Cost-sensitive option when configured and live-probed.',
  },
  xai: {
    id: 'xai',
    label: 'xAI',
    tier: 'standard',
    bestFor: ['Hosted reasoning', 'model comparison'],
    privacy: 'hosted',
    costKnown: false,
    note: 'Hosted provider; do not assume live readiness or price.',
  },
  together: {
    id: 'together',
    label: 'Together',
    tier: 'standard',
    bestFor: ['Open model hosting', 'routing experiments'],
    privacy: 'hosted',
    costKnown: false,
    note: 'Route cost depends on selected model.',
  },
  cerebras: {
    id: 'cerebras',
    label: 'Cerebras',
    tier: 'standard',
    bestFor: ['Fast inference', 'provider comparison'],
    privacy: 'hosted',
    costKnown: false,
    note: 'Use with explicit budget and readiness proof.',
  },
  'azure-openai': {
    id: 'azure-openai',
    label: 'Azure OpenAI',
    tier: 'standard',
    bestFor: ['Enterprise hosted routes', 'managed cloud policies'],
    privacy: 'hosted',
    costKnown: false,
    note: 'Cost depends on Azure deployment and enterprise policy.',
  },
  bedrock: {
    id: 'bedrock',
    label: 'Bedrock',
    tier: 'premium',
    bestFor: ['Enterprise cloud routing', 'AWS-governed deployments'],
    privacy: 'hosted',
    costKnown: false,
    note: 'Enterprise cloud route; require explicit setup and budget policy.',
  },
};

export class ZavorthModelCostGuardService {
  private readonly autonomySlider: Pick<ZavorthAutonomySliderService, 'buildContract'>;
  private readonly providerReadiness: Pick<ZavorthProviderReadinessMatrixService, 'buildSnapshot'>;

  constructor(runtime: ZavorthModelCostGuardRuntime = {}) {
    this.autonomySlider = runtime.autonomySlider || new ZavorthAutonomySliderService();
    this.providerReadiness = runtime.providerReadiness || new ZavorthProviderReadinessMatrixService();
  }

  public buildContract(input: ZavorthModelCostGuardInput = {}): ZavorthModelCostGuardContract {
    const request = clean(input.request);
    const autonomy = this.autonomySlider.buildContract({
      profile: input.profile,
      level: input.autonomy,
      intent: request,
    } satisfies ZavorthAutonomySliderInput);
    const providerMatrix = this.providerReadiness.buildSnapshot({
      includeAdvanced: true,
      providerId: clean(input.provider),
    } satisfies ZavorthProviderReadinessMatrixInput);
    const missionKind = classifyMission(request);
    const complexity = classifyComplexity(request, missionKind);
    const estimate = buildEstimate(complexity, missionKind);
    const effectiveMaxCents = resolveBudgetCents(input.maxCents, autonomy.requestedLevel, missionKind);
    const providerCards = buildProviderCards(providerMatrix.entries.map((entry) => ({
      id: entry.id,
      providerId: entry.providerId,
      providerName: entry.providerName,
      familyIds: entry.familyIds,
      status: entry.status,
      liveReady: entry.liveReady,
    })));
    const recommendedTier = recommendTier(autonomy.requestedLevel, missionKind, complexity);
    const decision = decide({
      estimateRisk: estimate.riskOfCostSurprise,
      maxCents: effectiveMaxCents,
      providerCards,
      requestedProvider: clean(input.provider),
      recommendedTier,
    });

    return {
      contractVersion: ZAVORTH_MODEL_COST_GUARD_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'model-cost-guard',
      selectedProfile: autonomy.selectedProfile,
      autonomy: autonomy.requestedLevel,
      request,
      missionKind,
      estimate: {
        complexity,
        expectedTokens: estimate.expectedTokens,
        expectedToolCalls: estimate.expectedToolCalls,
        expectedSubagents: estimate.expectedSubagents,
        riskOfCostSurprise: estimate.riskOfCostSurprise,
      },
      budget: {
        profileDefaultCents: defaultBudgetCents(autonomy.requestedLevel),
        requestedMaxCents: parseCents(input.maxCents),
        effectiveMaxCents,
        requireApprovalAboveCents: approvalThresholdCents(autonomy.requestedLevel),
        stopWhenExceeded: true,
      },
      routing: {
        recommendedTier,
        decision,
        reason: decisionReason(decision, recommendedTier, estimate.riskOfCostSurprise),
        fallbackOrder: fallbackOrder(recommendedTier, providerCards),
      },
      providerCards,
      userFacingCopy: {
        short: shortCopy(decision, effectiveMaxCents, recommendedTier),
        approvalPrompt: approvalPrompt(decision, effectiveMaxCents),
        receiptLine: `Cost guard: ${decision}; limit=${formatCents(effectiveMaxCents)}; estimate=${estimate.expectedTokens.total} tokens; tier=${recommendedTier}.`,
      },
      safety: {
        previewOnlyByDefault: true,
        liveProviderUseRequiresExplicitReadiness: true,
        paidEscalationRequiresApproval: true,
        costLimitIsAdvisoryUntilProviderReportsUsage: true,
        rawSecretsSerialized: false,
      },
      commandPreview: {
        inspect: 'zavorth model-cost --json',
        setBudget: `zavorth model-cost --max-cents ${effectiveMaxCents}`,
        runWithGuard: `zavorth run "${request || 'your mission'}" --max-cents ${effectiveMaxCents}`,
      },
      invariants: [
        'Model Cost Guard never treats a provider catalog entry as permission to spend.',
        'Live hosted provider use requires readiness evidence and a budget boundary.',
        'Unknown provider pricing is treated as approval-required, not free.',
        'Local models may avoid token billing but still consume host resources.',
        'Cost limits become enforceable only when provider/tool usage reports are available; otherwise they are conservative routing gates.',
      ],
    };
  }

  public renderText(contract: ZavorthModelCostGuardContract): string {
    return [
      '[zavorth-model-cost-guard]',
      `${contract.userFacingCopy.short} | profile=${contract.selectedProfile} autonomy=${contract.autonomy}`,
      `mission=${contract.missionKind} complexity=${contract.estimate.complexity} risk=${contract.estimate.riskOfCostSurprise}`,
      `tokens=${contract.estimate.expectedTokens.total} tools=${contract.estimate.expectedToolCalls} subagents=${contract.estimate.expectedSubagents}`,
      `budget=${formatCents(contract.budget.effectiveMaxCents)} approval-above=${formatCents(contract.budget.requireApprovalAboveCents)} decision=${contract.routing.decision}`,
      '',
      '[routing]',
      `tier=${contract.routing.recommendedTier}`,
      `reason=${contract.routing.reason}`,
      `fallback=${contract.routing.fallbackOrder.join(', ') || 'none'}`,
      '',
      '[providers]',
      ...contract.providerCards.slice(0, 10).map((card) =>
        `- ${card.id}: ${card.tier} | ${card.readiness} | approval=${card.liveUseNeedsApproval ? 'yes' : 'no'} | ${card.note}`,
      ),
      '',
      '[user copy]',
      contract.userFacingCopy.approvalPrompt,
      contract.userFacingCopy.receiptLine,
      '',
    ].join('\n');
  }
}

function buildProviderCards(entries: Array<{
  id: string;
  providerId: string;
  providerName: string;
  familyIds: string[];
  status: string;
  liveReady: boolean;
}>): ZavorthModelCostGuardProviderCard[] {
  const cards = new Map<string, ZavorthModelCostGuardProviderCard>();
  for (const entry of entries) {
    const keys = [entry.id, entry.providerId, entry.providerName, ...entry.familyIds].map(normalizeId);
    const tierKey = keys.find((key) => PROVIDER_TIERS[key]);
    const template = PROVIDER_TIERS[tierKey || ''] || {
      id: entry.id,
      label: entry.providerName || entry.id,
      tier: 'unknown' as const,
      bestFor: ['Unknown provider route'],
      privacy: 'unknown' as const,
      costKnown: false,
      note: 'Unknown provider cost; require explicit budget and readiness proof.',
    };
    const id = template.id;
    if (cards.has(id)) {
      continue;
    }
    cards.set(id, {
      ...template,
      readiness: readiness(entry.status, entry.liveReady),
      liveUseNeedsApproval: template.tier !== 'free_or_local' || !entry.liveReady || !template.costKnown,
    });
  }
  if (cards.size === 0) {
    for (const template of Object.values(PROVIDER_TIERS).slice(0, 6)) {
      cards.set(template.id, {
        ...template,
        readiness: 'unknown',
        liveUseNeedsApproval: template.tier !== 'free_or_local',
      });
    }
  }
  return Array.from(cards.values());
}

function readiness(status: string, liveReady: boolean): ZavorthModelCostGuardProviderCard['readiness'] {
  if (status === 'blocked' || status === 'unsupported') {
    return 'blocked';
  }
  if (status === 'missing_auth' || status === 'missing_base_url') {
    return 'needs_setup';
  }
  if (status === 'needs_probe' || (status === 'ready' && !liveReady)) {
    return 'needs_probe';
  }
  return status === 'ready' ? 'ready' : 'unknown';
}

function classifyMission(request: string | null): ZavorthModelCostGuardContract['missionKind'] {
  const text = normalize(request);
  if (/repo|code|bug|test|patch|github|developer/.test(text)) return 'development';
  if (/pdf|document|summar/.test(text)) return 'documents';
  if (/business|report|audit|client|customer|company/.test(text)) return 'business';
  if (/schedule|cron|routine|every day|remind|automation/.test(text)) return 'automation';
  if (/phone|adb|screen|browser|computer|device/.test(text)) return 'device';
  if (/day|message|file|organize|personal|daily/.test(text)) return 'daily';
  return 'unknown';
}

function classifyComplexity(
  request: string | null,
  missionKind: ZavorthModelCostGuardContract['missionKind'],
): ZavorthModelCostGuardContract['estimate']['complexity'] {
  const text = normalize(request);
  if (/large|entire|whole|all files|subagents|deep|audit|architecture|refactor/.test(text)) return 'large';
  if (missionKind === 'development' || missionKind === 'business' || missionKind === 'automation' || missionKind === 'device') return 'medium';
  if (text.split(/\s+/).filter(Boolean).length > 30) return 'medium';
  return 'small';
}

function buildEstimate(
  complexity: ZavorthModelCostGuardContract['estimate']['complexity'],
  missionKind: ZavorthModelCostGuardContract['missionKind'],
): Pick<ZavorthModelCostGuardContract['estimate'], 'expectedTokens' | 'expectedToolCalls' | 'expectedSubagents' | 'riskOfCostSurprise'> {
  const base = complexity === 'large'
    ? { input: 45000, output: 9000, tools: 12, subagents: missionKind === 'development' ? 3 : 1 }
    : complexity === 'medium'
      ? { input: 14000, output: 4000, tools: 5, subagents: missionKind === 'development' ? 1 : 0 }
      : { input: 3500, output: 1200, tools: 1, subagents: 0 };
  const highRisk = complexity === 'large' || missionKind === 'automation' || missionKind === 'device';
  return {
    expectedTokens: {
      input: base.input,
      output: base.output,
      total: base.input + base.output,
    },
    expectedToolCalls: base.tools,
    expectedSubagents: base.subagents,
    riskOfCostSurprise: highRisk ? 'high' : complexity === 'medium' ? 'medium' : 'low',
  };
}

function recommendTier(
  autonomy: ZavorthAutonomySliderLevel,
  missionKind: ZavorthModelCostGuardContract['missionKind'],
  complexity: ZavorthModelCostGuardContract['estimate']['complexity'],
): ZavorthModelCostTier {
  if (missionKind === 'daily' || complexity === 'small') return 'low';
  if (autonomy === 'conservative') return 'free_or_local';
  if (missionKind === 'development' && complexity === 'large') return 'premium';
  if (missionKind === 'business') return 'standard';
  if (missionKind === 'device' || missionKind === 'automation') return 'standard';
  return 'standard';
}

function decide(input: {
  estimateRisk: ZavorthModelCostGuardContract['estimate']['riskOfCostSurprise'];
  maxCents: number;
  providerCards: ZavorthModelCostGuardProviderCard[];
  requestedProvider: string | null;
  recommendedTier: ZavorthModelCostTier;
}): ZavorthModelCostGuardDecision {
  const provider = input.requestedProvider
    ? input.providerCards.find((card) => normalizeId(card.id) === normalizeId(input.requestedProvider) || normalizeId(card.label) === normalizeId(input.requestedProvider))
    : null;
  if (provider && provider.readiness === 'blocked') return 'block_until_configured';
  if (provider && provider.readiness !== 'ready') return 'ask_before_live';
  if (input.recommendedTier === 'free_or_local') return 'allow_preview';
  if (!provider || provider.liveUseNeedsApproval) return 'ask_before_live';
  if (input.estimateRisk === 'high' || input.maxCents <= 0) return 'ask_before_live';
  return input.maxCents >= 25 ? 'allow_with_budget' : 'ask_before_live';
}

function decisionReason(
  decision: ZavorthModelCostGuardDecision,
  tier: ZavorthModelCostTier,
  risk: ZavorthModelCostGuardContract['estimate']['riskOfCostSurprise'],
): string {
  if (decision === 'block_until_configured') return 'The selected provider is blocked or not configured enough for live use.';
  if (decision === 'ask_before_live') return `The request has ${risk} cost-surprise risk or uses ${tier} hosted routing. Ask before live spend.`;
  if (decision === 'allow_with_budget') return `Proceed only inside the visible budget using ${tier} routing and receipts.`;
  return 'Preview/local route can proceed without paid provider spend.';
}

function fallbackOrder(tier: ZavorthModelCostTier, providers: ZavorthModelCostGuardProviderCard[]): string[] {
  const tiers: ZavorthModelCostTier[] = tier === 'premium'
    ? ['premium', 'standard', 'low', 'free_or_local']
    : tier === 'standard'
      ? ['standard', 'low', 'free_or_local', 'premium']
      : tier === 'low'
        ? ['low', 'free_or_local', 'standard']
        : ['free_or_local', 'low', 'standard'];
  return providers
    .filter((provider) => tiers.includes(provider.tier))
    .sort((a, b) => tiers.indexOf(a.tier) - tiers.indexOf(b.tier))
    .map((provider) => provider.id)
    .filter(unique)
    .slice(0, 6);
}

function resolveBudgetCents(
  raw: unknown,
  autonomy: ZavorthAutonomySliderLevel,
  missionKind: ZavorthModelCostGuardContract['missionKind'],
): number {
  const requested = parseCents(raw);
  if (requested !== null) return requested;
  const base = defaultBudgetCents(autonomy);
  return missionKind === 'development' || missionKind === 'business' ? Math.max(base, 100) : base;
}

function defaultBudgetCents(autonomy: ZavorthAutonomySliderLevel): number {
  if (autonomy === 'conservative') return 0;
  if (autonomy === 'business') return 500;
  if (autonomy === 'advanced') return 250;
  return 50;
}

function approvalThresholdCents(autonomy: ZavorthAutonomySliderLevel): number {
  if (autonomy === 'business') return 1;
  if (autonomy === 'conservative') return 0;
  if (autonomy === 'advanced') return 50;
  return 10;
}

function parseCents(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.round(numeric) : null;
}

function shortCopy(
  decision: ZavorthModelCostGuardDecision,
  maxCents: number,
  tier: ZavorthModelCostTier,
): string {
  if (decision === 'block_until_configured') return 'This provider cannot be used yet.';
  if (decision === 'ask_before_live') return `I will ask before using a live ${tier} model or spending beyond ${formatCents(maxCents)}.`;
  if (decision === 'allow_with_budget') return `Live model use is allowed only inside the ${formatCents(maxCents)} budget.`;
  return 'Preview or local work can start without paid model spend.';
}

function approvalPrompt(decision: ZavorthModelCostGuardDecision, maxCents: number): string {
  if (decision === 'allow_preview') return 'No paid model approval needed for preview/local work.';
  if (decision === 'block_until_configured') return 'Configure or unblock the provider before live use.';
  return `Zavorth wants to use a live model with a visible max budget of ${formatCents(maxCents)}. Allow once?`;
}

function formatCents(cents: number): string {
  return `$${(Math.max(0, cents) / 100).toFixed(2)}`;
}

function normalizeId(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function normalize(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function clean(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text ? text : null;
}

function unique<T>(value: T, index: number, values: T[]): boolean {
  return values.indexOf(value) === index;
}
