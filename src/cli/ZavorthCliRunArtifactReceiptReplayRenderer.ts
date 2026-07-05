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
        contractVersion: '2026-05-03.artifact-memory',
        status: 'ready',
        entries: [],
        receipts: [
          {
            id: 'artifact-memory:cli-receipt',
            kind: 'artifact-ledger',
            source: 'ArtifactMemoryService',
            detail: 'Replay CLI fixture without reading file content.',
            status: 'ready',
          },
        ],
      },
      memoryWithReceipts: {
        source: 'MemoryWithReceiptsService',
        contractVersion: '2026-05-03.memory-receipts',
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
    'Run / Artifact / Receipt Replay Hardening - Channel mesh5',
    `- contract: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- session: ${snapshot.identifiers.sessionId}`,
    `- status: ${snapshot.status}`,
    `- frames: ${snapshot.summary.frameCount}`,
    `- artifacts: ${snapshot.summary.artifactLinkCount}`,
    `- receipts: ${snapshot.summary.observatoryReceiptCount + snapshot.summary.featureReceiptCount}`,
    `- features cobertas: ${snapshot.summary.coveredFeatureCount}/${snapshot.features.length}`,
    `- next step: ${snapshot.nextSafeAction}`,
    '',
    'Replay',
    `- available: ${snapshot.replay.available ? 'yes' : 'no'}`,
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
    lines.push('- no artifact linked');
  } else {
    for (const artifact of snapshot.artifactLinks.slice(0, 8)) {
      lines.push(
        `- ${artifact.artifactId}: ${artifact.title}`,
        `  receipt: ${artifact.observatoryReceiptId || artifact.memoryReceiptId || 'pending'}; command: ${artifact.commands.replayCommand}`,
      );
    }
  }

  lines.push('', 'Features');
  for (const feature of snapshot.features.filter((entry) => entry.present).slice(0, 12)) {
    lines.push(`- ${feature.label}: ${feature.receiptCount} receipt(s), contract ${feature.contractVersion || 'n/a'}`);
  }

  lines.push('', 'Politica');
  lines.push('- replay does not execute tools');
  lines.push('- no file/artifact was read from the filesystem');
  lines.push('- artifact content was not invented');
  lines.push('- reused artifacts must cite their source');
  lines.push('- natural language does not bypass policy');
  lines.push('- secrets were not serialized');

  lines.push('', 'Superficies');
  lines.push(`- ZavorthControl: ${snapshot.surface.zavorthControlPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);
  lines.push(`- Hint: ${snapshot.surface.replayHint}`);

  return lines.join('\n');
}
