import { handleZavorthCliRegistryOpsCommand } from '../../src/cli/ZavorthCliRegistryOps.js';
import {
  buildSafetyNarrativeCliSnapshot,
  formatSafetyNarrativeSnapshot,
  resolveSafetyNarrativeCliText,
} from '../../src/cli/ZavorthCliSafetyNarrativeRenderer.js';

function createFlags(json: boolean) {
  return {
    command: null,
    repl: false,
    json,
    live: false,
    userId: 'grey',
    platform: 'web' as const,
    chatId: 'web:grey',
    sessionId: 'session-cli-safety',
    workspaceHint: null,
    commandText: null,
  };
}

describe('Zavorth CLI Safety Narrative', () => {
  it('parses quoted safety input', () => {
    expect(resolveSafetyNarrativeCliText('"explique por que bloqueou"')).toBe('explique por que bloqueou');
  });

  it('renders safety JSON through the registry command', async () => {
    const writes: string[] = [];

    const result = await handleZavorthCliRegistryOpsCommand({
      runtime: {} as any,
      effectiveFlags: createFlags(true),
      commandName: 'safety',
      normalized: 'safety',
      args: 'corrija arquivo e rode testes',
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
      contractVersion: '2026-05-03.safety-narrative',
      highRiskBlockPresent: true,
      policy: expect.objectContaining({
        alternativesDoNotExecute: true,
        naturalLanguageDoesNotBypassPolicy: true,
      }),
    }));
    expect(payload.alternatives.length).toBeGreaterThan(0);
  });

  it('formats a compact human summary', () => {
    const snapshot = buildSafetyNarrativeCliSnapshot({
      text: 'corrija arquivo e rode testes',
      userId: 'grey',
      sessionId: 'session-cli-safety-human',
    });

    const text = formatSafetyNarrativeSnapshot(snapshot);

    expect(text).toContain('Safety Narrative - Safety Narrative');
    expect(text).toContain('Alternativas seguras');
    expect(text).toContain('Command Center: /control?sector=overview');
  });
});
