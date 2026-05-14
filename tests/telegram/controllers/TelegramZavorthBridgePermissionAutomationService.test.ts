import { TelegramZavorthBridgePermissionAutomationService } from '../../../src/telegram/controllers/TelegramZavorthBridgePermissionAutomationService';

describe('TelegramZavorthBridgePermissionAutomationService', () => {
  it('prefers the live companion pid when the bridge instance matches the stored instance', async () => {
    const automator = {
      approveVisibleStep: jest.fn().mockResolvedValue({ ok: true, pid: 778 }),
      rejectVisibleStep: jest.fn(),
      waitForPermissionPromptToClear: jest.fn().mockResolvedValue(true),
    };
    const service = new TelegramZavorthBridgePermissionAutomationService({
      createCompanionBridge: () =>
        ({
          isOnline: jest.fn().mockResolvedValue(true),
          readStatus: jest.fn().mockResolvedValue({
            instanceId: 'bridge-live',
            processId: 5856,
          }),
        }) as any,
      createWindowAutomator: () => automator as any,
    });

    const result = await service.applyApproval(
      {
        permission_id: 'perm-1',
        executor: 'zavorthBridge',
        kind: 'ui_permission',
        status: 'pending',
        scope: 'once',
        task_id: 'task-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        requested_by: 'user',
        metadata: {
          companion_instance_id: 'bridge-live',
          companion_process_id: 991,
        },
      } as any,
      {
        metadata: {
          zavorthBridgeCompanionInstanceId: 'bridge-live',
          zavorthBridgeCompanionProcessId: 991,
        },
      } as any,
      'once',
    );

    expect(automator.approveVisibleStep).toHaveBeenCalledWith(0, 'once', 5856);
    expect(automator.waitForPermissionPromptToClear).toHaveBeenCalledWith(5856);
    expect(result).toEqual({
      effectiveProcessId: 5856,
      instanceId: 'bridge-live',
    });
  });

  it('falls back to pid 0 when no stored or live target exists', async () => {
    const automator = {
      approveVisibleStep: jest.fn().mockResolvedValue({ ok: true, pid: 0 }),
      rejectVisibleStep: jest.fn(),
      waitForPermissionPromptToClear: jest.fn().mockResolvedValue(true),
    };
    const service = new TelegramZavorthBridgePermissionAutomationService({
      createCompanionBridge: () =>
        ({
          isOnline: jest.fn().mockResolvedValue(false),
          readStatus: jest.fn().mockResolvedValue(null),
        }) as any,
      createWindowAutomator: () => automator as any,
    });

    const result = await service.applyApproval(
      {
        permission_id: 'perm-2',
        executor: 'zavorthBridge',
        kind: 'ui_permission',
        status: 'pending',
        scope: 'once',
        task_id: 'task-2',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        requested_by: 'user',
        metadata: {},
      } as any,
      undefined,
      'once',
    );

    expect(automator.approveVisibleStep).toHaveBeenCalledWith(0, 'once', 0);
    expect(automator.waitForPermissionPromptToClear).toHaveBeenCalledWith(0);
    expect(result).toEqual({
      effectiveProcessId: 0,
      instanceId: null,
    });
  });
}
