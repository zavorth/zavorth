import {
  AgentRunService,
  ArtifactMemoryService,
  type ArtifactMemorySnapshot,
  type UniversalAgentRun,
} from '../runtime/agent/index.js';

export function resolveArtifactMemoryCliText(args: string): string {
  return String(args || '')
    .trim()
    .replace(/^(?:artifact-memory|artifacts-memory|memory-artifacts|artifacts|run|search|latest|reuse|cite)\b/i, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function buildArtifactMemoryCliSnapshot(input: {
  text: string;
  userId: string;
  sessionId: string;
}): ArtifactMemorySnapshot {
  const text = input.text || 'index important artifacts from the current session for sourced reuse';
  const service = new AgentRunService({
    now: () => new Date('2026-05-04T00:38:00.000Z'),
  });
  const run = service.createRun({
    userId: input.userId,
    channel: 'cli',
    sessionId: input.sessionId,
    text,
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    requestedTools: ['workspace.read', 'memory.read', 'artifacts.read'],
    metadata: {
      taskId: 'artifact-memory-index',
      artifactSummaries: {
        'artifact-memory-plan': {
          summary: 'Plan to turn artifacts into searchable memory with receipts.',
        },
        'artifact-memory-report': {
          summary: 'Artifact Memory validation report with focused gates and tests.',
        },
        'artifact-memory-diff': {
          summary: 'Implementation diff connecting runtime, CLI, and ZavorthControl.',
        },
      },
    },
  });
  run.summary = 'Artifact Memory prepared artifacts for searchable and citable reuse.';
  run.artifacts = [
    {
      id: 'artifact-memory-plan',
      title: 'Artifact Memory Plan',
      kind: 'plan',
      createdAt: run.updatedAt,
      sessionId: input.sessionId,
      status: 'ready',
    },
    {
      id: 'artifact-memory-report',
      title: 'Artifact Memory Validation Report',
      kind: 'report',
      createdAt: run.updatedAt,
      sessionId: input.sessionId,
      status: 'ready',
    },
    {
      id: 'artifact-memory-diff',
      title: 'Artifact Memory Implementation Diff',
      kind: 'diff',
      createdAt: run.updatedAt,
      sessionId: input.sessionId,
      status: 'draft',
    },
  ];
  run.metadata = {
    ...run.metadata,
    memoryWithReceipts: {
      receipts: [
        {
          id: 'memory-receipt-artifact-memory-plan',
          source: 'ArtifactMemoryService',
          origin: {
            kind: 'artifact',
            artifactId: 'artifact-memory-plan',
            ref: 'artifact-memory-plan',
          },
          confidence: 0.91,
        },
      ],
    },
  };
  return buildArtifactMemorySnapshotFromRun(run);
}

export function buildArtifactMemorySnapshotFromRun(
  run: UniversalAgentRun,
): ArtifactMemorySnapshot {
  return new ArtifactMemoryService().buildSnapshot({
    run,
    generatedAt: run.updatedAt,
  });
}

export function formatArtifactMemorySnapshot(
  snapshot: ArtifactMemorySnapshot,
): string {
  const lines = [
    'Artifact Memory',
    `- contract: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- status: ${snapshot.status}`,
    `- artifacts: ${snapshot.summary.artifactCount}`,
    `- memory entries: ${snapshot.summary.memoryEntryCount}`,
    `- reusable: ${snapshot.summary.reusableCount}`,
    `- receipts: ${snapshot.summary.receiptCount}; memory links: ${snapshot.summary.linkedMemoryReceiptCount}`,
    `- search ready: ${String(snapshot.summary.searchReady)}`,
    `- next step: ${snapshot.nextSafeAction}`,
    '',
    'Indexed Artifacts',
  ];

  for (const entry of snapshot.entries.slice(0, 10)) {
    lines.push(
      `- ${entry.category}: ${entry.title}`,
      `  artifactId: ${entry.artifactId}; memoryId: ${entry.memoryId}`,
      `  source: run=${entry.runId}; observatory=${entry.receipt.observatoryReceiptId || 'pending'}; memory=${entry.receipt.memoryReceiptId || 'pending'}`,
      `  reuse: ${entry.actions.reuseCommand}`,
      `  cite: ${entry.actions.citeCommand}`,
    );
  }

  if (snapshot.search.facets.length > 0) {
    lines.push('', 'Facets');
    for (const facet of snapshot.search.facets) {
      lines.push(`- ${facet.label}: ${facet.count}`);
    }
  }

  lines.push('', 'Policy');
  lines.push('- Artifact Memory is read-only');
  lines.push('- does not read file content and does not invent artifact content');
  lines.push('- does not mutate artifacts and does not write memory without explicit action');
  lines.push('- every reuse must cite artifactId, runId, and source receipt');

  lines.push('', 'Surfaces');
  lines.push(`- ZavorthControl: ${snapshot.surface.zavorthControlPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);
  lines.push(`- Search: ${snapshot.search.commands.searchCommand}`);

  return lines.join('\n');
}
