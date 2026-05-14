import {
  AgentRunService,
  MemoryWithReceiptsService,
  type MemoryWithReceiptsSnapshot,
  type UniversalAgentRun,
} from '../runtime/agent/index.js';

export function resolveMemoryWithReceiptsCliText(args: string): string {
  return String(args || '')
    .trim()
    .replace(/^(?:receipts|sources?|source|origem|run)\b/i, '')
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
  const text = input.text || 'Memoria consultada pela CLI.';
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
      title: 'Memoria consultada',
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
    'Memory With Receipts - Wave 32',
    `- contrato: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- memoria: ${snapshot.summary.memoryCount} item(ns) com ${snapshot.summary.receiptCount} receipt(s)`,
    `- confianca media: ${snapshot.summary.averageConfidence ?? 'n/a'}`,
    `- auditavel: ${String(snapshot.audit.allMemoryHasReceipt)}`,
    `- origem respondida: ${String(snapshot.audit.canAnswerSourceQuestion)}`,
    `- corrigir/esquecer: ${String(snapshot.audit.canForgetOrCorrect)}`,
    `- proximo passo: ${snapshot.nextSafeAction}`,
  ];

  if (snapshot.receipts.length > 0) {
    lines.push('', 'Receipts');
    for (const receipt of snapshot.receipts.slice(0, 8)) {
      lines.push(
        `- ${receipt.title} [${receipt.layer}/${receipt.confidenceLabel}]`,
        `  origem: ${receipt.source} (${receipt.sourceType})`,
        `  resumo: ${receipt.summary}`,
        `  esquecer: ${receipt.actions.forgetCommand}`,
        `  corrigir: ${receipt.actions.correctCommand}`,
      );
    }
  } else {
    lines.push('', 'Receipts', '- nenhum sinal de memoria foi usado neste run.');
  }

  lines.push('', 'Superficies');
  lines.push(`- Command Center: ${snapshot.surface.commandCenterPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);
  lines.push(`- Pergunta: ${snapshot.surface.sourceQuestionHint}`);

  return lines.join('\n');
}
