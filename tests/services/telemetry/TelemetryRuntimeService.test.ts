import fs from 'fs';
import os from 'os';
import path from 'path';
import { TelemetryRuntimeService } from '../../../src/services/telemetry/TelemetryRuntimeService';

describe('TelemetryRuntimeService', () => {
  it('appends structured events to a local jsonl file', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-telemetry-'));
    const outputFile = path.join(tempDir, 'telemetry-events.jsonl');
    const service = new TelemetryRuntimeService(outputFile);

    await service.record({
      traceId: 'trace-1',
      source: 'graph-runtime',
      eventType: 'graph.started',
      status: 'running',
      payload: { providerName: 'AIGateway' },
    });

    const lines = fs.readFileSync(outputFile, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(1);

    const event = JSON.parse(lines[0]);
    expect(event.traceId).toBe('trace-1');
    expect(event.eventType).toBe('graph.started');
    expect(event.payload.providerName).toBe('AIGateway');
  });

  it('redacts secret-like strings before writing telemetry jsonl', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-telemetry-'));
    const outputFile = path.join(tempDir, 'telemetry-events.jsonl');
    const service = new TelemetryRuntimeService(outputFile);

    await service.record({
      traceId: 'trace-secret',
      source: 'tool-runtime',
      eventType: 'tool.failed',
      status: 'failed',
      payload: {
        message: 'provider failed with sk-test12345678901234567890',
        nested: {
          authorization: 'Bearer abcdefghijklmnopqrstuvwxyz123456',
        },
      },
    });

    const serialized = fs.readFileSync(outputFile, 'utf8');
    expect(serialized).not.toContain('sk-test12345678901234567890');
    expect(serialized).not.toContain('abcdefghijklmnopqrstuvwxyz123456');
    expect(serialized).toContain('[redacted-secret]');
    expect(serialized).toContain('***');
  });
});
