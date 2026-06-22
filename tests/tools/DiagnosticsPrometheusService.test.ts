import fs from 'fs';
import os from 'os';
import path from 'path';
import { DiagnosticsPrometheusService } from '../../src/services/plugins/DiagnosticsPrometheusService';

describe('DiagnosticsPrometheusService', () => {
  let service: DiagnosticsPrometheusService;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prometheus-'));
    service = new DiagnosticsPrometheusService({ storageDir: tempDir });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('increments counters', () => {
    service.incrementCounter('test_counter', 1);
    service.incrementCounter('test_counter', 1);
    const json = service.getMetricsJson();
    expect(json).toContain('test_counter');
  });

  it('sets gauges', () => {
    service.setGauge('test_gauge', 42);
    const json = service.getMetricsJson();
    expect(json).toContain('42');
  });

  it('observes histogram values', () => {
    service.observeHistogram('zavorth_tool_duration_seconds', 0.5);
    service.observeHistogram('zavorth_tool_duration_seconds', 1.5);
    const json = service.getMetricsJson();
    expect(json).toContain('zavorth_tool_duration_seconds');
  });

  it('records tool execution', () => {
    service.recordToolExecution('web_search', 150, true);
    service.recordToolExecution('web_search', 200, false);
    const json = service.getMetricsJson();
    expect(json).toContain('zavorth_tool_executions_total');
  });

  it('records channel messages', () => {
    service.recordChannelMessage('telegram', 'sent');
    service.recordChannelMessage('discord', 'received');
    const json = service.getMetricsJson();
    expect(json).toContain('zavorth_channel_messages_sent_total');
  });

  it('exports prometheus format', () => {
    service.incrementCounter('test_c', 5);
    const exported = service.exportPrometheusFormat();
    expect(exported).toContain('# TYPE test_c counter');
    expect(exported).toContain('test_c 5');
  });

  it('exports JSON format', () => {
    const json = service.getMetricsJson();
    const parsed = JSON.parse(json);
    expect(parsed.counters).toBeTruthy();
    expect(parsed.gauges).toBeTruthy();
    expect(parsed.histograms).toBeTruthy();
  });

  it('gets stats', () => {
    const result = service.getStats();
    expect(result).toContain('Prometheus Metrics');
    expect(result).toContain('Counters');
    expect(result).toContain('Gauges');
  });

  it('resets metrics', () => {
    service.incrementCounter('test', 100);
    service.reset();
    const json = service.getMetricsJson();
    expect(json).not.toContain('100');
  });

  it('records approval request', () => {
    service.recordApprovalRequest('denied');
    service.recordApprovalRequest('approved');
    const json = service.getMetricsJson();
    expect(json).toContain('zavorth_approval_requests_total');
  });
});
