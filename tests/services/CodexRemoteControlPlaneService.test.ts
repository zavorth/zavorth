import { CodexRemoteControlPlaneService } from '../../src/services/CodexRemoteControlPlaneService';

describe('CodexRemoteControlPlaneService', () => {
  it('builds a monitor snapshot with active profile and remote transport summary', async () => {
    const service = new CodexRemoteControlPlaneService({
      now: () => new Date('2026-04-07T12:00:00.000Z'),
      codexCliAdapter: {
        isAvailable: jest.fn(async () => true),
      },
      powerShellBrokerClient: {
        probe: jest.fn(async () => ({ available: true })),
        brokerLockExists: jest.fn(() => false),
      } as any,
      profileRegistryService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-07T12:00:00.000Z',
          activeProfileId: 'default',
          profiles: [
            {
              id: 'default',
              label: 'Default Codex',
              description: 'Perfil pattern',
              codexCliPath: 'C:\\Codex\\codex.exe',
              codexHome: 'C:\\Users\\ermys\\.codex',
              workspaceRoot: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
              enabled: true,
              active: true,
              source: 'default',
            },
          ],
          narrative: {
            headline: 'Codex Remote',
            operatorSummary: 'Perfil pattern active.',
          },
        })),
        resolveExecutionProfile: jest.fn(() => ({
          id: 'default',
          label: 'Default Codex',
          description: 'Perfil pattern',
          codexCliPath: 'C:\\Codex\\codex.exe',
          codexHome: 'C:\\Users\\ermys\\.codex',
          workspaceRoot: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
          enabled: true,
          active: true,
          source: 'default',
        })),
      } as any,
      remoteTransportService: {
        buildSnapshot: jest.fn(() => ({
          entries: [
            {
              id: 'AIGateway',
              label: 'AIGateway',
              readiness: 'ready',
              available: true,
              endpoint: 'http://127.0.0.1:21128/v1',
              operatorSummary: 'Sidecar ready.',
            },
            {
              id: 'discord-transport',
              label: 'Discord transport',
              readiness: 'partial',
              available: false,
              endpoint: null,
              operatorSummary: 'Bridge in rollout.',
            },
          ],
        })),
      } as any,
      sessionStoreService: {
        canSpawn: jest.fn(() => true),
        createSession: jest.fn(() => ({
          ok: true,
          platform: 'web',
          sessionId: 'session-web-1',
          chatId: 'web:session-web-1',
          sourceUserId: 'session-web-1',
          runtimeUserId: 'web-user',
          handoffCommand: '/open-session session-web-1',
        })),
      } as any,
    });

    const snapshot = await service.buildSnapshot({ runtimeUserId: 'web-user' });

    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        cliReady: true,
        activeProfileId: 'default',
        profiles: 1,
        readyRemotePaths: 1,
        partialRemotePaths: 1,
        webSpawnReady: true,
        visibilityMode: 'full-user-visible',
      }),
    );
    expect(snapshot.visibility).toEqual(
      expect.objectContaining({
        mode: 'full-user-visible',
      }),
    );
    expect(snapshot.handoff.webDraft).toEqual(
      expect.objectContaining({
        sessionId: 'session-web-1',
      }),
    );
    expect(snapshot.remotePaths).toHaveLength(2);
  });
});
