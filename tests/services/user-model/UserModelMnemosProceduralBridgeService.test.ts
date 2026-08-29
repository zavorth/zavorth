import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { UserModelFactStore } from '../../../src/services/user-model/UserModelFactStore.js';
import { UserModelConfidenceEngine } from '../../../src/services/user-model/UserModelConfidenceEngine.js';
import { UserModelContextInjectionService } from '../../../src/services/user-model/UserModelContextInjectionService.js';
import { UserModelMnemosProceduralBridgeService } from '../../../src/services/user-model/UserModelMnemosProceduralBridgeService.js';
import { ZavorthMnemosProceduralMemoryService } from '../../../src/services/ZavorthMnemosProceduralMemoryService.js';
import { resolveUserModelConfig } from '../../../src/contracts/user-model/UserModelConfigContract.js';
import type { UserModelFact } from '../../../src/contracts/user-model/UserModelFactContract.js';

describe('UserModelMnemosProceduralBridgeService', () => {
  let tmpDir: string;
  let factStore: UserModelFactStore;
  let proceduralMemory: ZavorthMnemosProceduralMemoryService;
  let bridgeService: UserModelMnemosProceduralBridgeService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-bridge-test-'));
    const userModelDir = path.join(tmpDir, 'data', 'runtime', 'user-model');
    factStore = new UserModelFactStore({ dataDir: userModelDir });
    proceduralMemory = new ZavorthMnemosProceduralMemoryService({
      projectRoot: tmpDir,
    });
    bridgeService = new UserModelMnemosProceduralBridgeService({
      factStore,
      proceduralMemory,
      projectRoot: tmpDir,
      config: resolveUserModelConfig({
        proceduralPromotionThreshold: 0.85,
      }),
    });
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  function createTestFact(overrides: Partial<UserModelFact> = {}): UserModelFact {
    return {
      id: 'fact-1',
      userId: 'local-user',
      content: 'Always run automated test suite before git commit',
      kind: 'skill-lesson',
      category: 'git_commit',
      status: 'active',
      version: 1,
      confidence: 0.9,
      targetTools: ['git_commit'],
      evidence: [
        {
          citation: 'Observed in turn 1',
          timestamp: new Date().toISOString(),
        },
      ],
      source: 'conversation',
      language: 'en',
      surface: null,
      lastObservedAt: new Date().toISOString(),
      occurrences: 3,
      ...overrides,
    };
  }

  it('qualifies high-confidence skill-lesson facts as candidates', () => {
    const fact = createTestFact({ confidence: 0.9, kind: 'skill-lesson' });
    const assessment = bridgeService.assessFact(fact);

    expect(assessment.isCandidate).toBe(true);
    expect(assessment.scopes).toContain('git_commit');
    expect(assessment.scopes).toContain('git');
    expect(assessment.scopes).toContain('commit');
    expect(assessment.targetKind).toBe('general-procedure');
  });

  it('rejects facts with confidence below proceduralPromotionThreshold', () => {
    const fact = createTestFact({ confidence: 0.75, kind: 'skill-lesson' });
    const assessment = bridgeService.assessFact(fact);

    expect(assessment.isCandidate).toBe(false);
    expect(assessment.reasons.some((r) => r.includes('below promotion threshold'))).toBe(true);
  });

  it('rejects general conversational preferences not marked as operational', () => {
    const fact = createTestFact({
      kind: 'preference',
      targetTools: [],
      category: 'tone',
      content: 'User prefers concise answers',
      confidence: 0.95,
    });
    const assessment = bridgeService.assessFact(fact);

    expect(assessment.isCandidate).toBe(false);
    expect(assessment.reasons.some((r) => r.includes('not an operational lesson'))).toBe(true);
  });

  it('proposes promotion via Mnemos preview requiring approval', async () => {
    const fact = createTestFact({ id: 'fact-to-promote', confidence: 0.92 });
    await factStore.saveFact(fact);

    const previewSnapshot = await bridgeService.proposePromotion(fact.id);
    expect(previewSnapshot).not.toBeNull();
    expect(previewSnapshot?.action).toBe('preview');
    expect(previewSnapshot?.status).toBe('requires-approval');
    expect(previewSnapshot?.rule?.statement).toContain('Always run automated test suite before git commit');
  });

  it('promotes fact to Mnemos with approval and updates fact with proceduralPointer', async () => {
    const fact = createTestFact({ id: 'fact-approved', confidence: 0.95 });
    await factStore.saveFact(fact);

    const result = await bridgeService.promoteWithApproval(fact.id, 'operator-approval-123');
    expect(result).not.toBeNull();
    expect(result?.status).toBe('ready');
    expect(result?.safety.durableMutation).toBe(true);

    const updatedFact = await factStore.getFactById(fact.id);
    expect(updatedFact?.proceduralPointer).toBeDefined();
    expect(updatedFact?.proceduralPointer?.ruleId).toBe(result?.rule?.id);

    // Verify it is no longer a candidate since it is already promoted
    if (updatedFact) {
      const assessmentAfter = bridgeService.assessFact(updatedFact);
      expect(assessmentAfter.isCandidate).toBe(false);
    }
  });

  it('enforces single-lane migration by excluding promoted facts from chat injection prompt', async () => {
    const unpromotedFact = createTestFact({
      id: 'fact-unpromoted',
      content: 'Prefer typescript for scripts',
      kind: 'preference',
      category: 'code_style',
      targetTools: [],
      confidence: 0.9,
    });
    const operationalFact = createTestFact({
      id: 'fact-promoted',
      content: 'Always pass --build to docker compose up',
      kind: 'skill-lesson',
      category: 'docker',
      targetTools: ['docker_compose'],
      confidence: 0.95,
    });

    await factStore.saveFact(unpromotedFact);
    await factStore.saveFact(operationalFact);

    const injectionService = new UserModelContextInjectionService({
      factStore,
      config: resolveUserModelConfig(),
    });

    // Before promotion: both active facts can appear in chat prompt
    const beforePrompt = await injectionService.buildInjectionContext('local-user');
    expect(beforePrompt).toContain('Prefer typescript for scripts');
    expect(beforePrompt).toContain('Always pass --build to docker compose up');

    // Promote the operational fact to Mnemos
    await bridgeService.promoteWithApproval(operationalFact.id, 'approval-token-456');

    // After promotion: operational fact is excluded from general chat prompt (lane migrated)
    const afterPrompt = await injectionService.buildInjectionContext('local-user');
    expect(afterPrompt).toContain('Prefer typescript for scripts');
    expect(afterPrompt).not.toContain('Always pass --build to docker compose up');

    // Synchronous injection also excludes it
    const syncPrompt = injectionService.buildInjectionContextSync('local-user');
    expect(syncPrompt).toContain('Prefer typescript for scripts');
    expect(syncPrompt).not.toContain('Always pass --build to docker compose up');
  });

  it('retrieves scoped procedural guidance for relevant tools only', async () => {
    const gitFact = createTestFact({
      id: 'fact-git',
      content: 'Always run unit tests before git commit',
      kind: 'skill-lesson',
      category: 'git',
      targetTools: ['git_commit'],
      confidence: 0.95,
    });
    const dockerFact = createTestFact({
      id: 'fact-docker',
      content: 'Always pass --build flag to docker compose up',
      kind: 'skill-lesson',
      category: 'docker',
      targetTools: ['docker_compose'],
      confidence: 0.95,
    });

    await factStore.saveFact(gitFact);
    await factStore.saveFact(dockerFact);

    await bridgeService.promoteWithApproval(gitFact.id, 'approval-git');
    await bridgeService.promoteWithApproval(dockerFact.id, 'approval-docker');

    // Query for git_commit tool
    const gitGuidance = await bridgeService.getScopedGuidanceForTool('git_commit');
    expect(gitGuidance.some((g) => g.includes('unit tests before git commit'))).toBe(true);
    expect(gitGuidance.some((g) => g.includes('--build flag'))).toBe(false);

    // Query for docker_compose tool
    const dockerGuidance = await bridgeService.getScopedGuidanceForTool('docker_compose');
    expect(dockerGuidance.some((g) => g.includes('--build flag'))).toBe(true);
    expect(dockerGuidance.some((g) => g.includes('unit tests before git commit'))).toBe(false);

    // Query for unrelated tool (e.g. read_file)
    const unrelatedGuidance = await bridgeService.getScopedGuidanceForTool('read_file');
    expect(unrelatedGuidance).toHaveLength(0);
  });

  it('syncs lifecycle revocation when a fact is superseded', async () => {
    const fact = createTestFact({ id: 'fact-superseded-test', confidence: 0.95 });
    await factStore.saveFact(fact);

    const promotion = await bridgeService.promoteWithApproval(fact.id, 'approval-sup');
    const ruleId = promotion?.rule?.id;
    expect(ruleId).toBeDefined();

    // Verify active in Mnemos
    const beforeRules = proceduralMemory.list().rules.filter((r) => r.id === ruleId && r.status === 'active');
    expect(beforeRules).toHaveLength(1);

    // Mark fact superseded in store
    const updated = await factStore.getFactById(fact.id);
    if (updated) {
      updated.status = 'superseded';
      await factStore.saveFact(updated);
      await bridgeService.syncLifecycle(updated);
    }

    // Verify revoked in Mnemos
    const afterRules = proceduralMemory.list().rules.filter((r) => r.id === ruleId && r.status === 'revoked');
    expect(afterRules).toHaveLength(1);
  });

  it('handles fail-open gracefully when tool query encounters an unhandled error', async () => {
    const failingProceduralMemory = {
      query: () => {
        throw new Error('Disk I/O failure');
      },
    } as unknown as ZavorthMnemosProceduralMemoryService;

    const resilientBridge = new UserModelMnemosProceduralBridgeService({
      factStore,
      proceduralMemory: failingProceduralMemory,
      projectRoot: tmpDir,
    });

    // Must not throw, must return empty array
    const guidance = await resilientBridge.getScopedGuidanceForTool('git_commit');
    expect(guidance).toEqual([]);

    const structured = await resilientBridge.getScopedGuidanceStructured('git_commit');
    expect(structured.rules).toEqual([]);
  });
});
