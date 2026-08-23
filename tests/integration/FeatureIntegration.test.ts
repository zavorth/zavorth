import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

import { AccessControlService } from '../../src/security/AccessControlService';
import { SessionCloner } from '../../src/runtime/sessions/SessionCloner';
import { SessionCheckpoint } from '../../src/runtime/sessions/SessionCheckpoint';
import { MessageBus } from '../../src/agents/MessageBus';
import { AgentCommunicator } from '../../src/agents/AgentCommunicator';
import { ToolVersionRegistry } from '../../src/tools/ToolVersionRegistry';
import { SupplyChainVerifier } from '../../src/security/SupplyChainVerifier';
import { SessionAnalyticsZavorthControl as SessionAnalyticsDashboard } from '../../src/services/SessionAnalyticsZavorthControl';
import { ModelFallbackChain } from '../../src/agents/ModelFallbackChain';
import { ZavorthI18nService } from '../../src/i18n/ZavorthI18nService';


function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'feature-integ-'));
}

function sampleSessionData(sessionId: string) {
  return {
    messages: [
      { role: 'user', content: 'Hello', timestamp: '2025-01-01T00:00:00Z' },
      { role: 'assistant', content: 'Hi there', timestamp: '2025-01-01T00:00:01Z' },
    ],
    memory: [{ id: 'mem1', content: 'Remember this', keywords: ['test'] }],
    config: { model: 'gpt-4o', temperature: 0.7 },
    toolState: { activeTool: 'read_file' },
    metadata: { sessionId },
  };
}

describe('FeatureIntegration — Cross-module integration tests', () => {
  // ──────────────────────────────────────────────────────────────
  // 1. RBAC + Access Control
  // ──────────────────────────────────────────────────────────────
  describe('RBAC + Access Control', () => {
    let dir: string;
    let acs: AccessControlService;

    beforeEach(() => {
      dir = makeTempDir();
      acs = new AccessControlService(dir, { enforceMode: 'both', denyOverrides: true });
    });

    afterEach(() => {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* cleanup */ }
    });

    it('should allow access when RBAC grants role and ABAC policy matches', () => {
      const rbac = acs.getRbacEngine();
      rbac.createRole({ id: 'editor', name: 'Editor', description: 'Can edit docs', permissions: [] });
      rbac.createPermission({ id: 'perm_edit', name: 'Edit', description: 'Edit doc', resource: 'document', action: 'edit' });
      rbac.assignPermissionToRole('editor', 'perm_edit');
      rbac.assignRoleToUser('user1', 'editor');

      acs.createAbacPolicy({
        id: 'abac_editor',
        name: 'Allow editors during business hours',
        description: 'Allow edit when department is engineering',
        resource: 'document',
        action: 'edit',
        condition: { attribute: 'department', operator: 'equals', value: 'engineering' },
        effect: 'ALLOW',
        priority: 10,
        enabled: true,
      });

      const decision = acs.checkAccess({
        userId: 'user1',
        resource: 'document',
        action: 'edit',
        attributes: { department: 'engineering' },
      });

      expect(decision.allowed).toBe(true);
      expect(decision.enforceMode).toBe('both');
      expect(decision.rbacResult).toBeDefined();
      expect(decision.abacResult).toBeDefined();
    });

    it('should deny access when RBAC grants but ABAC policy denies', () => {
      const rbac = acs.getRbacEngine();
      rbac.createRole({ id: 'viewer', name: 'Viewer', description: 'Can view', permissions: [] });
      rbac.createPermission({ id: 'perm_view', name: 'View', description: 'View doc', resource: 'document', action: 'view' });
      rbac.assignPermissionToRole('viewer', 'perm_view');
      rbac.assignRoleToUser('user1', 'viewer');

      acs.createAbacPolicy({
        id: 'abac_deny_sensitive',
        name: 'Deny viewing sensitive docs',
        description: 'Deny view for confidential resources',
        resource: 'document',
        action: 'view',
        condition: { attribute: 'classification', operator: 'equals', value: 'confidential' },
        effect: 'DENY',
        priority: 100,
        enabled: true,
      });

      const decision = acs.checkAccess({
        userId: 'user1',
        resource: 'document',
        action: 'view',
        attributes: { classification: 'confidential' },
      });

      expect(decision.allowed).toBe(false);
      expect(decision.deniedBy).toBe('abac_deny_sensitive');
    });

    it('should apply override rules that bypass both RBAC and ABAC', () => {
      acs.addOverrideRule({
        id: 'emergency_override',
        resource: 'document',
        action: 'delete',
        effect: 'DENY',
        priority: 1000,
        description: 'Emergency: block all deletes',
      });

      const rbac = acs.getRbacEngine();
      rbac.createRole({ id: 'admin', name: 'Admin', description: 'Full access', permissions: [] });
      rbac.createPermission({ id: 'perm_delete', name: 'Delete', description: 'Delete doc', resource: 'document', action: 'delete' });
      rbac.assignPermissionToRole('admin', 'perm_delete');
      rbac.assignRoleToUser('admin_user', 'admin');

      const decision = acs.checkAccess({
        userId: 'admin_user',
        resource: 'document',
        action: 'delete',
      });

      expect(decision.allowed).toBe(false);
      expect(decision.overrideApplied).toBe('emergency_override');
    });

    it('should combine role-based and attribute-based decisions across multiple users', () => {
      const rbac = acs.getRbacEngine();
      rbac.createRole({ id: 'reader', name: 'Reader', description: 'Read only', permissions: [] });
      rbac.createRole({ id: 'writer', name: 'Writer', description: 'Read and write', permissions: [] });
      rbac.createPermission({ id: 'perm_r', name: 'Read', description: 'Read', resource: 'document', action: 'read' });
      rbac.createPermission({ id: 'perm_w', name: 'Write', description: 'Write', resource: 'document', action: 'write' });
      rbac.assignPermissionToRole('reader', 'perm_r');
      rbac.assignPermissionToRole('writer', 'perm_r');
      rbac.assignPermissionToRole('writer', 'perm_w');
      rbac.assignRoleToUser('alice', 'writer');
      rbac.assignRoleToUser('bob', 'reader');

      acs.createAbacPolicy({
        id: 'abac_internal_only',
        name: 'Internal users only',
        description: 'Allow only internal users',
        resource: 'document',
        action: 'write',
        condition: { attribute: 'network', operator: 'equals', value: 'internal' },
        effect: 'ALLOW',
        priority: 10,
        enabled: true,
      });

      const aliceDecision = acs.checkAccess({
        userId: 'alice',
        resource: 'document',
        action: 'write',
        attributes: { network: 'internal' },
      });
      expect(aliceDecision.allowed).toBe(true);

      const bobWriteDecision = acs.checkAccess({
        userId: 'bob',
        resource: 'document',
        action: 'write',
        attributes: { network: 'internal' },
      });
      expect(bobWriteDecision.allowed).toBe(false);
      expect(bobWriteDecision.rbacResult?.allowed).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // 2. Session Clone + Checkpoint
  // ──────────────────────────────────────────────────────────────
  describe('Session Clone + Checkpoint', () => {
    let cloner: SessionCloner;
    let checkpoint: SessionCheckpoint;

    beforeEach(() => {
      cloner = new SessionCloner();
      checkpoint = new SessionCheckpoint({ maxCheckpointsPerSession: 100 });
    });

    it('should clone a session and then checkpoint the clone independently', () => {
      const originalData = sampleSessionData('ses_original');
      cloner.registerSession('ses_original', originalData);

      const clone = cloner.cloneSession('ses_original', { includeMemory: true, includeHistory: true });
      expect(clone.sourceId).toBe('ses_original');
      expect(clone.type).toBe('clone');

      const clonedData = cloner.getSessionData(clone.id);
      expect(clonedData).not.toBeNull();
      expect(clonedData!.messages).toHaveLength(2);
      expect(clonedData!.memory).toHaveLength(1);

      checkpoint.registerSession('ses_original', originalData);
      checkpoint.registerSession(clone.id, clonedData!);

      const cpOriginal = checkpoint.createCheckpoint('ses_original', 'original-baseline');
      const cpClone = checkpoint.createCheckpoint(clone.id, 'clone-after-clone');

      expect(cpOriginal.sessionId).toBe('ses_original');
      expect(cpClone.sessionId).toBe(clone.id);
      expect(cpOriginal.number).toBe(1);
      expect(cpClone.number).toBe(1);

      expect(cpOriginal.data.messages).toHaveLength(2);
      expect(cpClone.data.messages).toHaveLength(2);
    });

    it('should modify clone data without affecting original, then checkpoint both', () => {
      const originalData = sampleSessionData('ses_1');
      cloner.registerSession('ses_1', originalData);

      const fork = cloner.forkSession('ses_1', { includeHistory: true, includeMemory: true });
      const forkData = cloner.getSessionData(fork.id)!;
      forkData.messages.push({ role: 'user', content: 'Fork-specific message', timestamp: '2025-01-02T00:00:00Z' });
      forkData.config = { ...forkData.config, temperature: 0.3 };

      checkpoint.registerSession('ses_1', originalData);
      checkpoint.registerSession(fork.id, forkData);

      const cpOrig = checkpoint.createCheckpoint('ses_1', 'pre-fork');
      const cpFork = checkpoint.createCheckpoint(fork.id, 'post-fork-edit');

      expect(cpOrig.data.messages).toHaveLength(2);
      expect(cpFork.data.messages).toHaveLength(3);
      expect(cpOrig.data.config).toEqual({ model: 'gpt-4o', temperature: 0.7 });
      expect(cpFork.data.config).toEqual({ model: 'gpt-4o', temperature: 0.3 });
    });

    it('should restore clone from checkpoint after modifying it', () => {
      const data = sampleSessionData('ses_restore');
      cloner.registerSession('ses_restore', data);
      checkpoint.registerSession('ses_restore', data);

      const cp1 = checkpoint.createCheckpoint('ses_restore', 'before-change');
      const sessionData = cloner.getSessionData('ses_restore')!;
      sessionData.messages.push({ role: 'user', content: 'New message', timestamp: '2025-02-01T00:00:00Z' });

      expect(cloner.getSessionData('ses_restore')!.messages).toHaveLength(3);

      const restored = checkpoint.restoreCheckpoint(cp1.id);
      expect(restored).not.toBeNull();
      expect(restored!.messages).toHaveLength(2);
    });

    it('should track lineage across clone and checkpoint operations', () => {
      const data = sampleSessionData('ses_lineage');
      cloner.registerSession('ses_lineage', data);

      const clone1 = cloner.cloneSession('ses_lineage');
      const clone2 = cloner.cloneSession('ses_lineage');

      const lineage = cloner.getLineage('ses_lineage');
      expect(lineage).toHaveLength(2);
      expect(lineage[0].type).toBe('clone');
      expect(lineage[1].type).toBe('clone');

      const allClones = cloner.listClones('ses_lineage');
      expect(allClones).toHaveLength(2);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // 3. Message Bus + Agent Communicator
  // ──────────────────────────────────────────────────────────────
  describe('Message Bus + Agent Communicator', () => {
    let bus: MessageBus;
    let communicator: AgentCommunicator;

    beforeEach(() => {
      bus = new MessageBus({ config: { defaultTtlMs: 60_000, ackTimeoutMs: 5000 } });
      communicator = new AgentCommunicator(bus, {
        defaultRequestTimeoutMs: 5000,
        now: () => new Date(),
      });
    });

    afterEach(() => {
      bus.destroy();
    });

    it('should deliver direct messages between two registered agents', () => {
      const received: unknown[] = [];
      bus.subscribe('agent_alpha', 'agent:comm', (msg) => {
        received.push(msg.payload);
      });

      communicator.registerAgent({
        id: 'agent_alpha',
        name: 'Alpha Agent',
        capabilities: ['code-review'],
        status: 'online',
      });
      communicator.registerAgent({
        id: 'agent_beta',
        name: 'Beta Agent',
        capabilities: ['testing'],
        status: 'online',
      });

      communicator.sendMessage({
        to: 'agent_alpha',
        from: 'agent_beta',
        type: 'review_request',
        payload: { file: 'src/index.ts', action: 'review' },
      });

      expect(received.length).toBeGreaterThanOrEqual(1);
    });

    it('should broadcast to all agents matching a capability filter', () => {
      const receivedAlpha: unknown[] = [];
      const receivedBeta: unknown[] = [];

      bus.subscribe('agent_alpha', 'agent:comm', (msg) => {
        receivedAlpha.push(msg.payload);
      });
      bus.subscribe('agent_beta', 'agent:comm', (msg) => {
        receivedBeta.push(msg.payload);
      });

      communicator.registerAgent({
        id: 'agent_alpha',
        name: 'Alpha',
        capabilities: ['code-review', 'testing'],
        status: 'online',
      });
      communicator.registerAgent({
        id: 'agent_beta',
        name: 'Beta',
        capabilities: ['testing'],
        status: 'online',
      });

      const delivered = communicator.broadcast({
        from: 'system',
        type: 'test_suite_available',
        payload: { suite: 'integration' },
        capabilityFilter: 'testing',
      });

      expect(delivered).toBe(2);
    });

    it('should delegate a task and complete it through the communicator', () => {
      communicator.registerAgent({
        id: 'worker1',
        name: 'Worker',
        capabilities: ['compute'],
        status: 'online',
      });
      communicator.registerAgent({
        id: 'coordinator1',
        name: 'Coordinator',
        capabilities: ['orchestrate'],
        status: 'online',
      });

      const delegation = communicator.delegateTask({
        taskType: 'compute',
        payload: { expression: '2+2' },
        assignedTo: 'worker1',
        assignedBy: 'coordinator1',
      });

      expect(delegation.status).toBe('pending');
      expect(delegation.taskType).toBe('compute');

      const completed = communicator.completeTask(delegation.id, 'worker1', { result: 4 });
      expect(completed).not.toBeNull();
      expect(completed!.status).toBe('completed');
      expect(completed!.result).toEqual({ result: 4 });
    });

    it('should discover agents by capability and track stats', () => {
      communicator.registerAgent({
        id: 'coder1',
        name: 'Coder',
        capabilities: ['coding', 'review'],
        status: 'online',
      });
      communicator.registerAgent({
        id: 'tester1',
        name: 'Tester',
        capabilities: ['testing'],
        status: 'online',
      });

      const coders = communicator.discoverAgents('coding');
      expect(coders).toHaveLength(1);
      expect(coders[0].id).toBe('coder1');

      const stats = communicator.getStats();
      expect(stats.totalAgents).toBe(2);
      expect(stats.onlineAgents).toBe(2);
      expect(stats.totalTasks).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // 4. Tool Version Registry + Tool Calls
  // ──────────────────────────────────────────────────────────────
  describe('Tool Version Registry + Tool Calls', () => {
    let registry: ToolVersionRegistry<(...args: unknown[]) => string>;

    beforeEach(() => {
      registry = new ToolVersionRegistry();
    });

    it('should execute the active tool version and switch versions', () => {
      const toolV1 = (..._args: unknown[]) => 'v1 result';
      const toolV2 = (..._args: unknown[]) => 'v2 result';

      registry.register('read_file', '1.0.0', toolV1);
      registry.register('read_file', '2.0.0', toolV2);

      const active = registry.get('read_file');
      expect(active).toBeDefined();
      expect(active!()).toBe('v2 result');

      registry.setActiveVersion('read_file', '1.0.0');
      expect(registry.get('read_file')!()).toBe('v1 result');
    });

    it('should track multiple tools with independent version chains', () => {
      registry.register('read_file', '1.0.0', () => 'read v1');
      registry.register('read_file', '1.1.0', () => 'read v1.1');
      registry.register('write_file', '1.0.0', () => 'write v1');
      registry.register('write_file', '2.0.0', () => 'write v2');

      expect(registry.listTools()).toContain('read_file');
      expect(registry.listTools()).toContain('write_file');
      expect(registry.getVersions('read_file')).toEqual(['1.0.0', '1.1.0']);
      expect(registry.getVersions('write_file')).toEqual(['1.0.0', '2.0.0']);
      expect(registry.get('read_file')!()).toBe('read v1.1');
      expect(registry.get('write_file')!()).toBe('write v2');
    });

    it('should deprecate a version and keep it callable', () => {
      registry.register('search', '1.0.0', () => 'old search');
      registry.register('search', '2.0.0', () => 'new search');
      registry.deprecate('search', '1.0.0', 'Use search v2 instead');

      const specificV1 = registry.getVersion('search', '1.0.0');
      expect(specificV1!()).toBe('old search');

      const comparison = registry.compareVersion('search');
      expect(comparison).not.toBeNull();
      expect(comparison!.deprecationWarning).toBeNull();
    });

    it('should detect outdated versions and report stats', () => {
      registry.register('deploy', '1.0.0', () => 'deploy v1');
      registry.register('deploy', '2.0.0', () => 'deploy v2');
      registry.register('deploy', '3.0.0', () => 'deploy v3');
      registry.setActiveVersion('deploy', '1.0.0');

      const comparison = registry.compareVersion('deploy');
      expect(comparison!.isOutdated).toBe(true);
      expect(comparison!.versionsBehind).toBe(2);

      const info = registry.getVersionInfo('deploy');
      expect(info!.totalRegistrations).toBe(3);

      const stats = registry.getStats();
      expect(stats.totalTools).toBe(1);
      expect(stats.totalVersions).toBe(3);
    });

    it('should remove the active version and auto-promote the latest', () => {
      registry.register('compile', '1.0.0', () => 'compile v1');
      registry.register('compile', '2.0.0', () => 'compile v2');
      registry.register('compile', '3.0.0', () => 'compile v3');

      registry.remove('compile', '3.0.0');
      expect(registry.get('compile')!()).toBe('compile v2');

      const versions = registry.getVersions('compile');
      expect(versions).toEqual(['1.0.0', '2.0.0']);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // 5. Supply Chain + Skill Loading
  // ──────────────────────────────────────────────────────────────
  describe('Supply Chain + Skill Loading', () => {
    let dir: string;
    let verifier: SupplyChainVerifier;

    beforeEach(() => {
      dir = makeTempDir();
      verifier = new SupplyChainVerifier({
        trustedKeysPath: path.join(dir, 'trusted-keys.json'),
        autoTrustOnFirstUse: true,
      });
    });

    afterEach(() => {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* cleanup */ }
    });

    it('should verify skill file integrity via hash matching', async () => {
      const skillDir = path.join(dir, 'skills', 'test-skill');
      fs.mkdirSync(skillDir, { recursive: true });
      const skillContent = '---\nname: test-skill\n---\nThis is a test skill.';
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skillContent);

      const hash = await verifier.calculateHash(path.join(skillDir, 'SKILL.md'));
      expect(hash).toBeTruthy();
      expect(hash).toMatch(/^[a-f0-9]{64}$/);

      const result = await verifier.verifySkill(
        path.join(skillDir, 'SKILL.md'),
        hash,
      );
      expect(result.verified).toBe(true);
      expect(result.hashMatch).toBe(true);
      expect(result.firstSeen).toBe(true);
    });

    it('should detect tampered skill files via hash mismatch', async () => {
      const skillPath = path.join(dir, 'tampered-skill.txt');
      fs.writeFileSync(skillPath, 'Original content');

      const originalHash = await verifier.calculateHash(skillPath);
      const result = await verifier.verifySkill(skillPath, originalHash);
      expect(result.verified).toBe(true);

      fs.writeFileSync(skillPath, 'Tampered content');
      const tamperedResult = await verifier.verifySkill(skillPath, originalHash);
      expect(tamperedResult.verified).toBe(false);
      expect(tamperedResult.hashMatch).toBe(false);
    });

    it('should track verification count across repeated checks', async () => {
      const skillPath = path.join(dir, 'repeat-skill.txt');
      fs.writeFileSync(skillPath, 'Stable skill content');

      await verifier.verifySkill(skillPath);
      await verifier.verifySkill(skillPath);
      await verifier.verifySkill(skillPath);

      const fingerprint = verifier.getFingerprint(skillPath);
      expect(fingerprint).not.toBeNull();
      expect(fingerprint!.verificationCount).toBe(3);
      expect(verifier.hasSeen(skillPath)).toBe(true);
    });

    it('should manage trusted keys and verify against them', () => {
      const key = verifier.addTrustedKey('test-author', 'public-key-data');
      expect(key.name).toBe('test-author');
      expect(key.fingerprint).toBeTruthy();

      const keys = verifier.listTrustedKeys();
      expect(keys).toHaveLength(1);
      expect(keys[0].name).toBe('test-author');

      const removed = verifier.removeTrustedKey(key.fingerprint);
      expect(removed).toBe(true);
      expect(verifier.listTrustedKeys()).toHaveLength(0);
    });

    it('should generate a verification report and stats', async () => {
      const skillPath = path.join(dir, 'report-skill.txt');
      fs.writeFileSync(skillPath, 'Report skill');

      await verifier.verifySkill(skillPath);

      const report = JSON.parse(verifier.exportReport());
      expect(report.verifiedSkills).toHaveLength(1);
      expect(report.stats.verifiedSkills).toBe(1);
      expect(report.stats.totalVerifications).toBe(1);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // 6. Analytics + Session Tracking
  // ──────────────────────────────────────────────────────────────
  describe('Analytics + Session Tracking', () => {
    let dashboard: SessionAnalyticsDashboard;

    beforeEach(() => {
      dashboard = new SessionAnalyticsDashboard();
    });

    it('should track tool calls and token usage per session', () => {
      dashboard.recordSessionStart('ses_1', { model: 'gpt-4o', workspace: '/project' });
      dashboard.recordToolCall('ses_1', 'read_file', { success: true, durationMs: 45 });
      dashboard.recordToolCall('ses_1', 'write_file', { success: true, durationMs: 120 });
      dashboard.recordToolCall('ses_1', 'read_file', { success: false, durationMs: 30, errorMessage: 'File not found' });
      dashboard.recordTokenUsage('ses_1', { input: 1500, output: 800 });

      const stats = dashboard.getSessionStats('ses_1');
      expect(stats).not.toBeNull();
      expect(stats!.toolCalls.total).toBe(3);
      expect(stats!.toolCalls.successful).toBe(2);
      expect(stats!.toolCalls.failed).toBe(1);
      expect(stats!.tokens.totalInput).toBe(1500);
      expect(stats!.tokens.totalOutput).toBe(800);
      expect(stats!.tokens.total).toBe(2300);
      expect(stats!.performance.slowestTool).not.toBeNull();
      expect(stats!.performance.slowestTool!.name).toBe('write_file');
    });

    it('should aggregate stats across multiple sessions in the overview', () => {
      dashboard.recordSessionStart('ses_a', { model: 'gpt-4o', workspace: '/project-a' });
      dashboard.recordSessionStart('ses_b', { model: 'claude-4', workspace: '/project-b' });

      dashboard.recordToolCall('ses_a', 'read_file', { success: true, durationMs: 50 });
      dashboard.recordToolCall('ses_b', 'write_file', { success: true, durationMs: 80 });
      dashboard.recordToolCall('ses_b', 'read_file', { success: true, durationMs: 40 });

      dashboard.recordTokenUsage('ses_a', { input: 1000, output: 500 });
      dashboard.recordTokenUsage('ses_b', { input: 2000, output: 1000 });

      const overview = dashboard.getOverview();
      expect(overview.totalSessions).toBe(2);
      expect(overview.totalToolCalls).toBe(3);
      expect(overview.totalTokens).toBe(4500);
      expect(overview.topTools.length).toBeGreaterThan(0);
      expect(overview.topTools[0].name).toBe('read_file');
      expect(overview.topTools[0].count).toBe(2);
    });

    it('should track errors with severity and compute error rate', () => {
      dashboard.recordSessionStart('ses_err', { model: 'gpt-4o', workspace: '/project' });
      dashboard.recordToolCall('ses_err', 'deploy', { success: false, durationMs: 5000, errorMessage: 'Timeout' });
      dashboard.recordToolCall('ses_err', 'read_file', { success: true, durationMs: 30 });
      dashboard.recordError('ses_err', 'Connection refused', 'high');
      dashboard.recordError('ses_err', 'Rate limited', 'medium');

      const stats = dashboard.getSessionStats('ses_err');
      expect(stats!.errors.total).toBe(2);
      expect(stats!.errors.bySeverity['high']).toBe(1);
      expect(stats!.errors.bySeverity['medium']).toBe(1);

      const overview = dashboard.getOverview();
      expect(overview.errorRate).toBeGreaterThan(0);
    });

    it('should rank tools by usage and compute cost breakdown', () => {
      dashboard.recordSessionStart('ses_rank', { model: 'gpt-4o', workspace: '/project' });
      dashboard.recordToolCall('ses_rank', 'read_file', { success: true, durationMs: 10 });
      dashboard.recordToolCall('ses_rank', 'read_file', { success: true, durationMs: 20 });
      dashboard.recordToolCall('ses_rank', 'read_file', { success: true, durationMs: 30 });
      dashboard.recordToolCall('ses_rank', 'write_file', { success: true, durationMs: 50 });
      dashboard.recordTokenUsage('ses_rank', { input: 5000, output: 2000 });

      const ranking = dashboard.getToolRanking();
      expect(ranking.length).toBeGreaterThanOrEqual(2);
      expect(ranking[0].name).toBe('read_file');
      expect(ranking[0].totalCalls).toBe(3);
      expect(ranking[0].successRate).toBe(1.0);

      const costs = dashboard.getCostBreakdown();
      expect(costs.length).toBe(1);
      expect(costs[0].model).toBe('gpt-4o');
      expect(costs[0].estimatedCost).toBeGreaterThan(0);
    });

    it('should export complete analytics data as JSON', () => {
      dashboard.recordSessionStart('ses_export', { model: 'gpt-4o', workspace: '/project' });
      dashboard.recordToolCall('ses_export', 'test_tool', { success: true, durationMs: 15 });

      const exported = JSON.parse(dashboard.exportData());
      expect(exported.overview).toBeDefined();
      expect(exported.toolRanking).toBeDefined();
      expect(exported.costBreakdown).toBeDefined();
      expect(exported.sessions).toBeDefined();
      expect(exported.sessions.length).toBe(1);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // 7. i18n + CLI Commands
  // ──────────────────────────────────────────────────────────────
  describe('i18n + CLI Commands', () => {
    it('should resolve CLI output translations for different locales', () => {
      const enService = new ZavorthI18nService({ locale: 'en-US' });
      const ptService = new ZavorthI18nService({ locale: 'pt-BR' });

      expect(enService.t('cli.help.title')).toBe('Zavorth CLI Help');
      expect(ptService.t('cli.help.title')).toBe('Ajuda do CLI Zavorth');
    });

    it('should fall back to English when a locale key is missing', () => {
      const ptService = new ZavorthI18nService({ locale: 'pt-BR' });

      expect(ptService.t('services.desktop.current_mode')).toBe('Modo atual');
      // dashboard.* ships in English only; pt-BR resolves through the en layer.
      expect(ptService.t('dashboard.home.subtitle')).toBe('Your personal command center.');
    });

    it('should interpolate variables into CLI output strings', () => {
      const service = new ZavorthI18nService({ locale: 'en-US' });

      expect(
        service.t('errors.generic.not_found', { vars: { resource: 'zavorth-api' } }),
      ).toBe('Resource not found: zavorth-api');

      expect(
        service.t('telegram.scheduler.create_failed', { vars: { error: 'timeout' } }),
      ).toBe('Failed to create schedule: timeout');
    });

    it('should return the raw key as fallback when no translation exists', () => {
      const service = new ZavorthI18nService({ locale: 'en-US' });

      expect(service.t('_feat_integ_fallback.nonexistent')).toBe('_feat_integ_fallback.nonexistent');
    });

    it('should check translation key existence with has()', () => {
      const service = new ZavorthI18nService({ locale: 'en-US' });

      expect(service.has('common.app.name')).toBe(true);
      expect(service.has('_feat_integ_has.missing')).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // 8. Model Fallback + Analytics
  // ──────────────────────────────────────────────────────────────
  describe('Model Fallback + Analytics', () => {
    let fallback: ModelFallbackChain;
    let dashboard: SessionAnalyticsDashboard;

    beforeEach(() => {
      fallback = new ModelFallbackChain({
        primary: { provider: 'openai', model: 'gpt-4o' },
        fallbacks: [
          { provider: 'anthropic', model: 'claude-4-sonnet' },
          { provider: 'google', model: 'gemini-2.5-flash' },
        ],
        cooldownMs: 1000,
      });
      dashboard = new SessionAnalyticsDashboard();
    });

    it('should select primary model and record success in analytics', () => {
      const candidate = fallback.selectCandidate();
      expect(candidate).not.toBeNull();
      expect(candidate!.provider).toBe('openai');
      expect(candidate!.model).toBe('gpt-4o');

      fallback.recordSuccess(candidate!);

      dashboard.recordSessionStart('ses_fb1', { model: candidate!.model, workspace: '/project' });
      dashboard.recordToolCall('ses_fb1', 'llm_call', { success: true, durationMs: 200 });

      const stats = dashboard.getSessionStats('ses_fb1');
      expect(stats!.toolCalls.successful).toBe(1);

      const summary = fallback.getSummary();
      expect(summary.available).toBe(3);
      expect(summary.inCooldown).toBe(0);
    });

    it('should trigger fallback on primary failure and track it in analytics', () => {
      const primary = fallback.selectCandidate();
      expect(primary!.provider).toBe('openai');

      fallback.recordFailure(primary!, 'rate_limit');

      const afterFailure = fallback.selectCandidate();
      expect(afterFailure).not.toBeNull();
      expect(afterFailure!.provider).toBe('anthropic');

      dashboard.recordSessionStart('ses_fb2', { model: primary!.model, workspace: '/project' });
      dashboard.recordToolCall('ses_fb2', 'llm_call', { success: false, durationMs: 500, errorMessage: 'Rate limited' });
      dashboard.recordError('ses_fb2', 'Primary model rate limited', 'medium');

      const stats = dashboard.getSessionStats('ses_fb2');
      expect(stats!.toolCalls.failed).toBe(1);
      expect(stats!.errors.total).toBe(1);

      const summary = fallback.getSummary();
      expect(summary.inCooldown).toBe(1);
    });

    it('should chain through all fallbacks when multiple providers fail', () => {
      const first = fallback.selectCandidate();
      expect(first!.provider).toBe('openai');
      fallback.recordFailure(first!, 'rate_limit');

      const second = fallback.selectCandidate();
      expect(second!.provider).toBe('anthropic');
      fallback.recordFailure(second!, 'server_error');

      const third = fallback.selectCandidate();
      expect(third!.provider).toBe('google');

      const summary = fallback.getSummary();
      expect(summary.total).toBe(3);
      expect(summary.inCooldown).toBe(2);
      expect(summary.available).toBe(1);
    });

    it('should reset a provider on success and track cost per model', () => {
      const primary = fallback.selectCandidate();
      fallback.recordFailure(primary!, 'timeout');

      fallback.recordSuccess(primary!);

      const summaryAfterReset = fallback.getSummary();
      expect(summaryAfterReset.inCooldown).toBe(0);
      expect(summaryAfterReset.available).toBe(3);

      dashboard.recordSessionStart('s1', { model: 'gpt-4o', workspace: '/p1' });
      dashboard.recordSessionStart('s2', { model: 'claude-4-sonnet', workspace: '/p2' });
      dashboard.recordTokenUsage('s1', { input: 1000, output: 500 });
      dashboard.recordTokenUsage('s2', { input: 2000, output: 1000 });

      const costs = dashboard.getCostBreakdown();
      expect(costs.length).toBe(2);
      const gptCost = costs.find((c) => c.model === 'gpt-4o');
      const claudeCost = costs.find((c) => c.model === 'claude-4-sonnet');
      expect(gptCost).toBeDefined();
      expect(claudeCost).toBeDefined();
      expect(gptCost!.estimatedCost).toBeGreaterThan(0);
      expect(claudeCost!.estimatedCost).toBeGreaterThan(0);
    });

    it('should mark auth errors as known-bad and report across candidates', () => {
      const c1 = { provider: 'openai', model: 'gpt-4o' };
      const c2 = { provider: 'anthropic', model: 'claude-4-sonnet' };

      fallback.recordFailure(c1, 'auth_error');
      fallback.recordFailure(c2, 'billing');

      const summary = fallback.getSummary();
      expect(summary.knownBad).toBe(2);

      const candidates = fallback.getCandidatesWithStatus();
      expect(candidates).toHaveLength(3);
      for (const c of candidates) {
        expect(typeof c.available).toBe('boolean');
        expect(typeof c.cooldownRemainingMs).toBe('number');
      }
    });
  });
});
