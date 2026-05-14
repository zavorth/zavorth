import { SupervisedBrowserControlAdapter } from '../../../src/adapters/overlord/SupervisedBrowserControlAdapter.js';

describe('SupervisedBrowserControlAdapter', () => {
  it('navigates only through supervised http/https browser actions', async () => {
    const browserTool = {
      handleToolCall: jest.fn(async () => ({
        content: [{ type: 'text', text: '{"ok":true}' }],
        isError: false,
      })),
    };
    const adapter = new SupervisedBrowserControlAdapter({ browserTool });

    const result = await adapter.execute(
      {
        capability: 'browser.control',
        command: JSON.stringify({ action: 'navigate', url: 'https://example.com' }),
        approved: true,
      },
      {
        allowed: true,
        requiresApproval: false,
        reason: 'ok',
        capability: 'browser.control',
        profile: 'dangerous',
        requiredProfile: 'dangerous',
        autonomyLevel: 5,
        requiredAutonomyLevel: 5,
        runtimeTarget: 'browser',
        mutating: true,
      },
    );

    expect(result.ok).toBe(true);
    expect(browserTool.handleToolCall).toHaveBeenCalledWith('browser_navigate', {
      url: 'https://example.com',
    });
  });

  it('blocks non-http browser navigation schemes', async () => {
    const adapter = new SupervisedBrowserControlAdapter({
      browserTool: { handleToolCall: jest.fn() },
    });

    const result = await adapter.execute(
      {
        capability: 'browser.control',
        command: JSON.stringify({ action: 'navigate', url: 'file:///C:/secret.txt' }),
        approved: true,
      },
      {
        allowed: true,
        requiresApproval: false,
        reason: 'ok',
        capability: 'browser.control',
        profile: 'dangerous',
        requiredProfile: 'dangerous',
        autonomyLevel: 5,
        requiredAutonomyLevel: 5,
        runtimeTarget: 'browser',
        mutating: true,
      },
    );

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('browser_url_rejected');
  });

  it('keeps evaluate_js behind owner opt-in', async () => {
    const browserTool = {
      handleToolCall: jest.fn(async () => ({
        content: [{ type: 'text', text: '{"value":2}' }],
        isError: false,
      })),
    };
    const adapter = new SupervisedBrowserControlAdapter({ browserTool });

    const blocked = await adapter.execute(
      {
        capability: 'browser.control',
        command: JSON.stringify({ action: 'evaluate_js', script: '1 + 1' }),
        profile: 'dangerous',
        approved: true,
      },
      {
        allowed: true,
        requiresApproval: false,
        reason: 'ok',
        capability: 'browser.control',
        profile: 'dangerous',
        requiredProfile: 'dangerous',
        autonomyLevel: 5,
        requiredAutonomyLevel: 5,
        runtimeTarget: 'browser',
        mutating: true,
      },
    );
    const allowed = await adapter.execute(
      {
        capability: 'browser.control',
        command: JSON.stringify({ action: 'evaluate_js', script: '1 + 1' }),
        profile: 'owner',
        approved: true,
        metadata: { allowEvaluateJs: true },
      },
      {
        allowed: true,
        requiresApproval: false,
        reason: 'ok',
        capability: 'browser.control',
        profile: 'owner',
        requiredProfile: 'dangerous',
        autonomyLevel: 6,
        requiredAutonomyLevel: 5,
        runtimeTarget: 'browser',
        mutating: true,
      },
    );

    expect(blocked.ok).toBe(false);
    expect(blocked.errorCode).toBe('browser_evaluate_js_blocked');
    expect(allowed.ok).toBe(true);
    expect(browserTool.handleToolCall).toHaveBeenCalledWith('evaluate_js', {
      script: '1 + 1',
    });
  });
});
