import { ComposerPayloadService } from '../../src/services/ComposerPayloadService';

describe('ComposerPayloadService', () => {
  it('keeps the typed message and normalizes valid mentions', () => {
    const service = new ComposerPayloadService();

    const result = service.normalize({
      message: '  /plan revisar o repo  ',
      mentions: [
        {
          id: '/plan',
          type: 'command',
          label: '/plan',
          trigger: '/',
          aliases: ['/p', '', '  '],
          payload: { command: '/plan' },
        },
        {
          id: '',
          type: 'skill',
          label: '',
        },
      ],
    });

    expect(result.messageText).toBe('/plan revisar o repo');
    expect(result.mentions).toHaveLength(1);
    expect(result.mentions[0]).toMatchObject({
      id: '/plan',
      type: 'command',
      label: '/plan',
      trigger: '/',
      aliases: ['/p'],
      payload: { command: '/plan' },
    });
  });

  it('falls back to mention labels when the message is empty', () => {
    const service = new ComposerPayloadService();

    const result = service.normalize({
      message: '   ',
      mentions: [
        { id: '/plan', type: 'command', label: '/plan' },
        { id: 'debugging', type: 'skill', label: '@debugging' },
      ],
    });

    expect(result.messageText).toBe('/plan @debugging');
    expect(result.mentions).toHaveLength(2);
  });

  it('returns empty values when neither message nor mentions are usable', () => {
    const service = new ComposerPayloadService();

    const result = service.normalize({
      message: null,
      mentions: [{ id: '', type: 'command', label: '' }],
    });

    expect(result.messageText).toBe('');
    expect(result.mentions).toEqual([]);
  });

  it('normalizes command center attachments, selected skills and voice input', () => {
    const service = new ComposerPayloadService();

    const result = service.normalize({
      message: 'analise isso',
      attachments: [
        {
          name: 'notes.md',
          type: 'text/markdown',
          size: 120,
          text: '# notas',
          truncated: false,
        },
        {
          name: '',
          type: 'text/plain',
        },
      ],
      selectedSkills: [
        {
          id: 'network_fetch',
          title: 'Pesquisar na web',
          prompt: 'Pesquise fontes recentes.',
          status: 'web',
        },
        {
          id: 'network_fetch',
          title: 'Duplicada',
        },
      ],
      voice: {
        transcript: 'research this by voice',
        language: 'en-US',
        source: 'speech-recognition',
        confidence: 0.82,
      },
    });

    expect(result.attachments).toEqual([
      expect.objectContaining({
        id: 'attachment:1:notes.md',
        name: 'notes.md',
        text: '# notas',
      }),
    ]);
    expect(result.selectedSkills).toEqual([
      expect.objectContaining({
        id: 'network_fetch',
        title: 'Pesquisar na web',
      }),
    ]);
    expect(result.voice).toEqual(expect.objectContaining({
      transcript: 'research this by voice',
      language: 'en-US',
      confidence: 0.82,
    }));
  });
});
