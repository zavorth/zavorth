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

const PHASE_9_SURFACES: UniversalAgentChannel[] = ['web', 'cli', 'telegram', 'api'];

const PHASE_9_CASES: Stage9SurfaceCase[] = [
  {
    label: 'light greeting',
    text: 'oi',
    expectedRoute: 'light-chat',
    executorMode: 'none',
    expectedMetadataKey: 'naturalFirstLightReply',
  },
  {
    label: 'natural explanation',
    text: 'me explica por que o contexto importa',
    expectedRoute: 'llm-reply',
    executorMode: 'none',
    expectedMetadataKey: 'naturalFirstLlmRuntime',
  },
  {
    label: 'channel setup',
    text: 'conecta Telegram',
    expectedRoute: 'capability-discovery',
    executorMode: 'optional',
    expectedMetadataKey: 'naturalCapabilityDiscovery',
  },
  {
    label: 'tool command',
    text: 'rode npm test',
    expectedRoute: 'tool-preview',
    executorMode: 'none',
    expectedMetadataKey: 'naturalFirstApprovalSafety',
  },
  {
    label: 'dangerous mutation',
    text: 'apague dist e faca push',
    expectedRoute: 'approval-proposal',
    executorMode: 'none',
    expectedMetadataKey: 'naturalFirstApprovalSafety',
  },
  {
    label: 'repo work',
    text: 'analise esse repo',
    expectedRoute: 'governed-execution',
    executorMode: 'required',
  },
  {
    label: 'memory recall',
    text: 'como resolvemos aquilo?',
    expectedRoute: 'memory-recall',
    executorMode: 'none',
    expectedMetadataKey: 'naturalFirstMemoryContinuity',
  },
];

function createIdFactory(seed: string) {
  let index = 0;
  return (prefix: string) => `${prefix}-certification-matrix-${seed}-${++index}`;
}

function createExecutor() {
  return jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(({ request }) => ({
    status: 'completed',
    summary: `Executor governado recebeu ${request.channel}.`,
    replyText: `executed:${request.channel}:${request.text}`,
  }));
}

describe('Natural First surface behavior Certification matrix', () => {
  const classifier = new NaturalFirstRunClassifier();

  it.each(
    PHASE_9_SURFACES.flatMap((channel) => PHASE_9_CASES.map((surfaceCase) => ({
      channel,
      surfaceCase,
    }))),
  )('classifies $surfaceCase.label on $channel as $surfaceCase.expectedRoute', ({ channel, surfaceCase }) => {
    expect(classifier.classify({
      text: surfaceCase.text,
      channel,
      userId: `${channel}:user`,
      sessionId: `${channel}:session`,
    })).toEqual(expect.objectContaining({
      contractVersion: 'natural-first-classifier/3',
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

  it.each(PHASE_9_SURFACES)('keeps slash commands as shortcuts on %s', (channel) => {
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
    PHASE_9_SURFACES.flatMap((channel) => PHASE_9_CASES.map((surfaceCase) => ({
      channel,
      surfaceCase,
    }))),
  )('runs $surfaceCase.label through ZavorthAgentGateway on $channel', async ({ channel, surfaceCase }) => {
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
      contractVersion: 'natural-first-classifier/3',
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
