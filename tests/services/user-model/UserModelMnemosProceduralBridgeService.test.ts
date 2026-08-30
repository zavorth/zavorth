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
    expect(assessment.risk).toBe('low');
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

  it('classifies kind and risk strictly from structured fact fields, never from content keywords', () => {
    // Content contains forbidden-sounding keywords but is a skill-lesson: still general-procedure/low
    const skillLesson = createTestFact({
      kind: 'skill-lesson',
      category: 'deploy',
      content: 'Never bypass the secret store when deploying to production',
      confidence: 0.95,
    });
    const skillAssessment = bridgeService.assessFact(skillLesson);
    expect(skillAssessment.targetKind).toBe('general-procedure');
    expect(skillAssessment.risk).toBe('low');

    // Decision facts map to workflow-preference/medium
    const decision = createTestFact({
      kind: 'decision',
      category: 'release',
      content: 'Decided to always run the full suite before release',
      confidence: 0.95,
    });
    const decisionAssessment = bridgeService.assessFact(decision);
    expect(decisionAssessment.targetKind).toBe('workflow-preference');
    expect(decisionAssessment.risk).toBe('medium');
  });

  it('proposes promotion by persisting a durable draft requiring approval', async () => {
    const fact = createTestFact({ id: 'fact-to-promote', confidence: 0.92 });
    await factStore.saveFact(fact);

    const draftSnapshot = await bridgeService.proposePromotion(fact.id);
    expect(draftSnapshot).not.toBeNull();
    expect(draftSnapshot?.action).toBe('draft');
    expect(draftSnapshot?.status).toBe('ready');
    expect(draftSnapshot?.safety.durableMutation).toBe(true);
    expect(draftSnapshot?.rule?.status).toBe('draft');
    expect(draftSnapshot?.rule?.statement).toContain('Always run automated test suite before git commit');

    // Draft is durable on disk and listed in Mnemos
    const listed = proceduralMemory.list().rules.filter((r) => r.id === draftSnapshot?.rule?.id);
    expect(listed).toHaveLength(1);
    expect(listed[0].status).toBe('draft');
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
  });

  it('propagates kind, risk and confidence from the fact assessment into the Mnemos rule', async () => {
    const fact = createTestFact({
      id: 'fact-kind-risk',
      kind: 'decision',
      category: 'release',
      targetTools: ['release_pipeline'],
      content: 'Always run the full suite before cutting a release',
      confidence: 0.93,
    });
    await factStore.saveFact(fact);

    const draft = await bridgeService.proposePromotion(fact.id);
    expect(draft?.rule?.kind).toBe('workflow-preference');
    expect(draft?.rule?.risk).toBe('medium');
    expect(draft?.rule?.confidence).toBeGreaterThanOrEqual(0.9);

    const approved = await bridgeService.promoteWithApproval(fact.id, 'operator-approval-kind-risk');
    expect(approved?.rule?.kind).toBe('workflow-preference');
    expect(approved?.rule?.risk).toBe('medium');
    expect(approved?.rule?.scope).toContain('release_pipeline');
  });

  it('persists a durable draft across service instances (survives restart)', async () => {
    const fact = createTestFact({ id: 'fact-restart', confidence: 0.9 });
    await factStore.saveFact(fact);

    await bridgeService.proposePromotion(fact.id);

    // A brand-new bridge + Mnemos instance reading the same on-disk store must see the draft
    const freshProceduralMemory = new ZavorthMnemosProceduralMemoryService({ projectRoot: tmpDir });
    const freshBridge = new UserModelMnemosProceduralBridgeService({
      factStore,
      proceduralMemory: freshProceduralMemory,
      projectRoot: tmpDir,
    });

    const listed = freshProceduralMemory.list().rules.filter(
      (r) => r.status === 'draft' && r.statement.includes('Always run automated test suite'),
    );
    expect(listed).toHaveLength(1);

    const guidance = await freshBridge.getScopedGuidanceForTool('git_commit');
    expect(guidance).toHaveLength(0);

    const approved = await freshBridge.promoteWithApproval(fact.id, 'operator-approval-restart');
    expect(approved?.status).toBe('ready');

    const activeGuidance = await freshBridge.getScopedGuidanceForTool('git_commit');
    expect(activeGuidance.some((g) => g.includes('Always run automated test suite'))).toBe(true);
  });
});
