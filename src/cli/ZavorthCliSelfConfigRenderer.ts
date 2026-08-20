import {
  AgentRunService,
  AgentSelfConfigService,
  type AgentSelfConfigSnapshot,
  type UniversalAgentRun,
} from '../runtime/agent/index.js';

export function resolveSelfConfigCliText(args: string): string {
  return String(args || '')
    .trim()
    .replace(/^(?:self|selfing|config|self-config|run|review)\b/i, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

export { resolveSelfConfigCliText as resolveSelfingZavorthControlCliText };

export function buildSelfConfigCliSnapshot(input: {
  text: string;
  userId: string;
  sessionId: string;
}): AgentSelfConfigSnapshot {
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
            tonePreference: 'direct, technical, concise',
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
      title: 'Operational preference',
      layer: 'semantic',
      summary: 'The user wants to implement deliveries in sequence.',
      confidence: 0.82,
    },
  ];
  return buildSelfConfigSnapshotFromRun(run);
}

export { buildSelfConfigCliSnapshot as buildSelfingZavorthControlCliSnapshot };

export function buildSelfConfigSnapshotFromRun(
  run: UniversalAgentRun,
): AgentSelfConfigSnapshot {
  return new AgentSelfConfigService().buildSnapshot({
    run,
    generatedAt: run.updatedAt,
  });
}

export { buildSelfConfigSnapshotFromRun as buildSelfingZavorthControlSnapshotFromRun };

export function formatSelfConfigSnapshot(
  snapshot: AgentSelfConfigSnapshot,
): string {
  const lines = [
    'Agent Self-Configuration',
    `- contract: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- status: ${snapshot.status}`,
    `- agent: ${snapshot.identity.agentName}`,
    `- user: ${snapshot.identity.userName}`,
    `- workspace: ${snapshot.identity.workspaceName}`,
    `- memory: ${snapshot.summary.memoryReceiptCount} receipt(s), ${snapshot.summary.lowConfidenceMemoryCount} low confidence`,
    `- editable: ${snapshot.summary.editableCardCount}; sensitive: ${snapshot.summary.sensitiveCardCount}`,
    `- suggestions: ${snapshot.summary.updateSuggestionCount}`,
    `- next step: ${snapshot.nextSafeAction}`,
    '',
    'Cards',
  ];

  for (const card of snapshot.cards.slice(0, 10)) {
    lines.push(
      `- ${card.section}: ${card.title}`,
      `  value: ${card.value}`,
      `  source: ${card.source}${card.sourceRef ? ` (${card.sourceRef})` : ''}; preview=${String(card.previewRequired)}; versioned=${String(card.versioned)}`,
    );
  }

  if (snapshot.suggestions.length > 0) {
    lines.push('', 'Suggestions');
    for (const suggestion of snapshot.suggestions.slice(0, 8)) {
      lines.push(`- ${suggestion.title}: ${suggestion.detail}`);
    }
  }

  lines.push('', 'Policy');
  lines.push('- snapshot read-only');
  lines.push('- identity, memory, and config were not changed');
  lines.push('- sensitive changes require preview, approval, and versioning');

  lines.push('', 'Surfaces');
  lines.push(`- Control: ${snapshot.surface.zavorthControlPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);
  lines.push(`- Preview: ${snapshot.surface.previewHint}`);

  return lines.join('\n');
}

export { formatSelfConfigSnapshot as formatSelfingZavorthControlSnapshot };
