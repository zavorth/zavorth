import { handleZavorthCliRegistryOpsCommand } from '../../src/cli/ZavorthCliRegistryOps.js';
import {
  buildPublicAdoptionPilotLoopCliSnapshot,
  formatPublicAdoptionPilotLoopSnapshot,
  resolvePublicAdoptionPilotLoopCliText,
} from '../../src/cli/ZavorthCliPublicAdoptionPilotLoopRenderer.js';

function createFlags(json: boolean) {
  return {
    command: null,
    repl: false,
    json,
    live: false,
    userId: 'grey',
    platform: 'web' as const,
    chatId: 'web:grey',
    sessionId: 'session-cli-public-adoption-pilot',
    workspaceHint: null,
    commandText: null,
  };
}

describe('Zavorth CLI Public Adoption Pilot Loop Public Adoption Pilot', () => {
  it('parses public-adoption-pilot-loop text after aliases', () => {
    expect(resolvePublicAdoptionPilotLoopCliText('public-adoption-pilot-loop "piloto controlado"')).toBe('piloto controlado');
    expect(resolvePublicAdoptionPilotLoopCliText('pilot-feedback-loop latest')).toBe('');
  });

  it('renders public adoption pilot loop JSON through the registry command', async () => {
    const writes: string[] = [];

    const result = await handleZavorthCliRegistryOpsCommand({
      runtime: {} as any,
      effectiveFlags: createFlags(true),
      commandName: 'public-adoption-pilot-loop',
      normalized: 'public-adoption-pilot-loop',
      args: 'public-adoption-pilot-loop "piloto controlado"',
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
      contractVersion: '2026-05-04.adoption-pilot',
      source: 'PublicAdoptionPilotLoopService',
      status: 'pilot-ready',
      readiness: expect.objectContaining({
        feedbackProductLoopReady: true,
        pilotLoopContractLinked: true,
        canStartControlledPilot: true,
        canCollectPublicFeedback: true,
        canPublishPilotMetrics: true,
      }),
      policy: expect.objectContaining({
        noImplicitCollection: true,
        noTelemetryEnabled: true,
        noExternalSubmission: true,
        noWorkspacePayloadStored: true,
        dashboardAggregatedOnly: true,
      }),
    }));
    expect(payload.surface.cliCommand).toContain('zavorth public-adoption-pilot-loop');
  });

  it('formats a compact human summary', () => {
    const snapshot = buildPublicAdoptionPilotLoopCliSnapshot({
      text: 'piloto controlado',
      userId: 'grey',
      sessionId: 'session-cli-public-adoption-pilot-human',
    });

    const text = formatPublicAdoptionPilotLoopSnapshot(snapshot);

    expect(text).toContain('Public Adoption / Pilot Feedback Loop - Public Adoption Pilot');
    expect(text).toMatch(/collection|implicit|not enabled|Public Adoption|pilot/i);
    expect(text).toContain('workspace payload was not stored');
    expect(text).toContain('zavorthControl uses only aggregates');
    expect(text).toContain('Dashboard: /zavorthControl?runId=');
  });
});
