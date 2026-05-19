import {
  AgentRunService,
  CrossChannelContinuityService,
  type CrossChannelContinuitySnapshot,
  type UniversalAgentRun,
} from '../runtime/agent/index.js';

export function resolveCrossChannelContinuityCliText(args: string): string {
  return String(args || '')
    .trim()
    .replace(/^(?:continuity|cross-channel|channel-continuity|channels|handoff|run|preview|resume|latest)\b/i, '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim();
}

export function buildCrossChannelContinuityCliSnapshot(input: {
  text: string;
  userId: string;
  sessionId: string;
}): CrossChannelContinuitySnapshot {
  const text = input.text || 'continue esta sessao entre command center e telegram';
  const service = new AgentRunService({
    now: () => new Date('2026-05-04T00:41:00.000Z'),
  });
  const run = service.createRun({
    userId: input.userId,
    channel: 'web',
    sessionId: input.sessionId,
    text,
    workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
    requestedTools: ['workspace.read'],
    metadata: {
      channelMeshBridge: {
        source: 'ZavorthAgentGateway.attachChannelMeshEventBus',
        receivedAt: '2026-05-04T00:41:00.000Z',
        channels: [
          {
            id: 'telegram:ops',
            label: 'Telegram Ops',
            kind: 'telegram',
            status: 'available',
            canResume: true,
          },
          {
            id: 'cli:local',
            label: 'Terminal local',
            kind: 'cli',
            status: 'available',
            canResume: true,
          },
        ],
      },
      crossChannelHandoffs: [
        {
          id: 'handoff:web-to-telegram',
          fromChannel: 'web',
          toChannel: 'telegram',
          reason: 'Operador quer receber continuidade no Telegram.',
          requiresApproval: true,
          previewRequired: true,
        },
      ],
    },
  });
  run.summary = 'Cross-channel continuity preparada sem enviar mensagens.';
  return buildCrossChannelContinuitySnapshotFromRun(run);
}

export function buildCrossChannelContinuitySnapshotFromRun(
  run: UniversalAgentRun,
): CrossChannelContinuitySnapshot {
  return new CrossChannelContinuityService().buildSnapshot({
    run,
    generatedAt: run.updatedAt,
  });
}

export function formatCrossChannelContinuitySnapshot(
  snapshot: CrossChannelContinuitySnapshot,
): string {
  const lines = [
    'Cross-Channel Continuity - Channel mesh1',
    `- contrato: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- sessao: ${snapshot.identifiers.sessionId}`,
    `- status: ${snapshot.status}`,
    `- canais: ${snapshot.summary.channelCount}`,
    `- handoffs: ${snapshot.summary.handoffCount}`,
    `- bridge: ${String(snapshot.summary.bridgeDetected)}`,
    `- proximo passo: ${snapshot.nextSafeAction}`,
    '',
    'Canais',
  ];

  for (const channel of snapshot.channels.slice(0, 10)) {
    lines.push(
      `- ${channel.kind}: ${channel.label} [${channel.status}]${channel.primary ? ' primary' : ''}`,
      `  origem: ${channel.source}; resume: ${channel.canResume ? 'sim' : 'nao'}; notify: ${channel.canNotify ? 'sim' : 'nao'}`,
      `  continuidade: ${channel.continuityKey}`,
    );
  }

  lines.push('', 'Handoffs');
  if (snapshot.handoffs.length === 0) {
    lines.push('- nenhum handoff necessario');
  } else {
    for (const handoff of snapshot.handoffs.slice(0, 8)) {
      lines.push(
        `- ${handoff.fromChannel} -> ${handoff.toChannel}: ${handoff.status}`,
        `  motivo: ${handoff.reason}`,
        `  comando: ${handoff.command}`,
      );
    }
  }

  lines.push('', 'Politica');
  lines.push('- nenhuma mensagem cross-channel foi enviada');
  lines.push('- nenhuma sessao paralela foi criada');
  lines.push('- mudanca de canal exige approval');
  lines.push('- canal original preservado');

  lines.push('', 'Superficies');
  lines.push(`- Command Center: ${snapshot.surface.commandCenterPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);
  lines.push(`- Approval: ${snapshot.surface.approvalHint}`);

  return lines.join('\n');
}
