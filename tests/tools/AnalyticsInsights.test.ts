import fs from 'fs';
import os from 'os';
import path from 'path';
import { UsageAnalyticsService } from '../../src/services/plugins/UsageAnalyticsService';
import { CostAnalyticsService } from '../../src/services/plugins/CostAnalyticsService';
import { QualityMetricsService } from '../../src/services/plugins/QualityMetricsService';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'analytics-'));

describe('UsageAnalyticsService', () => {
  let svc: UsageAnalyticsService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new UsageAnalyticsService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('records usage', () => {
    const r = svc.record({ tool: 'zavorth_vision', action: 'analyze', provider: 'gemini', model: 'gemini-2.0-flash', tokens_in: 100, tokens_out: 500, latency_ms: 2000, success: true, user: 'test', cost_estimate: 0.001 });
    expect(r).toContain('Recorded');
  });

  it('gets stats', () => {
    svc.record({ tool: 'test', action: 'run', provider: 'openai', model: 'gpt-4o', tokens_in: 10, tokens_out: 20, latency_ms: 100, success: true, user: 'test', cost_estimate: 0.001 });
    const r = svc.getStats();
    expect(r).toContain('Total calls: 1');
  });

  it('gets top tools', () => {
    svc.record({ tool: 'a', action: 'x', provider: 'p', model: 'm', tokens_in: 0, tokens_out: 0, latency_ms: 0, success: true, user: 'test', cost_estimate: 0 });
    svc.record({ tool: 'a', action: 'x', provider: 'p', model: 'm', tokens_in: 0, tokens_out: 0, latency_ms: 0, success: true, user: 'test', cost_estimate: 0 });
    const r = svc.getTopTools();
    expect(r).toContain('a: 2 calls');
  });

  it('gets daily summary', () => {
    svc.record({ tool: 'test', action: 'run', provider: 'p', model: 'm', tokens_in: 10, tokens_out: 20, latency_ms: 100, success: true, user: 'test', cost_estimate: 0.001 });
    const r = svc.getDailySummary();
    expect(r).toContain('calls');
  });
});

describe('CostAnalyticsService', () => {
  let svc: CostAnalyticsService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new CostAnalyticsService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('records cost', () => {
    const r = svc.record({ provider: 'openai', model: 'gpt-4o', tokens_in: 100, tokens_out: 200, cost: 0.005, task_type: 'chat' });
    expect(r).toContain('Cost recorded');
  });

  it('gets stats', () => {
    svc.record({ provider: 'openai', model: 'gpt-4o', tokens_in: 100, tokens_out: 200, cost: 0.005, task_type: 'chat' });
    const r = svc.getStats();
    expect(r).toContain('Total cost');
  });

  it('gets cost by provider', () => {
    svc.record({ provider: 'openai', model: 'gpt-4o', tokens_in: 100, tokens_out: 200, cost: 0.005, task_type: 'chat' });
    const r = svc.getCostByProvider();
    expect(r).toContain('openai');
  });

  it('gets cost by model', () => {
    svc.record({ provider: 'openai', model: 'gpt-4o', tokens_in: 100, tokens_out: 200, cost: 0.005, task_type: 'chat' });
    const r = svc.getCostByModel();
    expect(r).toContain('gpt-4o');
  });

  it('gets daily costs', () => {
    svc.record({ provider: 'openai', model: 'gpt-4o', tokens_in: 100, tokens_out: 200, cost: 0.005, task_type: 'chat' });
    const r = svc.getDailyCosts();
    expect(r).toContain('$');
  });
});

describe('QualityMetricsService', () => {
  let svc: QualityMetricsService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new QualityMetricsService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('records metric', () => {
    const r = svc.record({ tool: 'zavorth_vision', action: 'analyze', score: 8, feedback: 'positive', comment: 'Good', user: 'test' });
    expect(r).toContain('recorded');
  });

  it('gets stats', () => {
    svc.record({ tool: 'test', action: 'run', score: 7, feedback: 'positive', comment: '', user: 'test' });
    const r = svc.getStats();
    expect(r).toContain('Avg score');
  });

  it('gets quality by tool', () => {
    svc.record({ tool: 'a', action: 'x', score: 9, feedback: 'positive', comment: '', user: 'test' });
    const r = svc.getQualityByTool();
    expect(r).toContain('a');
  });

  it('gets worst tools', () => {
    svc.record({ tool: 'bad', action: 'x', score: 2, feedback: 'negative', comment: 'Bad', user: 'test' });
    const r = svc.getWorstTools();
    expect(r).toContain('bad');
  });

  it('gets recent feedback', () => {
    svc.record({ tool: 'test', action: 'run', score: 8, feedback: 'positive', comment: 'Nice', user: 'test' });
    const r = svc.getRecentFeedback();
    expect(r).toContain('Nice');
  });
});
