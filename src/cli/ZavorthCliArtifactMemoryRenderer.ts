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
  const text = input.text || 'indexe artifacts importantes da sessao atual para reuso com origem';
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
          summary: 'Plano para transformar artifacts em memoria pesquisavel com receipts.',
        },
        'artifact-memory-report': {
          summary: 'Relatorio de validacao de Artifact Memory com gates e testes focados.',
        },
        'artifact-memory-diff': {
          summary: 'Diff de implementacao conectando runtime, CLI e Dashboard.',
        },
      },
    },
  });
  run.summary = 'Artifact Memory preparou artifacts para pesquisa e reuso citavel.';
  run.artifacts = [
    {
      id: 'artifact-memory-plan',
      title: 'Plano Artifact Memory',
      kind: 'plan',
      createdAt: run.updatedAt,
      sessionId: input.sessionId,
      status: 'ready',
    },
    {
      id: 'artifact-memory-report',
      title: 'Relatorio de validacao Artifact Memory',
      kind: 'report',
      createdAt: run.updatedAt,
      sessionId: input.sessionId,
      status: 'ready',
    },
    {
      id: 'artifact-memory-diff',
      title: 'Diff de implementacao Artifact Memory',
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
    `- contrato: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- status: ${snapshot.status}`,
    `- artifacts: ${snapshot.summary.artifactCount}`,
    `- entradas de memoria: ${snapshot.summary.memoryEntryCount}`,
    `- reutilizaveis: ${snapshot.summary.reusableCount}`,
    `- receipts: ${snapshot.summary.receiptCount}; memory links: ${snapshot.summary.linkedMemoryReceiptCount}`,
    `- busca pronta: ${String(snapshot.summary.searchReady)}`,
    `- proximo passo: ${snapshot.nextSafeAction}`,
    '',
    'Artifacts indexados',
  ];

  for (const entry of snapshot.entries.slice(0, 10)) {
    lines.push(
      `- ${entry.category}: ${entry.title}`,
      `  artifactId: ${entry.artifactId}; memoryId: ${entry.memoryId}`,
      `  origem: run=${entry.runId}; observatory=${entry.receipt.observatoryReceiptId || 'pendente'}; memory=${entry.receipt.memoryReceiptId || 'pendente'}`,
      `  reuso: ${entry.actions.reuseCommand}`,
      `  citar: ${entry.actions.citeCommand}`,
    );
  }

  if (snapshot.search.facets.length > 0) {
    lines.push('', 'Facetas');
    for (const facet of snapshot.search.facets) {
      lines.push(`- ${facet.label}: ${facet.count}`);
    }
  }

  lines.push('', 'Politica');
  lines.push('- Artifact Memory e read-only');
  lines.push('- nao le conteudo de arquivo e nao inventa conteudo de artifact');
  lines.push('- nao muta artifacts e nao escreve memoria sem acao explicita');
  lines.push('- todo reuso deve citar artifactId, runId e receipt de origem');

  lines.push('', 'Superficies');
  lines.push(`- Dashboard: ${snapshot.surface.dashboardPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);
  lines.push(`- Busca: ${snapshot.search.commands.searchCommand}`);

  return lines.join('\n');
}
