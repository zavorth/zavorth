import {
  AgentRunService,
  CapabilityNegotiationService,
  type CapabilityNegotiationSnapshot,
  type UniversalAgentRun,
} from '../runtime/agent/index.js';

export function resolveCapabilityNegotiationCliText(args: string): string {
  return String(args || '')
    .trim()
    .replace(/^(?:run|negotiate|scope|approve|capabilities|proposal)\b/i, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function buildCapabilityNegotiationCliSnapshot(input: {
  text: string;
  userId: string;
  sessionId: string;
}): CapabilityNegotiationSnapshot {
  const text = input.text || 'fix the workspace, run tests, and prepare a preview patch';
  const service = new AgentRunService({
    now: () => new Date('2026-05-04T00:35:00.000Z'),
  });
  const run = service.createRun({
    userId: input.userId,
    channel: 'cli',
    sessionId: input.sessionId,
    text,
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    requestedTools: ['workspace.read', 'write_file', 'shell.exec'],
    metadata: {
      capabilityNegotiationRequired: true,
      targetPaths: ['src/runtime/agent', 'tests/runtime/agent'],
      requireApprovalFor: ['write_file', 'shell.exec'],
    },
  });
  return buildCapabilityNegotiationSnapshotFromRun(run);
}

export function buildCapabilityNegotiationSnapshotFromRun(
  run: UniversalAgentRun,
): CapabilityNegotiationSnapshot {
  return new CapabilityNegotiationService().buildSnapshot({
    run,
    generatedAt: run.updatedAt,
  });
}

export function formatCapabilityNegotiationSnapshot(
  snapshot: CapabilityNegotiationSnapshot,
): string {
  const lines = [
    'Capability Negotiation - Capability Negotiation',
    `- contract: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- status: ${snapshot.status}`,
    `- source: ${snapshot.decisionSource}`,
    `- risk: ${snapshot.summary.highestRisk}`,
    `- approval required: ${String(snapshot.summary.approvalRequired)}`,
    `- preview required: ${String(snapshot.summary.previewRequired)}`,
    `- next step: ${snapshot.nextSafeAction}`,
    '',
    'Scope',
    `- allowed tools: ${snapshot.scope.allowedToolIds.join(', ') || 'none'}`,
    `- blocked tools: ${snapshot.scope.blockedToolIds.join(', ') || 'none'}`,
    `- paths: ${snapshot.scope.pathHints.join(', ') || 'not declared'}`,
    `- surfaces: ${snapshot.scope.surfaces.join(', ') || 'not declared'}`,
  ];

  lines.push('', 'Capabilities');
  for (const capability of snapshot.capabilities.slice(0, 8)) {
    lines.push(
      `- ${capability.label} [${capability.risk}] ${capability.permission}`,
      `  tools: ${capability.toolIds.join(', ') || 'none'}; ${capability.blocked ? 'blocked' : 'available'}`,
      `  reason: ${capability.reason}`,
    );
  }

  if (snapshot.proposal) {
    lines.push('', 'Proposal');
    lines.push(`- ${snapshot.proposal.summary}`);
    lines.push(`- question: ${snapshot.proposal.userQuestion}`);
  }

  lines.push('', 'Policy');
  lines.push('- negotiation does not execute tools');
  lines.push('- approved scope limits tools and paths');
  lines.push('- approvals and preview remain required when policy demands them');

  lines.push('', 'Surfaces');
  lines.push(`- ZavorthControl: ${snapshot.surface.zavorthControlPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);
  lines.push(`- Hint: ${snapshot.surface.approvalHint}`);

  return lines.join('\n');
}
