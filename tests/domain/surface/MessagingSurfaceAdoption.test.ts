import {
  extractMessagingTransportPayload,
  projectResponseForChannel,
  registerPendingSurfaceApproval,
  resetPendingSurfaceApprovalIndexForTests,
  resolvePendingSurfaceApproval,
  replyWithMessagingSurfaceResponse,
  tryConsumeMessagingPermissionText,
} from '../../../src/domain/surface/application/surface-projection/index.js';
import { resolveSurfaceProfileForChannel } from '../../../src/domain/surface/application/surface-affordance/index.js';
import { buildAgentPermissionApprovalResponse } from '../../../src/services/permission/AgentPermissionApprovalPresentation.js';

const TASK_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('Messaging surface adoption (WhatsApp/Signal numbered)', () => {
  afterEach(() => {
    resetPendingSurfaceApprovalIndexForTests();
  });

  it('projects numbered text for whatsapp and registers pending on send', async () => {
    const profile = resolveSurfaceProfileForChannel('whatsapp');
    const response = buildAgentPermissionApprovalResponse(
      { approvalId: TASK_ID, title: 'Approval needed', riskLabel: 'medium' },
      profile,
    );
    const output = projectResponseForChannel('whatsapp', response, {}, { profile });
    expect(output.usedNativeButtons).toBe(false);
    expect(output.text).toMatch(/Reply with a number/i);

    const transport = extractMessagingTransportPayload(output);
    expect(transport.transportOptions).toBeNull();
    expect(transport.numberedOptions?.length).toBeGreaterThanOrEqual(4);

    const sent: string[] = [];
    const result = await replyWithMessagingSurfaceResponse({
      channel: 'whatsapp',
      chatId: 'wa-chat-1',
      response,
      options: { trackApprovalId: TASK_ID },
      send: async ({ text }) => {
        sent.push(text);
        return { messageId: 'msg-1' };
      },
    });
    expect(result.tracked).toBe(true);
    expect(sent[0]).toMatch(/Reply with a number/i);
    expect(
      resolvePendingSurfaceApproval({ surface: 'whatsapp', chatId: 'wa-chat-1' })?.approvalId,
    ).toBe(TASK_ID);
  });

  it('consumes numbered reply 1 as once and clears pending', async () => {
    registerPendingSurfaceApproval({
      approvalId: TASK_ID,
      surface: 'signal',
      chatId: 'sig-1',
      messageId: '9',
      numberedOptions: [
        'agent-perm-once',
        'agent-perm-session',
        'agent-perm-always',
        'agent-perm-deny',
      ],
    });
    const permission = tryConsumeMessagingPermissionText({
      channel: 'signal',
      chatId: 'sig-1',
      rawText: '1',
    });
    expect(permission).toEqual({ taskId: TASK_ID, choice: 'once' });
    expect(resolvePendingSurfaceApproval({ surface: 'signal', chatId: 'sig-1' })).toBeNull();
  });

  it('consumes reply 4 as deny', () => {
    registerPendingSurfaceApproval({
      approvalId: TASK_ID,
      surface: 'whatsapp',
      chatId: 'wa-2',
      messageId: '1',
      numberedOptions: [
        'agent-perm-once',
        'agent-perm-session',
        'agent-perm-always',
        'agent-perm-deny',
      ],
    });
    expect(
      tryConsumeMessagingPermissionText({
        channel: 'whatsapp',
        chatId: 'wa-2',
        rawText: '4',
      }),
    ).toEqual({ taskId: TASK_ID, choice: 'deny' });
  });
});
