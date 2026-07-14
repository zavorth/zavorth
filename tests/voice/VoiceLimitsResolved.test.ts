import {
  registerVoiceAgentAbort,
  getVoiceAgentAbort,
  resolveAbortSignalFromRequestMetadata,
  resetVoiceAgentAbortRegistryForTests,
} from '../../src/services/voice/VoiceAgentAbortRegistry.js';
import {
  extractAudioMediaFromPayload,
  resolveWhatsAppMediaDownload,
} from '../../src/services/voice/MessagingChannelVoiceIngest.js';

describe('Voice honest limits resolved', () => {
  afterEach(() => {
    resetVoiceAgentAbortRegistryForTests();
  });

  it('registers duplex abort signal for LLM path', () => {
    const ctrl = new AbortController();
    registerVoiceAgentAbort('dup-1', ctrl.signal);
    expect(getVoiceAgentAbort('dup-1')).toBe(ctrl.signal);
    expect(
      resolveAbortSignalFromRequestMetadata({ duplexSessionId: 'dup-1' }),
    ).toBe(ctrl.signal);
    expect(
      resolveAbortSignalFromRequestMetadata({ voiceAbortSignal: ctrl.signal }),
    ).toBe(ctrl.signal);
    ctrl.abort();
    // aborted signal may still be registered until cleanup event
    expect(ctrl.signal.aborted).toBe(true);
  });

  it('extracts WhatsApp media id without public url', () => {
    const media = extractAudioMediaFromPayload({
      messages: [
        {
          type: 'audio',
          audio: { id: 'media-abc-123', mime_type: 'audio/ogg; codecs=opus' },
        },
      ],
    });
    expect(media?.mediaId).toBe('media-abc-123');
    expect(media?.source).toBe('whatsapp');
    expect(media?.url).toBeUndefined();
  });

  it('resolveWhatsAppMediaDownload fails closed without token', async () => {
    await expect(
      resolveWhatsAppMediaDownload({ mediaId: 'x', accessToken: '' }),
    ).rejects.toThrow(/WHATSAPP_ACCESS_TOKEN|Type your message/i);
  });
});
