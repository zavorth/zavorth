import fs from 'fs';
import os from 'os';
import path from 'path';
import { CodexRemoteSessionStoreService } from '../../src/services/CodexRemoteSessionStoreService';
import { CodexRemoteSessionBrokerService } from '../../src/services/CodexRemoteSessionBrokerService';

describe('CodexRemoteSessionBrokerService', () => {
  it('creates a session through the broker and exposes live presence and guardrail details', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-codex-remote-broker-'));
    const store = new CodexRemoteSessionStoreService({
      now: () => new Date('2026-04-07T18:20:00.000Z'),
      stateFilePath: path.join(tempDir, 'codex-remote-sessions', 'index.json'),
    });
    const broker = new CodexRemoteSessionBrokerService({
      profileRegistryService: {
        resolveExecutionProfile: jest.fn(() => ({
          id: 'default',
          label: 'Default Codex',
          description: 'padrao',
          codexCliPath: 'C:\\Codex\\codex.exe',
          codexHome: 'C:\\Users\\ermys\\.codex',
          workspaceRoot: tempDir,
          enabled: true,
          active: true,
          source: 'default',
        })),
        buildSnapshot: jest.fn(() => ({
          activeProfileId: 'default',
          profiles: [{ id: 'default', enabled: true }],
        })),
      } as any,
      sessionStoreService: store,
      sidecarService: {
        startSession: jest.fn(async ({ sessionId }) => store.updateSession(sessionId, {
          status: 'running',
          pid: 4242,
          lastHeartbeatAt: '2026-04-07T18:20:00.000Z',
          metadata: {
            codexRemotePresence: {
              state: 'running',
              alive: true,
              pid: 4242,
              runtimeSeconds: 0,
              heartbeatAgeMs: 0,
              lastHeartbeatAt: '2026-04-07T18:20:00.000Z',
              stale: false,
              observedAt: '2026-04-07T18:20:00.000Z',
            },
            codexRemoteGuardrails: {
              timeoutSeconds: 1800,
              remainingSeconds: 1800,
              deadlineAt: '2026-04-07T18:50:00.000Z',
              staleAfterMs: 15000,
              state: 'healthy',
              summary: 'Guardrail saudavel; faltam 1800s de 1800s.',
            },
          },
        })),
        stopSession: jest.fn(async (sessionId) => store.updateSession(sessionId, { status: 'stopped' })),
        readTail: jest.fn(async (sessionId) => ({
          sessionId,
          status: 'running',
          logLines: ['working'],
          lastOutput: null,
          lastError: null,
        })),
        ensureSessionFresh: jest.fn(async (sessionId) => store.getSession(sessionId)!),
      } as any,
      gatewaySessionStoreService: {
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

    const started = await broker.startSession({
      prompt: 'monitor the migration',
      requestedBy: 'telegram-user',
    });
    expect(started.record.status).toBe('running');

    const handoff = broker.openWebSession({
      sessionId: started.record.sessionId,
      runtimeUserId: 'web-user',
    });
    const inspected = await broker.readSession(started.record.sessionId);

    expect(handoff.sessionId).toBe('session-web-1');
    expect(inspected?.record.handoffCommand).toBe('/open-session session-web-1');
    expect(inspected?.canStop).toBe(true);
    expect(inspected?.presence).toEqual(
      expect.objectContaining({
        state: 'running',
        alive: true,
        stale: false,
      }),
    );
    expect(inspected?.guardrails).toEqual(
      expect.objectContaining({
        state: 'healthy',
        summary: expect.stringContaining('Guardrail'),
      }),
    );
    expect(inspected?.visibility).toEqual(
      expect.objectContaining({
        mode: 'full-user-visible',
        pendingApprovals: 0,
      }),
    );
  });
});
