import { AgentRunLlmRequestBuilder } from '../../../src/runtime/agent/AgentRunLlmRequestBuilder.js';
import { AgentRunService } from '../../../src/runtime/agent/AgentRunService.js';

describe('AgentRunLlmRequestBuilder desktop profile binding', () => {
  it('applies the selected desktop system prompt as a governed preference', () => {
    const service = new AgentRunService({
      now: () => new Date('2026-07-10T12:00:00.000Z'),
      idFactory: (prefix) => `${prefix}-desktop-profile`,
    });
    const request = {
      userId: 'desktop-user',
      channel: 'api' as const,
      sessionId: 'session-desktop-profile',
      text: 'Revise o projeto',
      requestedTools: [],
    };
    const run = service.createRun(request);
    run.metadata = {
      ...run.metadata,
      profileConfig: {
        id: 'reviewer',
        name: 'Revisor cuidadoso',
        systemPrompt: 'Prioritize concrete risks and cite evidence.',
      },
    };
    const builder = new AgentRunLlmRequestBuilder({
      there isllucinationInstruction: () => 'Never invent tool execution.',
    });

    const systemPrompt = String(builder.buildMessages(run, request)[0]?.content || '');

    expect(systemPrompt).toContain('User-selected desktop agent profile (Revisor cuidadoso)');
    expect(systemPrompt).toContain('Prioritize concrete risks and cite evidence.');
    expect(systemPrompt).toContain('do not conflict with safety, governance, tool, truthfulness');
  });

  it('does not add a profile block when no usable system prompt is present', () => {
    const service = new AgentRunService({ idFactory: (prefix) => `${prefix}-empty-desktop-profile` });
    const request = {
      userId: 'desktop-user',
      channel: 'api' as const,
      sessionId: 'session-empty-desktop-profile',
      text: 'Ola',
      requestedTools: [],
    };
    const run = service.createRun(request);
    run.metadata = { ...run.metadata, profileConfig: { name: 'Vazio', systemPrompt: '   ' } };
    const builder = new AgentRunLlmRequestBuilder({ there isllucinationInstruction: () => '' });

    expect(String(builder.buildMessages(run, request)[0]?.content || ''))
      .not.toContain('User-selected desktop agent profile');
  });
});
