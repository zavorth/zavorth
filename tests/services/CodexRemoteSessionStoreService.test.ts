import fs from 'fs';
import os from 'os';
import path from 'path';
import { CodexRemoteSessionStoreService } from '../../src/services/CodexRemoteSessionStoreService';

describe('CodexRemoteSessionStoreService', () => {
  it('creates, updates and appends events for Codex Remote sessions with runtime metadata', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-codex-remote-store-'));
    const service = new CodexRemoteSessionStoreService({
      now: () => new Date('2026-04-07T18:00:00.000Z'),
      stateFilePath: path.join(tempDir, 'index.json'),
    });

    const session = service.createSession({
      prompt: 'continue from the last phase',
      profileId: 'default',
      workspaceRoot: 'C:\\repo',
      requestedBy: 'telegram-user',
      sourceSurface: 'telegram',
      metadata: {
        custom: {
          keepMe: true,
        },
      },
    });

    const updated = service.updateSession(session.sessionId, {
      status: 'running',
      pid: 4242,
      metadata: {
        custom: {
          extra: 'value',
        },
      },
    });
    const appended = service.appendEvent(session.sessionId, {
      type: 'started',
      message: 'Sessao iniciada.',
    });

    expect(updated.status).toBe('running');
    expect(appended.events.slice(-1)[0]).toEqual(
      expect.objectContaining({
        type: 'started',
        message: 'Sessao iniciada.',
      }),
    );
    expect(session.metadata).toEqual(
      expect.objectContaining({
        custom: {
          keepMe: true,
        },
        codexRemotePresence: expect.objectContaining({
          state: 'draft',
          stale: false,
        }),
        codexRemoteGuardrails: expect.objectContaining({
          timeoutSeconds: null,
          staleAfterMs: expect.any(Number),
        }),
      }),
    );
    expect(updated.metadata).toEqual(
      expect.objectContaining({
        custom: {
          keepMe: true,
          extra: 'value',
        },
      }),
    );
    expect(service.listSessions()).toHaveLength(1);
    expect(service.getSession(session.sessionId)?.pid).toBe(4242);
  });
});
