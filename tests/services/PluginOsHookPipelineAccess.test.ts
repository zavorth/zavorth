import {
  getPluginOsHookPipeline,
  runPluginOsHook,
  setPluginOsHookPipeline,
} from '../../src/services/PluginOsHookPipelineAccess.js';
import { ToolHookPipelineService } from '../../src/services/ToolHookPipelineService.js';

describe('PluginOsHookPipelineAccess', () => {
  afterEach(() => {
    setPluginOsHookPipeline(null);
  });

  it('exposes shared pipeline and runs llm/agent events', async () => {
    const pipeline = new ToolHookPipelineService();
    const seen: string[] = [];
    pipeline.registerListener('llm.before_request', async ({ event }) => {
      seen.push(event);
    });
    pipeline.registerListener('agent.before_turn', async ({ event }) => {
      seen.push(event);
    });

    setPluginOsHookPipeline(pipeline);
    expect(getPluginOsHookPipeline()).toBe(pipeline);

    await runPluginOsHook({
      event: 'llm.before_request',
      context: { messageCount: 1 },
    });
    await runPluginOsHook({
      event: 'agent.before_turn',
      context: { runId: 'run-1' },
    });

    expect(seen).toEqual(['llm.before_request', 'agent.before_turn']);
  });

  it('does not throw when pipeline is unset or listener fails', async () => {
    setPluginOsHookPipeline(null);
    await expect(runPluginOsHook({ event: 'llm.after_request' })).resolves.toBeUndefined();

    const pipeline = new ToolHookPipelineService();
    pipeline.registerListener('llm.after_request', async () => {
      throw new Error('listener boom');
    });
    setPluginOsHookPipeline(pipeline);
    await expect(runPluginOsHook({ event: 'llm.after_request' })).resolves.toBeUndefined();
  });

  it('lists extended plugin OS events in pipeline snapshot', () => {
    const snapshot = new ToolHookPipelineService().buildSnapshot();
    const names = snapshot.events.map((entry) => entry.name);
    expect(names).toEqual(expect.arrayContaining([
      'llm.before_request',
      'llm.after_request',
      'agent.before_turn',
      'agent.after_turn',
      'shutdown.before',
      'shutdown.after',
    ]));
  });
});
