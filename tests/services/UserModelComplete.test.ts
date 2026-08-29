import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { UserModelConfidenceEngine } from '../../src/services/user-model/UserModelConfidenceEngine.js';
import { UserModelFactStore } from '../../src/services/user-model/UserModelFactStore.js';
import { UserModelLegacyMigrationService } from '../../src/services/user-model/UserModelLegacyMigrationService.js';
import { UserModelTrajectoryReflectionService } from '../../src/services/user-model/UserModelTrajectoryReflectionService.js';
import type { UserModelFact } from '../../src/contracts/user-model/UserModelFactContract.js';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-user-model-v2-complete-'));
}

describe('UserModelCoreV2 — Complete Integration Suite', () => {
  let tmpDir: string;
  let factStore: UserModelFactStore;
  let confidenceEngine: UserModelConfidenceEngine;

  beforeEach(async () => {
    tmpDir = makeTmpDir();
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

  describe('Full Trajectory Reflection & Storage Lifecycle', () => {
    it('processes completed turn with authentic tool executions and stores procedural lesson', async () => {
      const mockLlm = {
        synthesize: jest.fn().mockResolvedValue({
          content: JSON.stringify({
            facts: [
              {
                content: 'create_file requires parent directory to exist beforehand',
                kind: 'skill-lesson',
                category: 'tool_execution',
                citation: 'create_file failed with ENOENT then succeeded after mkdir',
                confidenceScore: 0.85,
              },
            ],
            contradictions: [],
          }),
        }),
      };

      const reflection = new UserModelTrajectoryReflectionService({
        factStore,
        confidenceEngine,
        llmInference: mockLlm,
      });

      const result = await reflection.processTurn({
        turnId: 'turn-proc-1',
        userId: 'dev-user',
        userMessage: 'Please create the config file in the new folder',
        assistantText: 'I created the directory and wrote the config file.',
        toolExecutions: [
          {
            toolName: 'create_file',
            status: 'error',
            errorSnippet: 'ENOENT: no such file or directory',
            paramsSummary: 'path: config/app.json',
          },
          {
            toolName: 'create_directory',
            status: 'success',
            paramsSummary: 'path: config',
          },
          {
            toolName: 'create_file',
            status: 'success',
            paramsSummary: 'path: config/app.json',
          },
        ],
        surface: 'conversational',
      });

      expect(result.extractedCount).toBe(1);
      expect(factStore.isTurnProcessed('turn-proc-1')).toBe(true);

      const facts = await factStore.listFactsByUserId('dev-user');
      expect(facts).toHaveLength(1);
      expect(facts[0].kind).toBe('skill-lesson');
      expect(facts[0].confidence).toBe(0.85);
      expect(facts[0].status).toBe('active');
      expect(facts[0].evidence[0].turnId).toBe('turn-proc-1');
    });

    it('handles contradictory preference by superseding previous active fact', async () => {
      const initialFact: UserModelFact = {
        id: 'fact-pref-verbosity',
        userId: 'dev-user',
        content: 'Prefers concise short responses',
        kind: 'preference',
        category: 'response_length',
        status: 'active',
        version: 1,
        confidence: 0.9,
        evidence: [{ citation: 'User asked for short replies', timestamp: '2026-08-20T00:00:00.000Z' }],
        source: 'conversation',
        language: 'en',
        surface: null,
        lastObservedAt: '2026-08-20T00:00:00.000Z',
        occurrences: 1,
      };

      await factStore.saveFact(initialFact);

      const mockLlm = {
        synthesize: jest.fn().mockResolvedValue({
          content: JSON.stringify({
            facts: [
              {
                content: 'Prefers highly detailed explanations with code examples',
                kind: 'preference',
                category: 'response_length',
                citation: 'User explicitly changed mind: from now on give me full details',
                confidenceScore: 0.95,
              },
            ],
            contradictions: [
              {
                supersededFactId: 'fact-pref-verbosity',
                contradictedSummary: 'User now explicitly requests detailed explanations instead of short replies',
              },
            ],
          }),
        }),
      };

      const reflection = new UserModelTrajectoryReflectionService({
        factStore,
        confidenceEngine,
        llmInference: mockLlm,
      });

      await reflection.processTurn({
        turnId: 'turn-contra-1',
        userId: 'dev-user',
        userMessage: 'From now on, please give me full detailed explanations with code examples',
        assistantText: 'Understood. I will provide full detail and code examples from now on.',
        surface: 'conversational',
      });

      const oldFact = await factStore.getFactById('fact-pref-verbosity');
      expect(oldFact?.status).toBe('superseded');
      expect(oldFact?.supersededBy).toBe('superseded_by_contradiction');

      const allFacts = await factStore.listFactsByUserId('dev-user');
      const activeFacts = allFacts.filter((f) => f.status === 'active');
      expect(activeFacts).toHaveLength(1);
      expect(activeFacts[0].content).toContain('highly detailed');
    });

    it('recovers deterministically via ZavorthJsonSchemaRepairService when LLM output contains markdown fences', async () => {
      const mockLlm = {
        synthesize: jest.fn().mockResolvedValue({
          content: '```json\n{"facts": [{"content": "Uses PNPM instead of NPM", "kind": "preference", "category": "package_manager", "citation": "Always use pnpm", "confidenceScore": 0.9}], "contradictions": []}\n```',
        }),
      };

      const reflection = new UserModelTrajectoryReflectionService({
        factStore,
        confidenceEngine,
        llmInference: mockLlm,
      });

      const result = await reflection.processTurn({
        turnId: 'turn-repair-1',
        userId: 'dev-user',
        userMessage: 'Always use pnpm in this repository',
        assistantText: 'Noted. I will strictly use pnpm.',
        surface: 'conversational',
      });

      expect(result.extractedCount).toBe(1);
      const facts = await factStore.listFactsByUserId('dev-user');
      expect(facts[0].content).toBe('Uses PNPM instead of NPM');
    });
  });

  describe('Legacy Migration & Coexistence', () => {
    it('migrates profile and verifies factStore contains populated active facts', async () => {
      fs.writeFileSync(
        path.join(tmpDir, 'USER.md'),
        '- **Operating system**: Linux Ubuntu\n- **Preferred shell**: zsh\n',
        'utf8',
      );

      const migration = new UserModelLegacyMigrationService({
        projectRoot: tmpDir,
        homeRoot: tmpDir,
        factStore,
      });

      const result = await migration.runMigration('dev-user');
      expect(result.migrated).toBe(true);
      expect(result.factsCount).toBe(2);

      const facts = await factStore.listFactsByUserId('dev-user');
      expect(facts).toHaveLength(2);
      expect(facts.every((f) => f.status === 'active')).toBe(true);
    });
  });
});
