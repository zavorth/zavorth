import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RememberFactTool } from '../../src/tools/RememberFactTool.js';
import { UserModelFactStore } from '../../src/services/user-model/UserModelFactStore.js';
import { UserModelConfidenceEngine } from '../../src/services/user-model/UserModelConfidenceEngine.js';

describe('RememberFactTool', () => {
  let tmpDir: string;
  let factStore: UserModelFactStore;
  let confidenceEngine: UserModelConfidenceEngine;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-remember-tool-'));
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
      // safe cleanup
    }
  });

  it('declares tool name, description and strict schema parameters', () => {
    const tool = new RememberFactTool({ factStore, confidenceEngine });
    expect(tool.name).toBe('remember_fact');
    expect(tool.description).toContain('Explicitly remember');
    expect(tool.parameters.properties).toHaveProperty('fact');
    expect(tool.parameters.properties).toHaveProperty('category');
    expect(tool.parameters.required).toEqual(['fact', 'category']);
  });

  it('rejects execution when required parameters are missing', async () => {
    const tool = new RememberFactTool({ factStore, confidenceEngine });
    const resNoFact = JSON.parse(await tool.execute({ category: 'style' }));
    expect(resNoFact.success).toBe(false);
    expect(resNoFact.error).toContain('fact');

    const resNoCat = JSON.parse(await tool.execute({ fact: 'prefers python' }));
    expect(resNoCat.success).toBe(false);
    expect(resNoCat.error).toContain('category');
  });

  it('stores explicit fact successfully with active status and confidence', async () => {
    const tool = new RememberFactTool({ factStore, confidenceEngine });
    const rawResult = await tool.execute({
      fact: 'User prefers Vitest for frontend unit tests',
      category: 'testing_framework',
      kind: 'preference',
    });

    const result = JSON.parse(rawResult);
    expect(result.success).toBe(true);
    expect(result.factId).toBeDefined();

    const storedFact = await factStore.getFactById(result.factId);
    expect(storedFact).not.toBeNull();
    expect(storedFact?.content).toBe('User prefers Vitest for frontend unit tests');
    expect(storedFact?.status).toBe('active');
    expect(storedFact?.confidence).toBe(1.0);
    expect(storedFact?.source).toBe('explicit');
  });

  it('supersedes older fact when superseded_fact_id is provided', async () => {
    const tool = new RememberFactTool({ factStore, confidenceEngine });

    const firstRaw = await tool.execute({
      fact: 'Use Jest for tests',
      category: 'testing',
    });
    const firstId = JSON.parse(firstRaw).factId;

    const secondRaw = await tool.execute({
      fact: 'Use Vitest for tests',
      category: 'testing',
      superseded_fact_id: firstId,
    });
    const secondId = JSON.parse(secondRaw).factId;

    const oldFact = await factStore.getFactById(firstId);
    expect(oldFact?.status).toBe('superseded');
    expect(oldFact?.supersededBy).toBe(secondId);

    const newFact = await factStore.getFactById(secondId);
    expect(newFact?.status).toBe('active');
    expect(newFact?.content).toBe('Use Vitest for tests');
  });
});
