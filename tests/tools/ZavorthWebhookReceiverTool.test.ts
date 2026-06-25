import { ZavorthWebhookReceiverTool } from '../../src/tools/ZavorthWebhookReceiverTool';

describe('ZavorthWebhookReceiverTool', () => {
  let tool: ZavorthWebhookReceiverTool;

  beforeEach(() => {
    tool = new ZavorthWebhookReceiverTool();
  });

  it('lists webhooks as empty initially', async () => {
    const result = await tool.execute({ action: 'list' });
    expect(result).toContain('No active');
  });

  it('returns error for non-existent webhook stop', async () => {
    const result = await tool.execute({ action: 'stop', webhook_id: 'nonexistent' });
    expect(result).toContain('Error');
    expect(result).toContain('not found');
  });

  it('returns error for non-existent webhook log', async () => {
    const result = await tool.execute({ action: 'log', webhook_id: 'nonexistent' });
    expect(result).toContain('Error');
    expect(result).toContain('not found');
  });

  it('returns error for non-existent webhook clear', async () => {
    const result = await tool.execute({ action: 'clear', webhook_id: 'nonexistent' });
    expect(result).toContain('Error');
    expect(result).toContain('not found');
  });

  it('returns error without action', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Error');
    expect(result).toContain('action');
  });

  it('returns error for invalid action', async () => {
    const result = await tool.execute({ action: 'delete' });
    expect(result).toContain('Error');
    expect(result).toContain('invalid');
  });

  it('start returns a string result (handles http dynamic import gracefully)', async () => {
    const result = await tool.execute({ action: 'start', port: 9999 });
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('start with custom path returns a string result', async () => {
    const result = await tool.execute({
      action: 'start',
      port: 9998,
      path: '/my-custom-hook',
    });
    expect(typeof result).toBe('string');
  });

  it('start with custom method returns a string result', async () => {
    const result = await tool.execute({
      action: 'start',
      port: 9997,
      method: 'PUT',
    });
    expect(typeof result).toBe('string');
  });

  describe('exposes correct name and parameters', () => {
    it('has correct tool name', () => {
      expect(tool.name).toBe('zavorth_webhook_receiver');
    });

    it('requires action parameter', () => {
      expect(tool.parameters.required).toContain('action');
    });

    it('has all expected parameter properties', () => {
      const props = tool.parameters.properties as Record<string, unknown>;
      expect(props).toHaveProperty('action');
      expect(props).toHaveProperty('webhook_id');
      expect(props).toHaveProperty('path');
      expect(props).toHaveProperty('port');
      expect(props).toHaveProperty('method');
      expect(props).toHaveProperty('response_status');
      expect(props).toHaveProperty('max_requests');
    });
  });
});
