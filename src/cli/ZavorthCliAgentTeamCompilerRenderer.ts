import {
  AgentRunService,
  AgentTeamCompilerService,
  type AgentTeamCompilerLaunchResult,
  type AgentTeamCompilerSnapshot,
  type UniversalAgentRun,
} from '../runtime/agent/index.js';

function safeCliIdPart(value: string): string {
  return String(value || 'session')
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'session';
}

export function resolveAgentTeamCompilerCliAction(args: string): 'preview' | 'launch' | 'inspect' | 'synthesize' {
  const match = String(args || '').trim().match(/^(agent-team|team-compiler|compile-team|team|run|preview|approve|launch|inspect|latest|synthesize)\b/i);
  const action = String(match?.[1] || 'preview').toLowerCase();
  if (action === 'launch') {
    return 'launch';
  }
  if (action === 'inspect') {
    return 'inspect';
  }
  if (action === 'synthesize') {
    return 'synthesize';
  }
  return 'preview';
}

export function resolveAgentTeamCompilerApprovalId(args: string): string | null {
  const text = String(args || '');
  const equals = text.match(/--approval-id=("[^"]+"|'[^']+'|\S+)/i);
  const spaced = text.match(/--approval-id\s+("[^"]+"|'[^']+'|\S+)/i);
  const value = equals?.[1] || spaced?.[1] || '';
  return value.replace(/^["']|["']$/g, '').trim() || null;
}

export function resolveAgentTeamCompilerCliText(args: string): string {
  return String(args || '')
    .trim()
    .replace(/^(?:agent-team|team-compiler|compile-team|team|run|preview|approve|launch|inspect|latest|synthesize)\b/i, '')
    .replace(/--approval-id(?:=|\s+)("[^"]+"|'[^']+'|\S+)/gi, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function buildAgentTeamCompilerCliSnapshot(input: {
  text: string;
  userId: string;
  sessionId: string;
}): AgentTeamCompilerSnapshot {
  const text = input.text || 'compile uma equipe de agentes para implementar e validar esta entrega';
  const service = new AgentRunService({
    now: () => new Date('2026-05-04T00:40:00.000Z'),
    idFactory: (() => {
      let index = 0;
      const session = safeCliIdPart(input.sessionId);
      return (prefix: string) => `${prefix}-${session}-${++index}`;
    })(),
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
    'Agent Team Compiler - Channel mesh0',
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
  lines.push(`- ZavorthControl: ${snapshot.surface.zavorthControlPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);
  lines.push(`- Approval: ${snapshot.surface.approvalHint}`);

  return lines.join('\n');
}

export function buildAgentTeamCompilerCliLaunchResult(input: {
  text: string;
  userId: string;
  sessionId: string;
  approvalId?: string | null;
}): AgentTeamCompilerLaunchResult {
  const snapshot = buildAgentTeamCompilerCliSnapshot({
    text: input.text,
    userId: input.userId,
    sessionId: input.sessionId,
  });
  return new AgentTeamCompilerService({
    now: () => new Date('2026-05-04T00:42:00.000Z'),
  }).launchApprovedTeam(snapshot, {
    approvalId: input.approvalId,
    generatedAt: '2026-05-04T00:42:00.000Z',
  });
}

export function buildAgentTeamCompilerLaunchResultFromRun(
  run: UniversalAgentRun,
  approvalId?: string | null,
): AgentTeamCompilerLaunchResult {
  const snapshot = buildAgentTeamCompilerSnapshotFromRun(run);
  return new AgentTeamCompilerService().launchApprovedTeam(snapshot, {
    approvalId,
    generatedAt: run.updatedAt,
  });
}

export function formatAgentTeamCompilerLaunchResult(result: AgentTeamCompilerLaunchResult): string {
  const lines = [
    'Agent Team Launch - governed review board',
    `- contrato: ${result.contractVersion}`,
    `- status: ${result.status}`,
    `- team run: ${result.teamRunId}`,
    `- approval: ${result.approval.matched ? 'conferido' : 'pendente'}`,
    `- roles preparados: ${result.roles.filter((role: AgentTeamCompilerLaunchResult['roles'][number]) => role.status === 'prepared').length}`,
    `- turns: ${result.turns.length}`,
    `- sintese: ${result.synthesis.status}`,
    `- proximo passo: ${result.nextSafeAction}`,
  ];
  if (result.blockedReasons.length > 0) {
    lines.push('', 'Bloqueios');
    for (const reason of result.blockedReasons) {
      lines.push(`- ${reason}`);
    }
  }
  lines.push('', 'Politica');
  lines.push('- launch nao executa ferramentas diretamente');
  lines.push('- mutacao continua presa ao runtime de subagentes aprovado');
  lines.push('- sintese final exige peer review e receipts');
  return lines.join('\n');
}
