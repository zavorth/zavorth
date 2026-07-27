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
  const text = input.text || 'fix the workspace, edit files, and run npm test';
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
    'Tool Rehearsal - Tool Rehearsal',
    `- contract: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- status: ${snapshot.status}`,
    `- calls: ${snapshot.summary.callCount}`,
    `- calls danger: ${snapshot.summary.dangerousCallCount}`,
    `- approved scope: ${String(snapshot.summary.scopeApproved)}`,
    `- budget ok: ${String(snapshot.summary.budgetAllowed)}`,
    `- next step: ${snapshot.nextSafeAction}`,
    '',
    'Calls',
  ];

  for (const call of snapshot.calls.slice(0, 8)) {
    lines.push(
      `- ${call.order}. ${call.toolId} [${call.risk}]`,
      `  args: ${JSON.stringify(call.approximateArguments)}`,
      `  expected: ${call.expectedOutput}`,
      `  scope: ${call.allowedByScope ? 'allowed' : 'pending'}; dry-run=${String(call.dryRunSupported)}`,
    );
  }

  lines.push('', 'Adjustments');
  for (const adjustment of snapshot.adjustments.slice(0, 6)) {
    lines.push(`- ${adjustment.label}: ${adjustment.detail}`);
  }

  lines.push('', 'Policy');
  lines.push('- rehearsal does not execute tools');
  lines.push('- does not change the filesystem, spawn shell, or call the network');
  lines.push('- actual execution is limited to the rehearsed scope');

  lines.push('', 'Surfaces');
  lines.push(`- ZavorthControl: ${snapshot.surface.zavorthControlPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);
  lines.push(`- Hint: ${snapshot.surface.approvalHint}`);

  return lines.join('\n');
}
