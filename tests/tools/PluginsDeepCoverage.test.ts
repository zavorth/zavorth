import fs from 'fs';
import os from 'os';
import path from 'path';
import { ActiveMemoryService } from '../../src/services/plugins/ActiveMemoryService';
import { DiagnosticsPrometheusService } from '../../src/services/plugins/DiagnosticsPrometheusService';
import { KanbanSQLiteDispatcherService } from '../../src/services/plugins/KanbanSQLiteDispatcherService';
import { MemoryLanceDBService } from '../../src/services/plugins/MemoryLanceDBService';
import { MemoryHonchoService } from '../../src/services/plugins/MemoryHonchoService';
import { DiagnosticsOtelService } from '../../src/services/plugins/DiagnosticsOtelService';
import { AchievementsService } from '../../src/services/plugins/AchievementsService';
import { SkinEngineService } from '../../src/services/plugins/SkinEngineService';
import { TrajectoryResearchService } from '../../src/services/plugins/TrajectoryResearchService';
import { DiskCleanupService } from '../../src/services/plugins/DiskCleanupService';
import { CodexSupervisorService } from '../../src/services/plugins/CodexSupervisorService';
import { MemoryQdrantService } from '../../src/services/plugins/MemoryQdrantService';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), `plugin-deep-${Date.now()}_`));

describe('ActiveMemoryService — deep coverage', () => {
  let svc: ActiveMemoryService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new ActiveMemoryService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('remembers with all categories', () => {
    svc.remember('fact', { category: 'fact' });
    svc.remember('pref', { category: 'preference' });
    svc.remember('event', { category: 'event' });
    svc.remember('instr', { category: 'instruction' });
    svc.remember('ctx', { category: 'context' });
    svc.remember('rel', { category: 'relationship' });
    const r = svc.getStats();
    expect(r).toContain('6');
  });

  it('recalls with category filter', () => {
    svc.remember('TypeScript fact', { category: 'fact' });
    svc.remember('TypeScript pref', { category: 'preference' });
    const r = svc.recall('TypeScript', { category: 'fact' });
    expect(r).toContain('fact');
  });

  it('recalls with min_importance', () => {
    svc.remember('Low imp', { importance: 0.2 });
    svc.remember('High imp', { importance: 0.9 });
    const r = svc.recall('imp', { min_importance: 0.5 });
    expect(r).toContain('High imp');
  });

  it('promotes and demotes', () => {
    const id = svc.remember('Test');
    const memId = id.match(/\[mem_\w+\]/)![0].slice(1, -1);
    svc.promote(memId, 'important');
    svc.demote(memId, 'less important');
    const r = svc.getStats();
    expect(r).toContain('1');
  });

  it('processes interaction for name detection', () => {
    const decisions = svc.processInteraction('Me chamo Maria', 'Prazer, Maria!');
    expect(decisions.length).toBeGreaterThan(0);
  });

  it('processes interaction for preference', () => {
    const decisions = svc.processInteraction('Eu gosto de cafe', 'Legal!');
    expect(decisions.length).toBeGreaterThan(0);
  });

  it('processes interaction for aversion', () => {
    const decisions = svc.processInteraction('Eu odeio acordar cedo', 'Entendo!');
    expect(decisions.length).toBeGreaterThan(0);
  });

  it('processes interaction for reminder', () => {
    const decisions = svc.processInteraction('Lembrete: pagar conta amanha', 'Ok!');
    expect(decisions.length).toBeGreaterThan(0);
  });

  it('returns error for non-existent update', () => {
    const r = svc.update('nonexistent', { content: 'test' });
    expect(r).toContain('nao encontrada');
  });

  it('returns error for non-existent forget', () => {
    const r = svc.forget('nonexistent');
    expect(r).toContain('nao encontrada');
  });

  it('lists with category filter', () => {
    svc.remember('Fact', { category: 'fact' });
    svc.remember('Pref', { category: 'preference' });
    const r = svc.listEntries({ category: 'fact' });
    expect(r).toContain('Fact');
  });
});

describe('DiagnosticsPrometheusService — deep coverage', () => {
  let svc: DiagnosticsPrometheusService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new DiagnosticsPrometheusService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('increments counter with labels', () => {
    svc.incrementCounter('test', 1, { tool: 'web_search' });
    svc.incrementCounter('test', 1, { tool: 'web_search' });
    const r = svc.exportPrometheusFormat();
    expect(r).toContain('test');
  });

  it('sets gauge with labels', () => {
    svc.setGauge('test_gauge', 42, { region: 'us-east' });
    const r = svc.getMetricsJson();
    expect(r).toContain('42');
  });

  it('records multiple histogram values', () => {
    svc.observeHistogram('zavorth_tool_duration_seconds', 0.01);
    svc.observeHistogram('zavorth_tool_duration_seconds', 0.5);
    svc.observeHistogram('zavorth_tool_duration_seconds', 5);
    svc.observeHistogram('zavorth_tool_duration_seconds', 30);
    const r = svc.getMetricsJson();
    expect(r).toContain('zavorth_tool_duration_seconds');
  });

  it('records tool execution with success and failure', () => {
    svc.recordToolExecution('web_search', 100, true);
    svc.recordToolExecution('web_search', 200, false);
    svc.recordToolExecution('send_email', 500, true);
    const r = svc.getMetricsJson();
    expect(r).toContain('zavorth_tool_executions_total');
  });

  it('records channel messages', () => {
    svc.recordChannelMessage('telegram', 'sent');
    svc.recordChannelMessage('discord', 'received');
    svc.recordChannelMessage('slack', 'sent');
    const r = svc.getMetricsJson();
    expect(r).toContain('zavorth_channel_messages_sent_total');
  });

  it('records approval requests', () => {
    svc.recordApprovalRequest('approved');
    svc.recordApprovalRequest('denied');
    const r = svc.getMetricsJson();
    expect(r).toContain('zavorth_approval_requests_total');
  });

  it('resets all metrics', () => {
    svc.incrementCounter('test', 100);
    svc.reset();
    const r = svc.getMetricsJson();
    const parsed = JSON.parse(r);
    expect(parsed.counters.test).toBeUndefined();
  });

  it('exports prometheus format', () => {
    svc.incrementCounter('test_c', 5);
    const r = svc.exportPrometheusFormat();
    expect(r).toContain('# TYPE test_c counter');
    expect(r).toContain('test_c 5');
  });
});

describe('MemoryLanceDBService — deep coverage', () => {
  let svc: MemoryLanceDBService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new MemoryLanceDBService({ dbPath: dir, dimension: 32 }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('creates collection', () => {
    const r = svc.createCollection('test');
    expect(r).toContain('criada');
  });

  it('validates collection name', () => {
    const r = svc.createCollection('../etc/passwd');
    expect(r).toContain('Erro');
  });

  it('inserts documents', () => {
    svc.createCollection('test');
    const r = svc.insert('test', 'hello world', { source: 'test' });
    expect(r).toContain('inserido');
  });

  it('inserts batch', () => {
    svc.createCollection('test');
    const r = svc.insertBatch('test', [
      { content: 'hello', metadata: { a: 1 } },
      { content: 'world', metadata: { b: 2 } },
    ]);
    expect(r).toContain('2');
  });

  it('queries documents', () => {
    svc.createCollection('test');
    svc.insert('test', 'TypeScript is great');
    svc.insert('test', 'Python is also great');
    const r = svc.query('test', 'programming', 3);
    expect(r.length).toBeGreaterThan(0);
  });

  it('queries with filter', () => {
    svc.createCollection('test');
    svc.insert('test', 'hello', { lang: 'en' });
    svc.insert('test', 'hola', { lang: 'es' });
    const r = svc.query('test', 'greeting', 5, { lang: 'en' });
    expect(r.length).toBe(1);
  });

  it('deletes a document', () => {
    svc.createCollection('test');
    svc.insert('test', 'Delete me');
    const docs = svc.query('test', 'delete', 1);
    const r = svc.delete('test', docs[0].id);
    expect(r).toContain('deletado');
  });

  it('deletes collection', () => {
    svc.createCollection('temp');
    const r = svc.deleteCollection('temp');
    expect(r).toContain('deletada');
  });

  it('returns error for non-existent collection', () => {
    const r = svc.deleteCollection('nonexistent');
    expect(r).toContain('nao encontrada');
  });

  it('gets stats for collection', () => {
    svc.createCollection('test');
    svc.insert('test', 'Test');
    const r = svc.getStats('test');
    expect(r).toContain('1 documentos');
  });

  it('gets global stats', () => {
    svc.createCollection('a');
    svc.createCollection('b');
    const r = svc.getStats();
    expect(r).toContain('2 colecoes');
  });

  it('lists collections', () => {
    svc.createCollection('a');
    svc.createCollection('b');
    const r = svc.listCollections();
    expect(r).toContain('a');
    expect(r).toContain('b');
  });
});

describe('MemoryHonchoService — deep coverage', () => {
  let svc: MemoryHonchoService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new MemoryHonchoService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('creates profile with defaults', () => {
    const p = svc.getOrCreateProfile('user1');
    expect(p.id).toBe('user1');
    expect(p.communication_preferences.language).toBe('pt-BR');
  });

  it('adds multiple traits', () => {
    svc.addTrait('user1', 'curious');
    svc.addTrait('user1', 'analytical');
    svc.addTrait('user1', 'curious');
    const p = svc.getOrCreateProfile('user1');
    expect(p.traits.length).toBe(2);
  });

  it('sets multiple preferences', () => {
    svc.setPreference('user1', 'theme', 'dark');
    svc.setPreference('user1', 'lang', 'pt-BR');
    const p = svc.getOrCreateProfile('user1');
    expect(Object.keys(p.preferences).length).toBe(2);
  });

  it('adds knowledge areas', () => {
    svc.addKnowledgeArea('user1', 'TypeScript');
    svc.addKnowledgeArea('user1', 'DevOps');
    svc.addKnowledgeArea('user1', 'TypeScript');
    const p = svc.getOrCreateProfile('user1');
    expect(p.knowledge_areas.length).toBe(2);
  });

  it('learns facts with different sources', () => {
    svc.learnFact('user1', 'Fact from conv', 'conversation', 0.8);
    svc.learnFact('user1', 'Fact from file', 'file-read', 0.6);
    const p = svc.getOrCreateProfile('user1');
    expect(p.learned_facts.length).toBe(2);
  });

  it('sets communication preference', () => {
    const r = svc.setCommunicationPreference('user1', 'formality', 'casual');
    expect(r).toContain('atualizada');
  });

  it('returns error for invalid communication key', () => {
    const r = svc.setCommunicationPreference('user1', 'invalid_key', 'value');
    expect(r).toContain('invalida');
  });

  it('records interaction and increments count', () => {
    svc.recordInteraction('user1', { role: 'user', content: 'Hello', timestamp: new Date().toISOString(), channel: 'cli' });
    svc.recordInteraction('user1', { role: 'assistant', content: 'Hi!', timestamp: new Date().toISOString(), channel: 'cli' });
    const p = svc.getOrCreateProfile('user1');
    expect(p.interaction_history.total_interactions).toBe(2);
  });

  it('gets conversation history', () => {
    svc.recordInteraction('user1', { role: 'user', content: 'Test message', timestamp: new Date().toISOString(), channel: 'cli' });
    const r = svc.getConversationHistory('user1');
    expect(r).toContain('Test message');
  });

  it('lists profiles', () => {
    svc.getOrCreateProfile('user1');
    svc.getOrCreateProfile('user2');
    const r = svc.listProfiles();
    expect(r).toContain('2');
  });

  it('gets insights', () => {
    svc.recordInteraction('user1', { role: 'user', content: 'Me chamo Joao', timestamp: new Date().toISOString(), channel: 'cli' });
    const r = svc.getInsights('user1');
    expect(r).toContain('Insights');
  });
});

describe('DiagnosticsOtelService — deep coverage', () => {
  let svc: DiagnosticsOtelService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new DiagnosticsOtelService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('creates parent-child span hierarchy', () => {
    const parent = svc.startSpan('parent', { kind: 'server' });
    const child1 = svc.startSpan('child1', { parent_span_id: parent });
    const child2 = svc.startSpan('child2', { parent_span_id: parent });
    svc.endSpan(child1, 'ok');
    svc.endSpan(child2, 'error', 'timeout');
    svc.endSpan(parent, 'ok');
    const r = svc.getStats();
    expect(r).toContain('3 completos');
  });

  it('adds events to spans', () => {
    const span = svc.startSpan('test');
    svc.addSpanEvent(span, 'event1', { key: 'value1' });
    svc.addSpanEvent(span, 'event2', { key: 'value2' });
    svc.endSpan(span);
    const r = svc.getStats();
    expect(r).toBeTruthy();
  });

  it('records counter metrics', () => {
    svc.recordMetric('requests', { type: 'counter', value: 1 });
    svc.recordMetric('requests', { type: 'counter', value: 1 });
    svc.recordMetric('requests', { type: 'counter', value: 1 });
    const r = svc.getMetrics();
    expect(r).toContain('requests');
  });

  it('records gauge metrics', () => {
    svc.recordMetric('cpu', { type: 'gauge', value: 75.5 });
    const r = svc.getMetrics();
    expect(r).toContain('75');
  });

  it('logs at different severity levels', () => {
    svc.log('trace', 'trace message');
    svc.log('debug', 'debug message');
    svc.log('info', 'info message');
    svc.log('warn', 'warn message');
    svc.log('error', 'error message');
    svc.log('fatal', 'fatal message');
    const r = svc.getLogs();
    expect(r).toContain('trace');
    expect(r).toContain('fatal');
  });

  it('filters logs by severity', () => {
    svc.log('info', 'info msg');
    svc.log('error', 'error msg');
    svc.log('warn', 'warn msg');
    const r = svc.getLogs({ severity: 'error' });
    expect(r).toContain('error msg');
    expect(r).not.toContain('info msg');
  });

  it('exports to OTEL format', () => {
    svc.startSpan('test');
    const r = svc.exportToOtelFormat();
    const parsed = JSON.parse(r);
    expect(parsed.resourceSpans).toBeTruthy();
  });

  it('flushes all data', () => {
    svc.startSpan('test');
    svc.log('info', 'test');
    svc.recordMetric('test', { type: 'counter' });
    const r = svc.flush();
    expect(r).toContain('Flush completo');
  });
});

describe('AchievementsService — deep coverage', () => {
  let svc: AchievementsService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new AchievementsService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('tracks multiple events', () => {
    svc.trackEvent('user1', 'tool_executions', 1);
    svc.trackEvent('user1', 'tool_executions', 1);
    svc.trackEvent('user1', 'skill_uses', 1);
    const r = svc.getProfile('user1');
    expect(r).toContain('✅');
  });

  it('unlocks first_tool at 1 execution', () => {
    svc.trackEvent('user1', 'tool_executions', 1);
    const p = svc.getUserState('user1');
    expect(p.achievements['first_tool'].unlocked).toBe(true);
    expect(p.total_points).toBe(10);
  });

  it('unlocks tool_master at 100 executions', () => {
    svc.trackEvent('user1', 'tool_executions', 100);
    const p = svc.getUserState('user1');
    expect(p.achievements['tool_master'].unlocked).toBe(true);
  });

  it('updates streak', () => {
    const r = svc.updateStreak('user1', 'daily_usage');
    expect(r).toContain('1 dias');
  });

  it('manually unlocks achievement', () => {
    const r = svc.unlockManually('user1', 'hidden_easter_egg');
    expect(r).toContain('desbloqueado');
  });

  it('returns error for duplicate manual unlock', () => {
    svc.unlockManually('user1', 'hidden_easter_egg');
    const r = svc.unlockManually('user1', 'hidden_easter_egg');
    expect(r).toContain('ja desbloqueado');
  });

  it('returns error for non-existent achievement', () => {
    const r = svc.unlockManually('user1', 'nonexistent');
    expect(r).toContain('nao encontrado');
  });

  it('gets leaderboard', () => {
    svc.trackEvent('user1', 'tool_executions', 10);
    svc.trackEvent('user2', 'tool_executions', 5);
    const r = svc.getLeaderboard();
    expect(r).toContain('user1');
    expect(r).toContain('user2');
  });

  it('calculates level from points', () => {
    svc.trackEvent('user1', 'tool_executions', 1000);
    const p = svc.getUserState('user1');
    expect(p.level).toBeGreaterThan(1);
  });
});

describe('SkinEngineService — deep coverage', () => {
  let svc: SkinEngineService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new SkinEngineService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('has 4 built-in skins', () => {
    const r = svc.listSkins();
    expect(r).toContain('default');
    expect(r).toContain('ares');
    expect(r).toContain('mono');
    expect(r).toContain('slate');
  });

  it('switches between skins', () => {
    svc.setActiveSkin('ares');
    expect(svc.getActiveSkin().id).toBe('ares');
    svc.setActiveSkin('mono');
    expect(svc.getActiveSkin().id).toBe('mono');
  });

  it('returns error for non-existent skin', () => {
    const r = svc.setActiveSkin('nonexistent');
    expect(r).toContain('nao encontrado');
  });

  it('installs custom skin', () => {
    const skin = { id: 'custom', name: 'Custom', description: 'Test', author: 'Test', version: '1.0.0', colors: { primary: '#f00', secondary: '#0f0', accent: '#00f', success: '#0f0', warning: '#ff0', error: '#f00', info: '#0ff', muted: '#888', background: '#000', foreground: '#fff', border: '#333' }, prompt: { prefix: '>', suffix: '', separator: '', thinking_indicator: '.', success_indicator: '+', error_indicator: '-' }, typography: { font_family: 'mono', heading_style: 'normal' as const, code_style: 'normal' as const }, layout: { max_width: 80, padding: 0, compact_mode: true, show_timestamps: false, show_tool_names: false }, metadata: { created_at: '2025-01-01', updated_at: '2025-01-01', tags: [] } };
    const r = svc.installSkin(JSON.stringify(skin));
    expect(r).toContain('instalado');
  });

  it('removes custom skin', () => {
    const skin = { id: 'removable', name: 'Removable', description: 'Test', author: 'Test', version: '1.0.0', colors: { primary: '#f00', secondary: '#0f0', accent: '#00f', success: '#0f0', warning: '#ff0', error: '#f00', info: '#0ff', muted: '#888', background: '#000', foreground: '#fff', border: '#333' }, prompt: { prefix: '>', suffix: '', separator: '', thinking_indicator: '.', success_indicator: '+', error_indicator: '-' }, typography: { font_family: 'mono', heading_style: 'normal' as const, code_style: 'normal' as const }, layout: { max_width: 80, padding: 0, compact_mode: true, show_timestamps: false, show_tool_names: false }, metadata: { created_at: '2025-01-01', updated_at: '2025-01-01', tags: [] } };
    svc.installSkin(JSON.stringify(skin));
    const r = svc.removeSkin('removable');
    expect(r).toContain('removido');
  });

  it('gets preview for each built-in skin', () => {
    for (const id of ['default', 'ares', 'mono', 'slate']) {
      const r = svc.getSkinPreview(id);
      expect(r).toContain('Preview');
    }
  });

  it('exports skin as JSON', () => {
    const r = svc.exportSkin('ares');
    const parsed = JSON.parse(r);
    expect(parsed.id).toBe('ares');
  });

  it('returns error for invalid JSON on install', () => {
    const r = svc.installSkin('not json');
    expect(r).toContain('Erro');
  });

  it('returns error for skin without id', () => {
    const r = svc.installSkin(JSON.stringify({ name: 'Test' }));
    expect(r).toContain('Erro');
  });
});

describe('TrajectoryResearchService — deep coverage', () => {
  let svc: TrajectoryResearchService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new TrajectoryResearchService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('creates trajectory with hypothesis', () => {
    const r = svc.createTrajectory({ session_id: 's1', task: 'Test', hypothesis: 'H1', method: 'Benchmark' });
    expect(r).toContain('criada');
  });

  it('adds steps', () => {
    svc.createTrajectory({ session_id: 's1', task: 'Test', method: 'M1' });
    const trajs = svc.listTrajectories();
    const id = trajs.match(/\[res_\w+\]/)![0].slice(1, -1);
    svc.addStep(id, { action: 'Step 1', tool_used: 'sandbox', result_summary: 'Done', duration_ms: 100, success: true });
    svc.addStep(id, { action: 'Step 2', tool_used: 'terminal', result_summary: 'Passed', duration_ms: 200, success: true });
    const r = svc.getTrajectory(id);
    expect(r).toContain('2');
  });

  it('adds evidence and citations', () => {
    svc.createTrajectory({ session_id: 's1', task: 'Test', method: 'M1' });
    const trajs = svc.listTrajectories();
    const id = trajs.match(/\[res_\w+\]/)![0].slice(1, -1);
    svc.addEvidence(id, 'Evidence 1');
    svc.addEvidence(id, 'Evidence 2');
    svc.addCitation(id, { source: 'https://example.com', title: 'Source', relevance: 0.9 });
    const r = svc.getTrajectory(id);
    expect(r).toContain('2');
  });

  it('concludes trajectory with outcome', () => {
    svc.createTrajectory({ session_id: 's1', task: 'Test', method: 'M1' });
    const trajs = svc.listTrajectories();
    const id = trajs.match(/\[res_\w+\]/)![0].slice(1, -1);
    svc.concludeTrajectory(id, 'Confirmed hypothesis', 'confirmed');
    const r = svc.getTrajectory(id);
    expect(r).toContain('confirmed');
  });

  it('creates report', () => {
    svc.createTrajectory({ session_id: 's1', task: 'T1', method: 'M1' });
    const trajs = svc.listTrajectories();
    const id = trajs.match(/\[res_\w+\]/)![0].slice(1, -1);
    const r = svc.createReport({ title: 'Report', trajectory_ids: [id], findings: ['F1'], methodology: 'Benchmark', conclusions: ['C1'] });
    expect(r).toContain('criado');
  });

  it('exports for training in different formats', () => {
    svc.createTrajectory({ session_id: 's1', task: 'T1', method: 'M1' });
    const jsonl = svc.exportForTraining('jsonl');
    expect(jsonl).toContain('task');
    const alpaca = svc.exportForTraining('alpaca');
    expect(alpaca).toContain('instruction');
    const sharegpt = svc.exportForTraining('sharegpt');
    expect(sharegpt).toContain('conversations');
  });

  it('gets stats', () => {
    svc.createTrajectory({ session_id: 's1', task: 'T1', method: 'M1' });
    const r = svc.getStats();
    expect(r).toContain('1');
  });
});

describe('MemoryQdrantService — deep coverage', () => {
  let svc: MemoryQdrantService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new MemoryQdrantService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('creates collection', () => {
    const r = svc.createCollection('test', 32);
    expect(r).toContain('criada');
  });

  it('validates collection name', () => {
    const r = svc.createCollection('../etc/passwd');
    expect(r).toContain('Erro');
  });

  it('upserts and searches', () => {
    svc.createCollection('test', 4);
    svc.upsert('test', [
      { id: 'a', vector: [1, 0, 0, 0], payload: { content: 'hello' } },
      { id: 'b', vector: [0, 1, 0, 0], payload: { content: 'world' } },
    ]);
    const r = svc.search('test', [1, 0, 0, 0], 2);
    expect(r.length).toBe(2);
    expect(r[0].id).toBe('a');
  });

  it('validates vector dimension', () => {
    svc.createCollection('test', 4);
    const r = svc.upsert('test', [{ id: 'x', vector: [1, 0], payload: {} }]);
    expect(r).toContain('Erro');
  });

  it('retrieves point', () => {
    svc.createCollection('test', 4);
    svc.upsert('test', [{ id: 'v1', vector: [1, 0, 0, 0], payload: { content: 'test' } }]);
    const p = svc.retrieve('test', 'v1');
    expect(p).toBeTruthy();
  });

  it('returns null for non-existent point', () => {
    svc.createCollection('test', 4);
    const p = svc.retrieve('test', 'nonexistent');
    expect(p).toBeNull();
  });

  it('deletes points', () => {
    svc.createCollection('test', 4);
    svc.upsert('test', [{ id: 'v1', vector: [1, 0, 0, 0] }]);
    const r = svc.delete('test', ['v1']);
    expect(r).toContain('1');
  });

  it('lists collections', () => {
    svc.createCollection('a', 4);
    svc.createCollection('b', 4);
    const r = svc.listCollections();
    expect(r).toContain('a');
    expect(r).toContain('b');
  });

  it('gets stats', () => {
    svc.createCollection('test', 4);
    svc.upsert('test', [{ id: 'v1', vector: [1, 0, 0, 0] }]);
    const r = svc.getStats('test');
    expect(r).toContain('1 vetores');
  });

  it('searches and returns formatted', () => {
    svc.createCollection('test', 4);
    svc.upsert('test', [{ id: 'v1', vector: [1, 0, 0, 0], payload: { content: 'hello world' } }]);
    const r = svc.searchAndReturn('test', 'hello');
    expect(r).toContain('hello');
  });
});

describe('DiskCleanupService — deep coverage', () => {
  const makeSvc = () => new DiskCleanupService({ storageDir: fs.mkdtempSync(path.join(os.tmpdir(), 'dc-')) });

  it('lists 7 default rules', () => {
    const r = makeSvc().listRules();
    expect(r).toContain('temp_files');
    expect(r).toContain('screenshots');
    expect(r).toContain('logs_old');
    expect(r).toContain('cache');
  });

  it('adds custom rule', () => {
    const svc = makeSvc();
    const r = svc.addRule({ name: 'Custom', pattern: '*.custom', max_age_days: 1, max_size_mb: 10, directories: ['/tmp'], dry_run: false, enabled: true });
    expect(r).toContain('adicionada');
  });

  it('toggles rule', () => {
    const svc = makeSvc();
    const r = svc.toggleRule('temp_files', false);
    expect(r).toContain('desabilitada');
  });

  it('returns error for non-existent toggle', () => {
    const r = makeSvc().toggleRule('nonexistent', true);
    expect(r).toContain('nao encontrada');
  });
});

describe('CodexSupervisorService — deep coverage', () => {
  const makeSvc = () => new CodexSupervisorService({ storageDir: fs.mkdtempSync(path.join(os.tmpdir(), 'cs-')), maxConcurrent: 2 });

  it('lists tasks when empty', () => {
    const r = makeSvc().listTasks();
    expect(r).toContain('Nenhuma');
  });

  it('gets stats', () => {
    const r = makeSvc().getStats();
    expect(r).toContain('Supervisor Stats');
  });

  it('returns error for non-existent task status', () => {
    const r = makeSvc().getStatus('nonexistent');
    expect(r).toContain('nao encontrada');
  });

  it('returns error for kill on non-existent task', () => {
    const r = makeSvc().kill('nonexistent');
    expect(r).toContain('nao encontrada');
  });

  it('cleans up old tasks', () => {
    const r = makeSvc().cleanup(0);
    expect(r).toContain('removida');
  });
});
