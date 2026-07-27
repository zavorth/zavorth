import { UserFacingResponseService } from '../../src/services/UserFacingResponseService';

describe('UserFacingResponseService', () => {
  it('formats polished execution output without losing the success cue', () => {
    const text = UserFacingResponseService.formatExecutionOutput(
      'Gemini CLI',
      {
        success: true,
        stdout: 'Tudo certo por aqui.',
      },
      { presentationMode: true },
    );

    expect(text).toContain('Consegui concluir isso.');
    expect(text).toContain('Resultado:');
    expect(text).toContain('Tudo certo por aqui.');
  });

  it('formats structured research success with question and answer blocks', () => {
    const text = UserFacingResponseService.formatStructuredResearchSuccess(
      'is it harmful to leave the laptop lid almost closed-',
      [
        'Not costuma causar dano so por causa do angulo, mas pode piorar a ventilaction.',
        'Se o notebook depende das entradas de ar na base, o calor pode aumentar.',
        'Em uso leve, isso tende a ser menos problematico.',
      ].join('\n'),
    );

    expect(text).toContain('Pesquisa concluida.');
    expect(text).toContain('Pergunta: is it harmful to leave the laptop lid almost closed-');
    expect(text).toContain('Resposta direta:');
    expect(text).toContain('Detalhes uteis:');
    expect(text).toContain('Se quiser, eu posso resumir mais ou aprofundar a resposta.');
  });

  it('formats Stitch success like a visual delivery', () => {
    const text = UserFacingResponseService.formatExecutionOutput(
      'Google Stitch',
      {
        success: true,
        artifacts: [
          { kind: 'stitch_screenshot' },
          { kind: 'stitch_html' },
        ],
      },
      { presentationMode: true },
    );

    expect(text).toContain('A interface ficou pronta.');
    expect(text).toContain('O que foi gerado:');
    expect(text).toContain('Preview em imagem: 1');
    expect(text).toContain('HTML exportado: 1');
    expect(text).toContain('Como isso chega para you:');
    expect(text).toContain('Ideal para mostrar:');
  });
});
