import { TelegramGatewayHandlerRegistrar } from '../../src/telegram/TelegramGatewayHandlerRegistrar';

function createRegistrarHarness() {
  let transformer: any = null;
  const trackMessage = jest.fn();
  const bot = {
    api: {
      config: {
        use: jest.fn((fn) => {
          transformer = fn;
        }),
      },
    },
    use: jest.fn(),
    on: jest.fn(),
    catch: jest.fn(),
  } as any;

  const registrar = new TelegramGatewayHandlerRegistrar({
    bot,
    logRepo: { log: jest.fn() },
    chatCleanup: { trackMessage },
    groupEventController: {
      handleNewMembers: jest.fn(),
      handleLeftMember: jest.fn(),
      processAntiSpam: jest.fn(),
      processMessageFilter: jest.fn(),
      trackMessage: jest.fn(),
    } as any,
    mediaController: {
      handlePhoto: jest.fn(),
      handleVoice: jest.fn(),
      handleVideo: jest.fn(),
      handleDocument: jest.fn(),
    },
    callbackController: { handleCallback: jest.fn() },
    hostIdentityService: {},
    processTextMessage: jest.fn(),
    processGroupCommand: jest.fn(),
    canUseInteractiveGroupAi: jest.fn(),
  });

  return {
    bot,
    registrar,
    trackMessage,
    getTransformer: () => transformer,
  };
}

describe('TelegramGatewayHandlerRegistrar', () => {
  it('keeps outgoing reply cleanup controls and message tracking outside BotGateway', async () => {
    const { registrar, trackMessage, getTransformer } = createRegistrarHarness();
    registrar.registerOutgoingTracker();

    const transformer = getTransformer();
    expect(transformer).toBeDefined();

    const payload: Record<string, unknown> = {};
    const result = await transformer(
      jest.fn().mockResolvedValue({
        ok: true,
        result: {
          chat: { id: 12345 },
          message_id: 99,
        },
      }),
      'sendMessage',
      payload,
      undefined,
    );

    expect(result.ok).toBe(true);
    expect(payload.reply_markup).toBeDefined();
    expect(trackMessage).toHaveBeenCalledWith('12345', 99);
  });
});
