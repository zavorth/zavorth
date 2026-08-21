import { handleZavorthCliRegistryOpsCommand } from '../../src/cli/ZavorthCliRegistryOps.js';
import {
  buildReleaseAdoptionReadinessCliSnapshot,
  formatReleaseAdoptionReadinessSnapshot,
  resolveReleaseAdoptionReadinessCliText,
} from '../../src/cli/ZavorthCliReleaseAdoptionReadinessRenderer.js';

function createFlags(json: boolean) {
  return {
    command: null,
    repl: false,
    json,
    live: false,
    userId: 'grey',
    platform: 'web' as const,
    chatId: 'web:grey',
    sessionId: 'session-cli-release-adoption',
    workspaceHint: null,
    commandText: null,
  };
}

describe('Zavorth CLI Release Adoption Readiness Release Adoption Readiness', () => {
  it('parses release-adoption-readiness text after aliases', () => {
    expect(resolveReleaseAdoptionReadinessCliText('release-adoption-readiness "adocao publica"')).toBe('adocao publica');
    expect(resolveReleaseAdoptionReadinessCliText('support-readiness latest')).toBe('');
  });

  it('renders release adoption JSON through the registry command', async () => {
    const writes: string[] = [];

    const result = await handleZavorthCliRegistryOpsCommand({
      runtime: {} as any,
      effectiveFlags: createFlags(true),
      commandName: 'release-adoption-readiness',
      normalized: 'release-adoption-readiness',
      args: 'release-adoption-readiness "adocao publica"',
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
      contractVersion: '2026-05-04.release-readiness',
      source: 'ReleaseAdoptionReadinessService',
      status: 'release-adoption-ready',
      releaseTrain: expect.objectContaining({
        status: 'ready',
        policyCount: 4,
      }),
      publicAdoption: expect.objectContaining({
        readinessScore: 95,
        claimCount: 5,
      }),
      readiness: expect.objectContaining({
        canOpenPublicAdoption: true,
        canStartCanary: false,
      }),
      policy: expect.objectContaining({
        noDeployExecuted: true,
        noCanaryStarted: true,
        adoptionMetricsAggregatedOnly: true,
      }),
    }));
    expect(payload.surface.cliCommand).toContain('zavorth release-adoption-readiness');
  });

  it('formats a compact human summary', () => {
    const snapshot = buildReleaseAdoptionReadinessCliSnapshot({
      text: 'adocao publica',
      userId: 'grey',
      sessionId: 'session-cli-release-adoption-human',
    });

    const text = formatReleaseAdoptionReadinessSnapshot(snapshot);

    expect(text).toContain('Release & Adoption Readiness - Release Adoption Readiness');
    expect(text).toMatch(/deploy|not executed|Adoption Readiness/i);
    expect(text).toMatch(/canary|not started|Pre-Canary/i);
    expect(text).toContain('metrics are aggregated');
    expect(text).toContain('Dashboard: /zavorthControl?runId=');
  });
});
