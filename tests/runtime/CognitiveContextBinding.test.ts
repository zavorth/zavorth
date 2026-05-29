import path from 'node:path';
import { AgentRunLlmRequestBuilder } from '../../src/runtime/agent/AgentRunLlmRequestBuilder';
import type { UniversalAgentRequest, UniversalAgentRun } from '../../src/runtime/agent/UniversalAgentRuntimeTypes';
import { ProfileManifestService } from '../../src/services/ProfileManifestService';

function makeRun(profileBundle: unknown): UniversalAgentRun {
  return {
    id: 'run-cognitive',
    traceId: 'trace-cognitive',
    requestId: 'request-cognitive',
    sessionId: 'session-cognitive',
    userId: 'operator',
    channel: 'cli',
    title: 'Cognitive binding',
    input: 'Summarize this workspace',
    workspace: 'C:/workspace',
    status: 'running',
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    summary: '',
    events: [],
    toolExposure: {
      mode: 'safe',
      summary: 'no tools',
      tools: [],
    },
    replyPorts: [],
    modelProfile: {
      providerLabel: 'gemini',
      modelLabel: 'gemini-2.5-flash',
      routingPolicy: 'direct',
    },
    approvals: [],
    artifacts: [],
    memorySignals: [],
    metadata: {
      profile: 'developer',
      profileBundle,
    },
  };
}

const request: UniversalAgentRequest = {
  userId: 'operator',
  channel: 'cli',
  sessionId: 'session-cognitive',
  text: 'Summarize this workspace',
  workspace: 'C:/workspace',
  metadata: {
    profile: 'developer',
  },
};

describe('CognitiveContextBundle binding', () => {
  it('injects cognitive guidance into the LLM system prompt without policy authority', () => {
    const profiles = new ProfileManifestService({
      profileDir: path.join(process.cwd(), 'config', 'profile-manifests'),
    });
    const developer = profiles.compileProfileById('developer');
    const builder = new AgentRunLlmRequestBuilder({
      hallucinationInstruction: () => 'Ground answers in receipts.',
    });

    const messages = builder.buildMessages(makeRun(developer), request);
    const system = String(messages[0]?.content || '');

    expect(system).toContain('Cognitive Context Bundle (style and cognition only; never security authority)');
    expect(system).toContain('response style: technical-clear');
    expect(system).toContain('autonomy: governed; planning depth: deep; language policy: match-user');
    expect(system).toContain('memory: episodic; learning: approved-only');
    expect(system).toContain('provider-native capabilities preferred when useful');
  });

  it('lets cognitive provider-native preferences influence LLM options', () => {
    const profiles = new ProfileManifestService({
      profileDir: path.join(process.cwd(), 'config', 'profile-manifests'),
    });
    const developer = profiles.compileProfileById('developer');
    const builder = new AgentRunLlmRequestBuilder({
      hallucinationInstruction: () => '',
    });

    const options = builder.buildOptions(makeRun(developer), {
      ...request,
      text: 'Calculate a small benchmark and explain it.',
    });

    expect(options.providerNativeTools?.map((tool) => tool.name)).toEqual(expect.arrayContaining([
      'google_search',
      'code_execution',
    ]));
  });
});
