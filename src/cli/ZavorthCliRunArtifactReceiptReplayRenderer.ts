import {
  AgentRunService,
  RunArtifactReceiptReplayService,
  type RunArtifactReceiptReplaySnapshot,
  type UniversalAgentRun,
} from '../runtime/agent/index.js';

export function resolveRunArtifactReceiptReplayCliText(args: string): string {
  return String(args || '')
    .trim()
    .replace(/^(?:(?:replay-hardening|artifact-replay|receipt-replay|run-replay|replay|receipts|run|artifact|latest|status)\b\s*)+/i, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function buildRunArtifactReceiptReplayCliSnapshot(input: {
  text: string;
  userId: string;
  sessionId: string;
}): RunArtifactReceiptReplaySnapshot {
  const service = new AgentRunService({
    now: () => new Date('2026-05-04T00:45:00.000Z'),
  });
  const run = service.createRun({
    userId: input.userId,
    channel: 'cli',
    sessionId: input.sessionId,
    text: input.text || 'gere um plano e mantenha receipts para replay',
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    requestedTools: ['workspace.read'],
    metadata: {
      artifactMemory: {
        source: 'ArtifactMemoryService',
        contractVersion: '2026-05-03.wave-38',
        status: 'ready',
        entries: [],
        receipts: [
          {
            id: 'artifact-memory:cli-receipt',
            kind: 'artifact-ledger',
            source: 'ArtifactMemoryService',
            detail: 'Fixture CLI de replay sem ler conteudo de arquivo.',
            status: 'ready',
          },
        ],
      },
      memoryWithReceipts: {
        source: 'MemoryWithReceiptsService',
        contractVersion: '2026-05-03.wave-32',
        receipts: [
          {
            id: 'memory:cli-receipt',
            kind: 'memory',
            source: 'MemoryWithReceiptsService',
            detail: 'Memoria possui origem citavel.',
            status: 'ready',
          },
        ],
      },
    },
  });
  run.artifacts = [
    {
      id: 'artifact-cli-replay',
      title: 'Plano de replay auditavel',
      kind: 'plan',
      createdAt: run.updatedAt,
      sessionId: run.sessionId,
      status: 'ready',
    },
  ];
  run.summary = 'Replay hardening preparado sem executar ferramenta.';
  return buildRunArtifactReceiptReplaySnapshotFromRun(run);
}

export function buildRunArtifactReceiptReplaySnapshotFromRun(
  run: UniversalAgentRun,
): RunArtifactReceiptReplaySnapshot {
  return new RunArtifactReceiptReplayService().buildSnapshot({
    run,
    generatedAt: run.updatedAt,
  });
}

export function formatRunArtifactReceiptReplaySnapshot(
  snapshot: RunArtifactReceiptReplaySnapshot,
): string {
  const lines = [
    'Run / Artifact / Receipt Replay Hardening - Wave 45',
    `- contrato: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- sessao: ${snapshot.identifiers.sessionId}`,
    `- status: ${snapshot.status}`,
    `- frames: ${snapshot.summary.frameCount}`,
    `- artifacts: ${snapshot.summary.artifactLinkCount}`,
    `- receipts: ${snapshot.summary.observatoryReceiptCount + snapshot.summary.featureReceiptCount}`,
    `- features cobertas: ${snapshot.summary.coveredFeatureCount}/${snapshot.features.length}`,
    `- proximo passo: ${snapshot.nextSafeAction}`,
    '',
    'Replay',
    `- disponivel: ${snapshot.replay.available ? 'sim' : 'nao'}`,
    `- anchors: ${snapshot.replay.anchors.length}`,
    `- resumo: ${snapshot.replay.summary}`,
    '',
    'Frames',
  ];

  for (const frame of snapshot.frames.slice(0, 10)) {
    lines.push(
      `- #${frame.order} ${frame.kind}: ${frame.title}`,
      `  ${frame.source} - ${frame.status} - ${frame.detail}`,
    );
  }

  lines.push('', 'Artifacts');
  if (snapshot.artifactLinks.length === 0) {
    lines.push('- nenhum artifact linkado');
  } else {
    for (const artifact of snapshot.artifactLinks.slice(0, 8)) {
      lines.push(
        `- ${artifact.artifactId}: ${artifact.title}`,
        `  receipt: ${artifact.observatoryReceiptId || artifact.memoryReceiptId || 'pendente'}; comando: ${artifact.commands.replayCommand}`,
      );
    }
  }

  lines.push('', 'Features');
  for (const feature of snapshot.features.filter((entry) => entry.present).slice(0, 12)) {
    lines.push(`- ${feature.label}: ${feature.receiptCount} receipt(s), contrato ${feature.contractVersion || 'n/a'}`);
  }

  lines.push('', 'Politica');
  lines.push('- replay nao executa tools');
  lines.push('- nenhum arquivo/artifact foi lido do filesystem');
  lines.push('- conteudo de artifact nao foi inventado');
  lines.push('- artifacts reutilizados devem citar origem');
  lines.push('- linguagem natural nao bypassa policy');
  lines.push('- secrets nao foram serializados');

  lines.push('', 'Superficies');
  lines.push(`- Command Center: ${snapshot.surface.commandCenterPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);
  lines.push(`- Hint: ${snapshot.surface.replayHint}`);

  return lines.join('\n');
}
