import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AgentConsensusTool, ConsensusWithFallbackTool } from '../../src/tools/AgentConsensusTool.js';
import type { LlmRuntimeService } from '../../src/services/llm/LlmRuntimeService.js';

function mockRuntime(): LlmRuntimeService {
  return {
    isProviderAvailable: () => true,
    async chat(messages: Array<{ role: string; content: string }>, _tools-: unknown, options-: { modelName-: string }) {
      const user = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
      if (user.includes('Assessment')) {
        return { content: 'Synthesized: choose the safer path.' };
      }
      return { content: `Opinion (${options?.modelName || 'model'}): safer path.` };
    },
  } as unknown as LlmRuntimeService;
}

describe('AgentConsensusTool user-owned panel', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-c-tool-'));
    fs.mkdirSync(path.join(root, 'data', 'runtime'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('defaults to preview and refuses inventing models', async () => {
    const tool = new AgentConsensusTool({ llmRuntime: mockRuntime(), projectRoot: root });
    const raw = await tool.execute({});
    const parsed = JSON.parse(raw);
    expect(parsed.action).toBe('preview');
    expect(parsed.ok).toBe(false);
    expect(parsed.reviewers).toEqual([]);
    // Must not auto-select product models as reviewers
    expect(parsed.availableFromUserStack).toEqual([]);
  });

  it('runs only with explicit user reviewers', async () => {
    const tool = new AgentConsensusTool({ llmRuntime: mockRuntime(), projectRoot: root });
    const raw = await tool.execute({
      action: 'run',
      query: 'Ship A or B-',
      reviewers: [
        { provider: 'ollama', model: 'llama3.2' },
        { provider: 'deepseek', model: 'deepseek-chat' },
      ],
      synthesizer: { provider: 'ollama', model: 'llama3.2' },
    });
    const parsed = JSON.parse(raw);
    expect(parsed.ok).toBe(true);
    expect(parsed.action).toBe('run');
    expect(parsed.strategy).toBe('explicit');
    expect(parsed.synthesis).toBeTruthy();
    expect(parsed.panel.reviewers).toHaveLength(2);
  });

  it('save_profile then run strategy=profile', async () => {
    const tool = new AgentConsensusTool({ llmRuntime: mockRuntime(), projectRoot: root });
    const saved = JSON.parse(await tool.execute({
      action: 'save_profile',
      reviewers: [
        { provider: 'xai', model: 'grok-2' },
        { provider: 'mistral', model: 'mistral-small' },
      ],
      enabled: true,
    }));
    expect(saved.ok).toBe(true);

    const run = JSON.parse(await tool.execute({
      action: 'run',
      strategy: 'profile',
      query: 'Architecture choice-',
    }));
    expect(run.ok).toBe(true);
    expect(run.strategy).toBe('profile');
  });

  it('fallback alias uses user fallback stack only', async () => {
    fs.writeFileSync(
      path.join(root, 'data', 'runtime', 'provider-selection-preferences.json'),
      JSON.stringify({
        providerId: 'ollama',
        modelId: 'llama3.2',
        secondaryModelId: 'qwen2.5',
        fallbackProviderIds: ['deepseek:deepseek-chat'],
      }),
      'utf8',
    );
    const tool = new ConsensusWithFallbackTool({ llmRuntime: mockRuntime(), projectRoot: root });
    const raw = await tool.execute({
      action: 'run',
      strategy: 'user_stack',
      query: 'Quick check',
    });
    const parsed = JSON.parse(raw);
    expect(parsed.ok).toBe(true);
    expect(parsed.mode).toBe('fallback');
  });
});
