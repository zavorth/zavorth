import { handleZavorthCliRegistryOpsCommand } from '../../src/cli/ZavorthCliRegistryOps.js';
import {
  buildReleaseCandidatePreCanaryGateCliSnapshot,
  formatReleaseCandidatePreCanaryGateSnapshot,
  resolveReleaseCandidatePreCanaryGateCliText,
} from '../../src/cli/ZavorthCliReleaseCandidatePreCanaryGateRenderer.js';

function createFlags(json: boolean) {
  return {
    command: null,
    repl: false,
    json,
    live: false,
    userId: 'grey',
    platform: 'web' as const,
    chatId: 'web:grey',
    sessionId: 'session-cli-pre-canary',
    workspaceHint: null,
    commandText: null,
  };
}

describe('Zavorth CLI Release Candidate Pre-Canary Gate Pre-Canary Gate', () => {
  it('parses pre-canary text after aliases', () => {
    expect(resolveReleaseCandidatePreCanaryGateCliText('release-candidate-pre-canary "preparar rc"')).toBe('preparar rc');
    expect(resolveReleaseCandidatePreCanaryGateCliText('pre-canary-gate latest')).toBe('');
  });

  it('renders pre-canary JSON through the registry command', async () => {
    const writes: string[] = [];

    const result = await handleZavorthCliRegistryOpsCommand({
      runtime: {} as any,
      effectiveFlags: createFlags(true),
      commandName: 'release-candidate-pre-canary',
      normalized: 'release-candidate-pre-canary',
      args: 'release-candidate-pre-canary "preparar rc"',
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
      contractVersion: '2026-05-04.pre-canary',
      source: 'ReleaseCandidatePreCanaryGateService',
      status: 'pre-canary-ready',
      releaseAdoption: expect.objectContaining({
        ready: true,
        canStartCanary: false,
      }),
      evidencePack: expect.objectContaining({
        evidencePackReady: true,
        passCount: 6,
      }),
      ecosystem: expect.objectContaining({
        ecosystemPublishingReady: true,
        noFormalPartnerClaim: true,
      }),
      autopilot: expect.objectContaining({
        status: 'release_candidate_ready',
        globalRolloutEnabled: false,
        autoPromoteEnabled: false,
      }),
      goNoGo: expect.objectContaining({
        decision: 'go',
        ready: true,
      }),
      policy: expect.objectContaining({
        noCanaryStarted: true,
        noRolloutStarted: true,
        goNoGoRequiresExplicitApproval: true,
      }),
    }));
    expect(payload.surface.cliCommand).toContain('zavorth release-candidate-pre-canary');
  });

  it('formats a compact human summary', () => {
    const snapshot = buildReleaseCandidatePreCanaryGateCliSnapshot({
      text: 'preparar rc',
      userId: 'grey',
      sessionId: 'session-cli-pre-canary-human',
    });

    const text = formatReleaseCandidatePreCanaryGateSnapshot(snapshot);

    expect(text).toContain('Release Candidate / Pre-Canary Gate - Pre-Canary Gate');
    expect(text).toMatch(/canary|nao foi iniciado|not started|Pre-Canary/i);
    expect(text).toContain('rollout nao foi iniciado');
    expect(text).toContain('go/no-go exige aprovacao explicita');
    expect(text).toContain('Dashboard: /zavorthControl?runId=');
  });
});
