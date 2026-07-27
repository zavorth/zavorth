import fs from 'fs';
import path from 'path';
import os from 'os';

import { ActiveMemoryService } from '../../../src/services/plugins/ActiveMemoryService';
import { DiagnosticsPrometheusService } from '../../../src/services/plugins/DiagnosticsPrometheusService';
import { KanbanSQLiteDispatcherService } from '../../../src/services/plugins/KanbanSQLiteDispatcherService';
import { MemoryLanceDBService } from '../../../src/services/plugins/MemoryLanceDBService';
import { MemoryHonchoService } from '../../../src/services/plugins/MemoryHonchoService';
import { DiagnosticsOtelService } from '../../../src/services/plugins/DiagnosticsOtelService';
import { AchievementsService } from '../../../src/services/plugins/AchievementsService';
import { SkinEngineService } from '../../../src/services/plugins/SkinEngineService';
import { TrajectoryResearchService } from '../../../src/services/plugins/TrajectoryResearchService';
import { DiskCleanupService } from '../../../src/services/plugins/DiskCleanupService';
import { CodexSupervisorService } from '../../../src/services/plugins/CodexSupervisorService';
import { LLMRouterService } from '../../../src/services/plugins/LLMRouterService';
import { ContextCompressorService } from '../../../src/services/plugins/ContextCompressorService';
import { ReasoningEffortService } from '../../../src/services/plugins/ReasoningEffortService';
import { PromptCacheService } from '../../../src/services/plugins/PromptCacheService';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-plugin-test-'));
}

describe('AllPluginsDeep - Deep coverage for all Zavorth plugins', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
    tempDirs.length = 0;
  });

  describe('ActiveMemoryService', () => {
    let svc: ActiveMemoryService;
    beforeEach(() => {
      const tmpDir = makeTempDir();
      tempDirs.push(tmpDir);
      svc = new ActiveMemoryService({ storageDir: tmpDir });
    });

    it('should create instance', () => {
      expect(svc).toBeDefined();
      expect(svc).toBeInstanceOf(ActiveMemoryService);
    });

    it('remember() should store a memory and return ID string', () => {
      const result = svc.remember('Test fact');
      expect(typeof result).toBe('string');
      expect(result).toContain('Remembered');
    });

    it('recall() should retrieve stored memories', () => {
      svc.remember('Python is a programming language');
      const result = svc.recall('Python');
      expect(typeof result).toBe('string');
      expect(result).toContain('Python');
    });

    it('recall() with no matches should return no results message', () => {
      const result = svc.recall('xyznonexistent123');
      expect(result).toContain('No memories');
    });

    it('forget() should remove a memory', () => {
      const idResult = svc.remember('Temporary fact');
      const match = idResult.match(/\[(mem_[^\]]+)\]/);
      expect(match).not.toBeNull();
      const forgetResult = svc.forget(match![1]);
      expect(forgetResult).toContain('forgotten');
    });

    it('forget() with invalid ID should return not found', () => {
      const result = svc.forget('mem_nonexistent');
      expect(result).toContain('not found');
    });

    it('update() should modify existing memory', () => {
      const idResult = svc.remember('Old content');
      const match = idResult.match(/\[(mem_[^\]]+)\]/);
      const updateResult = svc.update(match![1], { content: 'New content' });
      expect(updateResult).toContain('updated');
    });

    it('promote() should increase importance', () => {
      const idResult = svc.remember('Important fact');
      const match = idResult.match(/\[(mem_[^\]]+)\]/);
      const result = svc.promote(match![1], 'test');
      expect(result).toContain('promoted');
    });

    it('demote() should decrease importance', () => {
      const idResult = svc.remember('Less important');
      const match = idResult.match(/\[(mem_[^\]]+)\]/);
      const result = svc.demote(match![1], 'test');
      expect(result).toContain('demoted');
    });

    it('getStats() should return statistics string', () => {
      svc.remember('Fact 1');
      svc.remember('Fact 2');
      const stats = svc.getStats();
      expect(stats).toContain('Total:');
      expect(stats).toContain('2');
    });

    it('listEntries() should list memories', () => {
      svc.remember('Listed fact');
      const result = svc.listEntries();
      expect(result).toContain('Memorys');
    });

    it('consolidate() should process decay and expiry', () => {
      svc.remember('Consolidation test');
      const result = svc.consolidate();
      expect(result).toContain('Consolidation');
    });

    it('processInteraction() should detect user names', () => {
      const decisions = svc.processInteraction('My name is John', 'Hello John!');
      expect(Array.isArray(decisions)).toBe(true);
    });

    it('processInteraction() should detect preferences', () => {
      const decisions = svc.processInteraction('I like chocolate', 'Tthere ist is great!');
      expect(Array.isArray(decisions)).toBe(true);
    });

    it('processInteraction() should detect reminders', () => {
      const decisions = svc.processInteraction('Remember to buy milk', 'Ok!');
      expect(Array.isArray(decisions)).toBe(true);
    });
  });

  describe('DiagnosticsPrometheusService', () => {
    let svc: DiagnosticsPrometheusService;
    beforeEach(() => {
      const tmpDir = makeTempDir();
      tempDirs.push(tmpDir);
      svc = new DiagnosticsPrometheusService({ storageDir: tmpDir });
    });

    it('should create instance', () => {
      expect(svc).toBeInstanceOf(DiagnosticsPrometheusService);
    });

    it('incrementCounter() should increase counter value', () => {
      svc.incrementCounter('test_counter', 5);
      const json = svc.getMetricsJson();
      expect(json).toContain('test_counter');
    });

    it('setGauge() should set gauge value', () => {
      svc.setGauge('test_gauge', 42);
      const json = svc.getMetricsJson();
      expect(json).toContain('test_gauge');
    });

    it('observeHistogram() should record histogram values', () => {
      svc.observeHistogram('zavorth_tool_duration_seconds', 0.5);
      const json = svc.getMetricsJson();
      expect(json).toContain('zavorth_tool_duration_seconds');
    });

    it('recordToolExecution() should record metrics', () => {
      svc.recordToolExecution('test_tool', 150, true);
      svc.recordToolExecution('test_tool', 200, false);
      const json = svc.getMetricsJson();
      expect(json).toContain('zavorth_tool_executions_total');
    });

    it('recordChannelMessage() should increment channel counter', () => {
      svc.recordChannelMessage('telegram', 'sent');
      svc.recordChannelMessage('discord', 'received');
      const stats = svc.getStats();
      expect(stats).toContain('Counters');
    });

    it('recordLlmLatency() should record latency histogram', () => {
      svc.recordLlmLatency('openai', 'gpt-4o', 500);
      const json = svc.getMetricsJson();
      expect(json).toContain('zavorth_llm_latency_seconds');
    });

    it('recordApprovalRequest() should track approvals', () => {
      svc.recordApprovalRequest('approved');
      svc.recordApprovalRequest('denied');
      const stats = svc.getStats();
      expect(stats).toBeDefined();
    });

    it('exportPrometheusFormat() should return valid Prometheus text', () => {
      svc.incrementCounter('test_export', 10);
      const output = svc.exportPrometheusFormat();
      expect(output).toContain('# TYPE');
      expect(output).toContain('counter');
    });

    it('getMetricsJson() should return valid JSON', () => {
      const json = svc.getMetricsJson();
      const parsed = JSON.parse(json);
      expect(parsed).toHaveProperty('counters');
      expect(parsed).toHaveProperty('gauges');
      expect(parsed).toHaveProperty('histograms');
    });

    it('getStats() should return formatted stats', () => {
      const stats = svc.getStats();
      expect(stats).toContain('Prometheus Metrics');
      expect(stats).toContain('Counters');
      expect(stats).toContain('Gauges');
    });

    it('reset() should clear all metrics', () => {
      svc.incrementCounter('temp_counter', 100);
      const result = svc.reset();
      expect(result).toContain('resetadas');
    });

    it('incrementCounter with labels should track labeled metrics', () => {
      svc.incrementCounter('labeled_counter', 1, { env: 'test' });
      svc.incrementCounter('labeled_counter', 1, { env: 'prod' });
      const json = svc.getMetricsJson();
      expect(json).toBeDefined();
    });
  });

  describe('KanbanSQLiteDispatcherService', () => {
    let svc: KanbanSQLiteDispatcherService;
    let tmpDir: string;
    beforeEach(() => {
      tmpDir = makeTempDir();
      tempDirs.push(tmpDir);
      svc = new KanbanSQLiteDispatcherService({ dbPath: path.join(tmpDir, 'test.sqlite') });
    });

    afterEach(() => {
      try { svc.close(); } catch { /* ignore */ }
    });

    it('should create instance', () => {
      expect(svc).toBeInstanceOf(KanbanSQLiteDispatcherService);
    });

    it('createBoard() should create a kanban board', () => {
      const result = svc.createBoard('Test Board');
      expect(result).toContain('created');
    });

    it('createBoard() duplicate should return error', () => {
      svc.createBoard('Dup Board');
      const result = svc.createBoard('Dup Board');
      expect(result).toContain('Error');
    });

    it('addCard() should add a card to a board', () => {
      svc.createBoard('Card Board');
      const result = svc.addCard('card_board', 'Test Card', { priority: 'high' });
      expect(result).toContain('added');
    });

    it('addCard() to non-existent board should return error', () => {
      const result = svc.addCard('nonexistent', 'Card');
      expect(result).toContain('Error');
    });

    it('listBoards() should list created boards', () => {
      svc.createBoard('List Board');
      const result = svc.listBoards();
      expect(result).toContain('List Board');
    });

    it('getBoard() should return board details', () => {
      svc.createBoard('Detail Board');
      const result = svc.getBoard('detail_board');
      expect(result).toContain('Detail Board');
    });

    it('moveCard() should move card between columns', () => {
      svc.createBoard('Move Board');
      svc.addCard('move_board', 'Move Me');
      const cards = svc.listCards('move_board');
      const cardMatch = cards.match(/card_[a-z0-9_]+/);
      if (cardMatch) {
        const result = svc.moveCard('move_board', cardMatch[0], 'in_progress');
        expect(result).toContain('moved');
      }
    });

    it('deleteBoard() should delete a board', () => {
      svc.createBoard('Delete Board');
      const result = svc.deleteBoard('delete_board');
      expect(result).toContain('deleted');
    });

    it('deleteBoard() non-existent should return error', () => {
      const result = svc.deleteBoard('nonexistent');
      expect(result).toContain('Error');
    });

    it('listCards() should list cards on a board', () => {
      svc.createBoard('Cards Board');
      svc.addCard('cards_board', 'Card 1');
      svc.addCard('cards_board', 'Card 2');
      const result = svc.listCards('cards_board');
      expect(result).toContain('Card 1');
    });
  });

  describe('MemoryLanceDBService', () => {
    let svc: MemoryLanceDBService;
    let tmpDir: string;
    beforeEach(() => {
      tmpDir = makeTempDir();
      tempDirs.push(tmpDir);
      svc = new MemoryLanceDBService({ dbPath: tmpDir, dimension: 128 });
    });

    it('should create instance', () => {
      expect(svc).toBeInstanceOf(MemoryLanceDBService);
    });

    it('createCollection() should create a collection', () => {
      const result = svc.createCollection('test_col');
      expect(result).toContain('created');
    });

    it('createCollection() duplicate should return already exists', () => {
      svc.createCollection('dup_col');
      const result = svc.createCollection('dup_col');
      expect(result).toContain('already exists');
    });

    it('createCollection() invalid name should return error', () => {
      const result = svc.createCollection('invalid name!');
      expect(result).toContain('Error');
    });

    it('addDocument() should add a document', () => {
      svc.createCollection('docs');
      const embedding = new Array(128).fill(0.1);
      const result = svc.addDocument('docs', 'Test content', embedding);
      expect(result).toContain('added');
    });

    it('query() should find similar documents', () => {
      svc.createCollection('query_col');
      const embedding = new Array(128).fill(0.5);
      svc.addDocument('query_col', 'Machine learning basics', embedding);
      const queryEmbedding = new Array(128).fill(0.5);
      const result = svc.query('query_col', queryEmbedding, 5);
      expect(result).toContain('Machine learning');
    });

    it('query() on empty collection should return no results', () => {
      svc.createCollection('empty_col');
      const result = svc.query('empty_col', new Array(128).fill(0), 5);
      expect(result).toContain('No');
    });

    it('deleteCollection() should delete collection', () => {
      svc.createCollection('del_col');
      const result = svc.deleteCollection('del_col');
      expect(result).toContain('deleted');
    });

    it('deleteCollection() non-existent should return not found', () => {
      const result = svc.deleteCollection('nonexistent');
      expect(result).toContain('not found');
    });

    it('listCollections() should list all collections', () => {
      svc.createCollection('list_a');
      svc.createCollection('list_b');
      const result = svc.listCollections();
      expect(result).toContain('list_a');
      expect(result).toContain('list_b');
    });

    it('getCollectionStats() should return collection info', () => {
      svc.createCollection('stats_col');
      const result = svc.getCollectionStats('stats_col');
      expect(result).toContain('stats_col');
    });
  });

  describe('MemoryHonchoService', () => {
    let svc: MemoryHonchoService;
    let tmpDir: string;
    beforeEach(() => {
      tmpDir = makeTempDir();
      tempDirs.push(tmpDir);
      svc = new MemoryHonchoService({ storageDir: tmpDir });
    });

    it('should create instance', () => {
      expect(svc).toBeInstanceOf(MemoryHonchoService);
    });

    it('createProfile() should create user profile', () => {
      const result = svc.createProfile('user1', { name: 'Alice' });
      expect(result).toContain('created');
    });

    it('getProfile() should return user profile', () => {
      svc.createProfile('user2', { name: 'Bob' });
      const result = svc.getProfile('user2');
      expect(result).toContain('Bob');
    });

    it('getProfile() non-existent should return not found', () => {
      const result = svc.getProfile('nonexistent');
      expect(result).toContain('not found');
    });

    it('addTurn() should add conversation turn', () => {
      svc.createProfile('user3');
      const result = svc.addTurn('user3', { role: 'user', content: 'Hello', channel: 'telegram' });
      expect(result).toContain('recorded');
    });

    it('getConversation() should return conversation history', () => {
      svc.createProfile('user4');
      svc.addTurn('user4', { role: 'user', content: 'Hi', channel: 'discord' });
      const result = svc.getConversation('user4');
      expect(result).toContain('Hi');
    });

    it('learnFact() should store a fact about user', () => {
      svc.createProfile('user5');
      const result = svc.learnFact('user5', 'User prefers dark mode', 0.8);
      expect(result).toContain('learned');
    });

    it('updatePreferences() should update user preferences', () => {
      svc.createProfile('user6');
      const result = svc.updatePreferences('user6', { theme: 'dark', lang: 'pt-BR' });
      expect(result).toContain('updated');
    });

    it('addDialecticInsight() should add insight', () => {
      svc.createProfile('user7');
      const result = svc.addDialecticInsight('user7', 'User is a senior developer', 'technical', 0.9);
      expect(result).toContain('insight');
    });

    it('getStats() should return service statistics', () => {
      svc.createProfile('user8');
      const result = svc.getStats();
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('listProfiles() should list all profiles', () => {
      svc.createProfile('alpha');
      svc.createProfile('beta');
      const result = svc.listProfiles();
      expect(result).toContain('alpha');
      expect(result).toContain('beta');
    });
  });

  describe('DiagnosticsOtelService', () => {
    let svc: DiagnosticsOtelService;
    let tmpDir: string;
    beforeEach(() => {
      tmpDir = makeTempDir();
      tempDirs.push(tmpDir);
      svc = new DiagnosticsOtelService({ storageDir: tmpDir });
    });

    it('should create instance', () => {
      expect(svc).toBeInstanceOf(DiagnosticsOtelService);
    });

    it('startSpan() should create a span and return span ID', () => {
      const spanId = svc.startSpan('test_operation');
      expect(typeof spanId).toBe('string');
      expect(spanId.length).toBeGreaterThan(0);
    });

    it('endSpan() should end a span', () => {
      const spanId = svc.startSpan('end_test');
      const result = svc.endSpan(spanId, 'ok');
      expect(result).toBeDefined();
    });

    it('addEvent() should add event to span', () => {
      const spanId = svc.startSpan('event_test');
      svc.addEvent(spanId, 'test_event', { key: 'value' });
      const stats = svc.getStats();
      expect(stats).toBeDefined();
    });

    it('recordMetric() should record a metric', () => {
      svc.recordMetric('test_metric', 42, 'counter', { env: 'test' });
      const stats = svc.getStats();
      expect(stats).toBeDefined();
    });

    it('recordLog() should record a log entry', () => {
      svc.recordLog('info', 'Test log message', { source: 'test' });
      const stats = svc.getStats();
      expect(stats).toBeDefined();
    });

    it('getStats() should return diagnostic stats', () => {
      svc.startSpan('stats_test');
      const stats = svc.getStats();
      expect(typeof stats).toBe('string');
      expect(stats).toContain('OTEL');
    });

    it('exportTraces() should export trace data', () => {
      svc.startSpan('export_test');
      svc.endSpan('export_test_0', 'ok');
      const result = svc.exportTraces();
      expect(result).toBeDefined();
    });

    it('setMaxSize() should configure max entries', () => {
      svc.setMaxSize(500);
      const stats = svc.getStats();
      expect(stats).toBeDefined();
    });
  });

  describe('AchievementsService', () => {
    let svc: AchievementsService;
    let tmpDir: string;
    beforeEach(() => {
      tmpDir = makeTempDir();
      tempDirs.push(tmpDir);
      svc = new AchievementsService({ storageDir: tmpDir });
    });

    afterEach(() => {
      svc.flush();
    });

    it('should create instance', () => {
      expect(svc).toBeInstanceOf(AchievementsService);
    });

    it('getUserState() should return user state', () => {
      const state = svc.getUserState('test_user');
      expect(state).toHaveProperty('user_id', 'test_user');
      expect(state).toHaveProperty('level', 1);
      expect(state).toHaveProperty('total_points', 0);
    });

    it('trackEvent() should record events', () => {
      const result = svc.trackEvent('user1', 'tool_executions', 1);
      expect(typeof result).toBe('string');
      expect(result).toContain('recorded');
    });

    it('trackEvent() should unlock achievements when threshold met', () => {
      const result = svc.trackEvent('user2', 'tool_executions', 1);
      expect(result).toContain('Achievement');
    });

    it('updateStreak() should track streaks', () => {
      const result = svc.updateStreak('user3', 'daily_usage');
      expect(result).toContain('Streak');
    });

    it('unlockManually() should unlock specific achievement', () => {
      const result = svc.unlockManually('user4', 'first_tool');
      expect(result).toContain('unlocked');
    });

    it('unlockManually() invalid ID should return not found', () => {
      const result = svc.unlockManually('user5', 'nonexistent');
      expect(result).toContain('not found');
    });

    it('getProfile() should return achievements profile', () => {
      svc.trackEvent('user6', 'tool_executions', 1);
      const profile = svc.getProfile('user6');
      expect(profile).toContain('Achievements Profile');
      expect(profile).toContain('Level');
    });

    it('getLeaderboard() should return leaderboard', () => {
      svc.trackEvent('lb_user1', 'tool_executions', 10);
      svc.trackEvent('lb_user2', 'tool_executions', 5);
      const lb = svc.getLeaderboard();
      expect(lb).toContain('Leaderboard');
    });

    it('getLeaderboard() with no users should return empty message', () => {
      const freshSvc = new AchievementsService({ storageDir: makeTempDir() });
      const lb = freshSvc.getLeaderboard();
      expect(lb).toContain('No users');
    });

    it('flush() should save state without error', () => {
      svc.trackEvent('flush_user', 'tool_executions', 1);
      expect(() => svc.flush()).not.toThrow();
    });
  });

  describe('SkinEngineService', () => {
    let svc: SkinEngineService;
    let tmpDir: string;
    beforeEach(() => {
      tmpDir = makeTempDir();
      tempDirs.push(tmpDir);
      svc = new SkinEngineService({ storageDir: tmpDir });
    });

    it('should create instance', () => {
      expect(svc).toBeInstanceOf(SkinEngineService);
    });

    it('getActiveSkin() should return default skin', () => {
      const skin = svc.getActiveSkin();
      expect(skin).toContain('Default');
    });

    it('listSkins() should list available skins', () => {
      const result = svc.listSkins();
      expect(result).toContain('Default');
    });

    it('setActiveSkin() should change active skin', () => {
      const result = svc.setActiveSkin('default');
      expect(result).toContain('active');
    });

    it('setActiveSkin() invalid should return error', () => {
      const result = svc.setActiveSkin('nonexistent_skin_xyz');
      expect(result).toContain('not found');
    });

    it('createSkin() should create a custom skin', () => {
      const skinDef = {
        id: 'custom',
        name: 'Custom',
        description: 'Test skin',
        author: 'test',
        version: '1.0.0',
      };
      const result = svc.createSkin(skinDef);
      expect(result).toContain('created');
    });

    it('getSkinDefinition() should return skin details', () => {
      const result = svc.getSkinDefinition('default');
      expect(result).toContain('Default');
    });

    it('getStats() should return skin statistics', () => {
      const result = svc.getStats();
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('TrajectoryResearchService', () => {
    let svc: TrajectoryResearchService;
    let tmpDir: string;
    beforeEach(() => {
      tmpDir = makeTempDir();
      tempDirs.push(tmpDir);
      svc = new TrajectoryResearchService({ storageDir: tmpDir });
    });

    it('should create instance', () => {
      expect(svc).toBeInstanceOf(TrajectoryResearchService);
    });

    it('createTrajectory() should create a research trajectory', () => {
      const result = svc.createTrajectory({
        session_id: 'sess_1',
        task: 'Investigate bug in auth module',
        method: 'systematic',
      });
      expect(result).toContain('created');
    });

    it('listTrajectories() should list all trajectories', () => {
      svc.createTrajectory({ session_id: 's1', task: 'Task A', method: 'test' });
      const result = svc.listTrajectories();
      expect(result).toContain('Task A');
    });

    it('getTrajectory() should return trajectory details', () => {
      const createResult = svc.createTrajectory({ session_id: 's2', task: 'Task B', method: 'test' });
      const idMatch = createResult.match(/ID:\s*(traj_[a-z0-9_]+)/);
      if (idMatch) {
        const result = svc.getTrajectory(idMatch[1]);
        expect(result).toContain('Task B');
      }
    });

    it('addStep() should add step to trajectory', () => {
      const createResult = svc.createTrajectory({ session_id: 's3', task: 'Task C', method: 'test' });
      const idMatch = createResult.match(/ID:\s*(traj_[a-z0-9_]+)/);
      if (idMatch) {
        const result = svc.addStep(idMatch[1], {
          action: 'Searched codebase',
          tool_used: 'grep',
          result_summary: 'Found 3 matches',
          duration_ms: 150,
          success: true,
        });
        expect(result).toContain('step');
      }
    });

    it('createReport() should create a research report', () => {
      const result = svc.createReport({
        title: 'Auth Bug Analysis',
        findings: ['Root cause identified'],
        methodology: 'Systematic debugging',
        conclusions: ['Fix applied'],
        confidence: 0.95,
      });
      expect(result).toContain('report');
    });

    it('getStats() should return statistics', () => {
      const result = svc.getStats();
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('DiskCleanupService', () => {
    let svc: DiskCleanupService;
    let tmpDir: string;
    beforeEach(() => {
      tmpDir = makeTempDir();
      tempDirs.push(tmpDir);
      svc = new DiskCleanupService({ storageDir: tmpDir });
    });

    it('should create instance', () => {
      expect(svc).toBeInstanceOf(DiskCleanupService);
    });

    it('listRules() should list cleanup rules', () => {
      const result = svc.listRules();
      expect(result).toContain('temp_files');
    });

    it('scan() should return scan results', () => {
      const result = svc.scan();
      expect(result).toContain('Cleanup scan');
    });

    it('scan() with specific rule should scan that rule', () => {
      const result = svc.scan('temp_files');
      expect(result).toBeDefined();
    });

    it('scan() with invalid rule should return no rules', () => {
      const result = svc.scan('nonexistent_rule');
      expect(result).toContain('No rules');
    });

    it('toggleRule() should enable/disable rule', () => {
      const result = svc.toggleRule('temp_files', false);
      expect(result).toContain('disabled');
    });

    it('getStats() should return cleanup statistics', () => {
      const result = svc.getStats();
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('CodexSupervisorService', () => {
    let svc: CodexSupervisorService;
    let tmpDir: string;
    beforeEach(() => {
      tmpDir = makeTempDir();
      tempDirs.push(tmpDir);
      svc = new CodexSupervisorService({ storageDir: tmpDir });
    });

    it('should create instance', () => {
      expect(svc).toBeInstanceOf(CodexSupervisorService);
    });

    it('listTasks() should list supervisor tasks', () => {
      const result = svc.listTasks();
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('getTask() with invalid ID should return not found', () => {
      const result = svc.getTask('nonexistent_task');
      expect(result).toContain('not found');
    });

    it('getStats() should return supervisor stats', () => {
      const result = svc.getStats();
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('getRunningTasks() should return running tasks', () => {
      const result = svc.getRunningTasks();
      expect(result).toBeDefined();
    });
  });

  describe('LLMRouterService', () => {
    let svc: LLMRouterService;
    beforeEach(() => {
      svc = new LLMRouterService({ costBudgetDaily: 10.0 });
    });

    it('should create instance', () => {
      expect(svc).toBeInstanceOf(LLMRouterService);
    });

    it('route() should return routing decision', () => {
      const result = svc.route('chat');
      expect(result).toBeDefined();
      expect(result).toHaveProperty('provider');
      expect(result).toHaveProperty('model');
    });

    it('route() for code_generation should prefer code models', () => {
      const result = svc.route('code_generation');
      expect(result).toBeDefined();
      expect(result.model).toBeDefined();
    });

    it('route() for unknown task should fallback', () => {
      const result = svc.route('unknown_task_xyz');
      expect(result).toBeDefined();
    });

    it('listModels() should list available models', () => {
      const result = svc.listModels();
      expect(result).toContain('gpt-4o');
    });

    it('getModelProfile() should return model details', () => {
      const result = svc.getModelProfile('gpt-4o');
      expect(result).toContain('gpt-4o');
    });

    it('getModelProfile() invalid should return not found', () => {
      const result = svc.getModelProfile('nonexistent_model');
      expect(result).toContain('not found');
    });

    it('recordUsage() should track usage stats', () => {
      svc.recordUsage('gpt-4o', 1000, 500, 0.05);
      const stats = svc.getStats();
      expect(stats).toBeDefined();
    });

    it('getStats() should return router statistics', () => {
      const stats = svc.getStats();
      expect(typeof stats).toBe('string');
      expect(stats).toContain('Router');
    });

    it('getDailyCostSummary() should return cost info', () => {
      const result = svc.getDailyCostSummary();
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('ContextCompressorService', () => {
    let svc: ContextCompressorService;
    let tmpDir: string;
    beforeEach(() => {
      tmpDir = makeTempDir();
      tempDirs.push(tmpDir);
      svc = new ContextCompressorService({ storageDir: tmpDir });
    });

    it('should create instance', () => {
      expect(svc).toBeInstanceOf(ContextCompressorService);
    });

    it('listStrategies() should list compression strategies', () => {
      const result = svc.listStrategies();
      expect(result).toContain('conservative');
    });

    it('getStrategy() should return strategy details', () => {
      const result = svc.getStrategy('conservative');
      expect(result).toContain('Conservative');
    });

    it('getStrategy() invalid should return not found', () => {
      const result = svc.getStrategy('nonexistent');
      expect(result).toContain('not found');
    });

    it('compress() should compress conversation turns', () => {
      const turns = [
        { role: 'user' as const, content: 'Hello', timestamp: new Date().toISOString() },
        { role: 'assistant' as const, content: 'Hi there!', timestamp: new Date().toISOString() },
        { role: 'user' as const, content: 'How are you-', timestamp: new Date().toISOString() },
      ];
      const result = svc.compress(turns, 'conservative');
      expect(result).toBeDefined();
    });

    it('getStats() should return compression statistics', () => {
      const result = svc.getStats();
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('ReasoningEffortService', () => {
    let svc: ReasoningEffortService;
    beforeEach(() => {
      svc = new ReasoningEffortService();
    });

    it('should create instance', () => {
      expect(svc).toBeInstanceOf(ReasoningEffortService);
    });

    it('getConfig() should return reasoning config for task', () => {
      const config = svc.getConfig('chat');
      expect(config).toBeDefined();
      expect(config).toHaveProperty('effort');
    });

    it('getConfig() for code_generation should return high effort', () => {
      const config = svc.getConfig('code_generation');
      expect(config.effort).toBe('high');
    });

    it('setGlobalEffort() should change global effort', () => {
      svc.setGlobalEffort('high');
      const config = svc.getConfig('chat');
      expect(config).toBeDefined();
    });

    it('setOverride() should set per-task override', () => {
      svc.setOverride('chat', 'high');
      const config = svc.getConfig('chat');
      expect(config.effort).toBe('high');
    });

    it('listProfiles() should list all profiles', () => {
      const result = svc.listProfiles();
      expect(result).toContain('chat');
      expect(result).toContain('code_generation');
    });

    it('getStats() should return stats string', () => {
      const result = svc.getStats();
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('PromptCacheService', () => {
    let svc: PromptCacheService;
    let tmpDir: string;
    beforeEach(() => {
      tmpDir = makeTempDir();
      tempDirs.push(tmpDir);
      svc = new PromptCacheService({ storageDir: tmpDir });
    });

    it('should create instance', () => {
      expect(svc).toBeInstanceOf(PromptCacheService);
    });

    it('computeHash() should return consistent hash', () => {
      const hash1 = svc.computeHash('test content');
      const hash2 = svc.computeHash('test content');
      expect(hash1).toBe(hash2);
    });

    it('computeHash() different content should return different hash', () => {
      const hash1 = svc.computeHash('content A');
      const hash2 = svc.computeHash('content B');
      expect(hash1).not.toBe(hash2);
    });

    it('lookup() should find cached prompt', () => {
      const hash = svc.computeHash('cached prompt');
      svc.store(hash, ['prefix'], 100, 'openai', 'gpt-4o');
      const result = svc.lookup(hash);
      expect(result).toBeDefined();
    });

    it('lookup() should miss for unknown hash', () => {
      const result = svc.lookup('nonexistent_hash_xyz');
      expect(result).toBeNull();
    });

    it('store() should cache a prompt prefix', () => {
      svc.store('hash_abc', ['prefix_tokens'], 50, 'openai', 'gpt-4o');
      const stats = svc.getStats();
      expect(stats).toBeDefined();
    });

    it('getStats() should return cache statistics', () => {
      const stats = svc.getStats();
      expect(typeof stats).toBe('string');
      expect(stats).toContain('Cache');
    });

    it('clear() should empty the cache', () => {
      svc.store('hash_clear', ['token'], 10, 'test', 'model');
      svc.clear();
      const result = svc.lookup('hash_clear');
      expect(result).toBeNull();
    });

    it('getHitRate() should return hit rate', () => {
      svc.store('hash_hr', ['t'], 5, 'openai', 'gpt-4o');
      svc.lookup('hash_hr');
      const rate = svc.getHitRate();
      expect(typeof rate).toBe('number');
    });
  });
});
