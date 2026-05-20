import {
  AgentRunService,
  SelfingDashboardService,
  type SelfingDashboardSnapshot,
  type UniversalAgentRun,
} from '../runtime/agent/index.js';

export function resolveSelfingDashboardCliText(args: string): string {
  return String(args || '')
    .trim()
    .replace(/^(?:self|selfing|dashboard|run|review)\b/i, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function buildSelfingDashboardCliSnapshot(input: {
  text: string;
  userId: string;
  sessionId: string;
}): SelfingDashboardSnapshot {
  const text = input.text || 'revise minha identidade, memoria e ferramentas conhecidas';
  const service = new AgentRunService({
    now: () => new Date('2026-05-04T00:37:00.000Z'),
  });
  const run = service.createRun({
    userId: input.userId,
    channel: 'cli',
    sessionId: input.sessionId,
    text,
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    requestedTools: ['workspace.read', 'memory.read'],
    metadata: {
      memoryPrompt: 'Usuario prefere resumo direto em portugues e entregas pequenas.',
      contextInput: {
        warm: {
          workspacePrompt: 'Workspace Zavorth Core',
          workspaceProfile: {
            workspaceName: 'Zavorth',
            agentDisplayName: 'Zavorth',
            userDisplayName: input.userId,
            tonePreference: 'direto, tecnico e em portugues',
            memoryMode: 'receipts-first',
            safetyPosture: 'preview-before-apply',
          },
          identityFiles: [
            {
              path: 'SOUL.md',
              exists: true,
              summary: 'Identidade viva do Zavorth.',
            },
            {
              path: 'USER.md',
              exists: true,
              summary: 'Preferencias do usuario e forma de trabalho.',
            },
            {
              path: 'MEMORY.md',
              exists: true,
              summary: 'Memorias importantes com origem revisavel.',
            },
          ],
        },
        cold: {
          memoryPrompt: 'Usuario prefere resumo direto em portugues e entregas pequenas.',
        },
      },
    },
  });
  run.memorySignals = [
    {
      id: 'cli-selfing-memory',
      title: 'Preferencia operacional',
      layer: 'semantic',
      summary: 'Usuario quer implementar as entregas em sequencia.',
      confidence: 0.82,
    },
  ];
  return buildSelfingDashboardSnapshotFromRun(run);
}

export function buildSelfingDashboardSnapshotFromRun(
  run: UniversalAgentRun,
): SelfingDashboardSnapshot {
  return new SelfingDashboardService().buildSnapshot({
    run,
    generatedAt: run.updatedAt,
  });
}

export function formatSelfingDashboardSnapshot(
  snapshot: SelfingDashboardSnapshot,
): string {
  const lines = [
    'Selfing Dashboard - Selfing Dashboard',
    `- contrato: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- status: ${snapshot.status}`,
    `- agente: ${snapshot.identity.agentName}`,
    `- usuario: ${snapshot.identity.userName}`,
    `- workspace: ${snapshot.identity.workspaceName}`,
    `- memoria: ${snapshot.summary.memoryReceiptCount} receipt(s), ${snapshot.summary.lowConfidenceMemoryCount} baixa confianca`,
    `- editaveis: ${snapshot.summary.editableCardCount}; sensiveis: ${snapshot.summary.sensitiveCardCount}`,
    `- sugestoes: ${snapshot.summary.updateSuggestionCount}`,
    `- proximo passo: ${snapshot.nextSafeAction}`,
    '',
    'Cards',
  ];

  for (const card of snapshot.cards.slice(0, 10)) {
    lines.push(
      `- ${card.section}: ${card.title}`,
      `  valor: ${card.value}`,
      `  fonte: ${card.source}${card.sourceRef ? ` (${card.sourceRef})` : ''}; preview=${String(card.previewRequired)}; versionado=${String(card.versioned)}`,
    );
  }

  if (snapshot.suggestions.length > 0) {
    lines.push('', 'Sugestoes');
    for (const suggestion of snapshot.suggestions.slice(0, 8)) {
      lines.push(`- ${suggestion.title}: ${suggestion.detail}`);
    }
  }

  lines.push('', 'Politica');
  lines.push('- snapshot read-only');
  lines.push('- identidade, memoria e config nao foram alteradas');
  lines.push('- mudancas sensiveis exigem preview, approval e versionamento');

  lines.push('', 'Superficies');
  lines.push(`- Command Center: ${snapshot.surface.commandCenterPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);
  lines.push(`- Preview: ${snapshot.surface.previewHint}`);

  return lines.join('\n');
}
