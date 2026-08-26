import { SurfaceIdentityService } from '../../src/services/SurfaceIdentityService';
import { SurfaceTaskDispatchService } from '../../src/orchestrator/SurfaceTaskDispatchService';

describe('SurfaceTaskDispatchService', () => {
  it('resolves the principal id, links the surface and dispatches through the shared task controller', async () => {
    let persisted = '';
    const surfaceIdentity = new SurfaceIdentityService({
      now: () => new Date('2026-04-01T15:00:00.000Z'),
      existsSync: () => Boolean(persisted),
      readFileSync: () => persisted,
      writeFileSync: (_path, content) => {
        persisted = String(content);
      },
      mkdirSync: () => undefined as any,
    });
    const parser = {
      parse: jest.fn((text: string) => ({
        normalized_message: text,
        command_type: '/task',
      })),
    };
    const taskOrchestrationController = {
      handleTaskMessage: jest.fn(async (_ctx: any, input: any) => ({
        task_id: 'task-123',
        user_id: input.userId,
        source: input.source,
        metadata: input.surfaceMetadata,
      })),
    };
    const dispatcher = new SurfaceTaskDispatchService({
      parser,
      taskOrchestrationController,
      surfaceIdentityService: surfaceIdentity,
    });

    const result = await dispatcher.dispatchTaskMessage({
      ctx: { reply: jest.fn() },
      platform: 'web',
      chatId: 'web:session-abc',
      text: 'resuma as mudancas',
      sourceUserId: 'session-abc',
      fallbackRuntimeUserId: 'telegram-admin',
      source: 'web',
      sessionId: 'session-abc',
      identity: {
        linkedBy: 'web-session',
        verificationMethod: 'dashboard-auth',
      },
    });

    expect(parser.parse).toHaveBeenCalledWith('resuma as mudancas');
    expect(taskOrchestrationController.handleTaskMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        chatId: 'web:session-abc',
        userId: 'telegram-admin',
        source: 'web',
        surfaceMetadata: expect.objectContaining({
          platform: 'web',
          sourceUserId: 'session-abc',
          runtimeUserId: 'telegram-admin',
          sessionId: 'session-abc',
          publicServerMode: false,
          forceApprovalForExecution: false,
          tenant: expect.objectContaining({
            tenantId: 'internal:web:operator',
            isolationMode: 'internal',
            onboardingStatus: 'internal',
          }),
        }),
      }),
    );
    expect(result.runtimeUserId).toBe('telegram-admin');
    expect(result.tenantId).toBe('internal:web:operator');
    expect(surfaceIdentity.listPrincipalUserIds('telegram-admin')).toEqual(['telegram-admin', 'session-abc']);
  });

  it('applies platform-specific verification defaults when identity hints are omitted', async () => {
    let persisted = '';
    const surfaceIdentity = new SurfaceIdentityService({
      now: () => new Date('2026-04-01T16:00:00.000Z'),
      existsSync: () => Boolean(persisted),
      readFileSync: () => persisted,
      writeFileSync: (_path, content) => {
        persisted = String(content);
      },
      mkdirSync: () => undefined as any,
    });
    const dispatcher = new SurfaceTaskDispatchService({
      parser: {
        parse: jest.fn(() => ({ normalized_message: '/task', command_type: '/task' })),
      } as any,
      taskOrchestrationController: {
        handleTaskMessage: jest.fn(async () => ({ task_id: 'task-456' })),
      } as any,
      surfaceIdentityService: surfaceIdentity,
    });

    await dispatcher.dispatchTaskMessage({
      ctx: { reply: jest.fn() },
      platform: 'discord',
      chatId: 'discord:guild:guild-1:channel:channel-9',
      text: '/task revisar ponte',
      sourceUserId: 'discord-user-1',
      fallbackRuntimeUserId: 'telegram-admin',
      source: 'discord',
    });

    const state = JSON.parse(persisted) as any;
    expect(state.links['discord:discord-user-1']).toEqual(
      expect.objectContaining({
        linkedBy: 'discord-bridge',
        verificationMethod: 'discord-bridge-signature',
      }),
    );
  });

  it('passes surface policy metadata through to the task controller', async () => {
    const taskOrchestrationController = {
      handleTaskMessage: jest.fn(async (_ctx: any, input: any) => ({
        task_id: 'task-789',
        metadata: input.surfaceMetadata,
      })),
    };
    const dispatcher = new SurfaceTaskDispatchService({
      parser: {
        parse: jest.fn(() => ({ normalized_message: '/task revisar', command_type: '/task' })),
      } as any,
      taskOrchestrationController: taskOrchestrationController as any,
    });

    await dispatcher.dispatchTaskMessage({
      ctx: { reply: jest.fn() },
      platform: 'discord',
      chatId: 'discord:guild:guild-1:channel:channel-9',
      text: '/task revisar',
      sourceUserId: 'discord-user-1',
      fallbackRuntimeUserId: 'discord-user-1',
      source: 'discord',
      surfacePolicy: {
        publicServerMode: true,
        forceApprovalForExecution: true,
        transport: 'slash_command',
      },
    });

    expect(taskOrchestrationController.handleTaskMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        surfaceMetadata: expect.objectContaining({
          publicServerMode: true,
          forceApprovalForExecution: true,
          transport: 'slash_command',
          tenant: expect.objectContaining({
            tenantId: 'discord:guild:guild-1',
            isolationMode: 'tenant',
            onboardingStatus: 'pending_onboarding',
          }),
        }),
      }),
    );
  });
});
