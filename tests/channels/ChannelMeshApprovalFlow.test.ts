import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  buildInboundChannelEvent,
  extractChannelMeshReplyEditEvent,
  extractChannelMeshReplyEvent,
} from '../../src/channels/contracts/ChannelMessageContract.js';
import { ChannelPolicyManager } from '../../src/channels/policies/ChannelPolicyManager.js';
import {
  registerSurfaceProfile,
  resetSurfaceProfileRegistryForTests,
} from '../../src/domain/surface/application/surface-affordance/index.js';
import { GatewayEventBus } from '../../src/gateway/events/GatewayEventBus.js';
import { ZavorthAgentGateway } from '../../src/runtime/agent/index.js';
import type { UniversalAgentExecutor } from '../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => {
    index += 1;
    return `${prefix}-${index}`;
  };
}

describe('Channel Mesh approval flow', () => {
  const tempDirs: string[] = [];

  function createIsolatedPolicyManager(env: Record<string, string> = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-channel-policy-'));
    tempDirs.push(root);
    return new ChannelPolicyManager({
      policyFile: path.join(root, 'channel-policies.json'),
      env: env as NodeJS.ProcessEnv,
    });
  }

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  async function createOpenSlackBus() {
    const policyManager = createIsolatedPolicyManager({
      ZAVORTH_CHANNEL_POLICY_SLACK_OPEN: 'true',
    });
    await policyManager.loadPolicies();
    return new GatewayEventBus();
  }

  function collectOutboundTexts(eventBus: GatewayEventBus, platform: string): string[] {
    const texts: string[] = [];
    eventBus.subscribe('public_ws', (event) => {
      const reply = extractChannelMeshReplyEvent(event, platform);
      if (reply) {
        texts.push(reply.text);
      }
    });
    return texts;
  }

  function collectOutboundEdits(
    eventBus: GatewayEventBus,
    platform: string,
  ): Array<{ chatId: string; messageId: string; text: string }> {
    const edits: Array<{ chatId: string; messageId: string; text: string }> = [];
    eventBus.subscribe('public_ws', (event) => {
      const edit = extractChannelMeshReplyEditEvent(event, platform);
      if (edit) {
        edits.push({ chatId: edit.chatId, messageId: edit.messageId, text: edit.text });
      }
    });
    return edits;
  }

  async function emitInbound(
    eventBus: GatewayEventBus,
    rawText: string,
    messageId: string,
    chatId = 'C-bulk',
    platform: 'slack' | 'telegram' = 'slack',
    userId = 'U123',
  ): Promise<void> {
    await eventBus.emit(
      buildInboundChannelEvent({
        platform,
        userId,
        chatId,
        rawText,
        messageId,
        now: new Date('2026-04-27T16:00:00.000Z'),
      }),
    );
  }

  it('resolves "/approve all" against every pending approval of that chat session', async () => {
    const eventBus = await createOpenSlackBus();
    const outboundTexts = collectOutboundTexts(eventBus, 'slack');
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => ({
      status: 'completed',
      summary: 'Executed after approval.',
      replyText: 'done',
    }));
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-27T16:00:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });
    gateway.attachChannelMeshEventBus(eventBus, {}, { onboardingGate: null });

    await gateway.handle({
      userId: 'U123',
      channel: 'api',
      sessionId: 'slack:C-bulk',
      text: 'run npm test',
      requestedTools: ['shell.exec'],
    });
    await gateway.handle({
      userId: 'U123',
      channel: 'api',
      sessionId: 'slack:C-bulk',
      text: 'deploy the service',
      requestedTools: ['shell.exec'],
    });
    expect(gateway.listRuns().filter((run) => run.status === 'waiting_approval')).toHaveLength(2);

    await emitInbound(eventBus, '/approve all once', '171234.0200');

    expect(executor).toHaveBeenCalledTimes(2);
    expect(outboundTexts).toContain('Approved all 2 approval(s) (once).');
    expect(gateway.listRuns().filter((run) => run.status === 'waiting_approval')).toHaveLength(0);
  });

  it('renders approval receipts in the chat preferred language carried on ingress metadata', async () => {
    const eventBus = await createOpenSlackBus();
    const outboundTexts = collectOutboundTexts(eventBus, 'slack');
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => ({
      status: 'completed',
      summary: 'Executed after approval.',
      replyText: 'done',
    }));
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-27T16:20:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });
    gateway.attachChannelMeshEventBus(eventBus, {}, { onboardingGate: null });

    await gateway.handle({
      userId: 'U123',
      channel: 'api',
      sessionId: 'slack:C-ptbr',
      text: 'run npm test',
      requestedTools: ['shell.exec'],
    });
    expect(gateway.listRuns().filter((run) => run.status === 'waiting_approval')).toHaveLength(1);

    // Telegram ingress attaches metadata.preferredLanguageCode; the mesh
    // handler threads it into every approval string it renders.
    await eventBus.emit({
      type: 'public_ws',
      payload: {
        id: 'slack-ptbr-0300',
        type: 'event',
        payload: {
          topic: 'im_message',
          data: {
            platform: 'slack',
            userId: 'U123',
            chatId: 'C-ptbr',
            rawText: '/approve all once',
            messageId: '171234.0300',
            receivedAt: '2026-04-27T16:20:00.000Z',
            normalizedInboundMessage: {
              requestId: 'slack:171234.0300',
              traceId: null,
              userId: 'U123',
              sessionId: 'slack:C-ptbr',
              channel: 'api',
              text: '/approve all once',
              workspace: null,
              requestedTools: [],
              replyPort: {
                id: 'slack:C-ptbr:channel-mesh',
                label: 'slack Channel Mesh',
                kind: 'api',
                status: 'available',
                primary: true,
                description: 'Normalized non-Telegram channel for the Zavorth Agent Gateway.',
              },
              metadata: {
                source: 'channel-mesh',
                platform: 'slack',
                surface: 'slack',
                channelPlatform: 'slack',
                channelUserId: 'U123',
                chatId: 'C-ptbr',
                messageId: '171234.0300',
                receivedAt: '2026-04-27T16:20:00.000Z',
                normalizedInboundMessage: true,
                canonicalChannelInboundMessage: true,
                channelFields: {},
                preferredLanguageCode: 'pt-BR',
              },
            },
          },
        },
      },
    });

    expect(executor).toHaveBeenCalledTimes(1);
    expect(outboundTexts).toContain('Todas as 1 aprovações foram aprovadas (once).');
  });

  it('captures free-text answers behind the "other" escape and denies fail-closed with the reason relayed', async () => {
    const eventBus = await createOpenSlackBus();
    const outboundTexts = collectOutboundTexts(eventBus, 'slack');
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>();
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-27T16:10:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });
    gateway.attachChannelMeshEventBus(eventBus, {}, { onboardingGate: null });

    // A destructive request stops before execution. The pending-approval
    // listing is published through the spine's presenter-facing registration,
    // exactly what the mesh guidance block does after a waiting run.
    await gateway.handle({
      userId: 'U123',
      channel: 'api',
      sessionId: 'slack:C-other',
      text: 'wipe the production database table now',
      requestedTools: ['shell.exec'],
    });
    const pendingRun = gateway.listRuns().find((run) => run.status === 'waiting_approval');
    expect(pendingRun).toBeDefined();
    const pendingApproval = pendingRun?.approvals.find((approval) => approval.status === 'pending');
    expect(pendingApproval).toBeDefined();
    gateway.registerChannelMeshApprovalMenu('slack', 'C-other', [pendingApproval?.id || '']);
    executor.mockClear();

    await emitInbound(eventBus, 'other', '171234.0202', 'C-other');

    expect(outboundTexts.some((text) => text.startsWith('Describe your answer for'))).toBe(true);

    await emitInbound(eventBus, 'not now, production is frozen', '171234.0203', 'C-other');

    expect(executor).not.toHaveBeenCalled();
    expect(outboundTexts).toContain('Denied 1 approval(s). Your answer was relayed to the agent.');
    const rejectedRun = gateway
      .listRuns()
      .find((run) => run.approvals.some((approval) => approval.status === 'rejected'));
    expect(rejectedRun?.status).toBe('cancelled');
    expect(
      rejectedRun?.events.find((event) => event.metadata?.operatorReason)?.metadata?.operatorReason,
    ).toBe('not now, production is frozen');
  });

  it('dismisses every other surface presenter when one surface resolves the approval', async () => {
    const eventBus = await createOpenSlackBus();
    const slackTexts = collectOutboundTexts(eventBus, 'slack');
    const telegramTexts = collectOutboundTexts(eventBus, 'telegram');
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>();
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-27T16:30:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });
    gateway.attachChannelMeshEventBus(eventBus, {}, { onboardingGate: null });

    // A risky request pends once; two connected surfaces render their own
    // presenter for the SAME canonical approval ref.
    await gateway.handle({
      userId: 'U123',
      channel: 'api',
      sessionId: 'cli:local',
      text: 'wipe the production database table now',
      requestedTools: ['shell.exec'],
    });
    const pendingRun = gateway.listRuns().find((run) => run.status === 'waiting_approval');
    expect(pendingRun).toBeDefined();
    const pendingApproval = pendingRun?.approvals.find((approval) => approval.status === 'pending');
    expect(pendingApproval).toBeDefined();
    const approvalRef = pendingApproval?.id || '';

    await emitInbound(eventBus, 'hello there', '171234.0500', 'C-dual');
    await emitInbound(eventBus, 'hello from telegram', '171234.0501', 'T-dual', 'telegram', 'U-telegram');
    gateway.registerChannelMeshApprovalMenu('slack', 'C-dual', [approvalRef]);
    gateway.registerChannelMeshApprovalMenu('telegram', 'T-dual', [approvalRef]);
    executor.mockClear();

    await emitInbound(eventBus, `/approve ${approvalRef} once`, '171234.0502');

    expect(slackTexts).toContain(`Approved ${approvalRef} (once).`);
    expect(telegramTexts).toContain(
      `Resolved elsewhere: approval ${approvalRef} was approved on another surface. No action is needed here.`,
    );

    // The stale telegram presenter is retired: a later message on that chat is
    // treated as agent prose and can no longer decide the resolved approval.
    await emitInbound(eventBus, '1', '171234.0503', 'T-dual', 'telegram', 'U-telegram');
    expect(
      telegramTexts.some((text) => text.includes(`Approved ${approvalRef}`) || text.includes('Denied')),
    ).toBe(false);
    const resolvedRun = gateway.listRuns().find((run) => run.approvals.some((entry) => entry.id === approvalRef));
    expect(resolvedRun?.approvals.find((entry) => entry.id === approvalRef)?.status).toBe('approved');
  });

  it('edits the stored telegram prompt card in place instead of sending a follow-up receipt', async () => {
    const eventBus = await createOpenSlackBus();
    const telegramTexts = collectOutboundTexts(eventBus, 'telegram');
    const telegramEdits = collectOutboundEdits(eventBus, 'telegram');
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => ({
      status: 'completed',
      summary: 'Executed after approval.',
      replyText: 'done',
    }));
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-27T17:00:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });
    gateway.attachChannelMeshEventBus(eventBus, {}, { onboardingGate: null });

    await emitInbound(eventBus, 'hello from telegram', '171234.0600', 'T-eip', 'telegram', 'U-telegram');

    // The risky request pends on another surface; the telegram presenter had
    // already rendered its card and captured the native message id (the same
    // capture the grammy guidance path performs via ctx.reply).
    await gateway.handle({
      userId: 'U123',
      channel: 'api',
      sessionId: 'cli:eip',
      text: 'wipe the production database table now',
      requestedTools: ['shell.exec'],
    });
    const pendingRun = gateway.listRuns().find((run) => run.status === 'waiting_approval');
    const approvalRef = pendingRun?.approvals.find((approval) => approval.status === 'pending')?.id || '';
    expect(approvalRef).not.toBe('');
    gateway.registerChannelMeshApprovalMenu('telegram', 'T-eip', [approvalRef], { promptMessageId: '5501' });
    executor.mockClear();

    await emitInbound(eventBus, `/approve ${approvalRef} once`, '171234.0602');

    // Edit-in-place wins over the follow-up receipt for the card surface.
    expect(telegramEdits).toEqual([
      {
        chatId: 'T-eip',
        messageId: '5501',
        text: `Resolved elsewhere: approval ${approvalRef} was approved on another surface. No action is needed here.`,
      },
    ]);
    expect(telegramTexts.every((text) => !text.includes('Resolved elsewhere'))).toBe(true);
  });

  it('falls back to a follow-up receipt when the resolved presenter cannot edit its cards', async () => {
    const eventBus = await createOpenSlackBus();
    const signalTexts = collectOutboundTexts(eventBus, 'signal');
    const signalEdits = collectOutboundEdits(eventBus, 'signal');
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => ({
      status: 'completed',
      summary: 'Executed after approval.',
      replyText: 'done',
    }));
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-27T17:10:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });
    gateway.attachChannelMeshEventBus(eventBus, {}, { onboardingGate: null });

    await gateway.handle({
      userId: 'U123',
      channel: 'api',
      sessionId: 'cli:fallback',
      text: 'wipe the production database table now',
      requestedTools: ['shell.exec'],
    });
    const pendingRun = gateway.listRuns().find((run) => run.status === 'waiting_approval');
    const approvalRef = pendingRun?.approvals.find((approval) => approval.status === 'pending')?.id || '';

    await emitInbound(eventBus, 'hello from signal', '171234.0610', 'S-fallback', 'signal', 'U-signal');
    // A numbered-text surface has no editable card even when a message id leaked in.
    gateway.registerChannelMeshApprovalMenu('signal', 'S-fallback', [approvalRef], { promptMessageId: '4242' });
    executor.mockClear();

    await emitInbound(eventBus, `/approve ${approvalRef} once`, '171234.0612');

    expect(signalEdits).toEqual([]);
    expect(signalTexts).toContain(
      `Resolved elsewhere: approval ${approvalRef} was approved on another surface. No action is needed here.`,
    );
  });

  describe('proactive pending-approval broadcast', () => {
    function extractPromptRefs(texts: string[]): string[] {
      return texts
        .map((text) => /\[[^\]]+\] .* — ref ([^\n]+)\n/.exec(text)?.[1] || '')
        .filter(Boolean);
    }

    it('prompts every active surface of the same user and dismisses everywhere on one decision', async () => {
      const eventBus = await createOpenSlackBus();
      const slackTexts = collectOutboundTexts(eventBus, 'slack');
      const telegramTexts = collectOutboundTexts(eventBus, 'telegram');
      const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => ({
        status: 'completed',
        summary: 'Executed after approval.',
        replyText: 'done',
      }));
      const gateway = new ZavorthAgentGateway({
        now: () => new Date('2026-04-27T18:00:00.000Z'),
        idFactory: createIdFactory(),
        executor,
      });
      gateway.attachChannelMeshEventBus(eventBus, {}, { onboardingGate: null });

      // Three surfaces went active: two belong to the requesting user, one to
      // somebody else who must never be prompted.
      await emitInbound(eventBus, 'hello slack', '171234.0700', 'C-b1', 'slack', 'U123');
      await emitInbound(eventBus, 'hi telegram', '171234.0701', 'T-b1', 'telegram', 'U123');
      await emitInbound(eventBus, 'other operator chat', '171234.0702', 'C-zz', 'slack', 'U999');

      await gateway.handle({
        userId: 'U123',
        channel: 'api',
        sessionId: 'cli:broadcast',
        text: 'wipe the production database table now',
        requestedTools: ['shell.exec'],
      });
      const approvalRef = gateway
        .listRuns()
        .find((run) => run.status === 'waiting_approval')
        ?.approvals.find((approval) => approval.status === 'pending')?.id;
      expect(approvalRef).toBeDefined();

      expect(extractPromptRefs(slackTexts)).toContain(approvalRef);
      expect(slackTexts.some((text) => text.includes('C-zz') || text.includes('U999'))).toBe(false);
      expect(telegramTexts.some((text) => text.includes(`ref ${approvalRef}`))).toBe(true);

      // The deciding chat is another idle surface of the same user; every
      // other prompted presenter receives its dismissal.
      await emitInbound(eventBus, `/approve ${approvalRef} once`, '171234.0703');

      const telegramDismissals = telegramTexts.filter((text) => text.includes('Resolved elsewhere'));
      expect(telegramDismissals.length).toBeGreaterThan(0);
      expect(executor).toHaveBeenCalled();

      // Retired presenters can no longer decide through stale tokens.
      await emitInbound(eventBus, '1', '171234.0704', 'T-b1', 'telegram', 'U123');
      expect(
        telegramTexts.some((text) => text.includes(`Approved ${approvalRef}`)),
      ).toBe(false);
    });

    it('never prompts surfaces that declared approvals disabled even when active and allowed', async () => {
      registerSurfaceProfile({
        id: 'broadcast-silent-relay',
        channel: 'plain',
        label: 'Broadcast silent relay',
        preset: 'chat-basic',
        overrides: {
          affordances: { text: false, slash_commands: false },
        },
      });
      try {
        const eventBus = await createOpenSlackBus();
        const silentTexts = collectOutboundTexts(eventBus, 'broadcast-silent-relay');
        const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => ({
          status: 'completed',
          summary: 'Executed after approval.',
          replyText: 'done',
        }));
        const gateway = new ZavorthAgentGateway({
          now: () => new Date('2026-04-27T18:05:00.000Z'),
          idFactory: createIdFactory(),
          executor,
        });
        gateway.attachChannelMeshEventBus(eventBus, {}, { onboardingGate: null });

        await eventBus.emit(
          buildInboundChannelEvent({
            platform: 'broadcast-silent-relay',
            userId: 'U123',
            chatId: 'BSR-1',
            rawText: 'silent hello',
            messageId: '171234.0710',
            now: new Date('2026-04-27T18:05:00.000Z'),
          }),
        );

        await gateway.handle({
          userId: 'U123',
          channel: 'api',
          sessionId: 'cli:silent-broadcast',
          text: 'wipe the production database table now',
          requestedTools: ['shell.exec'],
        });

        expect(extractPromptRefs(silentTexts)).toEqual([]);
      } finally {
        resetSurfaceProfileRegistryForTests();
      }
    });
    it('stays off entirely through the explicit opt-out bridge option', async () => {
      const eventBus = await createOpenSlackBus();
      const slackTexts = collectOutboundTexts(eventBus, 'slack');
      const telegramTexts = collectOutboundTexts(eventBus, 'telegram');
      const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => ({
        status: 'completed',
        summary: 'Executed after approval.',
        replyText: 'done',
      }));
      const gateway = new ZavorthAgentGateway({
        now: () => new Date('2026-04-27T18:10:00.000Z'),
        idFactory: createIdFactory(),
        executor,
      });
      gateway.attachChannelMeshEventBus(eventBus, {}, {
        onboardingGate: null,
        approvalBroadcastDisabled: true,
      });

      await emitInbound(eventBus, 'hello slack', '171234.0720', 'C-off', 'slack', 'U123');
      await emitInbound(eventBus, 'hi telegram', '171234.0721', 'T-off', 'telegram', 'U123');

      await gateway.handle({
        userId: 'U123',
        channel: 'api',
        sessionId: 'cli:optout',
        text: 'wipe the production database table now',
        requestedTools: ['shell.exec'],
      });

      expect(extractPromptRefs(slackTexts)).toEqual([]);
      expect(extractPromptRefs(telegramTexts)).toEqual([]);
    });

    it('enforces the channel policy boundary before prompting an idle surface', async () => {
      const eventBus = await createOpenSlackBus();
      const slackTexts = collectOutboundTexts(eventBus, 'slack');
      const telegramTexts = collectOutboundTexts(eventBus, 'telegram');
      const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(() => ({
        status: 'completed',
        summary: 'Executed after approval.',
        replyText: 'done',
      }));
      const gateway = new ZavorthAgentGateway({
        now: () => new Date('2026-04-27T18:15:00.000Z'),
        idFactory: createIdFactory(),
        executor,
      });
      gateway.attachChannelMeshEventBus(eventBus, {}, {
        onboardingGate: null,
        policyManager: {
          verifyAccess: async (channelId: string) => channelId !== 'slack',
        },
      });

      await emitInbound(eventBus, 'hello slack', '171234.0730', 'C-pol', 'slack', 'U123');
      await emitInbound(eventBus, 'hi telegram', '171234.0731', 'T-pol', 'telegram', 'U123');

      await gateway.handle({
        userId: 'U123',
        channel: 'api',
        sessionId: 'cli:policygate',
        text: 'wipe the production database table now',
        requestedTools: ['shell.exec'],
      });
      const approvalRef = gateway
        .listRuns()
        .find((run) => run.status === 'waiting_approval')
        ?.approvals.find((approval) => approval.status === 'pending')?.id;

      // Telegram passed the policy gate; slack was denied by it.
      expect(telegramTexts.some((text) => text.includes(`ref ${approvalRef}`))).toBe(true);
      expect(extractPromptRefs(slackTexts)).toEqual([]);
    });
  });
});
