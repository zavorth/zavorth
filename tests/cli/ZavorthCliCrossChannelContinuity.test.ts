import { handleZavorthCliRegistryOpsCommand } from '../../src/cli/ZavorthCliRegistryOps.js';
import {
  buildCrossChannelContinuityCliSnapshot,
  formatCrossChannelContinuitySnapshot,
  resolveCrossChannelContinuityCliText,
} from '../../src/cli/ZavorthCliCrossChannelContinuityRenderer.js';

function createFlags(json: boolean) {
  return {
    command: null,
    repl: false,
    json,
    live: false,
    userId: 'grey',
    platform: 'web' as const,
    chatId: 'web:grey',
    sessionId: 'session-cli-cross-channel',
    workspaceHint: null,
    commandText: null,
  };
}

describe('Zavorth CLI Cross-Channel Continuity', () => {
  it('parses continuity text after subcommands', () => {
    expect(resolveCrossChannelContinuityCliText('handoff "telegram depois"')).toBe('telegram depois');
  });

  it('renders continuity JSON through the registry command', async () => {
    const writes: string[] = [];

    const result = await handleZavorthCliRegistryOpsCommand({
      runtime: {} as any,
      effectiveFlags: createFlags(true),
      commandName: 'continuity',
      normalized: 'continuity',
      args: 'handoff "telegram depois"',
      writer: {
        line: (text) => writes.push(text),
        error: (text) => writes.push(text),
      },
    });

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      handled: true,
    }));
    const payload = JSON.parse(writes[0] || '{}');
    expect(payload).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.cross-channel',
      source: 'CrossChannelContinuityService',
      status: 'handoff-ready',
      summary: expect.objectContaining({
        channelCount: expect.any(Number),
        handoffCount: expect.any(Number),
        bridgeDetected: true,
        sameGateway: true,
      }),
      policy: expect.objectContaining({
        noCrossChannelMessageSent: true,
        noSessionForkCreated: true,
        approvalRequiredForChannelSwitch: true,
      }),
    }));
    expect(payload.surface.cliCommand).toContain('zavorth continuity');
  });

  it('formats a compact human summary', () => {
    const snapshot = buildCrossChannelContinuityCliSnapshot({
      text: 'continue on Telegram',
      userId: 'grey',
      sessionId: 'session-cli-cross-channel-human',
    });

    const text = formatCrossChannelContinuitySnapshot(snapshot);

    expect(text).toContain('Cross-Channel Continuity - Channel mesh1');
    expect(text).toContain('Channels');
    expect(text).toContain('no cross-channel message was sent');
    expect(text).toContain('Dashboard: /zavorthControl-sector=channels');
  });
});
