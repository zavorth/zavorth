import fs from 'fs';
import os from 'os';
import path from 'path';
import { EchoVoiceTelemetryService } from '../../src/domain/observability/infrastructure/EchoVoiceTelemetryService.js';

describe('EchoVoiceTelemetryService', () => {
  it('aggregates requests, latency, and known cost by surface', async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zavorth-voice-telemetry-'));
    const ledgerFile = path.join(tempDir, 'telemetry-events.jsonl');
    const service = new EchoVoiceTelemetryService({ filePath: ledgerFile });

    await service.recordSuccess({
      traceId: 'voice-1',
      surface: 'telegram',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      voiceName: 'Kore',
      languageCode: 'en-US',
      inputChars: 120,
      latencyMs: 300,
      estimatedCostUsd: 0.002,
    });
    await service.recordSuccess({
      traceId: 'voice-2',
      surface: 'agent',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      voiceName: 'Kore',
      languageCode: 'en-US',
      inputChars: 80,
      latencyMs: 200,
    });
    await service.recordFailure({
      traceId: 'voice-3',
      surface: 'telegram',
      provider: 'edge-tts',
      inputChars: 40,
      latencyMs: 25,
      estimatedCostUsd: 0,
      error: 'edge-tts missing',
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.totalRequests).toBe(3);
    expect(snapshot.successes).toBe(2);
    expect(snapshot.failures).toBe(1);
    expect(snapshot.totalInputChars).toBe(240);
    expect(snapshot.averageLatencyMs).toBe(175);
    expect(snapshot.knownCostUsd).toBe(0.002);
    expect(snapshot.unknownCostRequests).toBe(1);
    expect(snapshot.surfaces).toEqual([
      expect.objectContaining({
        surface: 'telegram',
        requests: 2,
        successes: 1,
        failures: 1,
        providers: ['edge-tts', 'gemini'],
      }),
      expect.objectContaining({
        surface: 'agent',
        requests: 1,
        successes: 1,
        failures: 0,
        providers: ['gemini'],
      }),
    ]);

    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });
});
