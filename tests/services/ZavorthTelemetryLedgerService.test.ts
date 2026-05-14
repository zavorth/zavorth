import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthTelemetryLedgerService } from '../../src/services/ZavorthTelemetryLedgerService.js';

describe('ZavorthTelemetryLedgerService', () => {
  it('summarizes telemetry events into traces, sources and sink posture', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-telemetry-'));
    const filePath = path.join(tempDir, 'telemetry-events.jsonl');
    fs.writeFileSync(
      filePath,
      [
        JSON.stringify({
          timestamp: '2026-04-12T12:00:00.000Z',
          traceId: 'trace-1',
          source: 'telegram',
          eventType: 'tool.started',
          status: 'running',
        }),
        JSON.stringify({
          timestamp: '2026-04-12T12:01:00.000Z',
          traceId: 'trace-1',
          source: 'telegram',
          eventType: 'tool.completed',
          status: 'success',
        }),
        JSON.stringify({
          timestamp: '2026-04-12T12:02:00.000Z',
          traceId: 'trace-2',
          source: 'web',
          eventType: 'execution.blocked',
          status: 'approval_required',
        }),
      ].join('\n'),
      'utf8',
    );

    const service = new ZavorthTelemetryLedgerService({
      filePath,
      now: () => new Date('2026-04-12T12:10:00.000Z'),
      env: {},
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.available).toBe(true);
    expect(snapshot.totalEvents).toBe(3);
    expect(snapshot.traceCount).toBe(2);
    expect(snapshot.blockedEvents).toBe(1);
    expect(snapshot.topSources[0]).toEqual(expect.objectContaining({
      label: 'telegram',
      count: 2,
    }));
    expect(snapshot.traces[0]).toEqual(expect.objectContaining({
      traceId: expect.stringMatching(/^trace:[a-f0-9]{12}$/),
      status: expect.stringMatching(/blocked|completed/),
    }));
    expect(snapshot.sinks.localJsonl).toBe(true);
    expect(snapshot.sinks.externalRequired).toBe(false);
    expect(snapshot.retention).toEqual(expect.objectContaining({
      scannedEvents: 3,
      retainedEvents: 3,
      truncated: false,
    }));
    expect(snapshot.redaction).toEqual(expect.objectContaining({
      mode: 'hashed-references',
      payloadsIncluded: false,
    }));
  });
});
