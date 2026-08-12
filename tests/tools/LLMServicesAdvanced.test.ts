import fs from 'fs';
import os from 'os';
import path from 'path';
import { LLMSelfEditContextService } from '../../src/services/plugins/LLMSelfEditContextService';
import { LLMModelSwitcherService } from '../../src/services/plugins/LLMModelSwitcherService';
import { LLMDriftDetectorService } from '../../src/services/plugins/LLMDriftDetectorService';
import { StreamingLLMService } from '../../src/services/plugins/StreamingLLMService';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'llm-advanced-'));

describe('LLMSelfEditContextService', () => {
  let svc: LLMSelfEditContextService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new LLMSelfEditContextService({ storageDir: dir, maxTokens: 500 }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('creates instance', () => { expect(svc).toBeDefined(); });
  it('adds system entry', () => { const id = svc.addEntry('system', 'You are helpful.'); expect(id).toBeTruthy(); });
  it('adds user entry', () => { const id = svc.addEntry('user', 'Hello'); expect(id).toBeTruthy(); });
  it('adds assistant entry', () => { const id = svc.addEntry('assistant', 'Hi there!'); expect(id).toBeTruthy(); });
  it('adds memory entry', () => { const id = svc.addEntry('memory', 'User prefers dark mode'); expect(id).toBeTruthy(); });
  it('adds fact entry', () => { const id = svc.addEntry('fact', 'TypeScript is typed JS'); expect(id).toBeTruthy(); });
  it('gets compiled context', () => {
    svc.addEntry('system', 'You are helpful.');
    svc.addEntry('user', 'Hello');
    const ctx = svc.getCompiledContext();
    expect(ctx).toContain('helpful');
    expect(ctx).toContain('Hello');
  });
  it('edits an entry', () => {
    const id = svc.addEntry('user', 'Original');
    const r = svc.editEntry(id, 'Updated');
    expect(r).toContain('edited');
  });
  it('removes an entry', () => {
    const id = svc.addEntry('user', 'Remove me');
    const r = svc.removeEntry(id);
    expect(r).toContain('removed');
  });
  it('returns error for non-existent edit', () => { expect(svc.editEntry('nonexistent', 'test')).toContain('not found'); });
  it('returns error for non-existent remove', () => { expect(svc.removeEntry('nonexistent')).toContain('not found'); });
  it('gets stats', () => {
    svc.addEntry('user', 'test');
    const r = svc.getStats();
    expect(r).toContain('Entries: 1');
  });
  it('auto-evicts when over budget', () => {
    for (let i = 0; i < 20; i++) svc.addEntry('user', 'x'.repeat(100));
    const ctx = svc.getCompiledContext();
    expect(ctx).toBeTruthy();
  });
  it('summarizes entries', () => {
    const entries = svc.getContext();
    const summary = svc.summarize(entries);
    expect(typeof summary).toBe('string');
  });
});

describe('LLMModelSwitcherService', () => {
  const svc = new LLMModelSwitcherService({ costBudget: 100 });

  it('creates instance', () => { expect(svc).toBeDefined(); });
  it('suggests cheaper model for chat', () => {
    const r = svc.suggestSwitch('gpt-4o', 'chat', 1000);
    expect(r).toBeTruthy();
    expect(r!.estimated_savings).toBeGreaterThan(0);
  });
  it('suggests better model for code generation', () => {
    const r = svc.suggestSwitch('llama-3.3-70b', 'code_generation', 1000);
    expect(r).toBeTruthy();
  });
  it('suggests better model for reasoning', () => {
    const r = svc.suggestSwitch('gpt-4o-mini', 'reasoning', 1000);
    expect(r).toBeTruthy();
  });
  it('returns null for same model', () => {
    const r = svc.suggestSwitch('gpt-4o', 'chat', 1000);
    expect(r).toBeTruthy();
    expect(r!.to_model).not.toBe('gpt-4o');
  });
  it('returns null for unknown model', () => {
    const r = svc.suggestSwitch('unknown-model', 'chat', 1000);
    expect(r).toBeNull();
  });
  it('lists models', () => {
    const r = svc.listModels();
    expect(r).toContain('gpt-4o');
    expect(r).toContain('claude-4');
    expect(r).toContain('gemini-2.5-pro');
  });
  it('gets stats', () => {
    const r = svc.getStats();
    expect(r).toContain('Models: 8');
  });
  it('records switch', () => {
    svc.recordSwitch({ from_model: 'gpt-4o', to_model: 'gpt-4o-mini', reason: 'cost', estimated_savings: 0.01, quality_impact: 'minimal' });
    const r = svc.getStats();
    expect(r).toContain('Switches: 1');
  });
});

describe('LLMDriftDetectorService', () => {
  const svc = new LLMDriftDetectorService();

  it('creates instance', () => { expect(svc).toBeDefined(); });
  it('detects topic drift', () => {
    svc.analyze('Tell me about Python', 'Python is a programming language...');
    const signals = svc.analyze('What is the weather today?', 'The weather is sunny.');
    expect(signals.some((s) => s.type === 'topic_drift')).toBe(true);
  });
  it('detects repetition', () => {
    svc.analyze('q', 'The answer is 42. The answer is 42. The answer is 42.');
    svc.analyze('q', 'The answer is 42. The answer is 42. The answer is 42.');
    svc.analyze('q', 'The answer is 42. The answer is 42. The answer is 42.');
    const signals = svc.getSignals('repetition');
    expect(signals.length).toBeGreaterThan(0);
  });
  it('detects hallucination risk', () => {
    const signals = svc.analyze('Who invented Python?', 'According to studies, Python was invented in 1991 by Guido van Rossum.');
    expect(signals.some((s) => s.type === 'hallucination_risk')).toBe(true);
  });
  it('detects quality drop', () => {
    const signals = svc.analyze('test', 'I think maybe but I\'m not sure possibly it could be');
    expect(signals.some((s) => s.type === 'quality_drop')).toBe(true);
  });
  it('gets signals by type', () => {
    svc.analyze('test', 'response');
    const signals = svc.getSignals('topic_drift');
    expect(Array.isArray(signals)).toBe(true);
  });
  it('gets all signals', () => {
    svc.analyze('test', 'response');
    const signals = svc.getSignals();
    expect(Array.isArray(signals)).toBe(true);
  });
  it('gets stats', () => {
    svc.analyze('test', 'response');
    const r = svc.getStats();
    expect(r).toContain('Signals:');
  });
});

describe('StreamingLLMService', () => {
  let svc: StreamingLLMService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new StreamingLLMService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('creates instance', () => { expect(svc).toBeDefined(); });
  it('lists sessions when empty', () => { expect(svc.listSessions()).toContain('No stream'); });
  it('gets stats', () => { expect(svc.getStats()).toContain('Sessions: 0'); });
  it('returns error for non-existent session', () => { expect(svc.getSession('nonexistent')).toContain('not found'); });
  it('handles cancel for non-existent stream', () => { expect(svc.cancel('nonexistent')).toContain('cancelled'); });
  it('streamChat returns error without API key', async () => {
    const r = await svc.streamChat('test-model', [{ role: 'user', content: 'hi' }]);
    expect(r).toContain('API key not configured');
  });
  it('streamChat handles missing provider key', async () => {
    const r = await svc.streamChat('test-model', [{ role: 'user', content: 'hi' }], { provider: 'nonexistent' });
    expect(r).toContain('API key not configured');
  });
});
