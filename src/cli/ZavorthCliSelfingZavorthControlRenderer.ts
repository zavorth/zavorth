import {
  AgentRunService,
  SelfingZavorthControlService,
  type SelfingZavorthControlSnapshot,
  type UniversalAgentRun,
} from '../runtime/agent/index.js';

export function resolveSelfingZavorthControlCliText(args: string): string {
  return String(args || '')
    .trim()
    .replace(/^(?:self|selfing|zavorthControl|run|review)\b/i, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function buildSelfingZavorthControlCliSnapshot(input: {
  text: string;
  userId: string;
  sessionId: string;
}): SelfingZavorthControlSnapshot {
  const text = input.text || 'review my identity, memory, and known tools';
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
      memoryPrompt: 'The user prefers direct summaries in their language and small deliveries.',
      contextInput: {
        warm: {
          workspacePrompt: 'Workspace Zavorth Core',
          workspaceProfile: {
            workspaceName: 'Zavorth',
            agentDisplayName: 'Zavorth',
            userDisplayName: input.userId,
            tonePreference: 'direct, technical e in the user language',
            memoryMode: 'receipts-first',
            safetyPosture: 'preview-before-apply',
          },
          identityFiles: [
            {
              path: 'SOUL.md',
              exists: true,
              summary: 'Living Zavorth identity.',
            },
            {
              path: 'USER.md',
              exists: true,
              summary: 'User preferences and working style.',
            },
            {
              path: 'runtime memory storage',
              exists: true,
              summary: 'Important memories with reviewable sources.',
            },
          ],
        },
        cold: {
          memoryPrompt: 'The user prefers direct summaries in their language and small deliveries.',
        },
      },
    },
  });
  run.memorySignals = [
    {
      id: 'cli-selfing-memory',
      title: 'Preference operational',
      layer: 'semantic',
      summary: 'The user wants to implement the deliveries in sequence.',
      confidence: 0.82,
    },
  ];
  return buildSelfingZavorthControlSnapshotFromRun(run);
}

export function buildSelfingZavorthControlSnapshotFromRun(
  run: UniversalAgentRun,
): SelfingZavorthControlSnapshot {
  return new SelfingZavorthControlService().buildSnapshot({
    run,
    generatedAt: run.updatedAt,
  });
}

export function formatSelfingZavorthControlSnapshot(
  snapshot: SelfingZavorthControlSnapshot,
): string {
  const lines = [
    'Selfing ZavorthControl - Selfing ZavorthControl',
    `- contract: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- status: ${snapshot.status}`,
    `- agente: ${snapshot.identity.agentName}`,
    `- user: ${snapshot.identity.userName}`,
    `- workspace: ${snapshot.identity.workspaceName}`,
    `- memory: ${snapshot.summary.memoryReceiptCount} receipt(s), ${snapshot.summary.lowConfidenceMemoryCount} baixa trust`,
    `- editaveis: ${snapshot.summary.editableCardCount}; sensitive: ${snapshot.summary.sensitiveCardCount}`,
    `- suggestions: ${snapshot.summary.updateSuggestionCount}`,
    `- next step: ${snapshot.nextSafeAction}`,
    '',
    'Cards',
  ];

  for (const card of snapshot.cards.slice(0, 10)) {
    lines.push(
      `- ${card.section}: ${card.title}`,
      `  value: ${card.value}`,
      `  source: ${card.source}${card.sourceRef ? ` (${card.sourceRef})` : ''}; preview=${String(card.previewRequired)}; versionado=${String(card.versioned)}`,
    );
  }

  if (snapshot.suggestions.length > 0) {
    lines.push('', 'Suggestions');
    for (const suggestion of snapshot.suggestions.slice(0, 8)) {
      lines.push(`- ${suggestion.title}: ${suggestion.detail}`);
    }
  }

  lines.push('', 'Politica');
  lines.push('- snapshot read-only');
  lines.push('- identity, memory, and config were not changed');
  lines.push('- sensitive changes require preview, approval, and versioning');

  lines.push('', 'surfaces');
  lines.push(`- ZavorthControl: ${snapshot.surface.zavorthControlPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);
  lines.push(`- Preview: ${snapshot.surface.previewHint}`);

  return lines.join('\n');
}
