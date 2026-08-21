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
  const text = input.text || 'continue this session between zavorthControl and telegram';
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
          reason: 'Operator wants to receive continuity on Telegram.',
          requiresApproval: true,
          previewRequired: true,
        },
      ],
    },
  });
  run.summary = 'Cross-channel continuity prepared without sending messages.';
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
    `- contract: ${snapshot.contractVersion}`,
    `- run: ${snapshot.identifiers.runId}`,
    `- session: ${snapshot.identifiers.sessionId}`,
    `- status: ${snapshot.status}`,
    `- channels: ${snapshot.summary.channelCount}`,
    `- handoffs: ${snapshot.summary.handoffCount}`,
    `- bridge: ${String(snapshot.summary.bridgeDetected)}`,
    `- next step: ${snapshot.nextSafeAction}`,
    '',
    'Channels',
  ];

  for (const channel of snapshot.channels.slice(0, 10)) {
    lines.push(
      `- ${channel.kind}: ${channel.label} [${channel.status}]${channel.primary ? ' primary' : ''}`,
      `  source: ${channel.source}; resume: ${channel.canResume ? 'yes' : 'no'}; notify: ${channel.canNotify ? 'yes' : 'no'}`,
      `  continuity: ${channel.continuityKey}`,
    );
  }

  lines.push('', 'Handoffs');
  if (snapshot.handoffs.length === 0) {
    lines.push('- no handoff necessary');
  } else {
    for (const handoff of snapshot.handoffs.slice(0, 8)) {
      lines.push(
        `- ${handoff.fromChannel} -> ${handoff.toChannel}: ${handoff.status}`,
        `  reason: ${handoff.reason}`,
        `  command: ${handoff.command}`,
      );
    }
  }

  lines.push('', 'Policy');
  lines.push('- no cross-channel message was sent');
  lines.push('- no parallel session was created');
  lines.push('- channel change requires approval');
  lines.push('- original channel preserved');

  lines.push('', 'Surfaces');
  lines.push(`- ZavorthControl: ${snapshot.surface.zavorthControlPath}`);
  lines.push(`- CLI: ${snapshot.surface.cliCommand}`);
  lines.push(`- Approval: ${snapshot.surface.approvalHint}`);

  return lines.join('\n');
}
