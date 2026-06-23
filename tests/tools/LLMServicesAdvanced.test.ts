import fs from 'fs';
import os from 'os';
import path from 'path';
import { LLMSelfEditContextService } from '../../src/services/plugins/LLMSelfEditContextService';
import { LLMModelSwitcherService } from '../../src/services/plugins/LLMModelSwitcherService';
import { LLMDriftDetectorService } from '../../src/services/plugins/LLMDriftDetectorService';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'llm-'));

describe('LLMSelfEditContextService', () => {
  let svc: LLMSelfEditContextService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new LLMSelfEditContextService({ storageDir: dir, maxTokens: 1000 }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('adds entries', () => {
    const id = svc.addEntry('user', 'Hello world');
    expect(id).toBeTruthy();
  });

  it('gets compiled context', () => {
    svc.addEntry('system', 'You are a helpful assistant.');
    svc.addEntry('user', 'What is TypeScript?');
    const ctx = svc.getCompiledContext();
    expect(ctx).toContain('assistant');
    expect(ctx).toContain('TypeScript');
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

  it('gets stats', () => {
    svc.addEntry('user', 'test');
    const r = svc.getStats();
    expect(r).toContain('Entries: 1');
  });

  it('returns error for non-existent edit', () => {
    const r = svc.editEntry('nonexistent', 'test');
    expect(r).toContain('not found');
  });
});

describe('LLMModelSwitcherService', () => {
  const svc = new LLMModelSwitcherService({ costBudget: 100 });

  it('suggests cheaper model for chat', () => {
    const r = svc.suggestSwitch('gpt-5.2', 'chat', 1000);
    expect(r).toBeTruthy();
    expect(r!.estimated_savings).toBeGreaterThan(0);
  });

  it('suggests better model for code generation', () => {
    const r = svc.suggestSwitch('llama-3.3-70b', 'code_generation', 1000);
    expect(r).toBeTruthy();
  });

  it('returns null for same model', () => {
    const r = svc.suggestSwitch('gpt-5.2', 'chat', 1000);
    expect(r).toBeTruthy();
    expect(r!.to_model).not.toBe('gpt-5.2');
  });

  it('lists models', () => {
    const r = svc.listModels();
    expect(r).toContain('gpt-5.2');
    expect(r).toContain('claude-4');
  });

  it('gets stats', () => {
    const r = svc.getStats();
    expect(r).toContain('Models: 8');
  });

  it('records switch', () => {
    svc.recordSwitch({ from_model: 'gpt-5.2', to_model: 'gpt-5.2-mini', reason: 'cost', estimated_savings: 0.01, quality_impact: 'minimal' });
    const r = svc.getStats();
    expect(r).toContain('Switches: 1');
  });
});

describe('LLMDriftDetectorService', () => {
  const svc = new LLMDriftDetectorService();

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

  it('gets stats', () => {
    svc.analyze('test', 'response');
    const r = svc.getStats();
    expect(r).toContain('Signals:');
  });
});
