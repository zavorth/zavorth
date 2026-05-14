import { config } from '../../../src/config/index';
import { TelegramAiStudioPermissionApprovalService } from '../../../src/telegram/controllers/TelegramAiStudioPermissionApprovalService';

describe('TelegramAiStudioPermissionApprovalService', () => {
  function createService(overrides: Record<string, any> = {}) {
    const permissionPolicy = {
      extractAiStudioPermissionValues: jest.fn().mockReturnValue(['google_search', 'code_execution']),
      mergeNormalizedValues: jest
        .fn()
        .mockImplementation((existing: any[], incoming: any[]) =>
          Array.from(new Set([...(existing || []), ...(incoming || [])])),
        ),
    };
    const taskApprovalSupport = {
      appendApprovalDecision: jest.fn().mockReturnValue({
        approval_history: ['decision'],
      }),
      completeTaskApproval: jest.fn().mockResolvedValue(true),
    };

    return {
      permissionPolicy,
      taskApprovalSupport,
      service: new TelegramAiStudioPermissionApprovalService({
        permissionPolicy: permissionPolicy as any,
        taskApprovalSupport: taskApprovalSupport as any,
        ...overrides,
      }),
    };
  }

  it('fills the approval patch when AI Studio values are still unresolved', () => {
    const { service } = createService();
    const patch: Record<string, any> = {};

    service.prepareApprovalPatch(
      {
        kind: 'builtin_tool_access',
        requested_value: 'google_search',
        resolved_value: null,
      } as any,
      patch as any,
    );

    expect(patch).toEqual({
      requested_value: 'google_search',
      resolved_value: 'google_search',
    });
  });

  it('merges approved tools and preferred model before delegating completion', async () => {
    const { service, taskApprovalSupport } = createService();
    const task = {
      metadata: {
        aistudio_allowed_tools: ['google_search'],
        aistudio_model: 'gemini-old',
      },
    };
    const approved = {
      metadata: {
        suggested_model: 'gemini-2.5-pro',
      },
    };

    const handled = await service.finalizeApproval(
      {} as any,
      {
        kind: 'builtin_tool_access',
      } as any,
      approved as any,
      '42',
      task as any,
    );

    expect(handled).toBe(true);
    expect(taskApprovalSupport.completeTaskApproval).toHaveBeenCalledWith(
      {},
      task,
      approved,
      expect.objectContaining({
        aistudio_allowed_tools: ['google_search', 'code_execution'],
        aistudio_model: 'gemini-2.5-pro',
        pendingPermissionId: null,
        pendingPermissionNotifiedAt: null,
        pendingPermissionNotificationError: null,
      }),
    );
  });

  it('falls back to the configured model for service access approvals', async () => {
    const permissionPolicy = {
      extractAiStudioPermissionValues: jest.fn().mockReturnValue(['drive']),
      mergeNormalizedValues: jest.fn().mockReturnValue(['drive']),
    };
    const taskApprovalSupport = {
      appendApprovalDecision: jest.fn().mockReturnValue({
        approval_history: ['decision'],
      }),
      completeTaskApproval: jest.fn().mockResolvedValue(true),
    };
    const service = new TelegramAiStudioPermissionApprovalService({
      permissionPolicy: permissionPolicy as any,
      taskApprovalSupport: taskApprovalSupport as any,
    });
    const task = {
      metadata: {},
    };
    const approved = {
      metadata: {},
    };

    await service.finalizeApproval(
      {} as any,
      {
        kind: 'service_access',
      } as any,
      approved as any,
      '42',
      task as any,
    );

    expect(permissionPolicy.mergeNormalizedValues).toHaveBeenCalledWith([], ['drive']);
    expect(taskApprovalSupport.completeTaskApproval).toHaveBeenCalledWith(
      {},
      task,
      approved,
      expect.objectContaining({
        aistudio_allowed_services: ['drive'],
        aistudio_model: config.aiStudioModel,
      }),
    );
  });
});
