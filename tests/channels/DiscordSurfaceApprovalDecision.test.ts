import { CoreOrchestrator } from '../../src/core/CoreOrchestrator.js';
import type { IMessageBroker, IMessageContext } from '../../src/contracts/IMessageBroker.js';
import type {
  SurfaceApprovalDecisionOutcome,
  SurfaceApprovalDecisionRequest,
} from '../../src/contracts/core/SurfaceApprovalDecisionContract.js';
import { DiscordGatewayInboundService } from '../../src/gateways/channels/discord/discord-gateway/DiscordGatewayInboundService.js';
import type { DiscordGatewayInteractionLike } from '../../src/gateways/channels/discord/DiscordGatewayTypes.js';
import { MatrixGateway } from '../../src/gateways/channels/simple/MatrixGateway.js';
import { DiscordSurfacePolicyService } from '../../src/services/DiscordSurfacePolicyService.js';
import type { LogRepository } from '../../src/storage/LogRepository.js';
import {
  registerPendingSurfaceApproval,
  resetPendingSurfaceApprovalIndexForTests,
} from '../../src/domain/surface/application/surface-projection/index.js';

const TASK_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const CHAT_ID = 'discord:guild:guild-ok:channel:channel-ok';
const NUMBERED_OPTIONS = [
  'agent-perm-once',
  'agent-perm-session',
  'agent-perm-always',
  'agent-perm-deny',
];

type DecisionRecordingBroker = IMessageBroker & {
  decisions: SurfaceApprovalDecisionRequest[];
  processMessageCalls: IMessageContext[];
};

type RecordingPersistence = {
  rejectedReasons: string[];
  processedInbound: Array<Record<string, unknown>>;
};

function createSilentLogRepo(): LogRepository {
  return {
    log: () => undefined,
  } as unknown as LogRepository;
}

function createDecisionBroker(): DecisionRecordingBroker {
  const broker: DecisionRecordingBroker = {
    decisions: [],
    processMessageCalls: [],
    registerGateway: () => undefined,
    broadcast: async () => undefined,
    async processMessage(ctx: IMessageContext) {
      broker.processMessageCalls.push(ctx);
    },
    async resolveSurfaceApprovalDecision(
      request: SurfaceApprovalDecisionRequest,
    ): Promise<SurfaceApprovalDecisionOutcome> {
      broker.decisions.push(request);
      await request.reply(`decision:${request.action}:${request.ref}:${request.scope || 'deny'}`);
      return {
        status: 'executed',
        action: request.action,
        ref: request.ref,
        scope: request.scope ?? null,
        replies: [],
        reason: null,
      };
    },
  };
  return broker;
}

function createInboundService(options: {
  policy: DiscordSurfacePolicyService;
  broker?: IMessageBroker | null;
  allowedGuildIds?: string[];
}): {
  service: DiscordGatewayInboundService;
  persistence: RecordingPersistence;
} {
  const persistence: RecordingPersistence = { rejectedReasons: [], processedInbound: [] };
  const service = new DiscordGatewayInboundService({
    broker: options.broker === undefined ? createDecisionBroker() : options.broker,
    allowDirectMessages: false,
    allowedGuildIds: options.allowedGuildIds ?? ['guild-ok'],
    discordSurfacePolicyService: options.policy,
    persistence: {
      markRejected: (reason: string) => persistence.rejectedReasons.push(reason),
      markProcessedInbound: (input) => persistence.processedInbound.push({ ...input }),
    } as unknown as ConstructorParameters<typeof DiscordGatewayInboundService>[0]['persistence'],
    replyService: {
      replyToMessage: async () => undefined,
      editChannelMessage: async () => undefined,
      replyToInteraction: async () => undefined,
      editInteractionReply: async () => undefined,
    } as unknown as ConstructorParameters<typeof DiscordGatewayInboundService>[0]['replyService'],
  });
  return { service, persistence };
}

function buildButtonInteraction(
  options: {
    userId?: string;
    guildId?: string | null;
    channelId?: string;
    customId?: string;
  } = {},
): DiscordGatewayInteractionLike {
  return {
    isButton: () => true,
    customId: options.customId ?? `task:once:${TASK_ID}`,
    message: { id: 'card-message-1' },
    user: { id: options.userId ?? 'user-ok' },
    guildId: options.guildId === undefined ? 'guild-ok' : options.guildId,
    channelId: options.channelId ?? 'channel-ok',
    channel: {},
  };
}

describe('Discord surface approval decision ingress', () => {
  afterEach(() => {
    resetPendingSurfaceApprovalIndexForTests();
  });

  describe('gateway tap path gates', () => {
    it('routes a permission tap through the typed decision broker without touching processMessage', async () => {
      const policy = new DiscordSurfacePolicyService({ rateLimitWindowMs: 0 });
      const broker = createDecisionBroker();
      const { service } = createInboundService({ policy, broker });

      await service.handleInteraction(buildButtonInteraction());

      expect(broker.decisions).toHaveLength(1);
      expect(broker.decisions[0]).toMatchObject({
        platform: 'discord',
        chatId: CHAT_ID,
        userId: 'user-ok',
        ref: TASK_ID,
        action: 'approve',
        scope: 'once',
        transport: 'interaction',
      });
      expect(broker.processMessageCalls).toHaveLength(0);
    });

    it('blocks taps from guilds outside the allowlist before any decision executes', async () => {
      const policy = new DiscordSurfacePolicyService({ rateLimitWindowMs: 0 });
      const broker = createDecisionBroker();
      const { service, persistence } = createInboundService({ policy, broker });

      await service.handleInteraction(buildButtonInteraction({ guildId: 'guild-other' }));

      expect(persistence.rejectedReasons).toEqual([
        'Discord native gateway guild guild-other is not allowlisted.',
      ]);
      expect(broker.decisions).toHaveLength(0);
      expect(broker.processMessageCalls).toHaveLength(0);
    });

    it('blocks taps in channels outside the surface policy allowlist', async () => {
      const policy = new DiscordSurfacePolicyService({
        rateLimitWindowMs: 0,
        allowedChannelIds: ['channel-ok'],
      });
      const broker = createDecisionBroker();
      const { service, persistence } = createInboundService({ policy, broker });

      await service.handleInteraction(buildButtonInteraction({ channelId: 'channel-other' }));

      expect(persistence.rejectedReasons).toEqual([
        'This Discord channel is not enabled for Zavorth. Use an operator-allowlisted channel.',
      ]);
      expect(broker.decisions).toHaveLength(0);
      expect(broker.processMessageCalls).toHaveLength(0);
    });

    it('enforces the rate limit on taps and stops the decision from executing', async () => {
      let nowMs = 1_000_000;
      const policy = new DiscordSurfacePolicyService({
        rateLimitWindowMs: 60_000,
        rateLimitMaxRequests: 1,
        now: () => nowMs,
      });
      const broker = createDecisionBroker();
      const { service, persistence } = createInboundService({ policy, broker });

      await service.handleInteraction(buildButtonInteraction());
      nowMs += 1_000;
      await service.handleInteraction(
        buildButtonInteraction({ customId: `task:session:${TASK_ID}` }),
      );

      expect(broker.decisions).toHaveLength(1);
      expect(broker.decisions[0]?.action).toBe('approve');
      expect(persistence.rejectedReasons).toEqual([
        'You reached the temporary limit for this Discord channel. Wait a bit before trying again.',
      ]);
      expect(broker.processMessageCalls).toHaveLength(0);
    });

    it('blocks unauthorized users identically on the tap path and the typed text path', async () => {
      const createBlockedSetup = () => {
        const policy = new DiscordSurfacePolicyService({ rateLimitWindowMs: 0 });
        const broker = createDecisionBroker();
        const setup = createInboundService({ policy, broker });
        return { ...setup, broker };
      };

      const tapSetup = createBlockedSetup();
      await tapSetup.service.handleInteraction(buildButtonInteraction({ guildId: 'guild-denied' }));

      const typedSetup = createBlockedSetup();
      await typedSetup.service.handleInboundMessage({
        id: 'msg-1',
        author: { id: 'user-ok' },
        guildId: 'guild-denied',
        channelId: 'channel-ok',
        content: `/approve ${TASK_ID} once`,
      });

      expect(tapSetup.persistence.rejectedReasons).toEqual(typedSetup.persistence.rejectedReasons);
      expect(tapSetup.broker.decisions).toHaveLength(0);
      expect(typedSetup.broker.decisions).toHaveLength(0);
      expect(tapSetup.broker.processMessageCalls).toHaveLength(0);
      expect(typedSetup.broker.processMessageCalls).toHaveLength(0);
    });

    it('consumes numbered replies through the typed decision broker with text transport', async () => {
      registerPendingSurfaceApproval({
        approvalId: TASK_ID,
        surface: 'discord',
        chatId: CHAT_ID,
        messageId: 'card-message-1',
        numberedOptions: NUMBERED_OPTIONS,
      });
      const policy = new DiscordSurfacePolicyService({ rateLimitWindowMs: 0 });
      const broker = createDecisionBroker();
      const { service, persistence } = createInboundService({ policy, broker });

      await service.handleInboundMessage({
        id: 'msg-2',
        author: { id: 'user-ok' },
        guildId: 'guild-ok',
        channelId: 'channel-ok',
        content: '1',
      });

      expect(broker.decisions).toHaveLength(1);
      expect(broker.decisions[0]).toMatchObject({
        ref: TASK_ID,
        action: 'approve',
        scope: 'once',
        transport: 'text',
        chatId: CHAT_ID,
      });
      expect(persistence.rejectedReasons).toHaveLength(0);
      expect(broker.processMessageCalls).toHaveLength(0);
    });

    it('routes webhook-surface numbered replies through the typed decision broker as well', async () => {
      const matrixRoom = '!room:example.test';
      registerPendingSurfaceApproval({
        approvalId: TASK_ID,
        surface: 'matrix',
        chatId: matrixRoom,
        messageId: null,
        numberedOptions: NUMBERED_OPTIONS,
      });
      const broker = createDecisionBroker();
      const gateway = new MatrixGateway({
        eventBus: { emit: jest.fn() } as unknown as never,
        policyManager: { verifyAccess: jest.fn(async () => true) } as unknown as never,
      });
      (gateway as unknown as { broker: unknown }).broker = broker;

      const accepted = await gateway.onMessageReceived({
        sender: '@user:example.test',
        room_id: matrixRoom,
        content: { body: '1' },
      });

      expect(accepted).toBe(true);
      expect(broker.decisions).toHaveLength(1);
      expect(broker.decisions[0]).toMatchObject({
        platform: 'matrix',
        chatId: matrixRoom,
        userId: '@user:example.test',
        ref: TASK_ID,
        action: 'approve',
        scope: 'once',
        transport: 'text',
      });
      expect(broker.processMessageCalls).toHaveLength(0);
    });
  });

  describe('broker delegation equivalence with the typed /approve path', () => {
    type BoundaryCall = {
      commandType: string | null;
      commandArgs: string | null;
      userId: string;
      chatId: string;
      platform: string;
    };

    function createEquivalenceHarness() {
      const boundaryCalls: BoundaryCall[] = [];
      const orchestrator = new CoreOrchestrator(createSilentLogRepo());
      orchestrator.attachSharedSurfaceCommandService({
        handleCommand: async ({ context, parsedCommand }) => {
          boundaryCalls.push({
            commandType: parsedCommand?.command_type ?? null,
            commandArgs: parsedCommand?.command_args ?? null,
            userId: context.userId,
            chatId: context.chatId,
            platform: context.platform,
          });
          const receipt = `receipt:${parsedCommand?.command_type}:${parsedCommand?.command_args}`;
          await context.reply(receipt);
          return {
            ok: true,
            handled: true,
            status: 'ok' as const,
            summary: 'handled',
            messages: [receipt],
            correlation: null,
            error: null,
            metadata: {},
          };
        },
      });
      return { orchestrator, boundaryCalls };
    }

    async function runTypedTextApproval(
      orchestrator: CoreOrchestrator,
      rawText: string,
    ): Promise<string[]> {
      const replies: string[] = [];
      await orchestrator.processMessage({
        platform: 'discord',
        userId: 'user-ok',
        chatId: CHAT_ID,
        isGroup: true,
        rawText,
        transport: 'text',
        reply: async (text: string) => {
          replies.push(text);
        },
        editMessage: async () => undefined,
      });
      return replies;
    }

    async function runTypedDecision(
      orchestrator: CoreOrchestrator,
      request: Omit<SurfaceApprovalDecisionRequest, 'reply'>,
    ): Promise<{ replies: string[]; outcome: SurfaceApprovalDecisionOutcome }> {
      const replies: string[] = [];
      const outcome = await orchestrator.resolveSurfaceApprovalDecision({
        ...request,
        reply: async (text: string) => {
          replies.push(text);
        },
      });
      return { replies, outcome };
    }

    it('produces byte-equal receipts for approve decisions on both ingress paths', async () => {
      const typed = createEquivalenceHarness();
      const tap = createEquivalenceHarness();

      const textReplies = await runTypedTextApproval(typed.orchestrator, `/approve ${TASK_ID} once`);
      const decision = await runTypedDecision(tap.orchestrator, {
        platform: 'discord',
        chatId: CHAT_ID,
        userId: 'user-ok',
        ref: TASK_ID,
        action: 'approve',
        scope: 'once',
      });

      expect(decision.outcome.status).toBe('executed');
      expect(decision.replies).toEqual(textReplies);
      expect(tap.boundaryCalls[0]?.commandType).toBe(typed.boundaryCalls[0]?.commandType);
      expect(tap.boundaryCalls[0]?.commandArgs).toBe(typed.boundaryCalls[0]?.commandArgs);
      expect(tap.boundaryCalls[0]?.userId).toBe('user-ok');
      expect(tap.boundaryCalls[0]?.platform).toBe('discord');
    });

    it('produces byte-equal receipts for deny decisions on both ingress paths', async () => {
      const typed = createEquivalenceHarness();
      const tap = createEquivalenceHarness();

      const textReplies = await runTypedTextApproval(typed.orchestrator, `/reject ${TASK_ID}`);
      const decision = await runTypedDecision(tap.orchestrator, {
        platform: 'discord',
        chatId: CHAT_ID,
        userId: 'user-ok',
        ref: TASK_ID,
        action: 'deny',
      });

      expect(decision.outcome.status).toBe('executed');
      expect(decision.replies).toEqual(textReplies);
      expect(tap.boundaryCalls[0]?.commandType).toBe('/reject');
      expect(tap.boundaryCalls[0]?.commandType).toBe(typed.boundaryCalls[0]?.commandType);
      expect(tap.boundaryCalls[0]?.commandArgs).toBe(typed.boundaryCalls[0]?.commandArgs);
    });

    it('keeps the actor identity intact so spine-level admin and host gates evaluate identically', async () => {
      const harness = createEquivalenceHarness();

      await runTypedDecision(harness.orchestrator, {
        platform: 'discord',
        chatId: CHAT_ID,
        userId: 'operator-42',
        ref: TASK_ID,
        action: 'approve',
        scope: 'session',
      });

      expect(harness.boundaryCalls[0]).toMatchObject({
        userId: 'operator-42',
        chatId: CHAT_ID,
        platform: 'discord',
      });
    });
  });
});
