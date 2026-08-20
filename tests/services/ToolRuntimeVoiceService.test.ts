import { EchoVoiceService } from '../../src/services/EchoVoiceService';

describe('EchoVoiceService', () => {
  it('maps voice command for notepad to a safe Echo Hands action', async () => {
    const handsService = {
      execute: jest.fn().mockResolvedValue({
        ok: true,
        action: 'open_app',
        message: 'App iniciado: notepad.',
        metadata: { app: 'notepad' },
        approvalRequired: false,
      }),
    };
    const service = new EchoVoiceService({ handsService });

    const result = await service.handleTranscript('Echo, abra o bloco de notas');

    expect(result.request).toEqual({
      action: 'open_app',
      args: { app: 'notepad' },
      risk: 'low',
    });
    expect(result.responseText).toBe('App iniciado: notepad.');
  });

  it('can transcribe an audio buffer before routing the command', async () => {
    const handsService = {
      execute: jest.fn().mockResolvedValue({
        ok: true,
        action: 'open_app',
        message: 'App iniciado: calculator.',
        metadata: { app: 'calculator' },
        approvalRequired: false,
      }),
    };
    const dictation = {
      transcribeBuffer: jest.fn().mockResolvedValue('abra a calculadora'),
    };
    const service = new EchoVoiceService({ handsService, dictation });

    const result = await service.handleAudioBuffer(Buffer.from('RIFF'));

    expect(dictation.transcribeBuffer).toHaveBeenCalled();
    expect(result.request?.args).toEqual({ app: 'calculator' });
  });
});
