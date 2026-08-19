import { handleZavorthCliRegistryOpsCommand } from '../../src/cli/ZavorthCliRegistryOps.js';
import {
  buildSkillMcpQuarantineCliSnapshot,
  formatSkillMcpQuarantineSnapshot,
  resolveSkillMcpQuarantineCliText,
} from '../../src/cli/ZavorthCliSkillMcpQuarantineRenderer.js';

function createFlags(json: boolean) {
  return {
    command: null,
    repl: false,
    json,
    live: false,
    userId: 'grey',
    platform: 'web' as const,
    chatId: 'web:grey',
    sessionId: 'session-cli-quarantine',
    workspaceHint: null,
    commandText: null,
  };
}

describe('Zavorth CLI Skill/MCP Quarantine', () => {
  it('parses quarantine text after subcommands', () => {
    expect(resolveSkillMcpQuarantineCliText('review "skill importada"')).toBe('skill importada');
  });

  it('renders quarantine JSON through the registry command', async () => {
    const writes: string[] = [];

    const result = await handleZavorthCliRegistryOpsCommand({
      runtime: {} as any,
      effectiveFlags: createFlags(true),
      commandName: 'quarantine',
      normalized: 'quarantine',
      args: 'review "skill importada"',
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
      contractVersion: '2026-05-03.skill-mcp-quarantine',
      summary: expect.objectContaining({
        total: 2,
        quarantined: 1,
      }),
      policy: expect.objectContaining({
        externalImportsNeverTrustedAutomatically: true,
        naturalLanguageDoesNotBypassQuarantine: true,
      }),
    }));
    expect(payload.entries[0].actions.promoteCommand).toContain('zavorth quarantine promote');
  });

  it('formats a compact human summary', () => {
    const snapshot = buildSkillMcpQuarantineCliSnapshot({
      text: 'skill importada',
      userId: 'grey',
      sessionId: 'session-cli-quarantine-human',
    });

    const text = formatSkillMcpQuarantineSnapshot(snapshot);

    expect(text).toContain('Skill/MCP Quarantine - Skill MCP Quarantine');
    expect(text).toMatch(/Capabilities importadas|Imported Capabilities/i);
    expect(text).toContain('promote: zavorth quarantine promote');
    expect(text).toMatch(/ZavorthControl: \/zavorthControl\.\.\.sector=skills/i);
  });
});
