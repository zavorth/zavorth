import { AgentRunLlmRequestBuilder } from '../../../src/runtime/agent/AgentRunLlmRequestBuilder.js';
import { AgentRunService } from '../../../src/runtime/agent/AgentRunService.js';

// Contention budget: agent-run pipeline tests exceed the 5s Jest default
// when full-group parallel workers load the machine.
jest.setTimeout(120000);

describe('AgentRunLlmRequestBuilder composer context', () => {
  it('builds system + user messages and forwards safe media as provider inline data', () => {
    const service = new AgentRunService({ idFactory: (prefix) => `${prefix}-composer-context` });
    const request = {
      userId: 'desktop-user',
      channel: 'api' as const,
      sessionId: 'session-composer-context',
      text: 'Describe this image',
      requestedTools: [],
      metadata: {
        locale: 'pt-BR',
        attachments: [
          {
            id: 'image-1',
            name: 'screen.png',
            type: 'image/png',
            size: 3,
            content: 'UE5H',
            relativePath: 'captures/screen.png',
            media: { kind: 'image', mimeType: 'image/png', encoding: 'base64' },
          },
        ],
      },
    };
    const run = service.createRun(request);
    const builder = new AgentRunLlmRequestBuilder({ hallucinationInstruction: () => '' });

    const messages = builder.buildMessages(run, request);
    const systemMessage = String(messages[0]?.content || '');
    const userMessage = messages[1];

    expect(systemMessage).toContain('You are Zavorth');
    expect(String(userMessage?.content || '')).toContain('Describe this image');
  });

  it('does not expose inline data for non-media attachment types', () => {
    const service = new AgentRunService({ idFactory: (prefix) => `${prefix}-text-context` });
    const request = {
      userId: 'desktop-user',
      channel: 'api' as const,
      sessionId: 'session-text-context',
      text: 'Review the note',
      requestedTools: [],
      metadata: {
        attachments: [{
          id: 'note-1',
          name: 'note.txt',
          type: 'text/plain',
          size: 5,
          text: 'hello',
          content: 'aGVsbG8=',
        }],
      },
    };
    const run = service.createRun(request);
    const builder = new AgentRunLlmRequestBuilder({ hallucinationInstruction: () => '' });

    const userMessage = builder.buildMessages(run, request)[1];

    expect(userMessage?.inlineData).toBeUndefined();
    expect(String(userMessage?.content || '')).toContain('Review the note');
  });
});
