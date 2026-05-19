import type {
  UniversalAgentRunObservatoryQuery,
  UniversalAgentRunObservatorySnapshot,
} from '../runtime/agent/index.js';

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeLimit(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function tokensFromArgs(args: string): string[] {
  return String(args || '').trim().split(/\s+/).filter(Boolean);
}

export function resolveRunObservatoryCliQuery(
  args: string,
  fallbackSessionId?: string | null,
): UniversalAgentRunObservatoryQuery {
  const tokens = tokensFromArgs(args);
  const query: UniversalAgentRunObservatoryQuery = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const lower = token.toLowerCase();
    const next = tokens[index + 1];

    if ((lower === 'run' || lower === '--run' || lower === '--run-id' || lower === 'runid') && next) {
      query.runId = next;
      index += 1;
      continue;
    }
    if ((lower === 'trace' || lower === '--trace' || lower === '--trace-id' || lower === 'traceid') && next) {
      query.traceId = next;
      index += 1;
      continue;
    }
    if ((lower === 'session' || lower === 'sessao' || lower === '--session' || lower === '--session-id') && next) {
      query.sessionId = next;
      index += 1;
      continue;
    }
    if ((lower === 'status' || lower === '--status') && next) {
      query.status = next as UniversalAgentRunObservatoryQuery['status'];
      index += 1;
      continue;
    }
    if ((lower === 'limit' || lower === '--limit') && next) {
      query.limit = normalizeLimit(next);
      index += 1;
      continue;
    }
    if (lower.startsWith('--run=')) {
      query.runId = token.slice('--run='.length);
      continue;
    }
    if (lower.startsWith('--trace=')) {
      query.traceId = token.slice('--trace='.length);
      continue;
    }
    if (lower.startsWith('--session=')) {
      query.sessionId = token.slice('--session='.length);
      continue;
    }
    if (lower.startsWith('--status=')) {
      query.status = token.slice('--status='.length) as UniversalAgentRunObservatoryQuery['status'];
      continue;
    }
    if (lower.startsWith('--limit=')) {
      query.limit = normalizeLimit(token.slice('--limit='.length));
    }
  }

  if (!query.runId && !query.traceId && !query.sessionId && !query.status && fallbackSessionId) {
    query.sessionId = fallbackSessionId;
  }
  return query;
}

export function formatRunObservatorySnapshot(
  snapshot: UniversalAgentRunObservatorySnapshot,
): string {
  const lines = [
    'Run Observatory - Run Observatory',
    `Contrato: ${snapshot.contractVersion}`,
    `Status: ${snapshot.health.status}`,
    `Runs: ${snapshot.matchedRuns}/${snapshot.totalRuns}`,
    `Receipts: ${snapshot.summary.receiptCount} | Eventos: ${snapshot.summary.eventCount} | Artifacts: ${snapshot.summary.artifactCount}`,
    `Replay: ${snapshot.replay.available ? 'disponivel' : 'indisponivel'} - ${snapshot.replay.summary}`,
    `Proximo passo: ${snapshot.health.nextSafeAction}`,
  ];

  if (snapshot.health.issues.length > 0) {
    lines.push('', 'Atencao:');
    for (const issue of snapshot.health.issues.slice(0, 5)) {
      lines.push(`- ${issue}`);
    }
  }

  if (snapshot.runs.length > 0) {
    lines.push('', 'Runs observadas:');
    for (const entry of snapshot.runs.slice(0, 8)) {
      const run = entry.run;
      lines.push(`- ${run.id} [${run.status}] ${normalizeText(run.title, run.summary)}`);
      lines.push(`  trace=${run.traceId} session=${run.sessionId} match=${entry.matchedBy.join('+')}`);
    }
  }

  if (snapshot.receipts.length > 0) {
    lines.push('', 'Receipts recentes:');
    for (const receipt of snapshot.receipts.slice(0, 8)) {
      lines.push(`- ${receipt.id} [${receipt.kind}/${receipt.status}] ${receipt.title}`);
    }
  }

  if (snapshot.diffPreviews.length > 0) {
    lines.push('', 'Previas de alteracao:');
    for (const preview of snapshot.diffPreviews.slice(0, 4)) {
      lines.push(`- ${preview.planId || preview.receiptId}: ${preview.summary}`);
      lines.push(`  acao: ${preview.actions.approveApplyInstruction}`);
      lines.push(`  rollback: ${preview.actions.rollbackInstruction}`);
    }
  }

  if (snapshot.sidecars.health.length > 0) {
    lines.push('', 'Sidecars:');
    for (const sidecar of snapshot.sidecars.health.slice(0, 6)) {
      const status = sidecar.ready ? 'pronto' : sidecar.enabled ? 'atencao' : 'desativado';
      lines.push(`- ${sidecar.name} [${status}] ${sidecar.message || sidecar.baseUrl || 'sem detalhe'}`);
    }
    lines.push(
      `  receipts sidecar: ${snapshot.sidecars.summary.recentReceiptCount}/${snapshot.sidecars.receipts.totalReceipts}`,
    );
  }

  lines.push('', `CLI: ${snapshot.surface.cliCommand || 'zavorth observatory --json'}`);
  lines.push(`Command Center: ${snapshot.surface.commandCenterPath}`);
  return lines.join('\n');
}
