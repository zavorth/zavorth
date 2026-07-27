import { handleZavorthCliRegistryOpsCommand } from '../../src/cli/ZavorthCliRegistryOps.js';
import {
  buildIntegrationShowcasePartnerSurfaceCliSnapshot,
  formatIntegrationShowcasePartnerSurfaceSnapshot,
  resolveIntegrationShowcasePartnerSurfaceCliText,
} from '../../src/cli/ZavorthCliIntegrationShowcasePartnerSurfaceRenderer.js';

function createFlags(json: boolean) {
  return {
    command: null,
    repl: false,
    json,
    live: false,
    userId: 'grey',
    platform: 'web' as const,
    chatId: 'web:grey',
    sessionId: 'session-cli-integration-showcase',
    workspaceHint: null,
    commandText: null,
  };
}

describe('Zavorth CLI Integration Showcase Partner Surface Integration Showcase', () => {
  it('parses integration-showcase-partner-surface text after aliases', () => {
    expect(resolveIntegrationShowcasePartnerSurfaceCliText('integration-showcase-partner-surface "showcase seguro"')).toBe('showcase seguro');
    expect(resolveIntegrationShowcasePartnerSurfaceCliText('partner-surface latest')).toBe('');
  });

  it('renders integration showcase JSON through the registry command', async () => {
    const writes: string[] = [];

    const result = await handleZavorthCliRegistryOpsCommand({
      runtime: {} as any,
      effectiveFlags: createFlags(true),
      commandName: 'integration-showcase-partner-surface',
      normalized: 'integration-showcase-partner-surface',
      args: 'integration-showcase-partner-surface "showcase seguro"',
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
      contractVersion: '2026-05-04.integration-showcase',
      source: 'IntegrationShowcasePartnerSurfaceService',
      status: 'showcase-ready',
      showcase: expect.objectContaining({
        vendorCount: 4,
        fixtureReadyCount: 4,
      }),
      readiness: expect.objectContaining({
        publicAdoptionPilotLoopReady: true,
        integrationShowcaseLinked: true,
        trustPlaneReady: true,
        canPublishShowcasePreview: true,
        canClaimFormalPartner: false,
      }),
      policy: expect.objectContaining({
        noFormalPartnerClaimWithoutRegistry: true,
        noCredentialRequiredForFixture: true,
        noNetworkRequiredForFixture: true,
        partnerSurfaceAuditable: true,
      }),
    }));
    expect(payload.surface.cliCommand).toContain('zavorth integration-showcase-partner-surface');
  });

  it('formats a compact human summary', () => {
    const snapshot = buildIntegrationShowcasePartnerSurfaceCliSnapshot({
      text: 'showcase seguro',
      userId: 'grey',
      sessionId: 'session-cli-integration-showcase-human',
    });

    const text = formatIntegrationShowcasePartnerSurfaceSnapshot(snapshot);

    expect(text).toContain('Integration Showcase / Partner Surface - Integration Showcase');
    expect(text).toMatch(/fixture|credencial|credential|Integration Showcase/i);
    expect(text).toContain('fixture does not call network');
    expect(text).toContain('compatibilidade tecnica not vira parceria formal');
    expect(text).toContain('Dashboard: /zavorthControl-runId=');
  });
});
