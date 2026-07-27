import { handleZavorthCliRegistryOpsCommand } from '../../src/cli/ZavorthCliRegistryOps.js';
import {
  buildPersonalOpsAutopilotCliSnapshot,
  formatPersonalOpsAutopilotSnapshot,
  resolvePersonalOpsAutopilotCliText,
} from '../../src/cli/ZavorthCliPersonalOpsAutopilotRenderer.js';

function createFlags(json: boolean) {
  return {
    command: null,
    repl: false,
    json,
    live: false,
    userId: 'grey',
    platform: 'web' as const,
    chatId: 'web:grey',
    sessionId: 'session-cli-personal-ops',
    workspaceHint: null,
    commandText: null,
  };
}

describe('Zavorth CLI Personal Ops Autopilot', () => {
  it('parses personal-ops text after subcommands', () => {
    expect(resolvePersonalOpsAutopilotCliText('preview "provider e budget"')).toBe('provider e budget');
  });

  it('renders personal-ops JSON through the registry command', async () => {
    const writes: string[] = [];

    const result = await handleZavorthCliRegistryOpsCommand({
      runtime: {} as any,
      effectiveFlags: createFlags(true),
      commandName: 'personal-ops',
      normalized: 'personal-ops',
      args: 'preview "provider e budget"',
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
      contractVersion: '2026-05-03.personal-ops',
      source: 'PersonalOpsAutopilotService',
      summary: expect.objectContaining({
        suggestionCount: expect.any(Number),
        approvalRequiredCount: expect.any(Number),
      }),
      policy: expect.objectContaining({
        noMutableActionExecuted: true,
        noAutorepairStarted: true,
        approvalsRequiredForMutation: true,
        previewBeforeAutorepair: true,
      }),
    }));
    expect(payload.surface.cliCommand).toContain('zavorth personal-ops');
  });

  it('formats a compact human summary', () => {
    const snapshot = buildPersonalOpsAutopilotCliSnapshot({
      text: 'diagnostique provider',
      userId: 'grey',
      sessionId: 'session-cli-personal-ops-human',
    });

    const text = formatPersonalOpsAutopilotSnapshot(snapshot);

    expect(text).toContain('Personal Ops Autopilot - Personal Ops Autopilot');
    expect(text).toContain('Suggestions');
    expect(text).toContain('no mutable action was executed');
    expect(text).toContain('Dashboard: /zavorthControl-sector=overview');
  });
});
