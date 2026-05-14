import {
  AgentRunService,
  ZavorthAgentGateway,
} from '../../../src/runtime/agent/index.js';
import {
  FixtureExternalAgentAdapter,
  buildToolExposurePolicyInputFromExternalCapabilities,
} from '../../../src/runtime/external-agents/index.js';
import { ToolExposurePolicy } from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => {
    index += 1;
    return `${prefix}-${index}`;
  };
}

describe('ExternalAgentAdapter contract boundary', () => {
  it('exposes health, capabilities, channels and fixture events without execution powers', async () => {
    const adapter = new FixtureExternalAgentAdapter();

    const health = await adapter.start();
    const capabilities = await adapter.listCapabilities();
    const channels = await adapter.listChannels();
    const sessions = await adapter.listSessions();
    const events = await adapter.pullTestEvents();

    expect(health).toEqual(expect.objectContaining({
      runtimeId: 'external-sidecar-fixture',
      status: 'ready',
      capabilities: {
        total: 3,
        trusted: 1,
        safe: 1,
        quarantined: 1,
      },
      approvals: {
        total: 1,
        pending: 1,
      },
      artifacts: {
        total: 1,
        ready: 1,
      },
    }));
    expect(channels).toEqual([
      expect.objectContaining({
        channel: 'api',
        inbound: true,
        outbound: false,
        replyBoundary: 'zavorth-reply-port-only',
      }),
    ]);
    expect(sessions).toEqual([
      expect.objectContaining({
        id: 'foreign-session-1',
        channel: 'api',
      }),
    ]);
    expect(events).toHaveLength(1);
    expect(capabilities.map((capability) => capability.trustState)).toEqual([
      'trusted',
      'safe',
      'quarantined',
    ]);
    expect(adapter.descriptor.boundary).toEqual(expect.objectContaining({
      requiresZavorthGateway: true,
      mayMutateFiles: false,
      maySendUserFacingMessages: false,
      mayExecuteTools: false,
      mayLaunchWorkers: false,
    }));
    expect(adapter.descriptor.namingQuarantine).toEqual(expect.objectContaining({
      sourceNamesQuarantined: true,
      allowedSourceNameScopes: ['adapter-diagnostics', 'inventory-evidence'],
    }));
    expect(adapter.lifecycle).toEqual(expect.objectContaining({
      phase: 'contract-layer',
      startBehavior: 'health-discovery-only',
      stopBehavior: 'local-adapter-state-only',
      canSpawnSourceRuntime: false,
      canMutateSourceRuntime: false,
    }));
    expect('sendMessage' in adapter).toBe(false);
    expect('executeTool' in adapter).toBe(false);
    expect('mutateFiles' in adapter).toBe(false);
    expect('launchWorker' in adapter).toBe(false);
    expect('dispatchTask' in adapter).toBe(false);
  });

  it('normalizes a fixture foreign event into a Zavorth NormalizedInboundMessage and gateway run', async () => {
    const adapter = new FixtureExternalAgentAdapter();
    const [event] = await adapter.pullTestEvents();
    const message = adapter.normalizeEvent(event);
    const topLevelEnvelope = JSON.stringify({
      requestId: message.requestId,
      traceId: message.traceId,
      userId: message.userId,
      sessionId: message.sessionId,
      channel: message.channel,
      text: message.text,
      requestedTools: message.requestedTools,
    });
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-27T16:05:00.000Z'),
      idFactory: createIdFactory(),
      executor: jest.fn(),
    });

    const result = await gateway.handle(message);

    expect(message).toEqual(expect.objectContaining({
      requestId: 'external-event:foreign-event-1',
      traceId: 'external-sidecar-fixture:foreign-session-1:foreign-event-1',
      userId: 'external-user-1',
      sessionId: 'external:foreign-session-1',
      channel: 'api',
      text: 'resuma a sessao externa usando o runtime Zavorth',
      requestedTools: ['read_file', 'shell.exec'],
    }));
    expect(topLevelEnvelope).not.toContain('Fixture External Runtime');
    expect(message.metadata?.externalAdapter).toEqual(expect.objectContaining({
      adapterId: 'external-sidecar-fixture',
      boundary: expect.objectContaining({
        gatewayEntry: 'ZavorthAgentGateway.handle',
        replyEntry: 'ReplyPipeline',
        policyEntry: 'ToolExposurePolicy',
      }),
      diagnostics: expect.objectContaining({
        sourceRuntimeName: 'Fixture External Runtime',
      }),
    }));
    expect(result.run).toEqual(expect.objectContaining({
      channel: 'api',
      sessionId: 'external:foreign-session-1',
      input: 'resuma a sessao externa usando o runtime Zavorth',
      status: 'waiting_approval',
    }));
    expect(result.run.metadata).toEqual(expect.objectContaining({
      source: 'external-agent-adapter',
      normalizedInboundMessage: true,
      adapterSource: 'universal-agent-runtime',
    }));
    expect(result.run.approvals[0]).toEqual(expect.objectContaining({
      risk: 'danger',
      status: 'pending',
    }));
  });

  it('normalizes provider, session, approval and artifact envelopes into Zavorth-native contracts', async () => {
    const adapter = new FixtureExternalAgentAdapter();
    const capabilities = await adapter.listCapabilities();
    const [sessionEnvelope] = await adapter.listSessionEnvelopes();
    const [approvalEnvelope] = await adapter.listApprovalEnvelopes();
    const [artifactEnvelope] = await adapter.listArtifactEnvelopes();

    const provider = adapter.normalizeCapabilityProvider(capabilities);
    const approval = adapter.normalizeApproval(approvalEnvelope);
    const artifact = adapter.normalizeArtifact(artifactEnvelope);

    expect(provider).toEqual(expect.objectContaining({
      id: 'external-capability-provider:external-sidecar-fixture',
      runtimeId: 'external-sidecar-fixture',
      nativeContract: 'ToolExposurePolicyInput',
      boundary: expect.objectContaining({
        requiresZavorthGateway: true,
        mayExecuteTools: false,
      }),
    }));
    expect(provider.toolExposurePolicyInput).toEqual(expect.objectContaining({
      allowedTools: ['read_file', 'external.summary'],
      blockedTools: ['shell.exec'],
      requireApprovalFor: ['external.summary'],
    }));
    expect(sessionEnvelope).toEqual(expect.objectContaining({
      id: 'external-session:foreign-session-1',
      runtimeId: 'external-sidecar-fixture',
      observedAt: '2026-04-27T16:00:00.000Z',
      descriptor: expect.objectContaining({
        id: 'foreign-session-1',
      }),
    }));
    expect(approval).toEqual({
      id: 'external-approval:foreign-approval-1',
      runId: 'external-run:foreign-session-1',
      title: 'Confirm external shell request',
      reason: 'A dangerous external tool request must be re-approved by Zavorth policy.',
      risk: 'danger',
      status: 'pending',
      createdAt: '2026-04-27T16:00:00.000Z',
    });
    expect(artifact).toEqual({
      id: 'external-artifact:foreign-artifact-1',
      title: 'External session handoff',
      kind: 'handoff',
      createdAt: '2026-04-27T16:00:00.000Z',
      sessionId: 'external:foreign-session-1',
      status: 'ready',
    });
    expect(JSON.stringify(approval)).not.toContain('Fixture External Runtime');
    expect(JSON.stringify(artifact)).not.toContain('Fixture External Runtime');
  });

  it('normalizes fixture capabilities into Zavorth tool exposure policy contracts', async () => {
    const adapter = new FixtureExternalAgentAdapter();
    const capabilities = await adapter.listCapabilities();
    const [trustedCapability,, quarantinedCapability] = capabilities;

    const trustedContract = adapter.normalizeCapability(trustedCapability);
    const quarantinedContract = adapter.normalizeCapability(quarantinedCapability);
    const profile = new ToolExposurePolicy().buildProfile(
      buildToolExposurePolicyInputFromExternalCapabilities(capabilities),
    );

    expect(trustedContract).toEqual(expect.objectContaining({
      id: 'external-capability:workspace-reader',
      nativeContract: 'ToolExposurePolicyInput',
      trustState: 'trusted',
      toolNames: ['read_file'],
      toolExposurePolicyInput: expect.objectContaining({
        allowedTools: ['read_file'],
        blockedTools: [],
      }),
      inventoryEvidence: expect.objectContaining({
        sourceRuntimeName: 'Fixture External Runtime',
      }),
    }));
    expect(quarantinedContract).toEqual(expect.objectContaining({
      id: 'external-capability:remote-shell-draft',
      trustState: 'quarantined',
      toolExposurePolicyInput: expect.objectContaining({
        allowedTools: [],
        blockedTools: ['shell.exec'],
      }),
    }));
    expect(profile).toEqual(expect.objectContaining({
      mode: 'confirm',
      toolExposureGatedByImportedCapabilityTrust: true,
    }));
    expect(profile.tools).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'read_file',
        risk: 'safe',
        requiresApproval: false,
      }),
      expect.objectContaining({
        id: 'external.summary',
        requiresApproval: true,
      }),
    ]));
    expect(profile.blockedTools).toEqual([
      expect.objectContaining({
        id: 'shell.exec',
        reason: 'blocked-by-external-adapter-quarantine',
      }),
    ]);
  });

  it('feeds external capability trust into AgentRunService so quarantined tools stay blocked', async () => {
    const adapter = new FixtureExternalAgentAdapter();
    const capabilities = await adapter.listCapabilities();
    const executor = jest.fn(({ run }) => ({
      status: 'completed',
      summary: `Tools visiveis: ${run.toolExposure.tools.map((tool: any) => tool.id).join(', ')}`,
      replyText: 'External capability policy aplicada.',
    }));
    const service = new AgentRunService({
      now: () => new Date('2026-04-27T16:10:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'api',
      sessionId: 'external:foreign-session-1',
      text: 'use somente capabilities externas governadas',
      requestedTools: ['read_file', 'external.summary', 'shell.exec'],
      metadata: {
        coldContext: adapter.buildColdContextMetadata(capabilities),
      },
    });

    expect(executor).toHaveBeenCalledTimes(1);
    expect(result.run.status).toBe('completed');
    expect(result.run.toolExposure.tools.map((tool) => tool.id)).toEqual([
      'read_file',
      'external.summary',
    ]);
    expect(result.run.toolExposure.blockedTools).toEqual([
      expect.objectContaining({
        id: 'shell.exec',
        reason: 'blocked-by-imported-capability-trust',
      }),
    ]);
    expect(result.run.metadata.importedCapabilityTrust).toEqual(expect.objectContaining({
      source: 'ColdContextResolver',
      hasQuarantined: true,
      blockedTools: ['shell.exec'],
      toolExposureGatedByImportedCapabilityTrust: true,
    }));
  });
});
