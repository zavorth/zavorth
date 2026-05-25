import { handleZavorthCliRegistryOpsCommand } from '../../src/cli/ZavorthCliRegistryOps.js';
import {
  buildUniversalIntentTrustCliSnapshot,
  formatUniversalIntentTrustSnapshot,
  resolveUniversalIntentTrustCliText,
} from '../../src/cli/ZavorthCliUniversalIntentTrustRenderer.js';

function createFlags(json: boolean) {
  return {
    command: null,
    repl: false,
    json,
    live: false,
    userId: 'grey',
    platform: 'web' as const,
    chatId: 'web:grey',
    sessionId: 'session-cli-uni-trust',
    workspaceHint: null,
    commandText: null,
  };
}

describe('Zavorth CLI UNI / Trust enforcement', () => {
  it('parses uni text after trust aliases', () => {
    expect(resolveUniversalIntentTrustCliText('trust-slider "aplique patch"')).toBe('aplique patch');
  });

  it('renders UNI / Trust JSON through the registry command', async () => {
    const writes: string[] = [];

    const result = await handleZavorthCliRegistryOpsCommand({
      runtime: {} as any,
      effectiveFlags: createFlags(true),
      commandName: 'uni',
      normalized: 'uni',
      args: 'uni "aplique patch em src/app.ts"',
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
      contractVersion: '2026-05-04.trust-enforcement',
      source: 'UniversalIntentTrustEnforcementService',
      summary: expect.objectContaining({
        trustLevel: 'collaborator',
        trustDecision: 'requires_permission',
      }),
      policy: expect.objectContaining({
        universalIntentIsSourceOfTruth: true,
        trustSliderEnforcedBeforeExecutor: true,
        secretsSerialized: false,
      }),
    }));
    expect(payload.surface.cliCommand).toContain('zavorth uni');
  });

  it('formats a compact human summary', () => {
    const snapshot = buildUniversalIntentTrustCliSnapshot({
      text: 'aplique um patch em src/app.ts',
      userId: 'grey',
      sessionId: 'session-cli-uni-trust-human',
    });

    const text = formatUniversalIntentTrustSnapshot(snapshot);

    expect(text).toContain('UNI / Trust Slider Enforcement - Channel mesh4');
    expect(text).toContain('Trust Slider e aplicado antes do executor');
    expect(text).toContain('host inteiro exige Overlord');
    expect(text).toContain('Dashboard: /dashboard?sector=config');
  });
});
