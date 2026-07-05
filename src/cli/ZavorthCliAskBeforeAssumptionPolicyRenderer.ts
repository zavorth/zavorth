import {
  AgentRunService,
  AskBeforeAssumptionPolicyService,
  type AskBeforeAssumptionPolicySnapshot,
  type UniversalAgentRun,
} from '../runtime/agent/index.js';

export function resolveAskBeforeAssumptionPolicyCliText(args: string): string {
  return String(args || '')
    .trim()
    .replace(/^(?:assumptions|ask-before-assumption|ask-policy|ask-first|run|preview|answer|latest)\b/i, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function buildAskBeforeAssumptionPolicyCliSnapshot(input: {
  text: string;
  userId: string;
  sessionId: string;
}): AskBeforeAssumptionPolicySnapshot {
  const text = input.text || 'apague isso e publique do jeito certo';
  const service = new AgentRunService({
    now: () => new Date('2026-05-04T00:42:00.000Z'),
  });
  const run = service.createRun({
    userId: input.userId,
    channel: 'web',
    sessionId: input.sessionId,
    text,
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    requestedTools: ['workspace.write'],
    metadata: {
      universalPreviewMode: {
        source: 'UniversalPreviewModeService',
        status: 'preview-required',
        risk: {
          previewRequired: true,
          requiresApproval: true,
          previewRequiredToolIds: ['workspace.write'],
        },
      },
      capabilityNegotiation: {
        source: 'CapabilityNegotiationService',
        status: 'waiting-approval',
        approvalId: 'approval:ask-policy:cli',
      },
      crossChannelContinuity: {
        source: 'CrossChannelContinuityService',
        status: 'handoff-ready',
      },
    },
  });
  run.summary = 'Ask Before Assumption Policy preparou perguntas sem executar mutacao.';
  return buildAskBeforeAssumptionPolicySnapshotFromRun(run);
}

export function buildAskBeforeAssumptionPolicySnapshotFromRun(
  run: UniversalAgentRun,
): AskBeforeAssumptionPolicySnapshot {
  return new AskBeforeAssumptionPolicyService().buildSnapshot({
    run,
    generatedAt: run.updatedAt,
  });
}

export function formatAskBeforeAssumptionPolicySnapshot(
  snapshot: AskBeforeAssumptionPolicySnapshot,
): string {
  const lines = [
    'Ask Before Assumption Policy - Channel mesh2',
    `- contract: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- session: ${snapshot.identifiers.sessionId}`,
    `- status: ${snapshot.status}`,
    `- assumptions: ${snapshot.summary.assumptionCount}`,
    `- questions: ${snapshot.summary.questionCount}`,
    `- blockers: ${snapshot.summary.blockerCount}`,
    `- next step: ${snapshot.nextSafeAction}`,
    '',
    'Questions',
  ];

  if (snapshot.questions.length === 0) {
    lines.push('- no required question');
  } else {
    for (const question of snapshot.questions.slice(0, 8)) {
      lines.push(
        `- ${question.priority}: ${question.question}`,
        `  reason: ${question.reason}`,
        `  default action: ${question.defaultAction}; blocks mutation: ${question.blocksMutation ? 'yes' : 'no'}`,
      );
    }
  }

  lines.push('', 'Detected assumptions');
  if (snapshot.assumptions.length === 0) {
    lines.push('- no critical assumption detected');
  } else {
    for (const assumption of snapshot.assumptions.slice(0, 8)) {
      lines.push(
        `- ${assumption.severity}: ${assumption.title} [${assumption.category}]`,
        `  missing: ${assumption.missingInput.join(', ') || 'n/a'}`,
        `  affects: ${assumption.affectedActions.join(', ') || 'no mutable action'}`,
      );
    }
  }

  lines.push('', 'Policy');
  lines.push('- no assumption was executed');
  lines.push('- no mutation was made');
  lines.push('- natural language does not bypass approval/tool policy');
  lines.push('- preview comes before risky action');

  lines.push('', 'Surfaces');
  lines.push(`- ZavorthControl: ${snapshot.surface.zavorthControlPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);
  lines.push(`- Hint: ${snapshot.surface.askHint}`);

  return lines.join('\n');
}
