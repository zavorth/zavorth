import {
  AgentRunService,
  PersonalOpsAutopilotService,
  type PersonalOpsAutopilotSnapshot,
  type UniversalAgentRun,
} from '../runtime/agent/index.js';

export function resolvePersonalOpsAutopilotCliText(args: string): string {
  return String(args || '')
    .trim()
    .replace(/^(?:personal-ops|ops-autopilot|autopilot|run|preview|review|inspect|latest)\b/i, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function buildPersonalOpsAutopilotCliSnapshot(input: {
  text: string;
  userId: string;
  sessionId: string;
}): PersonalOpsAutopilotSnapshot {
  const text = input.text || 'observe the runtime and suggest safe fixes';
  const service = new AgentRunService({
    now: () => new Date('2026-05-04T00:39:00.000Z'),
  });
  const run = service.createRun({
    userId: input.userId,
    channel: 'cli',
    sessionId: input.sessionId,
    text,
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    requestedTools: ['workspace.read', 'memory.read'],
    metadata: {
      runBudget: {
        source: 'RunBudgetPolicy',
        degraded: true,
        reason: 'estimate above the configured budget',
        estimatedCostUnits: 7,
        maxEstimatedCostUnits: 4,
      },
      naturalCapabilityDiscovery: {
        recommendations: [
          {
            id: 'runtime-doctor',
            label: 'Runtime doctor',
            reason: 'Operational request suggests diagnostics before repair.',
            toolIds: ['runtime.doctor'],
          },
        ],
        safety: {
          requiresApproval: true,
          previewRequired: true,
          approvalRequiredToolIds: ['runtime.repair'],
          previewRequiredToolIds: ['runtime.doctor'],
        },
      },
      providerArena: {
        summary: {
          hasProviderEvidence: true,
          fallbackUsed: true,
          readyCandidateCount: 1,
          recommendedProviderLabel: 'openai',
          recommendedModelLabel: 'gpt-test',
          decisionSource: 'observed',
        },
        selected: {
          providerLabel: 'openai',
          modelLabel: 'gpt-test',
        },
        candidates: [
          {
            id: 'candidate-openai',
            ready: true,
            healthStatus: 'healthy',
          },
        ],
      },
      artifactMemory: {
        status: 'needs-index',
        summary: {
          reusableCount: 2,
          memoryEntryCount: 3,
          linkedMemoryReceiptCount: 1,
        },
        entries: [
          {
            artifactId: 'artifact-plan-personal-ops',
            title: 'Ops autopilot plan',
          },
          {
            artifactId: 'artifact-report-personal-ops',
            title: 'Diagnostic report',
          },
        ],
      },
    },
  });
  run.summary = 'Personal Ops Autopilot prepared suggestions without running repairs.';
  return buildPersonalOpsAutopilotSnapshotFromRun(run);
}

export function buildPersonalOpsAutopilotSnapshotFromRun(
  run: UniversalAgentRun,
): PersonalOpsAutopilotSnapshot {
  return new PersonalOpsAutopilotService().buildSnapshot({
    run,
    generatedAt: run.updatedAt,
  });
}

export function formatPersonalOpsAutopilotSnapshot(
  snapshot: PersonalOpsAutopilotSnapshot,
): string {
  const lines = [
    'Personal Ops Autopilot - Personal Ops Autopilot',
    `- contract: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- status: ${snapshot.status}`,
    `- suggestions: ${snapshot.summary.suggestionCount}`,
    `- attention: ${snapshot.summary.attentionCount}`,
    `- approval: ${snapshot.summary.approvalRequiredCount}`,
    `- preview: ${snapshot.summary.previewAvailableCount}`,
    `- mutable: ${snapshot.summary.mutableActionCount}`,
    `- next step: ${snapshot.nextSafeAction}`,
    '',
    'Suggestions',
  ];

  for (const suggestion of snapshot.suggestions.slice(0, 10)) {
    lines.push(
      `- ${suggestion.category}: ${suggestion.title} [${suggestion.severity}]`,
      `  cause: ${suggestion.cause}`,
      `  impact: ${suggestion.impact}`,
      `  next: ${suggestion.nextStep}`,
      `  preview: ${suggestion.actions.previewCommand}`,
    );
  }

  lines.push('', 'Policy');
  lines.push('- no mutable action was executed');
  lines.push('- autorepair was not started');
  lines.push('- mutations require preview and approval');
  lines.push('- suggestions use receipts and do not serialize secrets');

  lines.push('', 'Surfaces');
  lines.push(`- ZavorthControl: ${snapshot.surface.zavorthControlPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);
  lines.push(`- Approval: ${snapshot.surface.approvalHint}`);

  return lines.join('\n');
}
