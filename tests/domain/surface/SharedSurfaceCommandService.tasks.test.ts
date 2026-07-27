import { SharedSurfaceCommandService } from '../../../src/services/SharedSurfaceCommandService';

function createContext(rawText: string) {
  return {
    platform: 'telegram',
    userId: 'telegram-user',
    chatId: 'telegram:chat-1',
    isGroup: false,
    rawText,
    reply: jest.fn(async () => undefined),
    editMessage: jest.fn(async () => undefined),
  };
}

function createService(overrides: Record<string, unknown> = {}) {
  return new SharedSurfaceCommandService({
    runtimeDiagnostics: { writeSnapshot: jest.fn(() => ({})) } as any,
    supervisedRuntimeService: { summarizeRecentChanges: jest.fn(), requestReload: jest.fn() } as any,
    autoRepairService: { summarizeLastRun: jest.fn(), run: jest.fn() } as any,
    ...overrides,
  });
}

describe('SharedSurfaceCommandService command boundary', () => {
  it.each([
    'mais detailed',
    'make a shorter and more technical version',
    'I want to connect you to Discord',
    'promova o aprendizado candidate:wf-1',
    'resume the onboarding workflow',
  ])('leaves free text for the agent model: %s', async (rawText) => {
    const workflowController = { handleWorkflow: jest.fn() };
    const surfaceTaskDispatcher = { dispatchTaskMessage: jest.fn() };
    const service = createService({ workflowController, surfaceTaskDispatcher });

    expect(await service.maybeHandle(createContext(rawText) as any)).toBe(false);
    expect(workflowController.handleWorkflow).not.toHaveBeenCalled();
    expect(surfaceTaskDispatcher.dispatchTaskMessage).not.toHaveBeenCalled();
  });

  it('routes an explicit workflow command through the deterministic surface', async () => {
    const ctx = createContext('/workflow review close onboarding do discord');
    const workflowController = { handleWorkflow: jest.fn(async () => undefined) };
    const service = createService({ workflowController });

    expect(await service.maybeHandle(ctx as any)).toBe(true);
    expect(workflowController.handleWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'telegram-user',
        chatId: 'telegram:chat-1',
        platform: 'telegram',
      }),
      'run review close onboarding do discord',
    );
  });

  it('does not claim empty messages', async () => {
    const service = createService();
    expect(await service.maybeHandle(createContext('   ') as any)).toBe(false);
  });
});
