import {
  AgentRunService,
  AgentTeamCompilerService,
  type AgentTeamCompilerSnapshot,
  type UniversalAgentRun,
} from '../runtime/agent/index.js';

export function resolveAgentTeamCompilerCliText(args: string): string {
  return String(args || '')
    .trim()
    .replace(/^(?:agent-team|team-compiler|compile-team|team|run|preview|approve|launch|inspect|latest)\b/i, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function buildAgentTeamCompilerCliSnapshot(input: {
  text: string;
  userId: string;
  sessionId: string;
}): AgentTeamCompilerSnapshot {
  const text = input.text || 'compile uma equipe de agentes para implementar e validar esta wave';
  const service = new AgentRunService({
    now: () => new Date('2026-05-04T00:40:00.000Z'),
  });
  const run = service.createRun({
    userId: input.userId,
    channel: 'cli',
    sessionId: input.sessionId,
    text,
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    requestedTools: ['swarm.run', 'workspace.read'],
    metadata: {
      suggestedSubagents: ['planner', 'implementer', 'verifier', 'safety-reviewer'],
      providerArena: {
        summary: {
          hasProviderEvidence: true,
          readyCandidateCount: 1,
          recommendedProviderLabel: 'openai',
          recommendedModelLabel: 'gpt-test',
          decisionSource: 'observed',
        },
        selected: {
          candidateId: 'candidate-openai',
          providerLabel: 'openai',
          modelLabel: 'gpt-test',
        },
      },
      capabilityNegotiation: {
        status: 'waiting-approval',
        summary: {
          capabilityCount: 2,
        },
      },
    },
  });
  run.summary = 'Agent Team Compiler preparou roles sem lancar subagentes.';
  return buildAgentTeamCompilerSnapshotFromRun(run);
}

export function buildAgentTeamCompilerSnapshotFromRun(
  run: UniversalAgentRun,
): AgentTeamCompilerSnapshot {
  return new AgentTeamCompilerService().buildSnapshot({
    run,
    generatedAt: run.updatedAt,
  });
}

export function formatAgentTeamCompilerSnapshot(
  snapshot: AgentTeamCompilerSnapshot,
): string {
  const lines = [
    'Agent Team Compiler - Wave 40',
    `- contrato: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- status: ${snapshot.status}`,
    `- objetivo: ${snapshot.objective}`,
    `- roles: ${snapshot.summary.roleCount}`,
    `- approvals: ${snapshot.summary.approvalRequiredCount}`,
    `- providers: ${snapshot.summary.providerAssignedCount}`,
    `- proximo passo: ${snapshot.nextSafeAction}`,
    '',
    'Roles',
  ];

  for (const role of snapshot.roles.slice(0, 8)) {
    lines.push(
      `- ${role.roleId}: ${role.label} [${role.kind}]`,
      `  objetivo: ${role.objective}`,
      `  provider: ${role.provider.providerLabel}/${role.provider.modelLabel} (${role.provider.source}, advisory)`,
      `  scope: ${role.scope.mode}; tools: ${role.toolIds.join(', ') || 'nenhuma'}`,
      `  budget: ${role.budget.maxToolCalls} calls; approval: ${role.approval.required ? 'sim' : 'nao'}`,
      `  preview: ${role.actions.previewCommand}`,
    );
  }

  lines.push('', 'Topologia');
  if (snapshot.topology.edges.length === 0) {
    lines.push('- sem edges; plano unitario ou nao necessario');
  } else {
    for (const edge of snapshot.topology.edges.slice(0, 8)) {
      lines.push(`- ${edge.from} -> ${edge.to}: ${edge.reason}`);
    }
  }

  lines.push('', 'Politica');
  lines.push('- nenhum subagente foi lancado');
  lines.push('- lancamento exige approval explicito');
  lines.push('- budgets iniciam em zero');
  lines.push('- provider e modelo sao advisory ate approval');

  lines.push('', 'Superficies');
  lines.push(`- Command Center: ${snapshot.surface.commandCenterPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);
  lines.push(`- Approval: ${snapshot.surface.approvalHint}`);

  return lines.join('\n');
}
