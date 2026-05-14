import { handleZavorthCliRegistryOpsCommand } from '../../src/cli/ZavorthCliRegistryOps.js';
import {
  buildAgentTeamCompilerCliSnapshot,
  formatAgentTeamCompilerSnapshot,
  resolveAgentTeamCompilerCliText,
} from '../../src/cli/ZavorthCliAgentTeamCompilerRenderer.js';

function createFlags(json: boolean) {
  return {
    command: null,
    repl: false,
    json,
    live: false,
    userId: 'grey',
    platform: 'web' as const,
    chatId: 'web:grey',
    sessionId: 'session-cli-agent-team',
    workspaceHint: null,
    commandText: null,
  };
}

describe('Zavorth CLI Agent Team Compiler', () => {
  it('parses agent-team text after subcommands', () => {
    expect(resolveAgentTeamCompilerCliText('preview "implemente com subagentes"')).toBe('implemente com subagentes');
  });

  it('renders agent-team JSON through the registry command', async () => {
    const writes: string[] = [];

    const result = await handleZavorthCliRegistryOpsCommand({
      runtime: {} as any,
      effectiveFlags: createFlags(true),
      commandName: 'agent-team',
      normalized: 'agent-team',
      args: 'preview "implemente com subagentes"',
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
      contractVersion: '2026-05-03.wave-40',
      source: 'AgentTeamCompilerService',
      status: 'waiting-approval',
      summary: expect.objectContaining({
        roleCount: expect.any(Number),
        approvalRequiredCount: expect.any(Number),
        compilerOnly: true,
      }),
      policy: expect.objectContaining({
        noSubagentsLaunched: true,
        approvalRequiredBeforeLaunch: true,
        budgetsDefaultToZero: true,
      }),
    }));
    expect(payload.surface.cliCommand).toContain('zavorth agent-team');
  });

  it('formats a compact human summary', () => {
    const snapshot = buildAgentTeamCompilerCliSnapshot({
      text: 'compile equipe para wave',
      userId: 'grey',
      sessionId: 'session-cli-agent-team-human',
    });

    const text = formatAgentTeamCompilerSnapshot(snapshot);

    expect(text).toContain('Agent Team Compiler - Wave 40');
    expect(text).toContain('Roles');
    expect(text).toContain('nenhum subagente foi lancado');
    expect(text).toContain('Command Center: /control?sector=agents');
  });
});
