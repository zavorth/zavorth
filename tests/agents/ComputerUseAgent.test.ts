import fs from 'fs';
import os from 'os';
import path from 'path';
import { ComputerUseAgent } from '../../src/agents/ComputerUseAgent.js';

const mockDesktopExecute = jest.fn();

jest.mock('../../src/tools/DesktopAutomationTool.js', () => ({
  DesktopAutomationTool: jest.fn().mockImplementation(() => ({
    execute: mockDesktopExecute,
  })),
}));


describe('ComputerUseAgent', () => {
  const originalEnabled = process.env.ZAVORTH_COMPUTER_USE_ENABLED;
  let screenshotPath: string;

  beforeEach(() => {
    process.env.ZAVORTH_COMPUTER_USE_ENABLED = 'true';
    screenshotPath = path.join(os.tmpdir(), `zavorth-computer-use-${Date.now()}.png`);
    fs.writeFileSync(screenshotPath, Buffer.from('fake-png'));
    mockDesktopExecute.mockReset();
    mockDesktopExecute.mockImplementation(async (args: Record<string, unknown>) => {
      if (args.action === 'screenshot') {
        return `Screenshot: ${screenshotPath} (10x10px)`;
      }
      return 'Ação executada.';
    });
  });

  afterEach(() => {
    if (originalEnabled === undefined) {
      delete process.env.ZAVORTH_COMPUTER_USE_ENABLED;
    } else {
      process.env.ZAVORTH_COMPUTER_USE_ENABLED = originalEnabled;
    }
    if (fs.existsSync(screenshotPath)) {
      fs.unlinkSync(screenshotPath);
    }
  });

  it('uses a screenshot as inline vision input and stops when the LLM returns done', async () => {
    const llmRuntime = {
      chat: jest.fn(async () => ({
        content: '{"action":"done","reasoning":"visible state is complete"}',
        toolCalls: [],
        finishReason: 'stop',
      })),
    };
    const agent = new ComputerUseAgent(llmRuntime as any);

    const snapshot = await agent.run({
      targetWindow: 'Fake Window',
      objective: 'Check the fake screen',
      maxIterations: 1,
      delayBetweenActionsMs: 0,
    });

    expect(snapshot.status).toBe('completed');
    expect(llmRuntime.chat).toHaveBeenCalledWith([
      expect.objectContaining({
        inlineData: [expect.objectContaining({ mimeType: 'image/png' })],
      }),
    ]);
    expect(mockDesktopExecute).toHaveBeenCalledWith({
      action: 'screenshot',
      windowTitle: 'Fake Window',
    });
  });

  it('blocks execution unless the visual computer-use profile is explicitly enabled', async () => {
    process.env.ZAVORTH_COMPUTER_USE_ENABLED = 'false';
    const agent = new ComputerUseAgent({ chat: jest.fn() } as any);

    await expect(agent.run({
      targetWindow: 'Fake Window',
      objective: 'Should be blocked',
      maxIterations: 1,
    })).rejects.toThrow('Computer Use visual bloqueado');
  });

  it('emits hook callbacks for screenshot planning and execution so watch mode can supervise the run', async () => {
    const llmRuntime = {
      chat: jest.fn(async () => ({
        content: '{"action":"click-element","targetText":"Entrar","reasoning":"o CTA principal esta visivel"}',
        toolCalls: [],
        finishReason: 'stop',
      })),
    };
    const hooks = {
      onScreenshot: jest.fn(),
      onActionPlanned: jest.fn(async ({ action }) => action),
      onActionExecuted: jest.fn(),
    };
    const agent = new ComputerUseAgent(llmRuntime as any, { delayMs: 0 });

    const snapshot = await agent.run({
      targetWindow: 'Fake Window',
      objective: 'Click the primary CTA',
      maxIterations: 1,
      delayBetweenActionsMs: 0,
      hooks,
    });

    expect(snapshot.status).toBe('completed');
    expect(hooks.onScreenshot).toHaveBeenCalledWith(expect.objectContaining({
      screenshotPath: screenshotPath,
    }));
    expect(hooks.onActionPlanned).toHaveBeenCalledWith(expect.objectContaining({
      action: expect.objectContaining({
        action: 'click-element',
        targetText: 'Entrar',
      }),
    }));
    expect(hooks.onActionExecuted).toHaveBeenCalledWith(expect.objectContaining({
      action: expect.objectContaining({
        action: 'click-element',
      }),
      result: 'Ação executada.',
    }));
  });
});
