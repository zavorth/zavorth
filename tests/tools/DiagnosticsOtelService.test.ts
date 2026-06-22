import fs from 'fs';
import os from 'os';
import path from 'path';
import { DiagnosticsOtelService } from '../../src/services/plugins/DiagnosticsOtelService';

describe('DiagnosticsOtelService', () => {
  let service: DiagnosticsOtelService;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'otel-test-'));
    service = new DiagnosticsOtelService({ storageDir: tempDir });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('starts and ends a span', () => {
    const spanId = service.startSpan('test-span', { kind: 'internal' });
    expect(spanId).toBeTruthy();
    const result = service.endSpan(spanId, 'ok');
    expect(result).toContain('finalizado');
  });

  it('creates parent-child spans', () => {
    const parentId = service.startSpan('parent');
    const childId = service.startSpan('child', { parent_span_id: parentId });
    expect(childId).toBeTruthy();
    service.endSpan(childId);
    service.endSpan(parentId);
  });

  it('adds events to a span', () => {
    const spanId = service.startSpan('test');
    const result = service.addSpanEvent(spanId, 'my-event', { key: 'value' });
    expect(result).toContain('adicionado');
    service.endSpan(spanId);
  });

  it('lists active spans', () => {
    service.startSpan('span1');
    service.startSpan('span2');
    const result = service.getActiveSpans();
    expect(result).toContain('2');
  });

  it('records metrics', () => {
    service.recordMetric('requests', { type: 'counter', value: 1 });
    service.recordMetric('requests', { type: 'counter', value: 1 });
    const result = service.getMetrics();
    expect(result).toContain('requests');
    expect(result).toContain('2');
  });

  it('records gauge metrics', () => {
    service.recordMetric('cpu_usage', { type: 'gauge', value: 45.5 });
    const result = service.getMetrics();
    expect(result).toContain('45.5');
  });

  it('logs entries', () => {
    service.log('info', 'System started');
    service.log('error', 'Something failed');
    const result = service.getLogs();
    expect(result).toContain('System started');
    expect(result).toContain('Something failed');
  });

  it('filters logs by severity', () => {
    service.log('info', 'Info message');
    service.log('error', 'Error message');
    const result = service.getLogs({ severity: 'error' });
    expect(result).toContain('Error message');
    expect(result).not.toContain('Info message');
  });

  it('gets stats', () => {
    service.startSpan('test');
    service.recordMetric('test', { type: 'counter' });
    service.log('info', 'test');
    const result = service.getStats();
    expect(result).toContain('Spans');
    expect(result).toContain('Metricas');
    expect(result).toContain('Logs');
  });

  it('exports to OTEL format', () => {
    service.startSpan('test');
    const exported = service.exportToOtelFormat();
    const parsed = JSON.parse(exported);
    expect(parsed.resourceSpans).toBeTruthy();
  });

  it('flushes data', () => {
    service.startSpan('test');
    service.log('info', 'test');
    const result = service.flush();
    expect(result).toContain('Flush completo');
  });
});
