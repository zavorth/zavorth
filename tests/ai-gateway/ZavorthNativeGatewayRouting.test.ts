import { applyZavorthContextCompression } from '../../src/zavorth-control/lib/zavorthContextCompression';
import { executeZavorthBatchJsonl } from '../../src/zavorth-control/lib/zavorthBatchWorker';
import { runZavorthCompressionBenchmark } from '../../src/zavorth-control/lib/zavorthCompressionBenchmark';
import { RequestTelemetry, getTelemetrySummary, recordTelemetry } from '../../src/zavorth-control/shared/utils/requestTelemetry';

describe('Zavorth native gateway routing layer', () => {
  it('compresses oversized chat context without dropping latest user intent', () => {
    const latest = 'Please summarize the exact next safe step.';
    const result = applyZavorthContextCompression({
      model: 'auto',
      messages: [
        { role: 'system', content: 'You are Zavorth.' },
        { role: 'user', content: 'noise\n'.repeat(50000) },
        { role: 'user', content: latest },
      ],
    });

    expect(result.applied).toBe(true);
    expect(JSON.stringify(result.body)).toContain(latest);
    expect(result.compressedBytes).toBeLessThan(result.originalBytes);
  });

  it('deduplicates repeated middle context while preserving system and latest messages', () => {
    const latest = 'Keep this final instruction exactly.';
    const repeated = 'same retrieved document\n'.repeat(4000);
    const result = applyZavorthContextCompression({
      model: 'auto',
      zavorth_compression: true,
      messages: [
        { role: 'system', content: 'System policy stays.' },
        { role: 'user', content: repeated },
        { role: 'user', content: repeated },
        { role: 'user', content: latest },
      ],
    });

    const messages = (result.body.messages || []) as Array<{ content: string }>;
    expect(messages).toHaveLength(3);
    expect(JSON.stringify(result.body)).toContain('System policy stays.');
    expect(JSON.stringify(result.body)).toContain(latest);
    expect(JSON.stringify(result.body)).toContain('"deduplicatedMessages":1');
  });

  it('keeps telemetry phase breakdown populated by stage', () => {
    const telemetry = new RequestTelemetry('test-gateway-routing');
    telemetry.startPhase('parse');
    telemetry.endPhase();
    recordTelemetry(telemetry);

    const summary = getTelemetrySummary(60_000);

    expect(summary.count).toBeGreaterThan(0);
    expect(summary.phaseBreakdown.parse.count).toBeGreaterThan(0);
  });

  it('executes batch JSONL with retry/backoff and stable request counts', async () => {
    const sleeps: number[] = [];
    let calls = 0;
    const result = await executeZavorthBatchJsonl({
      endpoint: '/v1/chat/completions',
      jsonl: [
        JSON.stringify({ custom_id: 'a', method: 'POST', url: '/v1/chat/completions', body: { model: 'auto' } }),
        JSON.stringify({ custom_id: 'b', method: 'POST', url: '/v1/chat/completions', body: { model: 'auto' } }),
      ].join('\n'),
      options: {
        concurrency: 2,
        maxRetries: 1,
        backoffMs: 7,
        now: () => 100,
        sleep: async (ms) => {
          sleeps.push(ms);
        },
      },
      dispatch: async ({ id }) => {
        calls += 1;
        if (id === 'a' && calls === 1) {
          return { ok: false, status: 429, body: { error: 'retry me' } };
        }
        return { ok: true, status: 200, body: { id } };
      },
    });

    expect(result.requestCounts).toEqual({ total: 2, completed: 2, failed: 0 });
    expect(result.attempts).toBe(3);
    expect(result.maxConcurrency).toBe(2);
    expect(sleeps).toEqual([7]);
    expect(result.outputLines).toHaveLength(2);
  });

  it('runs a compression benchmark that preserves latest intent and saves context', () => {
    const benchmark = runZavorthCompressionBenchmark();

    expect(benchmark.passed).toBe(true);
    expect(benchmark.totalSavedBytes).toBeGreaterThan(0);
    expect(benchmark.cases.every((entry) => entry.latestIntentPreserved)).toBe(true);
  });
});
