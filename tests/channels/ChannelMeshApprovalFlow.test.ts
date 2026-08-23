import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  buildInboundChannelEvent,
  extractChannelMeshReplyEvent,
} from '../../src/channels/contracts/ChannelMessageContract.js';
import { ChannelPolicyManager } from '../../src/channels/policies/ChannelPolicyManager.js';
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
});
