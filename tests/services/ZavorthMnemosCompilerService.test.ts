import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthMnemosCompilerService } from '../../src/services/ZavorthMnemosCompilerService';
import type { WebRealtimeEvent } from '../../src/services/WebRealtimeService';

describe('ZavorthMnemosCompilerService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('correctly ingests and persists structured lifecycle events', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mnemos-compiler-'));
    tempDirs.push(tempDir);

    const service = new ZavorthMnemosCompilerService({
      now: () => new Date('2026-05-31T12:00:00.000Z'),
    });

    const sessionId = 'test-session-123';

    // Ingest a message event
    const messageEvent: WebRealtimeEvent = {
      id: 'evt-1',
      type: 'message',
      createdAt: '2026-05-31T12:00:00.000Z',
      payload: {
        id: 'msg-1',
        role: 'user',
        content: 'Hello Zavorth, here is a secret api_key: sk-1234567890abcdef12345678',
        taskId: 'task-1',
        kind: 'input',
      },
    };

    const ingested = service.ingestEvent(tempDir, sessionId, messageEvent);
    expect(ingested).not.toBeNull();
    expect(ingested!.sessionId).toBe(sessionId);
    expect(ingested!.type).toBe('message');
    expect(ingested!.payload.content).toContain('api_key=[redacted-secret]');
    expect(ingested!.payload.content).toContain('[redacted-secret]');

    // Read events back and verify persistence
    const events = service.readEvents(tempDir);
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe('evt-1');
    expect(events[0].payload.content).toContain('api_key=[redacted-secret]');
  });

  it('correctly filters out ping events', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mnemos-compiler-ping-'));
    tempDirs.push(tempDir);

    const service = new ZavorthMnemosCompilerService();
    const pingEvent: WebRealtimeEvent = {
      id: 'ping-1',
      type: 'ping',
      createdAt: '2026-05-31T12:00:00.000Z',
      payload: { sessionId: 'session-123' },
    };

    const ingested = service.ingestEvent(tempDir, 'session-123', pingEvent);
    expect(ingested).toBeNull();

    const events = service.readEvents(tempDir);
    expect(events).toHaveLength(0);
  });

  it('supports clearing events', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mnemos-compiler-clear-'));
    tempDirs.push(tempDir);

    const service = new ZavorthMnemosCompilerService();
    const messageEvent: WebRealtimeEvent = {
      id: 'evt-2',
      type: 'message',
      createdAt: '2026-05-31T12:00:00.000Z',
      payload: {
        id: 'msg-2',
        role: 'assistant',
        content: 'Response',
      },
    };

    service.ingestEvent(tempDir, 'session-123', messageEvent);
    expect(service.readEvents(tempDir)).toHaveLength(1);

    service.clearEvents(tempDir);
    expect(service.readEvents(tempDir)).toHaveLength(0);
  });

  it('keeps only the last 1000 items in the log file', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mnemos-compiler-limit-'));
    tempDirs.push(tempDir);

    const service = new ZavorthMnemosCompilerService({
      now: () => new Date('2026-05-31T12:00:00.000Z'),
    });

    // Ingest 1005 events
    for (let i = 0; i < 1005; i++) {
      const messageEvent: WebRealtimeEvent = {
        id: `evt-${i}`,
        type: 'message',
        createdAt: '2026-05-31T12:00:00.000Z',
        payload: {
          id: `msg-${i}`,
          role: 'user',
          content: `message ${i}`,
        },
      };
      service.ingestEvent(tempDir, 'session-123', messageEvent);
    }

    const events = service.readEvents(tempDir);
    expect(events).toHaveLength(1000);
    // The first 5 events (0 to 4) should have been sliced out, so the first event is evt-5
    expect(events[0].id).toBe('evt-5');
    expect(events[999].id).toBe('evt-1004');
  });
});
