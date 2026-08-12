import {
  NaturalFirstRunClassifier,
  ZavorthAgentGateway,
  type NaturalFirstRoute,
  type UniversalAgentChannel,
  type UniversalAgentExecutor,
} from '../../../src/runtime/agent/index.js';

type Stage9SurfaceCase = {
  label: string;
  text: string;
  expectedRoute: NaturalFirstRoute;
  executorMode: 'none' | 'optional' | 'required';
  expectedMetadataKey?: string;
};

const SURFACES: UniversalAgentChannel[] = ['web', 'cli', 'telegram', 'api'];

const SURFACE_CASES: Stage9SurfaceCase[] = [
  {
    label: 'short greeting',
    text: 'oi',
    expectedRoute: 'llm-reply',
    executorMode: 'none',
    expectedMetadataKey: 'naturalFirstLlmRuntime',
  },
  {
    label: 'natural explanation',
    text: 'me explica por que o contexto importa',
    expectedRoute: 'llm-reply',
    executorMode: 'none',
    expectedMetadataKey: 'naturalFirstLlmRuntime',
  },
  {
    label: 'channel setup (agent free-text, not capability NLU)',
    text: 'conecta Telegram',
    expectedRoute: 'llm-reply',
    executorMode: 'none',
    expectedMetadataKey: 'naturalFirstLlmRuntime',
  },
  {
    label: 'shell-looking free text (no keyword force)',
    text: 'rode npm test',
    expectedRoute: 'llm-reply',
    executorMode: 'none',
    expectedMetadataKey: 'naturalFirstLlmRuntime',
  },
  {
    label: 'mutation-looking free text (no keyword force)',
    text: 'apague dist e faca push',
    expectedRoute: 'llm-reply',
    executorMode: 'none',
    expectedMetadataKey: 'naturalFirstLlmRuntime',
  },
  {
    label: 'repo work (agent free-text, not operational phrase map)',
    text: 'analise esse repo',
    expectedRoute: 'llm-reply',
    executorMode: 'none',
    expectedMetadataKey: 'naturalFirstLlmRuntime',
  },
  {
    label: 'memory recall (agent free-text without memory metadata)',
    text: 'como resolvemos aquilo?',
    expectedRoute: 'llm-reply',
    executorMode: 'none',
    expectedMetadataKey: 'naturalFirstLlmRuntime',
  },
];

function createIdFactory(seed: string) {
  let index = 0;
  return (prefix: string) => `${prefix}-certification-matrix-${seed}-${++index}`;
}

function createExecutor() {
  return jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(({ request }) => ({
    status: 'completed',
    summary: `Governed executor received ${request.channel}.`,
    replyText: `executed:${request.channel}:${request.text}`,
  }));
}

describe('Natural First surface behavior Certification matrix ', () => {
  const classifier = new NaturalFirstRunClassifier();

  it.each(
    SURFACES.flatMap((channel) => SURFACE_CASES.map((surfaceCase) => ({
      channel,
      surfaceCase,
    }))),)('classifies $surfaceCase.label on $channel as $surfaceCase.expectedRoute', ({ channel, surfaceCase }) => {
    expect(classifier.classify({
      text: surfaceCase.text,
      channel,
      userId: `${channel}:user`,
      sessionId: `${channel}:session`,
    })).toEqual(expect.objectContaining({
      contractVersion: 'natural-first-classifier/4',
      shouldEnterGateway: true,
      route: surfaceCase.expectedRoute,
      context: expect.objectContaining({
        channel,
        user: expect.objectContaining({
          present: true,
        }),
        session: expect.objectContaining({
          present: true,
        }),
      }),
    }));
  });

  it.each(SURFACES)('keeps slash commands as shortcuts on %s', (channel) => {
    expect(classifier.classify({
      text: '/status',
      channel,
    })).toEqual(expect.objectContaining({
      route: 'slash-command',
      shouldEnterGateway: false,
      usesLlm: 'not-required',
    }));
  });

  it.each(
    SURFACES.flatMap((channel) => SURFACE_CASES.map((surfaceCase) => ({
      channel,
      surfaceCase,
    }))),)('runs $surfaceCase.label through ZavorthAgentGateway on $channel', async ({ channel, surfaceCase }) => {
    const executor = createExecutor();
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-11T16:00:00.000Z'),
      idFactory: createIdFactory(`${channel}-${surfaceCase.expectedRoute}`),
      executor: surfaceCase.executorMode === 'none' ? undefined : executor,
    });

    const result = await gateway.handle({
      requestId: `${channel}:${surfaceCase.expectedRoute}`,
      userId: `${channel}:user`,
      channel,
      sessionId: `${channel}:session`,
      text: surfaceCase.text,
      requestedTools: [],
    });
    const route = result.run.metadata.naturalFirstRoute as Record<string, unknown>;
    const entrypoint = result.run.metadata.naturalFirstEntrypoint as Record<string, unknown>;

    expect(entrypoint).toEqual(expect.objectContaining({
      gatewayRequired: true,
      inputKind: 'free-text',
    }));
    expect(route).toEqual(expect.objectContaining({
      contractVersion: 'natural-first-classifier/4',
      shouldEnterGateway: true,
      route: surfaceCase.expectedRoute,
    }));
    expect(result.run.channel).toBe(channel);
    expect(result.run.metadata.adapterSource).toBe('universal-agent-runtime');

    if (surfaceCase.expectedMetadataKey) {
      expect(result.run.metadata).toEqual(expect.objectContaining({
        [surfaceCase.expectedMetadataKey]: expect.any(Object),
      }));
    }
    if (surfaceCase.executorMode === 'none') {
      expect(executor).not.toHaveBeenCalled();
    }
    if (surfaceCase.executorMode === 'required') {
      expect(executor).toHaveBeenCalledTimes(1);
      expect(result.replies[0]?.text).toContain(`executed:${channel}`);
    }
    if (surfaceCase.expectedRoute === 'tool-preview' || surfaceCase.expectedRoute === 'approval-proposal') {
      expect(result.run.status).toBe('waiting_approval');
      expect(result.run.metadata.naturalFirstApprovalSafety).toEqual(expect.objectContaining({
        status: 'approval-required',
      }));
    }
  });
});
