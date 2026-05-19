import {
  AgentRunService,
  UniversalIntentTrustEnforcementService,
  type UniversalAgentRun,
  type UniversalIntentTrustEnforcementSnapshot,
} from '../runtime/agent/index.js';

export function resolveUniversalIntentTrustCliText(args: string): string {
  return String(args || '')
    .trim()
    .replace(/^(?:uni|universal-intent|intent|trust-slider|trust-policy|trust|run|status|latest|preview)\b/i, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function buildUniversalIntentTrustCliSnapshot(input: {
  text: string;
  userId: string;
  sessionId: string;
}): UniversalIntentTrustEnforcementSnapshot {
  const text = input.text || 'aplique um patch em src/app.ts';
  const service = new AgentRunService({
    now: () => new Date('2026-05-04T00:44:00.000Z'),
  });
  const run = service.createRun({
    userId: input.userId,
    channel: 'cli',
    sessionId: input.sessionId,
    text,
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    requestedTools: text.toLowerCase().includes('host')
      ? ['shell.exec']
      : ['write_file'],
    metadata: {
      trustMode: text.toLowerCase().includes('protected') ? 'protected' : 'collaborator',
      workspaceRoot: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      targetPath: text.toLowerCase().includes('host')
        ? 'C:\\Windows\\System32\\drivers\\etc\\hosts'
        : 'C:\\TESTES DEV\\zavorth-core\\Zavorth\\src\\app.ts',
      hostScopeRequested: text.toLowerCase().includes('host inteiro'),
    },
  });
  run.summary = 'UNI / Trust Slider avaliado sem executar ferramenta.';
  return buildUniversalIntentTrustSnapshotFromRun(run);
}

export function buildUniversalIntentTrustSnapshotFromRun(
  run: UniversalAgentRun,
): UniversalIntentTrustEnforcementSnapshot {
  return new UniversalIntentTrustEnforcementService().buildSnapshot({
    run,
    generatedAt: run.updatedAt,
  });
}

export function formatUniversalIntentTrustSnapshot(
  snapshot: UniversalIntentTrustEnforcementSnapshot,
): string {
  const lines = [
    'UNI / Trust Slider Enforcement - Channel mesh4',
    `- contrato: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- sessao: ${snapshot.identifiers.sessionId}`,
    `- status: ${snapshot.status}`,
    `- intent: ${snapshot.summary.intent}`,
    `- risco: ${snapshot.summary.risk}`,
    `- trust: ${snapshot.summary.trustLevel} -> ${snapshot.summary.trustDecision}`,
    `- posture: ${snapshot.summary.posture}`,
    `- proximo passo: ${snapshot.nextSafeAction}`,
    '',
    'Permissao',
  ];

  if (snapshot.permission.required) {
    lines.push(
      `- tipo: ${snapshot.permission.kind}`,
      `- escopo: ${snapshot.permission.scope}`,
      `- preview: ${snapshot.permission.previewRequired ? 'sim' : 'nao'}`,
      `- approval: ${snapshot.permission.approvalRequired ? 'sim' : 'nao'}`,
      `- prompt: ${snapshot.permission.prompt || 'n/a'}`,
    );
  } else {
    lines.push('- nenhuma permissao conversacional obrigatoria');
  }

  lines.push('', 'Clarificacao');
  if (snapshot.clarification.required) {
    lines.push(
      `- pergunta: ${snapshot.clarification.question || 'confirmar antes de agir'}`,
      `- falta: ${snapshot.clarification.missing.join(', ') || 'n/a'}`,
    );
  } else {
    lines.push('- nenhuma pergunta obrigatoria');
  }

  lines.push('', 'Gates');
  for (const gate of snapshot.gates) {
    lines.push(`- ${gate.status}: ${gate.label} (${gate.source})`, `  ${gate.detail}`);
  }

  lines.push('', 'Politica');
  lines.push('- UniversalIntentService e a fonte da classificacao');
  lines.push('- Trust Slider e aplicado antes do executor');
  lines.push('- linguagem natural nao bypassa permissao, preview ou approval');
  lines.push('- host inteiro exige Overlord com owner/operator e kill switch');
  lines.push('- workspace boundary continua enforcement global');
  lines.push('- nenhuma ferramenta foi executada pelo snapshot');
  lines.push('- secrets nao foram serializados');

  lines.push('', 'Superficies');
  lines.push(`- Command Center: ${snapshot.surface.commandCenterPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);
  lines.push(`- Trust: ${snapshot.surface.trustHint}`);
  lines.push(`- Permissao: ${snapshot.surface.permissionHint}`);

  return lines.join('\n');
}
