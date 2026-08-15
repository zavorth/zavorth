import { GeminiManagedAgentExecutor } from '../../src/execution/GeminiManagedAgentExecutor';
import { config } from '../../src/config';
import type { ExecutionRequest } from '../../src/contracts/ExecutionContract';


describe('GeminiManagedAgentExecutor', () => {
  const originalEnabled = (config as any).geminiManagedAgentsEnabled;

  afterEach(() => {
    (config as any).geminiManagedAgentsEnabled = originalEnabled;
  });

  it('is disabled by default and explains the opt-in gate', async () => {
    (config as any).geminiManagedAgentsEnabled = false;
    const executor = new GeminiManagedAgentExecutor({ apiKey: 'key' });
    const result = await executor.execute(request());
    expect(result.success).toBe(false);
    expect(result.error_code).toBe('GEMINI_MANAGED_AGENT_DISABLED');
  });

  it('requires explicit approval before remote managed execution', async () => {
    (config as any).geminiManagedAgentsEnabled = true;
    const executor = new GeminiManagedAgentExecutor({ apiKey: 'key' });
    const result = await executor.execute(request());
    expect(result.success).toBe(false);
    expect(result.error_code).toBe('GEMINI_MANAGED_AGENT_APPROVAL_REQUIRED');
  });

  it('creates a governed interaction after opt-in and approval', async () => {
    (config as any).geminiManagedAgentsEnabled = true;
    const fetchImpl = jest.fn(async () => new Response(JSON.stringify({
      id: 'interactions/managed',
      output_text: 'remote done',
      steps: [{ type: 'model_output', text: 'remote done' }],
    }), { status: 200, headers: { 'content-type': 'application/json' } })) as any;
    const executor = new GeminiManagedAgentExecutor({
      apiKey: 'key',
      baseUrl: 'https://example.test/v1beta',
      fetchImpl,
    });

    const result = await executor.execute(request({ approval_id: 'approval-1' }));

    expect(result.success).toBe(true);
    expect(result.stdout).toBe('remote done');
    expect(result.metadata.gemini_managed_agent.steps).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.test/v1beta/interactions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-goog-api-key': 'key' }),
      }),
    );
  });
});

function request(metadata: Record<string, unknown> = {}): ExecutionRequest {
  return {
    execution_id: 'exec-1',
    task_id: 'task-1',
    executor: 'gemini_managed_agent',
    workspace: __dirname,
    objective: 'test objective',
    instructions: ['do safe work'],
    allowed_paths: [],
    blocked_paths: [],
    allowed_commands: [],
    blocked_commands: [],
    timeout_seconds: 10,
    dry_run: false,
    requires_backup: false,
    metadata,
  };
}
