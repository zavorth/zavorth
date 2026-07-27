import {
  ZAVORTH_PROVIDER_SELECTION_UX_CONTRACT_VERSION,
  type ZavorthProviderSelectionCandidate,
  type ZavorthProviderSelectionDecision,
  type ZavorthProviderSelectionIntent,
  type ZavorthProviderSelectionUxSnapshot,
} from '../contracts/ZavorthProviderSelectionUxContract.js';
import type {
  ZavorthProviderReadinessEntry,
  ZavorthProviderReadinessMatrixSnapshot,
} from '../contracts/ZavorthProviderReadinessMatrixContract.js';
import {
  ZavorthProviderReadinessMatrixService,
  type ZavorthProviderReadinessMatrixInput,
} from './ZavorthProviderReadinessMatrixService.js';

export type ZavorthProviderSelectionUxInput = ZavorthProviderReadinessMatrixInput & {
  target?: string | null;
  intent?: ZavorthProviderSelectionIntent | string | null;
  requireLiveEvidence?: boolean;
};

export type ZavorthProviderSelectionUxRuntime = {
  now?: () => Date;
  readiness?: Pick<ZavorthProviderReadinessMatrixService, 'buildLiveSnapshot' | 'renderText'>;
};

export class ZavorthProviderSelectionUxService {
  private readonly now: () => Date;
  private readonly readiness: Pick<ZavorthProviderReadinessMatrixService, 'buildLiveSnapshot'>;

  constructor(runtime: ZavorthProviderSelectionUxRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.readiness = runtime.readiness || new ZavorthProviderReadinessMatrixService({
      now: this.now,
    });
  }

  public async buildSnapshot(input: ZavorthProviderSelectionUxInput = {}): Promise<ZavorthProviderSelectionUxSnapshot> {
    const intent = normalizeIntent(input.intent, input.target);
    const target = normalizeId(input.target || input.providerId);
    const matrix = await this.readiness.buildLiveSnapshot({
      ...input,
      providerId: input.live === true && target ? target : null,
      probe: true,
      live: input.live === true,
      allowAllLive: false,
    });
    const candidates = rankCandidates(matrix, intent, target);
    const selected = findExplicitCandidate(candidates, target)
      || candidates.find((candidate) => candidate.canUseNow || candidate.canTestNow)
      || candidates[0]
      || null;
    const fallbacks = candidates
      .filter((candidate) => !selected || candidate.providerId !== selected.providerId)
      .filter((candidate) => candidate.canUseNow || candidate.canTestNow)
      .slice(0, 4);
    const blocked = candidates
      .filter((candidate) => candidate.requiresConfiguration || candidate.status === 'blocked')
      .slice(0, 6);
    const decision = resolveDecision(selected, fallbacks, input.requireLiveEvidence === true);

    return {
      contractVersion: ZAVORTH_PROVIDER_SELECTION_UX_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'provider-selection-ux',
      generatedAt: this.now().toISOString(),
      request: {
        target: target || null,
        intent,
        requireLiveEvidence: input.requireLiveEvidence === true,
        includeAdvanced: input.includeAdvanced === true,
      },
      active: {
        provider: matrix.activeProvider,
        model: matrix.activeModel,
      },
      decision,
      selected,
      fallbacks,
      blocked,
      explanation: buildExplanation(matrix, selected, decision, input.requireLiveEvidence === true),
      safety: {
        catalogIsNotLiveProof: true,
        selectionDoesNotWriteConfig: true,
        liveProbeRequiresExplicitCommand: true,
        rawSecretsSerialized: false,
        zavorthControlExecutionAuthority: false,
      },
      commands: buildCommands(selected, fallbacks),
      nextAction: buildNextAction(selected, decision),
    };
  }

  public renderText(snapshot: ZavorthProviderSelectionUxSnapshot): string {
    const selected = snapshot.selected;
    return [
      '[provider-selection]',
      `decision=${snapshot.decision}`,
      `intent=${snapshot.request.intent}`,
      `target=${snapshot.request.target || 'auto'}`,
      `active=${snapshot.active.provider}/${snapshot.active.model}`,
      selected ? `selected=${selected.providerId} status=${selected.status} live=${selected.liveStatus} model=${selected.model || 'none'}`
        : 'selected=none',
      '',
      '[explanation]',
      ...snapshot.explanation.map((line) => `- ${line}`),
      '',
      '[fallbacks]',
      ...(snapshot.fallbacks.length
        ? snapshot.fallbacks.map((candidate) => `- ${candidate.providerId}: ${candidate.status}/${candidate.liveStatus} score=${candidate.score}`)
        : ['- none']),
      '',
      '[commands]',
      ...snapshot.commands.map((entry) => `- ${entry.id}: ${entry.command} | live=${entry.liveNetworkUsed} | mutates_config=${entry.mutatesConfig}`),
      '',
      `next=${snapshot.nextAction}`,
      '',
    ].join('\n');
  }
}

function findExplicitCandidate(
  candidates: ZavorthProviderSelectionCandidate[],
  target: string,
): ZavorthProviderSelectionCandidate | null {
  if (!target) {
    return null;
  }
  return candidates.find((candidate) => candidate.providerId === target) || null;
}

function rankCandidates(
  matrix: ZavorthProviderReadinessMatrixSnapshot,
  intent: ZavorthProviderSelectionIntent,
  target: string,
): ZavorthProviderSelectionCandidate[] {
  return matrix.entries
    .map((entry) => toCandidate(entry, scoreEntry(entry, intent, target)))
    .sort((a, b) => b.score - a.score || a.providerId.localeCompare(b.providerId));
}

function toCandidate(entry: ZavorthProviderReadinessEntry, score: number): ZavorthProviderSelectionCandidate {
  const canUseNow = entry.status === 'ready' && (!entry.discoverySupported || entry.probe.status === 'passed' || entry.probe.status === 'ready_to_probe' || entry.probe.status === 'not_run');
  const canTestNow = (entry.status === 'ready' || entry.status === 'needs_probe') && entry.probe.status !== 'blocked';
  const requiresConfiguration = entry.status === 'missing_auth' || entry.status === 'missing_base_url' || entry.status === 'unsupported' || entry.status === 'degraded';
  const livePassed = entry.probe.status === 'passed';
  return {
    providerId: entry.id,
    label: entry.label,
    model: entry.currentModelName,
    status: entry.status,
    liveStatus: entry.probe.status,
    score,
    reasons: [
      entry.status === 'ready' ? 'Provider appears configured.' : entry.userAction,
      livePassed ? 'Live evidence exists.' : 'Catalog readiness is not live proof.',
      entry.routeClass === 'local' ? 'local/private route.' : `${entry.routeClass || entry.routeKind} route.`,
    ],
    canUseNow,
    canTestNow,
    requiresConfiguration,
    userAction: entry.userAction,
    commands: {
      use: `zavorth providers select ${entry.id}`,
      inspect: `zavorth providers --provider ${entry.id}`,
      test: `zavorth providers test ${entry.id}`,
      liveTest: `zavorth providers test ${entry.id} --live`,
    },
  };
}

function scoreEntry(entry: ZavorthProviderReadinessEntry, intent: ZavorthProviderSelectionIntent, target: string): number {
  let score = 0;
  const keys = new Set([entry.id, entry.providerId, entry.providerName, ...entry.familyIds].map(normalizeId));
  if (target && keys.has(target)) score += 1000;
  if (entry.status === 'ready') score += 120;
  if (entry.status === 'needs_probe') score += 70;
  if (entry.probe.status === 'passed') score += 70;
  if (entry.probe.status === 'ready_to_probe') score += 30;
  if (entry.status === 'missing_auth' || entry.status === 'missing_base_url') score -= 60;
  if (entry.status === 'blocked' || entry.status === 'unsupported') score -= 100;
  if (intent === 'fast' && ['gemini', 'groq', 'deepseek', 'openrouter', 'qwen'].some((key) => keys.has(key))) score += 40;
  if (intent === 'smart' && ['openai', 'anthropic', 'gemini', 'openrouter'].some((key) => keys.has(key))) score += 40;
  if (intent === 'local' && (entry.routeClass === 'local' || ['ollama', 'lmstudio', 'vllm', 'aigateway'].some((key) => keys.has(key)))) score += 80;
  if (intent === 'openai-compatible' && ['openai', 'openrouter', 'aigateway', 'custom-openai-compatible', 'litellm', 'ollama'].some((key) => keys.has(key))) score += 60;
  if (intent === 'coding' && ['openai', 'aigateway', 'anthropic', 'openrouter', 'gemini'].some((key) => keys.has(key))) score += 55;
  if (intent === 'research' && ['openrouter', 'openai', 'gemini', 'anthropic'].some((key) => keys.has(key))) score += 55;
  if (intent === 'budget' && ['gemini', 'gemma', 'qwen', 'deepseek', 'groq'].some((key) => keys.has(key))) score += 55;
  return score;
}

function resolveDecision(
  selected: ZavorthProviderSelectionCandidate | null,
  fallbacks: ZavorthProviderSelectionCandidate[],
  requireLiveEvidence: boolean,
): ZavorthProviderSelectionDecision {
  if (!selected) return 'blocked';
  if (selected.status === 'blocked') return fallbacks.length > 0 ? 'choose_fallback' : 'blocked';
  if (selected.requiresConfiguration) return fallbacks.length > 0 ? 'choose_fallback' : 'configure_first';
  if (requireLiveEvidence && selected.liveStatus !== 'passed') return selected.canTestNow ? 'test_first' : 'choose_fallback';
  if (selected.status === 'needs_probe' || selected.liveStatus === 'ready_to_probe') return 'test_first';
  return selected.canUseNow ? 'use_now' : 'configure_first';
}

function buildExplanation(
  matrix: ZavorthProviderReadinessMatrixSnapshot,
  selected: ZavorthProviderSelectionCandidate | null,
  decision: ZavorthProviderSelectionDecision,
  requireLiveEvidence: boolean,
): string[] {
  const lines = [
    `Matrix found ${matrix.summary.ready}/${matrix.summary.total} ready provider route(s).`,
    'Catalog readiness is useful, but live evidence only exists after an explicit provider probe.',
  ];
  if (!selected) {
    return [...lines, 'No selectable provider was found.'];
  }
  lines.push(`Selected ${selected.label} because score=${selected.score} and status=${selected.status}.`);
  if (decision === 'test_first') {
    lines.push(requireLiveEvidence ? 'Live evidence was required, so the next safe action is an explicit live test.'
      : 'Provider can be used, but testing first is recommended before making it default.');
  }
  if (decision === 'configure_first') lines.push(selected.userAction);
  if (decision === 'choose_fallback') lines.push('Selected provider is not ready enough; use a fallback or configure it first.');
  return lines;
}

function buildCommands(
  selected: ZavorthProviderSelectionCandidate | null,
  fallbacks: ZavorthProviderSelectionCandidate[],
): ZavorthProviderSelectionUxSnapshot['commands'] {
  const commands: ZavorthProviderSelectionUxSnapshot['commands'] = [];
  if (selected) {
    commands.push(
      { id: 'inspect-selected', label: 'Inspect selected provider', command: selected.commands.inspect, liveNetworkUsed: false, mutatesConfig: false },
      { id: 'test-selected', label: 'Prepare selected provider test', command: selected.commands.test, liveNetworkUsed: false, mutatesConfig: false },
      { id: 'live-test-selected', label: 'Run selected provider live test', command: selected.commands.liveTest, liveNetworkUsed: true, mutatesConfig: false },
      { id: 'draft-use-selected', label: 'Draft provider selection', command: selected.commands.use, liveNetworkUsed: false, mutatesConfig: false },
    );
  }
  for (const fallback of fallbacks.slice(0, 3)) {
    commands.push({
      id: `fallback-${fallback.providerId}`,
      label: `Fallback: ${fallback.label}`,
      command: fallback.commands.inspect,
      liveNetworkUsed: false,
      mutatesConfig: false,
    });
  }
  return commands;
}

function buildNextAction(
  selected: ZavorthProviderSelectionCandidate | null,
  decision: ZavorthProviderSelectionDecision,
): string {
  if (!selected) return 'Configure at least one provider before selecting a model route.';
  if (decision === 'use_now') return `Use ${selected.providerId} for this session, or persist it through the approved setup flow.`;
  if (decision === 'test_first') return `Run ${selected.commands.liveTest} for live evidence before treating it as proven.`;
  if (decision === 'configure_first') return selected.userAction;
  if (decision === 'choose_fallback') return 'Choose one ready fallback, or configure the selected provider first.';
  return 'Provider selection is blocked until policy/readiness changes.';
}

function normalizeIntent(value: unknown, target: unknown): ZavorthProviderSelectionIntent {
  const raw = String(value || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
  if (raw === 'fast' || raw === 'speed' || raw === 'cheap') return 'fast';
  if (raw === 'smart' || raw === 'intelligence' || raw === 'quality') return 'smart';
  if (raw === 'local' || raw === 'local-first' || raw === 'private') return 'local';
  if (raw === 'openai-compatible' || raw === 'compatible') return 'openai-compatible';
  if (raw === 'coding' || raw === 'code') return 'coding';
  if (raw === 'research') return 'research';
  if (raw === 'budget') return 'budget';
  return String(target || '').trim() ? 'explicit' : 'smart';
}

function normalizeId(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}
