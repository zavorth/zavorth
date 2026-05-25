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
  const text = input.text || 'observe o runtime e sugira correcoes seguras';
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
        reason: 'estimativa acima do budget configurado',
        estimatedCostUnits: 7,
        maxEstimatedCostUnits: 4,
      },
      naturalCapabilityDiscovery: {
        recommendations: [
          {
            id: 'runtime-doctor',
            label: 'Runtime doctor',
            reason: 'Pedido operacional sugere diagnostico antes de reparo.',
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
            title: 'Plano de ops autopilot',
          },
          {
            artifactId: 'artifact-report-personal-ops',
            title: 'Relatorio de diagnostico',
          },
        ],
      },
    },
  });
  run.summary = 'Personal Ops Autopilot preparou sugestoes sem executar reparos.';
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
    `- contrato: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- status: ${snapshot.status}`,
    `- sugestoes: ${snapshot.summary.suggestionCount}`,
    `- atencao: ${snapshot.summary.attentionCount}`,
    `- approval: ${snapshot.summary.approvalRequiredCount}`,
    `- preview: ${snapshot.summary.previewAvailableCount}`,
    `- mutaveis: ${snapshot.summary.mutableActionCount}`,
    `- proximo passo: ${snapshot.nextSafeAction}`,
    '',
    'Sugestoes',
  ];

  for (const suggestion of snapshot.suggestions.slice(0, 10)) {
    lines.push(
      `- ${suggestion.category}: ${suggestion.title} [${suggestion.severity}]`,
      `  causa: ${suggestion.cause}`,
      `  impacto: ${suggestion.impact}`,
      `  proximo: ${suggestion.nextStep}`,
      `  preview: ${suggestion.actions.previewCommand}`,
    );
  }

  lines.push('', 'Politica');
  lines.push('- nenhuma acao mutavel foi executada');
  lines.push('- autorepair nao foi iniciado');
  lines.push('- mutacoes exigem preview e approval');
  lines.push('- sugestoes usam receipts e nao serializam secrets');

  lines.push('', 'Superficies');
  lines.push(`- Dashboard: ${snapshot.surface.dashboardPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);
  lines.push(`- Approval: ${snapshot.surface.approvalHint}`);

  return lines.join('\n');
}
