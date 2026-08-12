import { buildModelsSurfaceResponseExample } from '../../../src/domain/surface/application/surface-response';
import { ZavorthChannelCapabilityAwarenessService } from '../../../src/services/ZavorthChannelCapabilityAwarenessService';

describe('ZavorthChannelCapabilityAwarenessService', () => {
  const now = () => new Date('2026-05-12T10:00:00.000Z');

  it('defines required channel capabilities without privileging Telegram', () => {
    const service = new ZavorthChannelCapabilityAwarenessService({ now });

    const snapshot = service.buildSnapshot();

    expect(snapshot.status).toBe('ready');
    expect(snapshot.phase).toBe('checkpoint-7-channel-capability-awareness');
    expect(snapshot.summary).toMatchObject({
      requiredProfiles: 7,
      allRequiredChannelsCovered: true,
      telegramPrivileged: false,
      failedChecks: 0,
    });
    expect(snapshot.profiles.map((profile) => profile.channel)).toEqual(expect.arrayContaining([
      'telegram',
      'discord',
      'whatsapp',
      'signal',
      'imessage',
      'cli',
      'web',
    ]));
  });

  it('adapts the same models response to Telegram inline buttons', () => {
    const service = new ZavorthChannelCapabilityAwarenessService({ now });

    const adapted = service.adaptResponse('telegram', buildModelsSurfaceResponseExample());

    expect(adapted.status).toBe('native');
    expect(adapted.nativeMode).toBe('telegram_inline_keyboard');
    expect(adapted.capabilityUsed.nativeButtons).toBe(true);
    expect((adapted.rendered.native as any).replyMarkup.inline_keyboard.flat()).toEqual([
      expect.objectContaining({ text: 'Gemini', callback_data: '/model gemini' }),
      expect.objectContaining({ text: 'OpenAI', callback_data: '/model openai' }),
      expect.objectContaining({ text: 'Gemma', callback_data: '/model gemma-2-27b-it' }),
    ]);
  });

  it('adapts the same models response to Discord components safely', () => {
    const service = new ZavorthChannelCapabilityAwarenessService({ now });

    const adapted = service.adaptResponse('discord', buildModelsSurfaceResponseExample());

    expect(adapted.status).toBe('native');
    expect(adapted.nativeMode).toBe('discord_components');
    expect(adapted.capabilityUsed.nativeButtons).toBe(true);
    expect((adapted.rendered.native as any).allowedMentions).toEqual({ parse: [] });
    expect((adapted.rendered.native as any).components[0].components).toEqual([
      expect.objectContaining({ label: 'Gemini' }),
      expect.objectContaining({ label: 'OpenAI' }),
      expect.objectContaining({ label: 'Gemma' }),
    ]);
  });

  it('uses structured text fallback for WhatsApp, Signal and iMessage', () => {
    const service = new ZavorthChannelCapabilityAwarenessService({ now });

    for (const channel of ['whatsapp', 'signal', 'imessage'] as const) {
      const adapted = service.adaptResponse(channel, buildModelsSurfaceResponseExample());

      expect(adapted.status).toBe('fallback');
      expect(adapted.nativeMode).toBe('structured_text_fallback');
      expect(adapted.rendered.native).toBeNull();
      expect(adapted.rendered.text).toContain('/model gemini');
      expect(adapted.capabilityUsed.fallbackText).toBe(true);
    }
  });

  it('keeps CLI dense and Web/API projected from the same response', () => {
    const service = new ZavorthChannelCapabilityAwarenessService({ now });
    const response = buildModelsSurfaceResponseExample();

    const cli = service.adaptResponse('cli', response);
    const web = service.adaptResponse('web', response);

    expect(cli.nativeMode).toBe('dense_cli');
    expect(cli.capabilityUsed.denseTable).toBe(true);
    expect(cli.rendered.text).toContain('Provider');
    expect(web.nativeMode).toBe('web_api_payload');
    expect(web.status).toBe('projection');
    expect(web.capabilityUsed.webPayload).toBe(true);
    expect(web.rendered.actions.length).toBeGreaterThan(0);
  });
});
