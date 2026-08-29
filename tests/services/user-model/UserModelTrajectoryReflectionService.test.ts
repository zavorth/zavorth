import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { UserModelConfidenceEngine } from '../../../src/services/user-model/UserModelConfidenceEngine.js';
import { UserModelFactStore } from '../../../src/services/user-model/UserModelFactStore.js';
import {
  UserModelTrajectoryReflectionService,
  trajectoryExtractionSchema,
} from '../../../src/services/user-model/UserModelTrajectoryReflectionService.js';
import type { UserModelFact } from '../../../src/contracts/user-model/UserModelFactContract.js';

describe('UserModelTrajectoryReflectionService', () => {
  let tmpDir: string;
  let factStore: UserModelFactStore;
  let confidenceEngine: UserModelConfidenceEngine;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-reflection-test-'));
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

  it('validates schema correctly with strict Zod parsing', () => {
    const validJson = {
      facts: [
        {
          content: 'Prefers TypeScript over plain JavaScript',
          kind: 'preference',
          category: 'programming_language',
          citation: 'User requested TypeScript only',
          confidenceScore: 0.9,
        },
      ],
      contradictions: [
        {
          supersededFactId: 'fact-old-1',
          contradictedSummary: 'User previously said Python but now prefers TypeScript',
        },
      ],
    };

    const parsed = trajectoryExtractionSchema.parse(validJson);
    expect(parsed.facts).toHaveLength(1);
    expect(parsed.contradictions).toHaveLength(1);
  });

  it('skips processing if userMessage is shorter than 5 chars', async () => {
    const mockLlm = { synthesize: jest.fn() };
    const service = new UserModelTrajectoryReflectionService({
      factStore,
      confidenceEngine,
      llmInference: mockLlm,
    });

    const result = await service.processTurn({
      turnId: 'turn-short',
      userId: 'test-user',
      userMessage: 'hi',
      assistantText: 'hello',
    });

    expect(result.extractedCount).toBe(0);
    expect(mockLlm.synthesize).not.toHaveBeenCalled();
    expect(factStore.isTurnProcessed('turn-short')).toBe(true);
  });

  it('reinforces existing fact when category matches and no contradiction is declared', async () => {
    const initialFact: UserModelFact = {
      id: 'fact-pref-lang',
      userId: 'test-user',
      content: 'Prefers TypeScript',
      kind: 'preference',
      category: 'language',
      status: 'active',
      version: 1,
      confidence: 0.7,
      evidence: [{ citation: 'Turn 1', timestamp: '2026-08-01T00:00:00.000Z' }],
      source: 'conversation',
      language: 'en',
      surface: null,
      lastObservedAt: '2026-08-01T00:00:00.000Z',
      occurrences: 1,
    };

    await factStore.saveFact(initialFact);

    const mockLlm = {
      synthesize: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          facts: [
            {
              content: 'Prefers TypeScript',
              kind: 'preference',
              category: 'language',
              citation: 'Turn 2 confirmation',
              confidenceScore: 0.85,
            },
          ],
          contradictions: [],
        }),
      }),
    };

    const service = new UserModelTrajectoryReflectionService({
      factStore,
      confidenceEngine,
      llmInference: mockLlm,
    });

    const result = await service.processTurn({
      turnId: 'turn-2',
      userId: 'test-user',
      userMessage: 'Let us build it with TypeScript',
      assistantText: 'Sounds good!',
    });

    expect(result.extractedCount).toBe(1);

    const updated = await factStore.getFactById('fact-pref-lang');
    expect(updated?.occurrences).toBe(2);
    expect(updated?.version).toBe(2);
    expect(updated?.confidence).toBeGreaterThan(0.7);
    expect(updated?.evidence).toHaveLength(2);
  });

  it('retries synthesis once if first output is malformed JSON', async () => {
    const mockLlm = {
      synthesize: jest
        .fn()
        .mockResolvedValueOnce({
          content: 'Here is what I found: NOT A VALID JSON OBJECT',
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({
            facts: [
              {
                content: 'Uses Jest for unit testing',
                kind: 'preference',
                category: 'testing_framework',
                citation: 'Run with jest',
                confidenceScore: 0.8,
              },
            ],
            contradictions: [],
          }),
        }),
    };

    const service = new UserModelTrajectoryReflectionService({
      factStore,
      confidenceEngine,
      llmInference: mockLlm,
    });

    const result = await service.processTurn({
      turnId: 'turn-retry-1',
      userId: 'test-user',
      userMessage: 'Make sure to run with Jest',
      assistantText: 'Running tests with Jest.',
    });

    expect(mockLlm.synthesize).toHaveBeenCalledTimes(2);
    expect(result.extractedCount).toBe(1);

    const facts = await factStore.listFactsByUserId('test-user');
    expect(facts[0].content).toBe('Uses Jest for unit testing');
  });
});
