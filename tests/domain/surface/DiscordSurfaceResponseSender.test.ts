import {
  projectDiscordSurfaceResponse,
  replyWithDiscordSurfaceResponse,
  extractDiscordApiSafeReplyOptions,
} from '../../../src/gateways/channels/discord/DiscordSurfaceResponseSender.js';
import {
  resetPendingSurfaceApprovalIndexForTests,
  resolvePendingSurfaceApproval,
  resetSurfaceProjectionTelemetryForTests,
  listSurfaceProjectionTelemetry,
} from '../../../src/domain/surface/application/surface-projection/index.js';
import { resolveSurfaceProfileForChannel } from '../../../src/domain/surface/application/surface-affordance/index.js';
import { buildAgentPermissionApprovalResponse } from '../../../src/services/permission/AgentPermissionApprovalPresentation.js';

const TASK_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('DiscordSurfaceResponseSender', () => {
  afterEach(() => {
    resetPendingSurfaceApprovalIndexForTests();
    resetSurfaceProjectionTelemetryForTests();
  });

  function approvalResponse() {
    const profile = resolveSurfaceProfileForChannel('discord');
    return buildAgentPermissionApprovalResponse(
      {
        approvalId: TASK_ID,
        title: 'Approval needed',
        summary: 'Run shell?',
        riskLabel: 'high',
      },
      profile,
    );
  }

  it('projectDiscordSurfaceResponse emits API-safe components for approval card', () => {
    const response = approvalResponse();
    const projected = projectDiscordSurfaceResponse(response);

    expect(projected.usedNativeButtons).toBe(true);
    expect(projected.text).toMatch(/Approval|shell|approve/i);
    expect(projected.replyOptions).toBeTruthy();
    expect(Array.isArray(projected.replyOptions?.components)).toBe(true);
    expect((projected.replyOptions?.components || []).length).toBeGreaterThan(0);
    expect(projected.replyOptions?.allowedMentions).toEqual({ parse: [] });

    // Non-API keys must be stripped from public replyOptions
    expect((projected.replyOptions as any).suggestedReactions).toBeUndefined();
    expect((projected.replyOptions as any).selectMenu).toBeUndefined();
    expect((projected.replyOptions as any).reactionsHint).toBeUndefined();
    expect((projected.replyOptions as any).numberedOptions).toBeUndefined();

    const events = listSurfaceProjectionTelemetry(10);
    expect(events.some((e) => e.channel === 'discord')).toBe(true);
  });

  it('extractDiscordApiSafeReplyOptions strips suggestedReactions and selectMenu flags', () => {
    const response = approvalResponse();
    const projected = projectDiscordSurfaceResponse(response);
    // Inject non-API keys into raw output and re-extract
    const dirty = {
      ...projected.output,
      replyOptions: {
        ...(projected.output.replyOptions || {}),
        suggestedReactions: ['✅', '❌'],
        selectMenu: true,
        reactionsHint: 'React…',
        numberedOptions: ['a', 'b'],
      },
    };
    const safe = extractDiscordApiSafeReplyOptions(dirty);
    expect(safe).toBeTruthy();
    expect((safe as any).suggestedReactions).toBeUndefined();
    expect((safe as any).selectMenu).toBeUndefined();
    expect((safe as any).reactionsHint).toBeUndefined();
    expect((safe as any).numberedOptions).toBeUndefined();
    expect(safe?.allowedMentions || safe?.components).toBeTruthy();
  });

  it('replyWithDiscordSurfaceResponse registers pending approval when chatId + messageId + track id', async () => {
    const response = approvalResponse();
    const sent: Array<{ text: string; options?: unknown }> = [];

    const result = await replyWithDiscordSurfaceResponse(
      {
        chatId: 'discord:guild:1:channel:2',
        reply: async (text, options) => {
          sent.push({ text, options });
          return { messageId: 'msg-42' };
        },
      },
      response,
      { trackApprovalId: TASK_ID, highRisk: true },
    );

    expect(result.tracked).toBe(true);
    expect(result.messageId).toBe('msg-42');
    expect(result.usedNativeButtons).toBe(true);
    expect(sent).toHaveLength(1);
    expect(Array.isArray((sent[0].options as any)?.components)).toBe(true);

    const pending = resolvePendingSurfaceApproval({
      surface: 'discord',
      chatId: 'discord:guild:1:channel:2',
      messageId: 'msg-42',
    });
    expect(pending?.approvalId).toBe(TASK_ID);
    expect(pending?.highRisk).toBe(true);
  });

  it('replyWithout send returns projected payload and does not track without messageId', async () => {
    const response = approvalResponse();
    const result = await replyWithDiscordSurfaceResponse(
      { chatId: 'discord:dm:99' },
      response,
      { trackApprovalId: TASK_ID },
    );

    expect(result.tracked).toBe(false);
    expect(result.messageId).toBeNull();
    expect(result.replyOptions?.components).toBeTruthy();
    expect(
      resolvePendingSurfaceApproval({ surface: 'discord', chatId: 'discord:dm:99' }),
    ).toBeNull();
  });
});
