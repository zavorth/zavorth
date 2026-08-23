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

  async function emitInbound(eventBus: GatewayEventBus, rawText: string, messageId: string): Promise<void> {
    await eventBus.emit(
      buildInboundChannelEvent({
        platform: 'slack',
        userId: 'U123',
        chatId: 'C-ops',
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
      sessionId: 'slack:C-ops',
      text: 'run npm test',
      requestedTools: ['shell.exec'],
    });
    await gateway.handle({
      userId: 'U123',
      channel: 'api',
      sessionId: 'slack:C-ops',
      text: 'deploy the service',
      requestedTools: ['shell.exec'],
    });
    expect(gateway.listRuns().filter((run) => run.status === 'waiting_approval')).toHaveLength(2);

    await emitInbound(eventBus, '/approve all once', '171234.0200');

    expect(executor).toHaveBeenCalledTimes(2);
    expect(outboundTexts).toContain('Approved all 2 approval(s) (once).');
    expect(gateway.listRuns().filter((run) => run.status === 'waiting_approval')).toHaveLength(0);
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
      sessionId: 'slack:C-ops',
      text: 'wipe the production database table now',
      requestedTools: ['shell.exec'],
    });
    const pendingRun = gateway.listRuns().find((run) => run.status === 'waiting_approval');
    expect(pendingRun).toBeDefined();
    const pendingApproval = pendingRun?.approvals.find((approval) => approval.status === 'pending');
    expect(pendingApproval).toBeDefined();
    gateway.registerChannelMeshApprovalMenu('slack', 'C-ops', [pendingApproval?.id || '']);
    executor.mockClear();

    await emitInbound(eventBus, 'other', '171234.0202');

    expect(outboundTexts.some((text) => text.startsWith('Describe your answer for'))).toBe(true);

    await emitInbound(eventBus, 'not now, production is frozen', '171234.0203');

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
});
