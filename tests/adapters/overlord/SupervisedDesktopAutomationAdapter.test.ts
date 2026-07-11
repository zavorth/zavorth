import { SupervisedDesktopAutomationAdapter } from '../../../src/adapters/overlord/SupervisedDesktopAutomationAdapter.js';
import { isOperatorContinuityEnvelope } from '../../../src/runtime/operator/OperatorContinuityEnvelope.js';

describe('SupervisedDesktopAutomationAdapter', () => {
  it('executes scoped desktop actions through DesktopAutomationTool', async () => {
    const desktopTool = {
      execute: jest.fn(async () => 'Acao executada com sucesso.'),
    };
    const adapter = new SupervisedDesktopAutomationAdapter({ desktopTool, platform: 'win32' });

    const result = await adapter.execute(
      {
        capability: 'desktop.automation',
        command: JSON.stringify({ action: 'click-element', windowTitle: 'Notepad', targetText: 'Save' }),
        approved: true,
      },
      {
        allowed: true,
        requiresApproval: false,
        reason: 'ok',
        capability: 'desktop.automation',
        profile: 'dangerous',
        requiredProfile: 'dangerous',
        autonomyLevel: 5,
        requiredAutonomyLevel: 5,
        runtimeTarget: 'desktop',
        mutating: true,
      },
    );

    expect(result.ok).toBe(true);
    expect(desktopTool.execute).toHaveBeenCalledWith(expect.objectContaining({
      action: 'click-element',
      windowTitle: 'Notepad',
      targetText: 'Save',
    }));
    const envelope = adapter.getLastContinuityEnvelope();
    expect(isOperatorContinuityEnvelope(envelope)).toBe(true);
    expect(envelope?.request?.surface).toBe('desktop-automation');
    expect(envelope?.request?.operation).toBe('desktop.mutate');
    expect(envelope?.decision?.allowed).toBe(true);
    expect(envelope?.result?.status).toBe('applied');
    expect(envelope?.receipt?.terminal).toBe(true);
    expect(result.metadata?.operatorContinuity).toEqual(expect.objectContaining({
      continuityId: envelope?.ids.continuityId,
      terminal: true,
    }));
  });

  it('rejects desktop actions without a scoped target window or process', async () => {
    const adapter = new SupervisedDesktopAutomationAdapter({
      desktopTool: { execute: jest.fn() },
      platform: 'win32',
    });

    const result = await adapter.execute(
      {
        capability: 'desktop.automation',
        command: JSON.stringify({ action: 'screenshot' }),
        approved: true,
      },
      {
        allowed: true,
        requiresApproval: false,
        reason: 'ok',
        capability: 'desktop.automation',
        profile: 'dangerous',
        requiredProfile: 'dangerous',
        autonomyLevel: 5,
        requiredAutonomyLevel: 5,
        runtimeTarget: 'desktop',
        mutating: true,
      },
    );

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('desktop_action_rejected');
  });

  it('requires explicit approval for mutating desktop actions', async () => {
    const adapter = new SupervisedDesktopAutomationAdapter({
      desktopTool: { execute: jest.fn() },
      platform: 'win32',
    });

    const result = await adapter.execute(
      {
        capability: 'desktop.automation',
        command: JSON.stringify({ action: 'type-text', windowTitle: 'Notepad', payload: 'hello' }),
        approved: false,
      },
      {
        allowed: true,
        requiresApproval: false,
        reason: 'ok',
        capability: 'desktop.automation',
        profile: 'dangerous',
        requiredProfile: 'dangerous',
        autonomyLevel: 5,
        requiredAutonomyLevel: 5,
        runtimeTarget: 'desktop',
        mutating: true,
      },
    );

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('desktop_action_approval_required');
  });
});
