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
    `- contrato: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- sessao: ${snapshot.identifiers.sessionId}`,
    `- status: ${snapshot.status}`,
    `- assuncoes: ${snapshot.summary.assumptionCount}`,
    `- perguntas: ${snapshot.summary.questionCount}`,
    `- bloqueios: ${snapshot.summary.blockerCount}`,
    `- proximo passo: ${snapshot.nextSafeAction}`,
    '',
    'Perguntas',
  ];

  if (snapshot.questions.length === 0) {
    lines.push('- nenhuma pergunta obrigatoria');
  } else {
    for (const question of snapshot.questions.slice(0, 8)) {
      lines.push(
        `- ${question.priority}: ${question.question}`,
        `  motivo: ${question.reason}`,
        `  acao padrao: ${question.defaultAction}; bloqueia mutacao: ${question.blocksMutation ? 'sim' : 'nao'}`,
      );
    }
  }

  lines.push('', 'Assuncoes detectadas');
  if (snapshot.assumptions.length === 0) {
    lines.push('- nenhuma assuncao critica detectada');
  } else {
    for (const assumption of snapshot.assumptions.slice(0, 8)) {
      lines.push(
        `- ${assumption.severity}: ${assumption.title} [${assumption.category}]`,
        `  falta: ${assumption.missingInput.join(', ') || 'n/a'}`,
        `  afeta: ${assumption.affectedActions.join(', ') || 'nenhuma acao mutavel'}`,
      );
    }
  }

  lines.push('', 'Politica');
  lines.push('- nenhuma assuncao foi executada');
  lines.push('- nenhuma mutacao foi feita');
  lines.push('- linguagem natural nao bypassa approval/tool policy');
  lines.push('- preview vem antes de acao arriscada');

  lines.push('', 'Superficies');
  lines.push(`- Command Center: ${snapshot.surface.commandCenterPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);
  lines.push(`- Hint: ${snapshot.surface.askHint}`);

  return lines.join('\n');
}
