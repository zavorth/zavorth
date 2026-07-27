import {
  getSurfaceProjector,
  listSurfaceProjectors,
  projectResponseForChannel,
  registerSurfaceProjector,
  resetSurfaceProjectorRegistryForTests,
  SURFACE_PROJECTOR_CONTRACT_VERSION,
  type SurfaceProjector,
  type SurfaceProjectorInput,
  type SurfaceProjectorOutput,
} from '../../../src/domain/surface/application/surface-projection/index.js';
import { resolveSurfaceProfileForChannel } from '../../../src/domain/surface/application/surface-affordance/index.js';
import {
  buildAgentPermissionApprovalResponse,
} from '../../../src/services/permission/AgentPermissionApprovalPresentation.js';
import {
  projectSharedSurfaceResponse,
  replyWithSharedSurfaceResponse,
} from '../../../src/domain/surface/presentation/shared-surface/SharedSurfaceResponseSender.js';

const TASK_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('SurfaceProjectors (F3)', () => {
  afterEach(() => {
    resetSurfaceProjectorRegistryForTests();
  });

  function approvalResponse(channel: string) {
    const profile = resolveSurfaceProfileForChannel(channel);
    return buildAgentPermissionApprovalResponse(
      {
        approvalId: TASK_ID,
        title: 'Approval needed',
        summary: 'Run shell-',
        riskLabel: 'high',
      },
      profile,
    );
  }

  it('registers builtins for telegram, discord, cli, web, desktop, plain', () => {
    const channels = listSurfaceProjectors().map((p) => p.channel);
    expect(channels).toEqual(
      expect.arrayContaining([
        'telegram',
        'discord',
        'cli',
        'web',
        'desktop',
        'plain',
        'signal',
        'whatsapp',
      ]),
    );
  });

  it('telegram projector emits reply_markup inline keyboard', () => {
    const response = approvalResponse('telegram');
    const out = projectResponseForChannel('telegram', response);
    expect(out.contractVersion).toBe(SURFACE_PROJECTOR_CONTRACT_VERSION);
    expect(out.channel).toBe('telegram');
    expect(out.usedNativeButtons).toBe(true);
    expect(out.replyOptions).toBeTruthy();
    expect((out.replyOptions as any).reply_markup?.inline_keyboard?.length).toBeGreaterThan(0);
    const flat = (out.replyOptions as any).reply_markup.inline_keyboard.flat();
    expect(flat.some((b: any) => String(b.callback_data || '').includes('once'))).toBe(true);
    expect(flat.some((b: any) => String(b.callback_data || '').includes('deny'))).toBe(true);
  });

  it('discord projector emits components', () => {
    const response = approvalResponse('discord');
    const out = projectResponseForChannel('discord', response);
    expect(out.usedNativeButtons).toBe(true);
    expect(Array.isArray((out.replyOptions as any)?.components)).toBe(true);
    expect((out.replyOptions as any).components.length).toBeGreaterThan(0);
  });

  it('cli/plain are text-only; signal has numbered metadata without native buttons', () => {
    for (const channel of ['cli', 'plain']) {
      const response = approvalResponse(channel);
      const out = projectResponseForChannel(channel, response);
      expect(out.replyOptions).toBeNull();
      expect(out.text).toMatch(/\/approve|once|Approval/i);
      expect(out.usedNativeButtons).toBe(false);
    }
    const signal = projectResponseForChannel('signal', approvalResponse('signal'));
    expect(signal.usedNativeButtons).toBe(false);
    expect((signal.replyOptions as any)?.numberedPrompt).toBe(true);
    expect(signal.text).toMatch(/\/approve|once|Reply with a number|Approval/i);
  });

  it('web/desktop projectors expose structured surfaceActions', () => {
    const web = projectResponseForChannel('web', approvalResponse('web'));
    expect(web.replyOptions).toBeTruthy();
    expect(Array.isArray((web.replyOptions as any).surfaceActions)).toBe(true);
    expect((web.replyOptions as any).surfaceActions.length).toBeGreaterThanOrEqual(4);

    const desktop = projectResponseForChannel('desktop', approvalResponse('desktop'));
    expect((desktop.replyOptions as any).surface).toBe('desktop');
    expect((desktop.replyOptions as any).keyboardShortcuts).toBe(true);
  });

  it('unknown channel falls back to plain projector', () => {
    const out = projectResponseForChannel('totally-unknown-surface', approvalResponse('plain'));
    expect(out.channel).toBe('plain');
    expect(out.replyOptions).toBeNull();
  });

  it('custom projector registration overrides builtin', () => {
    const custom: SurfaceProjector = {
      channel: 'telegram',
      project(_input: SurfaceProjectorInput): SurfaceProjectorOutput {
        return {
          contractVersion: SURFACE_PROJECTOR_CONTRACT_VERSION,
          channel: 'telegram',
          text: 'custom-telegram',
          replyOptions: null,
          rendered: {
            target: 'telegram',
            format: 'telegram-text',
            text: 'custom-telegram',
            actions: [],
            native: null as any,
          },
          usedNativeButtons: false,
          profileId: 'custom',
        };
      },
    };
    registerSurfaceProjector(custom);
    const out = getSurfaceProjector('telegram').project({
      response: approvalResponse('telegram'),
    });
    expect(out.text).toBe('custom-telegram');
  });

  it('projectSharedSurfaceResponse + replyWithSharedSurfaceResponse use projectors', async () => {
    const response = approvalResponse('telegram');
    const projected = projectSharedSurfaceResponse('telegram', response);
    expect(projected.replyOptions).toBeTruthy();

    const reply = jest.fn().mockResolvedValue(undefined);
    const rendered = await replyWithSharedSurfaceResponse(
      {
        platform: 'telegram' as any,
        userId: '1',
        chatId: '1',
        isGroup: false,
        rawText: '',
        reply,
        editMessage: jest.fn(),
      },
      response,
    );
    expect(reply).toHaveBeenCalled();
    const [, opts] = reply.mock.calls[0];
    expect(opts?.reply_markup?.inline_keyboard?.length).toBeGreaterThan(0);
    expect(rendered.text.length).toBeGreaterThan(0);
  });
});
