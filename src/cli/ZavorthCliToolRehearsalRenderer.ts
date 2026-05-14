import {
  AgentRunService,
  ToolRehearsalService,
  type ToolRehearsalSnapshot,
  type UniversalAgentRun,
} from '../runtime/agent/index.js';

export function resolveToolRehearsalCliText(args: string): string {
  return String(args || '')
    .trim()
    .replace(/^(?:run|rehearse|tool-rehearsal|tools|calls|proposal)\b/i, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function buildToolRehearsalCliSnapshot(input: {
  text: string;
  userId: string;
  sessionId: string;
}): ToolRehearsalSnapshot {
  const text = input.text || 'corrija o workspace, edite arquivos e rode npm test';
  const service = new AgentRunService({
    now: () => new Date('2026-05-04T00:36:00.000Z'),
  });
  const run = service.createRun({
    userId: input.userId,
    channel: 'cli',
    sessionId: input.sessionId,
    text,
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    requestedTools: ['workspace.read', 'write_file', 'shell.exec'],
    metadata: {
      toolRehearsalRequired: true,
      targetPaths: ['src/runtime/agent', 'tests/runtime/agent'],
      requireApprovalFor: ['write_file', 'shell.exec'],
    },
  });
  const negotiation = (run.metadata.capabilityNegotiation || {}) as any;
  run.metadata.capabilityNegotiation = {
    ...negotiation,
    status: 'approved',
    approved: true,
    scope: {
      ...(negotiation.scope || {}),
      approved: true,
    },
  };
  return buildToolRehearsalSnapshotFromRun(run);
}

export function buildToolRehearsalSnapshotFromRun(
  run: UniversalAgentRun,
): ToolRehearsalSnapshot {
  return new ToolRehearsalService().buildSnapshot({
    run,
    generatedAt: run.updatedAt,
  });
}

export function formatToolRehearsalSnapshot(
  snapshot: ToolRehearsalSnapshot,
): string {
  const lines = [
    'Tool Rehearsal - Wave 36',
    `- contrato: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- status: ${snapshot.status}`,
    `- calls: ${snapshot.summary.callCount}`,
    `- calls danger: ${snapshot.summary.dangerousCallCount}`,
    `- scope aprovado: ${String(snapshot.summary.scopeApproved)}`,
    `- budget ok: ${String(snapshot.summary.budgetAllowed)}`,
    `- proximo passo: ${snapshot.nextSafeAction}`,
    '',
    'Calls',
  ];

  for (const call of snapshot.calls.slice(0, 8)) {
    lines.push(
      `- ${call.order}. ${call.toolId} [${call.risk}]`,
      `  args: ${JSON.stringify(call.approximateArguments)}`,
      `  esperado: ${call.expectedOutput}`,
      `  escopo: ${call.allowedByScope ? 'permitido' : 'pendente'}; dry-run=${String(call.dryRunSupported)}`,
    );
  }

  lines.push('', 'Ajustes');
  for (const adjustment of snapshot.adjustments.slice(0, 6)) {
    lines.push(`- ${adjustment.label}: ${adjustment.detail}`);
  }

  lines.push('', 'Politica');
  lines.push('- rehearsal nao executa tools');
  lines.push('- nao muda filesystem, nao spawna shell e nao chama rede');
  lines.push('- execucao real fica limitada ao escopo ensaiado');

  lines.push('', 'Superficies');
  lines.push(`- Command Center: ${snapshot.surface.commandCenterPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);
  lines.push(`- Hint: ${snapshot.surface.approvalHint}`);

  return lines.join('\n');
}
