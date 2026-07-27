import {
  AgentRunService,
  MemoryWithReceiptsService,
  type MemoryWithReceiptsSnapshot,
  type UniversalAgentRun,
} from '../runtime/agent/index.js';

export function resolveMemoryWithReceiptsCliText(args: string): string {
  return String(args || '')
    .trim()
    .replace(/^(?:receipts|sources...|source|origem|run)\b/i, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function buildMemoryWithReceiptsCliSnapshot(input: {
  text: string;
  userId: string;
  sessionId: string;
}): MemoryWithReceiptsSnapshot {
  const service = new AgentRunService({
    now: () => new Date('2026-05-03T23:20:00.000Z'),
  });
  const text = input.text || 'Memory consulted by the CLI.';
  const run = service.createRun({
    userId: input.userId,
    channel: 'cli',
    sessionId: input.sessionId,
    text,
    requestedTools: ['memory.read'],
    metadata: {
      memoryPrompt: text,
      coldContext: {
        memoryContext: {
          label: 'cli-memory',
          sourceType: 'chat',
          chatId: input.sessionId,
        },
      },
    },
  });
  run.memorySignals = [
    {
      id: 'cli-memory-signal',
      title: 'Memory consulted',
      layer: 'episodic',
      summary: text,
      confidence: 0.74,
    },
  ];
  return new MemoryWithReceiptsService({
    now: () => new Date(run.updatedAt),
  }).buildSnapshot({
    run,
    generatedAt: run.updatedAt,
  });
}

export function buildMemoryWithReceiptsSnapshotFromRun(
  run: UniversalAgentRun,
): MemoryWithReceiptsSnapshot {
  return new MemoryWithReceiptsService().buildSnapshot({
    run,
    generatedAt: run.updatedAt,
  });
}

export function formatMemoryWithReceiptsSnapshot(
  snapshot: MemoryWithReceiptsSnapshot,
): string {
  const lines = [
    'Memory With Receipts - Memory Receipts',
    `- contract: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- memory: ${snapshot.summary.memoryCount} item(s) with ${snapshot.summary.receiptCount} receipt(s)`,
    `- average trust: ${snapshot.summary.averageConfidence ?? 'n/a'}`,
    `- auditable: ${String(snapshot.audit.allMemoryHasReceipt)}`,
    `- source answerable: ${String(snapshot.audit.canAnswerSourceQuestion)}`,
    `- correct/forget: ${String(snapshot.audit.canForgetOrCorrect)}`,
    `- next step: ${snapshot.nextSafeAction}`,
  ];

  if (snapshot.receipts.length > 0) {
    lines.push('', 'Receipts');
    for (const receipt of snapshot.receipts.slice(0, 8)) {
      lines.push(
        `- ${receipt.title} [${receipt.layer}/${receipt.confidenceLabel}]`,
        `  source: ${receipt.source} (${receipt.sourceType})`,
        `  summary: ${receipt.summary}`,
        `  forget: ${receipt.actions.forgetCommand}`,
        `  correct: ${receipt.actions.correctCommand}`,
      );
    }
  } else {
    lines.push('', 'Receipts', '- no memory signal was used in this run.');
  }

  lines.push('', 'Surfaces');
  lines.push(`- ZavorthControl: ${snapshot.surface.zavorthControlPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);
  lines.push(`- Question: ${snapshot.surface.sourceQuestionHint}`);

  return lines.join('\n');
}
