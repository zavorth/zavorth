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
  const text = input.text || 'corrija o workspace, rode testes e prepare um patch em preview';
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
    `- contrato: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- status: ${snapshot.status}`,
    `- fonte: ${snapshot.decisionSource}`,
    `- risco: ${snapshot.summary.highestRisk}`,
    `- approval requerido: ${String(snapshot.summary.approvalRequired)}`,
    `- preview requerido: ${String(snapshot.summary.previewRequired)}`,
    `- proximo passo: ${snapshot.nextSafeAction}`,
    '',
    'Escopo',
    `- tools permitidas: ${snapshot.scope.allowedToolIds.join(', ') || 'nenhuma'}`,
    `- tools bloqueadas: ${snapshot.scope.blockedToolIds.join(', ') || 'nenhuma'}`,
    `- paths: ${snapshot.scope.pathHints.join(', ') || 'nao declarados'}`,
    `- superficies: ${snapshot.scope.surfaces.join(', ') || 'nao declaradas'}`,
  ];

  lines.push('', 'Capabilities');
  for (const capability of snapshot.capabilities.slice(0, 8)) {
    lines.push(
      `- ${capability.label} [${capability.risk}] ${capability.permission}`,
      `  tools: ${capability.toolIds.join(', ') || 'nenhuma'}; ${capability.blocked ? 'bloqueada' : 'disponivel'}`,
      `  motivo: ${capability.reason}`,
    );
  }

  if (snapshot.proposal) {
    lines.push('', 'Proposta');
    lines.push(`- ${snapshot.proposal.summary}`);
    lines.push(`- pergunta: ${snapshot.proposal.userQuestion}`);
  }

  lines.push('', 'Politica');
  lines.push('- negotiation nao executa tools');
  lines.push('- escopo aprovado limita tools e paths');
  lines.push('- approvals e preview continuam obrigatorios quando a policy exigir');

  lines.push('', 'Superficies');
  lines.push(`- Dashboard: ${snapshot.surface.dashboardPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);
  lines.push(`- Hint: ${snapshot.surface.approvalHint}`);

  return lines.join('\n');
}
