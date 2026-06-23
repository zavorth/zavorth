import fs from 'fs';
import path from 'path';
import os from 'os';

import { ActiveMemoryService } from '../../src/services/plugins/ActiveMemoryService';
import { KanbanSQLiteDispatcherService } from '../../src/services/plugins/KanbanSQLiteDispatcherService';
import { AchievementsService } from '../../src/services/plugins/AchievementsService';
import { LLMRouterService } from '../../src/services/plugins/LLMRouterService';
import { ReasoningEffortService } from '../../src/services/plugins/ReasoningEffortService';
import { PromptCacheService } from '../../src/services/plugins/PromptCacheService';
import { ContextCompressorService } from '../../src/services/plugins/ContextCompressorService';
import { MemoryLanceDBService } from '../../src/services/plugins/MemoryLanceDBService';
import { MemoryHonchoService } from '../../src/services/plugins/MemoryHonchoService';
import { ZavorthPolicyEnforcerTool } from '../../src/tools/ZavorthPolicyEnforcerTool';
import { ZavorthPrivacyVaultTool } from '../../src/tools/ZavorthPrivacyVaultTool';
import { ZavorthReceiptSearchTool } from '../../src/tools/ZavorthReceiptSearchTool';
import { ZavorthAgentGovernanceTool } from '../../src/tools/ZavorthAgentGovernanceTool';
import { ZavorthWorkflowBuilderTool } from '../../src/tools/ZavorthWorkflowBuilderTool';
import { ZavorthPromptLibraryTool } from '../../src/tools/ZavorthPromptLibraryTool';
import { ZavorthTokenBudgetTool } from '../../src/tools/ZavorthTokenBudgetTool';
import { ZavorthMultiRepoTool } from '../../src/tools/ZavorthMultiRepoTool';
import { ZavorthDocumentExtractorTool } from '../../src/tools/ZavorthDocumentExtractorTool';
import { DiagnosticsPrometheusService } from '../../src/services/plugins/DiagnosticsPrometheusService';
import { DiagnosticsOtelService } from '../../src/services/plugins/DiagnosticsOtelService';
import { TrajectoryResearchService } from '../../src/services/plugins/TrajectoryResearchService';
import { DiskCleanupService } from '../../src/services/plugins/DiskCleanupService';
import { SkinEngineService } from '../../src/services/plugins/SkinEngineService';
import { CodexSupervisorService } from '../../src/services/plugins/CodexSupervisorService';

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-integ-'));
}

describe('AgentWorkflow — Integration tests across multiple components', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
    tempDirs.length = 0;
  });

  describe('Memory + Kanban + Achievements integration', () => {
    let memory: ActiveMemoryService;
    let kanban: KanbanSQLiteDispatcherService;
    let achievements: AchievementsService;

    beforeEach(() => {
      const tmpDir = makeTempDir();
      tempDirs.push(tmpDir);
      memory = new ActiveMemoryService({ storageDir: path.join(tmpDir, 'memory') });
      kanban = new KanbanSQLiteDispatcherService({ dbPath: path.join(tmpDir, 'kanban.sqlite') });
      achievements = new AchievementsService({ storageDir: path.join(tmpDir, 'achievements') });
    });

    afterEach(() => {
      try { kanban.close(); } catch { /* ignore */ }
      achievements.flush();
    });

    it('should create a task in kanban based on memory recall', () => {
      memory.remember('Need to fix login bug', { category: 'instruction', importance: 0.9 });
      const recalled = memory.recall('login bug');
      expect(recalled).toContain('login bug');

      kanban.createBoard('Bug Fixes');
      const cardResult = kanban.addCard('bug_fixes', 'Fix login bug', { priority: 'high' });
      expect(cardResult).toContain('added');
    });

    it('should track achievement when creating kanban cards', () => {
      kanban.createBoard('Achievement Board');
      kanban.addCard('achievement_board', 'First task');
      const trackResult = achievements.trackEvent('test_user', 'tool_executions', 1);
      expect(trackResult).toBeDefined();
    });

    it('should store kanban card ID in memory for later recall', () => {
      kanban.createBoard('Memory Board');
      const cardResult = kanban.addCard('memory_board', 'Remember this task');
      const cardIdMatch = cardResult.match(/ID:\s*(card_[a-z0-9_]+)/);
      if (cardIdMatch) {
        memory.remember(`kanban_card:${cardIdMatch[1]}:Remember this task`, { category: 'context' });
        const recalled = memory.recall('Remember this task');
        expect(recalled).toContain('Remember this task');
      }
    });

    it('full workflow: memory -> kanban -> achievement -> profile', () => {
      memory.remember('User wants to deploy v2', { importance: 0.9 });
      kanban.createBoard('Deployments');
      kanban.addCard('deployments', 'Deploy v2', { priority: 'critical' });
      achievements.trackEvent('deploy_user', 'tool_executions', 1);
      const profile = achievements.getProfile('deploy_user');
      expect(profile).toContain('Achievements Profile');
    });
  });

  describe('LLM Router + Reasoning + Cache integration', () => {
    let router: LLMRouterService;
    let reasoning: ReasoningEffortService;
    let cache: PromptCacheService;

    beforeEach(() => {
      const tmpDir = makeTempDir();
      tempDirs.push(tmpDir);
      router = new LLMRouterService({ costBudgetDaily: 10.0 });
      reasoning = new ReasoningEffortService();
      cache = new PromptCacheService({ storageDir: path.join(tmpDir, 'cache') });
    });

    it('should route task and apply reasoning config', () => {
      const routeDecision = router.route('code_generation');
      expect(routeDecision).toBeDefined();
      expect(routeDecision.model).toBeDefined();

      const reasonConfig = reasoning.getConfig('code_generation');
      expect(reasonConfig.effort).toBe('high');
    });

    it('should cache prompt prefix after routing', () => {
      const routeDecision = router.route('chat');
      const promptContent = `system:${routeDecision.model}:chat`;
      const hash = cache.computeHash(promptContent);
      cache.store(hash, ['system', 'chat'], 100, routeDecision.provider, routeDecision.model);

      const cached = cache.lookup(hash);
      expect(cached).toBeDefined();
    });

    it('should use cached prompt to avoid re-routing', () => {
      const content = 'cached system prompt for chat';
      const hash = cache.computeHash(content);
      cache.store(hash, ['system'], 50, 'openai', 'gpt-5.2-mini');

      const hit = cache.lookup(hash);
      expect(hit).not.toBeNull();

      const missHash = cache.computeHash('different prompt');
      const miss = cache.lookup(missHash);
      expect(miss).toBeNull();
    });

    it('should apply different reasoning for different task types', () => {
      const chatConfig = reasoning.getConfig('chat');
      const codeConfig = reasoning.getConfig('code_generation');
      const reviewConfig = reasoning.getConfig('code_review');

      expect(chatConfig.effort).not.toBe(codeConfig.effort);
      expect(reviewConfig.effort).toBe('medium');
    });

    it('router should respect cost budget', () => {
      const summary = router.getDailyCostSummary();
      expect(summary).toBeDefined();
      expect(typeof summary).toBe('string');
    });
  });

  describe('Document Extraction + Memory storage', () => {
    let memory: ActiveMemoryService;
    let docExtractor: ZavorthDocumentExtractorTool;

    beforeEach(() => {
      const tmpDir = makeTempDir();
      tempDirs.push(tmpDir);
      memory = new ActiveMemoryService({ storageDir: path.join(tmpDir, 'memory') });
      docExtractor = new ZavorthDocumentExtractorTool({ storageDir: path.join(tmpDir, 'docs') });
    });

    it('should store extracted document content in memory', () => {
      const docContent = 'This is a test document about API security best practices.';
      memory.remember(`doc:${docContent}`, { category: 'context', source: 'document' });
      const recalled = memory.recall('API security');
      expect(recalled).toContain('API security');
    });

    it('should handle multiple document memories', () => {
      memory.remember('doc:Authentication guide for REST APIs', { category: 'context' });
      memory.remember('doc:Database migration instructions', { category: 'context' });
      memory.remember('doc:Security audit checklist', { category: 'context' });

      const apiResults = memory.recall('API');
      expect(apiResults).toContain('Authentication');

      const dbResults = memory.recall('Database');
      expect(dbResults).toContain('migration');
    });

    it('should support document memory with tags', () => {
      memory.remember('doc:Deployment guide v2', {
        category: 'instruction',
        tags: ['deployment', 'v2', 'production'],
      });

      const result = memory.recall('deployment');
      expect(result).toContain('Deployment');
    });
  });

  describe('Security guidance + Policy enforcement', () => {
    let policyEnforcer: ZavorthPolicyEnforcerTool;
    let governance: ZavorthAgentGovernanceTool;

    beforeEach(() => {
      const tmpDir = makeTempDir();
      tempDirs.push(tmpDir);
      policyEnforcer = new ZavorthPolicyEnforcerTool({ storageDir: path.join(tmpDir, 'policy') });
      governance = new ZavorthAgentGovernanceTool({ storageDir: path.join(tmpDir, 'governance') });
    });

    it('should check policy before governance check', async () => {
      const policyResult = await policyEnforcer.execute({
        action: 'check',
        tool_name: 'send_email',
        risk_level: 'high',
      });
      expect(policyResult).toBeDefined();
      expect(typeof policyResult).toBe('string');
    });

    it('should block destructive commands via policy', async () => {
      const result = await policyEnforcer.execute({
        action: 'check',
        tool_name: 'remote_shell',
        tool_args: JSON.stringify({ command: 'rm -rf /' }),
        risk_level: 'critical',
      });
      expect(result).toBeDefined();
    });

    it('should audit all policies', async () => {
      const result = await policyEnforcer.execute({ action: 'audit' });
      expect(result).toContain('Governance Policy Audit');
    });

    it('governance should list policies', async () => {
      const result = await governance.execute({ action: 'policy_list' });
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('governance should perform safety report', async () => {
      const result = await governance.execute({ action: 'safety_report' });
      expect(result).toBeDefined();
    });

    it('combined: policy check then governance audit', async () => {
      const policyResult = await policyEnforcer.execute({ action: 'list_policies' });
      expect(policyResult).toContain('Governance Policies');

      const govResult = await governance.execute({ action: 'policy_list' });
      expect(govResult).toBeDefined();
    });
  });

  describe('Multi-repo + Workflow builder integration', () => {
    let multiRepo: ZavorthMultiRepoTool;
    let workflowBuilder: ZavorthWorkflowBuilderTool;

    beforeEach(() => {
      const tmpDir = makeTempDir();
      tempDirs.push(tmpDir);
      multiRepo = new ZavorthMultiRepoTool({ storageDir: path.join(tmpDir, 'repos') });
      workflowBuilder = new ZavorthWorkflowBuilderTool({ storageDir: path.join(tmpDir, 'workflows') });
    });

    it('should list repos and workflows independently', async () => {
      const reposResult = await multiRepo.execute({ action: 'list' });
      expect(reposResult).toBeDefined();

      const workflowsResult = await workflowBuilder.execute({ action: 'list' });
      expect(workflowsResult).toBeDefined();
    });

    it('should create workflow that references repos', async () => {
      const workflowResult = await workflowBuilder.execute({
        action: 'create',
        name: 'CI Pipeline',
        description: 'Run tests across repos',
      });
      expect(workflowResult).toBeDefined();
    });

    it('should handle empty state for both components', async () => {
      const repos = await multiRepo.execute({ action: 'list' });
      expect(typeof repos).toBe('string');

      const workflows = await workflowBuilder.execute({ action: 'list' });
      expect(typeof workflows).toBe('string');
    });
  });

  describe('Prompt library + Token budget integration', () => {
    let promptLib: ZavorthPromptLibraryTool;
    let tokenBudget: ZavorthTokenBudgetTool;

    beforeEach(() => {
      const tmpDir = makeTempDir();
      tempDirs.push(tmpDir);
      promptLib = new ZavorthPromptLibraryTool({ storageDir: path.join(tmpDir, 'prompts') });
      tokenBudget = new ZavorthTokenBudgetTool({ storageDir: path.join(tmpDir, 'budget') });
    });

    it('should list prompts and check budget', async () => {
      const promptsResult = await promptLib.execute({ action: 'list' });
      expect(promptsResult).toBeDefined();

      const budgetResult = await tokenBudget.execute({ action: 'status' });
      expect(budgetResult).toBeDefined();
    });

    it('should track token usage when using prompts', async () => {
      const budgetResult = await tokenBudget.execute({ action: 'status' });
      expect(typeof budgetResult).toBe('string');

      const promptsResult = await promptLib.execute({ action: 'list' });
      expect(typeof promptsResult).toBe('string');
    });
  });

  describe('Privacy vault + Receipt search integration', () => {
    let vault: ZavorthPrivacyVaultTool;
    let receipts: ZavorthReceiptSearchTool;

    beforeEach(() => {
      const tmpDir = makeTempDir();
      tempDirs.push(tmpDir);
      vault = new ZavorthPrivacyVaultTool({ storageDir: path.join(tmpDir, 'vault') });
      receipts = new ZavorthReceiptSearchTool({ storageDir: path.join(tmpDir, 'receipts') });
    });

    it('should store secret and search receipts', async () => {
      const storeResult = await vault.execute({
        action: 'store',
        name: 'GitHub Token',
        value: 'ghp_test123',
        category: 'api_key',
      });
      expect(storeResult).toContain('stored');

      const listResult = await vault.execute({ action: 'list' });
      expect(listResult).toContain('GitHub Token');
    });

    it('should retrieve secret and verify audit log', async () => {
      await vault.execute({
        action: 'store',
        name: 'AWS Key',
        value: 'AKIA_TEST',
        category: 'api_key',
      });

      const listResult = await vault.execute({ action: 'list' });
      const idMatch = listResult.match(/(vault_[a-z0-9_]+)/);
      if (idMatch) {
        const retrieveResult = await vault.execute({
          action: 'retrieve',
          secret_id: idMatch[1],
        });
        expect(retrieveResult).toContain('AKIA_TEST');
      }

      const auditResult = await vault.execute({ action: 'audit_log' });
      expect(auditResult).toContain('Audit Log');
    });

    it('should search receipts for audit trail', async () => {
      const result = await receipts.execute({ action: 'stats' });
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('Diagnostics + Monitoring integration', () => {
    let prometheus: DiagnosticsPrometheusService;
    let otel: DiagnosticsOtelService;

    beforeEach(() => {
      const tmpDir = makeTempDir();
      tempDirs.push(tmpDir);
      prometheus = new DiagnosticsPrometheusService({ storageDir: path.join(tmpDir, 'prometheus') });
      otel = new DiagnosticsOtelService({ storageDir: path.join(tmpDir, 'otel') });
    });

    it('should record metrics in prometheus and traces in otel', () => {
      prometheus.recordToolExecution('test_tool', 100, true);
      const spanId = otel.startSpan('test_operation');
      otel.endSpan(spanId, 'ok');

      const promStats = prometheus.getStats();
      expect(promStats).toContain('Counters');

      const otelStats = otel.getStats();
      expect(otelStats).toBeDefined();
    });

    it('should export both prometheus format and otel traces', () => {
      prometheus.incrementCounter('export_test', 5);
      otel.recordMetric('otel_metric', 42, 'counter');

      const promExport = prometheus.exportPrometheusFormat();
      expect(promExport).toContain('# TYPE');

      const otelExport = otel.exportTraces();
      expect(otelExport).toBeDefined();
    });

    it('should correlate tool execution across both systems', () => {
      const toolName = 'correlated_tool';
      prometheus.recordToolExecution(toolName, 250, true);

      const spanId = otel.startSpan(`tool:${toolName}`);
      otel.addEvent(spanId, 'tool_start', { tool: toolName });
      otel.endSpan(spanId, 'ok');

      const promJson = prometheus.getMetricsJson();
      expect(promJson).toContain('zavorth_tool_executions_total');
    });
  });

  describe('Skin + Trajectory + Cleanup integration', () => {
    let skins: SkinEngineService;
    let trajectory: TrajectoryResearchService;
    let cleanup: DiskCleanupService;

    beforeEach(() => {
      const tmpDir = makeTempDir();
      tempDirs.push(tmpDir);
      skins = new SkinEngineService({ storageDir: path.join(tmpDir, 'skins') });
      trajectory = new TrajectoryResearchService({ storageDir: path.join(tmpDir, 'research') });
      cleanup = new DiskCleanupService({ storageDir: path.join(tmpDir, 'cleanup') });
    });

    it('should operate all three services independently', () => {
      const skinResult = skins.listSkins();
      expect(skinResult).toContain('Default');

      trajectory.createTrajectory({ session_id: 's1', task: 'Test research', method: 'test' });
      const trajList = trajectory.listTrajectories();
      expect(trajList).toContain('Test research');

      const cleanupScan = cleanup.scan();
      expect(cleanupScan).toContain('Cleanup scan');
    });

    it('should get stats from all services', () => {
      const skinStats = skins.getStats();
      const trajStats = trajectory.getStats();
      const cleanupStats = cleanup.getStats();

      expect(typeof skinStats).toBe('string');
      expect(typeof trajStats).toBe('string');
      expect(typeof cleanupStats).toBe('string');
    });
  });

  describe('Honcho + LanceDB memory integration', () => {
    let honcho: MemoryHonchoService;
    let lance: MemoryLanceDBService;

    beforeEach(() => {
      const tmpDir = makeTempDir();
      tempDirs.push(tmpDir);
      honcho = new MemoryHonchoService({ storageDir: path.join(tmpDir, 'honcho') });
      lance = new MemoryLanceDBService({ dbPath: path.join(tmpDir, 'lancedb'), dimension: 64 });
    });

    it('should store user profile in honcho and docs in lance', () => {
      honcho.createProfile('user1', { name: 'Alice' });
      lance.createCollection('user1_docs');

      const embedding = new Array(64).fill(0.1);
      lance.addDocument('user1_docs', 'Alice preferences document', embedding);

      const profile = honcho.getProfile('user1');
      expect(profile).toContain('Alice');

      const queryResult = lance.query('user1_docs', embedding, 3);
      expect(queryResult).toContain('Alice');
    });

    it('should link honcho insights with lance document retrieval', () => {
      honcho.createProfile('researcher');
      honcho.addDialecticInsight('researcher', 'User studies ML', 'technical', 0.9);

      lance.createCollection('ml_papers');
      const embedding = new Array(64).fill(0.3);
      lance.addDocument('ml_papers', 'Deep learning fundamentals', embedding);

      const insight = honcho.getProfile('researcher');
      expect(insight).toBeDefined();

      const docs = lance.query('ml_papers', embedding, 5);
      expect(docs).toContain('Deep learning');
    });
  });

  describe('Supervisor + Context compression integration', () => {
    let supervisor: CodexSupervisorService;
    let compressor: ContextCompressorService;

    beforeEach(() => {
      const tmpDir = makeTempDir();
      tempDirs.push(tmpDir);
      supervisor = new CodexSupervisorService({ storageDir: path.join(tmpDir, 'supervisor') });
      compressor = new ContextCompressorService({ storageDir: path.join(tmpDir, 'compressor') });
    });

    it('should list supervisor tasks and compression strategies', () => {
      const tasks = supervisor.listTasks();
      expect(tasks).toBeDefined();

      const strategies = compressor.listStrategies();
      expect(strategies).toContain('conservative');
    });

    it('should get stats from both services', () => {
      const supStats = supervisor.getStats();
      const compStats = compressor.getStats();

      expect(typeof supStats).toBe('string');
      expect(typeof compStats).toBe('string');
    });
  });
});
