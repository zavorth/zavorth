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
  const text = input.text || 'compile an agent team to implement and validate this delivery';
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
  run.summary = 'Agent Team Compiler prepared roles without launching delegated work.';
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
    `- contract: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- status: ${snapshot.status}`,
    `- objective: ${snapshot.objective}`,
    `- roles: ${snapshot.summary.roleCount}`,
    `- approvals: ${snapshot.summary.approvalRequiredCount}`,
    `- providers: ${snapshot.summary.providerAssignedCount}`,
    `- next step: ${snapshot.nextSafeAction}`,
    '',
    'Roles',
  ];

  for (const role of snapshot.roles.slice(0, 8)) {
    lines.push(
      `- ${role.roleId}: ${role.label} [${role.kind}]`,
      `  objective: ${role.objective}`,
      `  provider: ${role.provider.providerLabel}/${role.provider.modelLabel} (${role.provider.source}, advisory)`,
      `  scope: ${role.scope.mode}; tools: ${role.toolIds.join(', ') || 'none'}`,
      `  budget: ${role.budget.maxToolCalls} calls; approval: ${role.approval.required ? 'yes' : 'no'}`,
      `  preview: ${role.actions.previewCommand}`,
    );
  }

  lines.push('', 'Topology');
  if (snapshot.topology.edges.length === 0) {
    lines.push('- no edges; unit plan or not necessary');
  } else {
    for (const edge of snapshot.topology.edges.slice(0, 8)) {
      lines.push(`- ${edge.from} -> ${edge.to}: ${edge.reason}`);
    }
  }

  lines.push('', 'Policy');
  lines.push('- no subagent was launched');
  lines.push('- launch requires explicit approval');
  lines.push('- budgets start at zero');
  lines.push('- provider and model are advisory until approval');

  lines.push('', 'Surfaces');
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
    `- contract: ${result.contractVersion}`,
    `- status: ${result.status}`,
    `- team run: ${result.teamRunId}`,
    `- approval: ${result.approval.matched ? 'matched' : 'pending'}`,
    `- prepared roles: ${result.roles.filter((role: AgentTeamCompilerLaunchResult['roles'][number]) => role.status === 'prepared').length}`,
    `- turns: ${result.turns.length}`,
    `- synthesis: ${result.synthesis.status}`,
    `- next step: ${result.nextSafeAction}`,
  ];
  if (result.blockedReasons.length > 0) {
    lines.push('', 'Blocks');
    for (const reason of result.blockedReasons) {
      lines.push(`- ${reason}`);
    }
  }
  lines.push('', 'Policy');
  lines.push('- launch does not execute tools directly');
  lines.push('- mutation remains bound to the approved subagent runtime');
  lines.push('- final synthesis requires peer review and receipts');
  return lines.join('\n');
}
