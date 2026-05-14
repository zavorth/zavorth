import {
  ZavorthAgentGateway,
} from '../../../src/runtime/agent/index.js';
import {
  EXTERNAL_AGENT_WAVE1_SOURCE_RUNTIME_NAME,
  createWave1GatewayProtocolFrameFixtures,
  normalizeWave1GatewayProtocolFrame,
} from '../../../src/runtime/external-agents/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => {
    index += 1;
    return `${prefix}-${index}`;
  };
}

describe('Wave 1 gateway protocol frame fixture parity', () => {
  it('normalizes a message-like protocol frame into Zavorth inbound and gateway contracts', async () => {
    const [requestFrame] = createWave1GatewayProtocolFrameFixtures();
    const normalized = normalizeWave1GatewayProtocolFrame(requestFrame);
    const executor = jest.fn(() => ({
      status: 'completed',
      summary: 'Wave 1 protocol frame stayed inside Zavorth contracts.',
      replyText: 'protocol frame normalized',
    }));
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-27T19:01:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    expect(normalized.ok).toBe(true);
    if (!normalized.ok || !normalized.message) {
      throw new Error('Expected message-like frame to produce NormalizedInboundMessage.');
    }

    const result = await gateway.handle(normalized.message);
    const topLevelInput = JSON.stringify({
      requestId: normalized.message.requestId,
      traceId: normalized.message.traceId,
      userId: normalized.message.userId,
      sessionId: normalized.message.sessionId,
      channel: normalized.message.channel,
      text: normalized.message.text,
      requestedTools: normalized.message.requestedTools,
    });

    expect(normalized.nativeContract).toBe('NormalizedInboundMessage');
    expect(normalized.reachesExecutor).toBe(true);
    expect(normalized.sourceFrameStoredAsPublicContract).toBe(false);
    expect(normalized.message).toEqual(expect.objectContaining({
      requestId: 'external-event:wave1-frame-request-1',
      sessionId: 'external:wave1-source-session',
      channel: 'api',
      text: 'route this gateway request through Zavorth contracts',
      requestedTools: ['read_file'],
    }));
    expect(topLevelInput).not.toContain(EXTERNAL_AGENT_WAVE1_SOURCE_RUNTIME_NAME);
    expect(normalized.message.metadata?.source).toBe('external-agent-gateway-protocol-boundary');
    expect(normalized.message.metadata?.externalGatewayProtocolBoundary).toEqual(expect.objectContaining({
      boundary: expect.objectContaining({
        gatewayEntry: 'ZavorthAgentGateway.handle',
        replyEntry: 'ReplyPipeline',
        policyEntry: 'ToolExposurePolicy',
      }),
    }));
    expect(result.run.status).toBe('completed');
    expect(result.run.metadata).toEqual(expect.objectContaining({
      source: 'external-agent-gateway-protocol-boundary',
      normalizedInboundMessage: true,
    }));
    expect(executor).toHaveBeenCalledTimes(1);
  });

  it('keeps response and invalid frames out of executor paths as diagnostic envelopes or structured errors', () => {
    const fixtures = createWave1GatewayProtocolFrameFixtures();
    const responseFrame = fixtures.find((fixture) => fixture.fixtureCase === 'valid-response-diagnostic');
    const errorFrame = fixtures.find((fixture) => fixture.fixtureCase === 'valid-error-frame');
    const invalidFrame = fixtures.find((fixture) => fixture.fixtureCase === 'invalid-frame-schema');

    if (!responseFrame || !errorFrame || !invalidFrame) {
      throw new Error('Wave 1 protocol fixture set is incomplete.');
    }

    const response = normalizeWave1GatewayProtocolFrame(responseFrame);
    const sourceError = normalizeWave1GatewayProtocolFrame(errorFrame);
    const invalid = normalizeWave1GatewayProtocolFrame(invalidFrame);

    expect(response.ok).toBe(true);
    if (!response.ok) {
      throw new Error('Expected response frame to normalize as diagnostic evidence.');
    }
    expect(response.nativeContract).toBe('ExternalAgentEventEnvelope');
    expect(response.envelope.kind).toBe('diagnostic');
    expect(response.message).toBeUndefined();
    expect(response.reachesExecutor).toBe(false);
    expect(response.sourceFrameStoredAsPublicContract).toBe(false);

    expect(sourceError).toEqual({
      ok: false,
      error: expect.objectContaining({
        nativeContract: 'ZavorthStructuredGatewayError/v1',
        code: 'external-frame-error',
        reachesExecutor: false,
        sourceFrameStoredAsPublicContract: false,
      }),
    });
    expect(invalid).toEqual({
      ok: false,
      error: expect.objectContaining({
        nativeContract: 'ZavorthStructuredGatewayError/v1',
        code: 'external-frame-invalid',
        reachesExecutor: false,
        sourceFrameStoredAsPublicContract: false,
      }),
    });
  });
});
