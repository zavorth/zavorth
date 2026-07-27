import {
  AgentRunService,
  ProviderArenaService,
  type ProviderArenaSnapshot,
  type UniversalAgentRun,
} from '../runtime/agent/index.js';

export function resolveProviderArenaCliText(args: string): string {
  return String(args || '')
    .trim()
    .replace(/^(?:run|compare|status|models|providers|arena)\b/i, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function buildProviderArenaCliSnapshot(input: {
  text: string;
  userId: string;
  sessionId: string;
}): ProviderArenaSnapshot {
  const service = new AgentRunService({
    now: () => new Date('2026-05-03T23:58:00.000Z'),
  });
  const run = service.createRun({
    userId: input.userId,
    channel: 'cli',
    sessionId: input.sessionId,
    text: input.text || 'compare provider for code task with fallback',
    requestedTools: ['workspace.read'],
    modelProfile: {
      providerLabel: 'aigateway',
      modelLabel: 'claude-sonnet-4.5',
      routingPolicy: 'gateway',
      routeId: 'aigateway',
      familyId: 'frontier-coding',
      selectionSource: 'current-config',
      readiness: 'ready',
      ready: true,
      fallbackOrder: ['aigateway', 'openai', 'gemini'],
      selectionExplanation: ['current operator config', 'governed fallback enabled'],
      supportsTools: true,
      supportsStreaming: true,
    },
    metadata: {
      modelPickerSelection: {
        source: 'current-config',
        providerName: 'aigateway',
        providerLabel: 'AI Gateway',
        modelName: 'claude-sonnet-4.5',
        modelLabel: 'Claude Sonnet 4.5',
        routeId: 'aigateway',
        familyId: 'frontier-coding',
        readiness: 'ready',
        ready: true,
        fallbackOrder: ['aigateway', 'openai', 'gemini'],
        explanation: ['current operator config', 'governed fallback enabled'],
      },
    },
  });
  run.metadata = {
    ...run.metadata,
    runBudget: {
      source: 'RunBudgetPolicy',
      degraded: false,
      estimatedCostUnits: 3,
      maxEstimatedCostUnits: 10,
      inputChars: run.input.length,
      requestedToolCount: 1,
      exposedToolCount: 1,
    },
    llmRuntimeRoute: {
      source: 'LlmRuntimeService',
      requestedProviderName: 'aigateway',
      primaryProviderName: 'aigateway',
      providerName: 'aigateway',
      modelName: 'claude-sonnet-4.5',
      fallbackAllowed: true,
      fallbackUsed: false,
      providerChain: ['aigateway', 'openai', 'gemini'],
      attempts: [
        {
          providerName: 'aigateway',
          modelName: 'claude-sonnet-4.5',
          status: 'succeeded',
          fallback: false,
          durationMs: 960,
        },
      ],
      request: {
        messageCount: 1,
        toolCount: 1,
        inputChars: run.input.length,
      },
    },
    providerRouteBudgetCorrelation: {
      source: 'AgentRunService',
      routeSource: 'LlmRuntimeService',
      providerName: 'aigateway',
      modelName: 'claude-sonnet-4.5',
      primaryProviderName: 'aigateway',
      requestedProviderName: 'aigateway',
      routingPolicy: 'gateway',
      fallbackUsed: false,
      fallbackAllowed: true,
      providerAttemptCount: 1,
      unavailableProviderCount: 0,
      modelPicker: {
        source: 'current-config',
        providerName: 'aigateway',
        providerLabel: 'AI Gateway',
        modelName: 'claude-sonnet-4.5',
        modelLabel: 'Claude Sonnet 4.5',
        routeId: 'aigateway',
        readiness: 'ready',
        ready: true,
        fallbackOrder: ['aigateway', 'openai', 'gemini'],
        explanation: ['current operator config', 'governed fallback enabled'],
        matchedEffectiveProvider: true,
      },
      budget: {
        source: 'RunBudgetPolicy',
        degraded: false,
        estimatedCostUnits: 3,
        maxEstimatedCostUnits: 10,
        inputChars: run.input.length,
        requestedToolCount: 1,
        exposedToolCount: 1,
      },
    },
  };
  return buildProviderArenaSnapshotFromRun(run);
}

export function buildProviderArenaSnapshotFromRun(
  run: UniversalAgentRun,
): ProviderArenaSnapshot {
  return new ProviderArenaService().buildSnapshot({
    run,
    generatedAt: run.updatedAt,
  });
}

export function formatProviderArenaSnapshot(
  snapshot: ProviderArenaSnapshot,
): string {
  const lines = [
    'Provider Arena - Provider Arena',
    `- contract: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- decision: ${snapshot.summary.decisionSource}`,
    `- recomendado: ${snapshot.summary.recommendedProviderLabel}/${snapshot.summary.recommendedModelLabel}`,
      `- candidates: ${snapshot.summary.candidateCount}`,
    `- ready: ${snapshot.summary.readyCandidateCount}`,
    `- fallback usado: ${String(snapshot.summary.fallbackUsed)}`,
    `- receipts observatory: ${snapshot.summary.observatoryReceiptCount}`,
    `- next step: ${snapshot.nextSafeAction}`,
  ];

    lines.push('', 'Candidates');
  for (const candidate of snapshot.candidates.slice(0, 8)) {
    lines.push(
      `- ${candidate.providerLabel}/${candidate.modelLabel} [${candidate.source}] score=${candidate.overallScore}`,
      `  rota: ${candidate.routeId}; readiness=${candidate.readiness}; health=${candidate.healthStatus}`,
      `  reliability=${candidate.reliabilityScore}; cost=${candidate.costScore}; latency=${candidate.latencyScore}`,
    );
  }

  lines.push('', 'Receipts');
  for (const receipt of snapshot.receipts.slice(0, 8)) {
    lines.push(`- ${receipt.kind}: ${receipt.detail}`);
  }

  lines.push('', 'Politica');
  lines.push('- read-only arena; no provider call was executed');
  lines.push('- does not automatically overwrite Model Picker');
  lines.push('- fallback and decision source stay visible');

  lines.push('', 'Superficies');
  lines.push(`- ZavorthControl: ${snapshot.surface.zavorthControlPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);
  lines.push(`- Hint: ${snapshot.surface.arenaHint}`);

  return lines.join('\n');
}
