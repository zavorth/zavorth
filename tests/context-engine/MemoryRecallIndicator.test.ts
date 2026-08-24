import { ContextEngine } from '../../src/context-engine/ContextEngine.js';
import type { EpisodicMemoryBridge, RecallResult } from '../../src/context-engine/EpisodicMemoryBridge.js';
import type { ToolDefinition } from '../../src/providers/ILlmProvider.js';

function buildTool(name: string): ToolDefinition {
  return {
    name,
    description: `Tool ${name}`,
    parameters: { type: 'object', properties: {}, required: [] },
  };
}

function buildRecallResult(overrides: Partial<RecallResult> = {}): RecallResult {
  return {
    memories: [],
    contextBlock: '',
    totalSearched: 0,
    searchTimeMs: 3,
    ...overrides,
  };
}

describe('ContextEngine memory recall indicator', () => {
  it('reports a non-sensitive informed indicator when recall injected memories', async () => {
    const engine = new ContextEngine();
    const bridge = {
      recall: jest.fn().mockResolvedValue(
        buildRecallResult({
          memories: [
            { key: 'stack', value: 'typescript', category: 'preference' },
            { key: 'editor', value: 'vscode', category: 'preference' },
          ],
          contextBlock: 'RELEVANT MEMORIES:\n- [preference] stack: typescript',
          totalSearched: 2,
          searchTimeMs: 12,
        }),
      ),
    } as unknown as EpisodicMemoryBridge;
    engine.attachEpisodicBridge(bridge);

    const decision = await engine.prepareAsync(
      'what stack do I usually use?',
      'user-1',
      'chat-1',
      'test',
      [buildTool('get_datetime')],
      'system instruction',
    );

    expect(bridge.recall).toHaveBeenCalledWith('what stack do I usually use?', 'user-1');
    expect(decision.memoryRecall).toBeDefined();
    expect(decision.memoryRecall?.informed).toBe(true);
    expect(decision.memoryRecall?.memoryCount).toBe(2);
    expect(decision.memoryRecall?.searchTimeMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(decision.memoryRecall)).not.toContain('typescript');
  });

  it('reports an uninformed indicator when recall found nothing', async () => {
    const engine = new ContextEngine();
    engine.attachEpisodicBridge({
      recall: jest.fn().mockResolvedValue(buildRecallResult()),
    } as unknown as EpisodicMemoryBridge);

    const decision = await engine.prepareAsync(
      'random question',
      'user-1',
      'chat-2',
      'test',
      [],
      'system instruction',
    );

    expect(decision.memoryRecall).toBeDefined();
    expect(decision.memoryRecall?.informed).toBe(false);
    expect(decision.memoryRecall?.memoryCount).toBe(0);
  });

  it('omits the indicator entirely when no episodic bridge is attached', async () => {
    const engine = new ContextEngine();
    const decision = await engine.prepareAsync(
      'question without memory',
      'user-1',
      'chat-3',
      'test',
      [],
      'system instruction',
    );
    expect(decision.memoryRecall).toBeUndefined();
  });
});
