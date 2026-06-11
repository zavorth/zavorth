import { AgentRunLlmRequestBuilder } from '../../../src/runtime/agent/AgentRunLlmRequestBuilder.js';
import { AgentRunService } from '../../../src/runtime/agent/AgentRunService.js';

describe('AgentRunLlmRequestBuilder automatic skill context', () => {
  it('injects the auto-selected skill prompt as governed context', () => {
    const service = new AgentRunService({
      now: () => new Date('2026-06-10T15:20:00.000Z'),
      idFactory: (prefix) => `${prefix}-auto-skill-prompt`,
    });
    const request = {
      userId: 'operator',
      channel: 'cli' as const,
      sessionId: 'session-auto-skill-prompt',
      text: 'tem um bug nesse fluxo',
      requestedTools: [],
    };
    const run = service.createRun(request);
    run.metadata = {
      ...run.metadata,
      autoSkillInvocation: {
        source: 'AgentRunAutomaticSkillInvocationService',
        status: 'selected',
        selectedSkillName: 'debugging',
        promptEnvelopeText: 'Governed debugging skill prompt',
        rawSecretsSerialized: false,
      },
    };
    const builder = new AgentRunLlmRequestBuilder({
      hallucinationInstruction: () => 'Never invent tool execution.',
    });

    const messages = builder.buildMessages(run, request);

    expect(messages[0].content).toContain('Auto-selected governed skill');
    expect(messages[0].content).toContain('debugging');
    expect(messages[0].content).toContain('Governed debugging skill prompt');
    expect(messages[0].content).toContain('does not grant tool execution by itself');
  });
});
