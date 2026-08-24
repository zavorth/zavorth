import { ContextEngine, deriveWorkspaceScope } from '../../src/context-engine/ContextEngine.js';
import { EpisodicMemoryBridge } from '../../src/context-engine/EpisodicMemoryBridge.js';
import { MemoryService } from '../../src/services/MemoryService.js';
import type { ToolDefinition } from '../../src/providers/ILlmProvider.js';

async function seedEpisode(memoryService: MemoryService, userId: string, key: string, value: string, workspace?: string | null): Promise<void> {
  await memoryService.remember(userId, key, value, 'episode', { workspace });
}

describe('Workspace-scoped episodic memory isolation', () => {
  it('derives a stable scope from workspace context hints', () => {
    expect(deriveWorkspaceScope('C:\\DEV WORKSPACE\\Projetos\\Zavorth')).toBe('zavorth');
    expect(deriveWorkspaceScope('/home/operator/projects/api-server')).toBe('api-server');
    expect(deriveWorkspaceScope('   ')).toBeNull();
    expect(deriveWorkspaceScope(null)).toBeNull();
  });

  it('hides workspace-scoped episodes from other workspaces while keeping unscoped recall intact', async () => {
    const memoryService = new MemoryService();

    await seedEpisode(memoryService, 'ws-user', 'episode_a1', 'Zavorth deploy window is Sunday', 'zavorth');
    await seedEpisode(memoryService, 'ws-user', 'episode_b1', 'API server uses pino logging', 'api-server');
    await seedEpisode(memoryService, 'ws-user', 'episode_legacy', 'Legacy pre-scoping memory');

    const zavorthHits = await memoryService.listRelevant('ws-user', 'deploy window sunday', 8, { workspaceScope: 'zavorth' });
    const apiHits = await memoryService.listRelevant('ws-user', 'deploy window sunday', 8, { workspaceScope: 'api-server' });
    const unscopedHits = await memoryService.listRelevant('ws-user', 'deploy window sunday', 8);

    expect(zavorthHits.map((entry) => entry.key)).toContain('episode_a1');
    expect(zavorthHits.map((entry) => entry.key)).not.toContain('episode_b1');
    expect(apiHits.map((entry) => entry.key)).not.toContain('episode_a1');
    expect(unscopedHits.map((entry) => entry.key)).toContain('episode_a1');
    expect(unscopedHits.map((entry) => entry.key)).toContain('episode_legacy');
  });

  it('scopes episodic bridge persistence and recall to the active workspace', async () => {
    const memoryService = new MemoryService();
    const bridge = new EpisodicMemoryBridge({ autoPersist: true, autoRecall: true });
    bridge.attach(memoryService);

    const base = Date.parse('2026-02-01T09:00:00.000Z');
    const events = [
      { id: 'e1', timestamp: new Date(base).toISOString(), surface: 'cli', chatId: 'c1', userId: 'bridge-user', role: 'user' as const, content: 'In Zavorth we always run npm run check before commits.' },
      { id: 'e2', timestamp: new Date(base + 1000).toISOString(), surface: 'cli', chatId: 'c1', userId: 'bridge-user', role: 'assistant' as const, content: 'Understood.' },
      { id: 'e3', timestamp: new Date(base + 2000).toISOString(), surface: 'cli', chatId: 'c1', userId: 'bridge-user', role: 'user' as const, content: 'Also the release owner reviews tags.' },
      { id: 'e4', timestamp: new Date(base + 3000).toISOString(), surface: 'cli', chatId: 'c1', userId: 'bridge-user', role: 'assistant' as const, content: 'Noted.' },
    ];

    await bridge.persistEpisode(events, 'bridge-user', 'zavorth');

    const scoped = await bridge.recall('npm run check before commits', 'bridge-user', 'zavorth');
    const otherWorkspace = await bridge.recall('npm run check before commits', 'bridge-user', 'some-other-project');
    const unscopedGlobalView = await bridge.recall('npm run check before commits', 'bridge-user');

    expect(scoped.memories.length).toBeGreaterThanOrEqual(1);
    expect(otherWorkspace.memories).toHaveLength(0);
    expect(unscopedGlobalView.memories.length).toBeGreaterThanOrEqual(1);
  });

  it('threads the workspace scope derived from workspace context through prepareAsync recall', async () => {
    const engine = new ContextEngine();
    const recallSpy = jest.fn().mockResolvedValue({
      memories: [],
      contextBlock: '',
      totalSearched: 0,
      searchTimeMs: 0,
    });
    engine.attachEpisodicBridge({
      recall: recallSpy,
    } as never);

    const tools: ToolDefinition[] = [];
    await engine.prepareAsync('question', 'user-9', 'chat-9', 'test', tools, 'system', 'C:\\work\\projects\\api-server');

    expect(recallSpy).toHaveBeenCalledWith('question', 'user-9', 'api-server');
  });
});
