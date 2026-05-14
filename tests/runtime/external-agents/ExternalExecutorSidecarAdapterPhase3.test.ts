import {
  ZavorthAgentGateway,
  ToolExposurePolicy,
} from '../../../src/runtime/agent/index.js';
import {
  buildToolExposurePolicyInputFromExternalCapabilities,
} from '../../../src/runtime/external-agents/index.js';
import {
  FixtureExternalExecutorSidecarClient,
  QuarantinedExternalExecutorSidecarAdapter,
} from '../../../src/runtime/external-agents/external-executor/index.js';
import type {
  ExternalAgentOutboundActionEnvelope,
} from '../../../src/runtime/external-agents/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => {
    index += 1;
    return `${prefix}-${index}`;
  };
}

function createAction(
  overrides: Partial<ExternalAgentOutboundActionEnvelope> = {},
): ExternalAgentOutboundActionEnvelope {
  return {
    id: 'phase-3-action-1',
    runtimeId: 'external-runtime:primary-sidecar',
    sessionId: 'source-session-1',
    requestedAt: '2026-04-27T17:05:00.000Z',
    kind: 'diagnostic',
    label: 'Controlled source diagnostic',
    risk: 'safe',
    dryRun: true,
    replyBoundary: 'zavorth-reply-port-only',
    payload: {
      text: 'controlled phase 3 diagnostic dispatch',
    },
    approval: null,
    ...overrides,
  };
}

describe('Plan 111 Phase 3 quarantined source sidecar adapter', () => {
  it('queries source runtime health and lists source channels, skills and tools through Zavorth contracts', async () => {
    const client = new FixtureExternalExecutorSidecarClient();
    const adapter = new QuarantinedExternalExecutorSidecarAdapter({
      client,
      now: () => new Date('2026-04-27T17:10:00.000Z'),
    });

    const health = await adapter.start();
    const channels = await adapter.listChannels();
    const capabilities = await adapter.listCapabilities();
    const provider = await adapter.normalizeCapabilityProvider();
    const toolProfile = new ToolExposurePolicy().buildProfile(
      buildToolExposurePolicyInputFromExternalCapabilities(capabilities),
    );

    expect(health).toEqual(expect.objectContaining({
      runtimeId: 'external-runtime:primary-sidecar',
      status: 'ready',
      diagnostics: expect.objectContaining({
        sourceRuntimeName: 'ExternalExecutor',
      }),
    }));
    expect(adapter.descriptor).toEqual(expect.objectContaining({
      id: 'external-runtime:primary-sidecar',
      label: 'External runtime primary sidecar',
    }));
    expect(adapter.lifecycle).toEqual(expect.objectContaining({
      phase: 'sidecar-adapter',
      startBehavior: 'connect-existing-runtime-only',
      canSpawnSourceRuntime: false,
      canMutateSourceRuntime: false,
    }));
    expect(channels).toEqual([
      expect.objectContaining({
        id: 'external-channel:source-inbox',
        inbound: true,
        outbound: false,
        replyBoundary: 'zavorth-reply-port-only',
      }),
    ]);
    expect(capabilities.map((capability) => capability.kind)).toEqual([
      'channel',
      'skill',
      'tool',
    ]);
    expect(provider).toEqual(expect.objectContaining({
      id: 'external-capability-provider:external-runtime:primary-sidecar',
      nativeContract: 'ToolExposurePolicyInput',
    }));
    expect(toolProfile.blockedTools).toEqual([
      expect.objectContaining({
        id: 'shell.exec',
        reason: 'blocked-by-external-adapter-quarantine',
      }),
    ]);
    expect(JSON.stringify({
      id: adapter.descriptor.id,
      label: adapter.descriptor.label,
      providerId: provider.id,
      channelIds: channels.map((channel) => channel.id),
    })).not.toContain('ExternalExecutor');
  });

  it('receives a source event and routes it into ZavorthAgentGateway as a normalized inbound message', async () => {
    const adapter = new QuarantinedExternalExecutorSidecarAdapter({
      client: new FixtureExternalExecutorSidecarClient(),
      now: () => new Date('2026-04-27T17:10:00.000Z'),
    });
    const [event] = await adapter.pullTestEvents();
    const message = adapter.normalizeEvent(event);
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-27T17:11:00.000Z'),
      idFactory: createIdFactory(),
      executor: jest.fn(() => ({
        status: 'completed',
        replyText: 'Health sidecar verificado pelo gateway Zavorth.',
      })),
    });

    const result = await gateway.handle(message);

    expect(message).toEqual(expect.objectContaining({
      requestId: 'external-event:source-event-1',
      traceId: 'external-runtime:primary-sidecar:source-session-1:source-event-1',
      userId: 'source-user-1',
      sessionId: 'external:source-session-1',
      channel: 'api',
      text: 'verifique o health do sidecar pelo gateway Zavorth',
      requestedTools: ['channels.list'],
    }));
    expect(result.run).toEqual(expect.objectContaining({
      channel: 'api',
      sessionId: 'external:source-session-1',
      input: 'verifique o health do sidecar pelo gateway Zavorth',
    }));
    expect(result.run.metadata).toEqual(expect.objectContaining({
      source: 'external-agent-adapter',
      normalizedInboundMessage: true,
      adapterSource: 'universal-agent-runtime',
    }));
  });

  it('dispatches a controlled outbound action and blocks risky actions until Zavorth approves them', async () => {
    const client = new FixtureExternalExecutorSidecarClient();
    const adapter = new QuarantinedExternalExecutorSidecarAdapter({
      client,
      now: () => new Date('2026-04-27T17:12:00.000Z'),
    });

    const safeResult = await adapter.dispatchControlledOutboundAction(createAction());
    const blockedRiskyResult = await adapter.dispatchControlledOutboundAction(createAction({
      id: 'phase-3-action-2',
      risk: 'danger',
      dryRun: false,
      kind: 'tool',
      label: 'Dangerous source tool dispatch',
      payload: {
        toolName: 'shell.exec',
      },
    }));
    const approvedRiskyResult = await adapter.dispatchControlledOutboundAction(createAction({
      id: 'phase-3-action-3',
      risk: 'danger',
      dryRun: false,
      kind: 'tool',
      label: 'Approved source tool dispatch',
      payload: {
        toolName: 'shell.exec',
      },
      approval: {
        id: 'zavorth-approval-1',
        status: 'approved',
      },
    }));

    expect(safeResult).toEqual(expect.objectContaining({
      status: 'dry-run',
      dryRun: true,
      decision: expect.objectContaining({
        ok: true,
        reason: 'allowed',
        requiresApproval: false,
      }),
      receipt: expect.objectContaining({
        id: 'receipt:phase-3-action-1',
      }),
    }));
    expect(blockedRiskyResult).toEqual(expect.objectContaining({
      status: 'blocked',
      decision: expect.objectContaining({
        ok: false,
        reason: 'requires-zavorth-approval',
        requiresApproval: true,
      }),
    }));
    expect(approvedRiskyResult).toEqual(expect.objectContaining({
      status: 'dispatched',
      dryRun: false,
      decision: expect.objectContaining({
        ok: true,
        reason: 'allowed',
        requiresApproval: true,
      }),
      receipt: expect.objectContaining({
        id: 'receipt:phase-3-action-3',
      }),
    }));
    expect(client.dispatchedActions.map((action) => action.id)).toEqual([
      'phase-3-action-1',
      'phase-3-action-3',
    ]);
  });
});
