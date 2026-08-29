import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { UserModelConfidenceEngine } from '../../../src/services/user-model/UserModelConfidenceEngine.js';
import { UserModelFactStore } from '../../../src/services/user-model/UserModelFactStore.js';
import { UserModelContextInjectionService } from '../../../src/services/user-model/UserModelContextInjectionService.js';
import type { UserModelFact } from '../../../src/contracts/user-model/UserModelFactContract.js';

describe('UserModelContextInjectionService', () => {
  let tmpDir: string;
  let factStore: UserModelFactStore;
  let confidenceEngine: UserModelConfidenceEngine;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-inject-test-'));
    factStore = new UserModelFactStore({
      dataDir: path.join(tmpDir, 'data', 'runtime', 'user-model'),
    });
    await factStore.initialize();
    confidenceEngine = new UserModelConfidenceEngine();
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Safe cleanup
    }
  });

  it('returns empty string when no facts are active', async () => {
    const service = new UserModelContextInjectionService({
      factStore,
      confidenceEngine,
    });

    const block = await service.buildInjectionContext('test-user');
    expect(block).toBe('');

    const blockSync = service.buildInjectionContextSync('test-user');
    expect(blockSync).toBe('');
  });

  it('formats active facts within token budget and confidence threshold', async () => {
    const activeFact: UserModelFact = {
      id: 'fact-lang',
      userId: 'test-user',
      content: 'Always format output in English',
      kind: 'preference',
      category: 'language',
      status: 'active',
      version: 1,
      confidence: 0.95,
      evidence: [{ citation: 'User prompt', timestamp: new Date().toISOString() }],
      source: 'explicit',
      language: 'en',
      surface: null,
      lastObservedAt: new Date().toISOString(),
      occurrences: 3,
    };

    const draftFact: UserModelFact = {
      id: 'fact-draft',
      userId: 'test-user',
      content: 'Draft fact not yet confirmed',
      kind: 'opinion',
      category: 'misc',
      status: 'draft',
      version: 1,
      confidence: 0.5,
      evidence: [{ citation: 'Inferred', timestamp: new Date().toISOString() }],
      source: 'llm',
      language: 'en',
      surface: null,
      lastObservedAt: new Date().toISOString(),
      occurrences: 1,
    };

    await factStore.saveFact(activeFact);
    await factStore.saveFact(draftFact);

    const service = new UserModelContextInjectionService({
      factStore,
      confidenceEngine,
    });

    const block = await service.buildInjectionContext('test-user');
    expect(block).toContain('<user_model_facts>');
    expect(block).toContain('- [preference] language: Always format output in English');
    expect(block).not.toContain('Draft fact not yet confirmed');
    expect(block).toContain('</user_model_facts>');

    const blockSync = service.buildInjectionContextSync('test-user');
    expect(blockSync).toContain('<user_model_facts>');
    expect(blockSync).toContain('- [preference] language: Always format output in English');
  });

  it('respects token budget and cuts off low-ranked facts when budget is exceeded', async () => {
    const service = new UserModelContextInjectionService({
      factStore,
      confidenceEngine,
      config: {
        enabled: true,
        learningRate: 0.1,
        activationConfidenceThreshold: 0.7,
        evidenceRequiredForActive: 2,
        halfLifeDays: 90,
        maxInjectionTokens: 30, // ~120 characters max
        reflectionTimeoutMs: 5000,
        retractThreshold: 0.2,
      },
    });

    // Add multiple active facts
    for (let i = 0; i < 5; i++) {
      const fact: UserModelFact = {
        id: `fact-${i}`,
        userId: 'budget-user',
        content: `Short fact ${i}`,
        kind: 'preference',
        category: `cat_${i}`,
        status: 'active',
        version: 1,
        confidence: 0.95 - i * 0.05,
        evidence: [{ citation: 'explicit', timestamp: new Date().toISOString() }],
        source: 'explicit',
        language: 'en',
        surface: null,
        lastObservedAt: new Date().toISOString(),
        occurrences: 1,
      };
      await factStore.saveFact(fact);
    }

    const block = service.buildInjectionContextSync('budget-user');
    expect(block).toContain('<user_model_facts>');
    expect(block).toContain('cat_0');
    // Must not include all 5 facts due to token limit
    expect(block).not.toContain('cat_4');
    expect(block.length).toBeLessThanOrEqual(130);
  });
});
