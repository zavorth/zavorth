import { convertChatMessagesToOpenAI } from '../../src/providers/openaiMessageConversion';

describe('openaiMessageConversion', () => {
  it('passes audio inlineData as input_audio content parts', () => {
    const [message] = convertChatMessagesToOpenAI([
      {
        role: 'user',
        content: 'Analise este audio.',
        inlineData: [{ mimeType: 'audio/ogg', data: 'AAA=' }],
      },
    ]) as any[];

    expect(message.role).toBe('user');
    expect(message.content).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'text', text: 'Analise este audio.' }),
      expect.objectContaining({
        type: 'input_audio',
        input_audio: expect.objectContaining({ data: 'AAA=', format: 'ogg' }),
      }),
    ]));
  });

  it('flushes tool media only after consecutive tool responses', () => {
    const converted = convertChatMessagesToOpenAI([
      {
        role: 'assistant',
        content: null,
        toolCalls: [
          { id: 'call-1', name: 'screenshot', arguments: {} },
          { id: 'call-2', name: 'inspect', arguments: {} },
        ],
      },
      {
        role: 'tool',
        content: 'Screenshot: C:/tmp/a.png',
        toolCallId: 'call-1',
        inlineData: [{ mimeType: 'image/png', data: 'PNG=' }],
      },
      {
        role: 'tool',
        content: 'Inspect ok',
        toolCallId: 'call-2',
      },
    ]) as any[];

    expect(converted.map((message) => message.role)).toEqual(['assistant', 'tool', 'tool', 'user']);
    expect(converted[3].content).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'image_url' }),
    ]));
  });
});
