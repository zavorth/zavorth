import {
  buildAgentPermissionActions,
  buildAgentPermissionApprovalResponse,
  buildAgentPermissionCallbackData,
  parseAgentPermissionTaskCallback,
  renderAgentPermissionApprovalForSurface,
} from '../../../src/services/permission/AgentPermissionApprovalPresentation.js';

describe('AgentPermissionApprovalPresentation', () => {
  const taskId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  it('builds callback data under Telegram 64-byte limit', () => {
    for (const choice of ['once', 'session', 'always', 'deny'] as const) {
      const data = buildAgentPermissionCallbackData(choice, taskId);
      expect(data.length).toBeLessThanOrEqual(64);
      expect(data.startsWith(`task:${choice}:`)).toBe(true);
    }
  });

  it('builds four surface-agnostic actions', () => {
    const actions = buildAgentPermissionActions(taskId);
    expect(actions.map((a) => a.label)).toEqual(['Run once', 'Session', 'Always', 'Deny']);
    expect(actions.every((a) => a.callbackData && a.command)).toBe(true);
  });

  it('parses modern and legacy task callbacks', () => {
    expect(parseAgentPermissionTaskCallback(`task:once:${taskId}`)).toEqual({
      choice: 'once',
      taskId,
    });
    expect(parseAgentPermissionTaskCallback(`task:session:${taskId}`)?.choice).toBe('session');
    expect(parseAgentPermissionTaskCallback(`task:approve:${taskId}`)).toEqual({
      choice: 'once',
      taskId,
    });
    expect(parseAgentPermissionTaskCallback(`task:reject:${taskId}`)?.choice).toBe('deny');
    expect(parseAgentPermissionTaskCallback('noise')).toBeNull();
  });

  it('telegram render produces inline_keyboard; plain render lists slash commands', () => {
    const response = buildAgentPermissionApprovalResponse({
      approvalId: taskId,
      title: 'Approval needed',
      summary: 'Run shell?',
      riskLabel: 'high',
    });
    expect(response.intent).toBe('approval');
    expect(response.actions?.length).toBe(4);

    const tg = renderAgentPermissionApprovalForSurface('telegram', {
      approvalId: taskId,
      title: 'Approval needed',
    });
    expect(tg.rendered.native?.replyMarkup?.inline_keyboard?.length).toBeGreaterThan(0);
    const flat = tg.rendered.native!.replyMarkup!.inline_keyboard.flat();
    expect(flat.some((b) => b.callback_data?.includes('once'))).toBe(true);

    const plain = renderAgentPermissionApprovalForSurface('cli', {
      approvalId: taskId,
      title: 'Approval needed',
    });
    expect(plain.rendered.native).toBeNull();
    expect(plain.rendered.text).toMatch(/\/approve/);
    expect(plain.rendered.text).toMatch(/once|session|always/i);
  });
});
