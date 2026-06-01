import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { VoiceWakeRuntimeService } from '../../src/services/VoiceWakeRuntimeService.js';

describe('VoiceWakeRuntimeService', () => {
  let root: string;
  let nowMs: number;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-wake-'));
    nowMs = Date.parse('2026-05-31T12:00:00.000Z');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('is off by default, arms with TTL, expires, and never persists raw audio', () => {
    const service = runtime();

    expect(service.status().mode).toBe('off');
    const armed = service.arm(60_000);
    expect(armed.mode).toBe('armed');
    expect(armed.detector.configured).toBe(true);
    expect(armed.privacy.rawAudioPersisted).toBe(false);

    nowMs += 61_000;
    const expired = service.status();
    expect(expired.mode).toBe('off');
    expect(expired.lastReceipt?.event).toBe('expired');
    expect(JSON.stringify(expired)).not.toMatch(/rawAudio[^P]/u);
  });

  it('captures local wake events and stores only transcript receipts', () => {
    const service = runtime();
    service.arm(120_000);
    expect(service.handleEvent({ type: 'wake' }).mode).toBe('listening');
    expect(service.handleEvent({ type: 'capture_started' }).mode).toBe('capturing');
    const committed = service.handleEvent({ type: 'transcript', transcript: 'open tasks' });

    expect(committed.mode).toBe('cooldown');
    expect(committed.lastReceipt).toEqual(expect.objectContaining({
      event: 'transcript_committed',
      transcript: 'open tasks',
      rawAudioPersisted: false,
    }));
  });

  it('auto-disarms on screen lock or sensitive profile switch', () => {
    const service = runtime();
    service.arm(120_000);
    expect(service.handleEvent({ type: 'sensitive_profile' }).mode).toBe('off');

    service.arm(120_000);
    expect(service.handleEvent({ type: 'lock_screen' }).lastReceipt?.summary).toContain('screen was locked');
  });

  function runtime() {
    return new VoiceWakeRuntimeService({
      stateFile: path.join(root, 'runtime', 'voice-wake-session.json'),
      env: {
        ZAVORTH_WAKE_COMMAND: 'local-wake',
        ZAVORTH_WAKE_ARGS: '--model small',
      },
      now: () => new Date(nowMs),
      sessionId: 'test-session',
    });
  }
});
