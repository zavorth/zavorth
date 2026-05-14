import {
  CanonicalSessionContextAssembler,
  ZavorthAgentGateway,
  PUBLIC_ECOSYSTEM_CONTRACTS,
  PUBLIC_ECOSYSTEM_CONTRACT_VERSION,
} from '../../../src/runtime/agent/index.js';
import type {
  AgentReplyPort,
  AgentRunOptions,
  AgentRunResult,
  AssembledAgentContext,
  NormalizedInboundMessage,
  PublicMcpCapabilitySnapshot,
  PublicSkillSnapshot,
  PublicToolSurfaceSnapshot,
  ToolExposureProfile,
  ZavorthAgentGatewaySnapshot,
  ZavorthAgentRequest,
  ZavorthAgentRunResult,
  ZavorthContextSnapshot,
  ZavorthReplyPort,
  ZavorthToolExposureProfile,
} from '../../../src/runtime/agent/contracts/index.js';
import type {
  NormalizedInboundMessage as RootNormalizedInboundMessage,
  UniversalAgentRequest,
  UniversalAgentRunResult,
  UniversalReplyPort,
  UniversalToolExposureProfile,
} from '../../../src/runtime/agent/index.js';

function asRuntimeRequest(input: NormalizedInboundMessage): UniversalAgentRequest {
  return input;
}

function asRootContract(input: NormalizedInboundMessage): RootNormalizedInboundMessage {
  return input;
}

function asRuntimeReplyPort(input: AgentReplyPort): UniversalReplyPort {
  return input;
}

function asRuntimeToolExposureProfile(input: ToolExposureProfile): UniversalToolExposureProfile {
  return input;
}

function asRuntimeRunResult(input: AgentRunResult): UniversalAgentRunResult {
  return input;
}

function asZavorthRequest(input: ZavorthAgentRequest): UniversalAgentRequest {
  return input;
}

function asZavorthReplyPort(input: ZavorthReplyPort): UniversalReplyPort {
  return input;
}

function asZavorthToolExposureProfile(input: ZavorthToolExposureProfile): UniversalToolExposureProfile {
  return input;
}

function asZavorthRunResult(input: ZavorthAgentRunResult): UniversalAgentRunResult {
  return input;
}

describe('Universal agent contract facade', () => {
  it('keeps public contract names assignable to the existing runtime types', () => {
    const inbound: NormalizedInboundMessage = {
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-contract',
      text: 'resuma o estado do runtime',
      requestedTools: ['read_file'],
      metadata: {
        transport: 'web',
      },
    };
    const runtimeRequest = asRuntimeRequest(inbound);
    const rootRequest = asRootContract(inbound);

    const replyPort: AgentReplyPort = {
      id: 'web-primary',
      label: 'Command Center',
      kind: 'web',
      status: 'available',
      primary: true,
    };
    const runtimeReplyPort = asRuntimeReplyPort(replyPort);

    const toolExposure: ToolExposureProfile = {
      mode: 'safe',
      summary: '1 ferramenta exposta com policy safe.',
      tools: [
        {
          id: 'read_file',
          label: 'Read file',
          risk: 'safe',
          requiresApproval: false,
        },
      ],
    };
    const runtimeToolExposure = asRuntimeToolExposureProfile(toolExposure);

    const runResult = asRuntimeRunResult({
      ok: true,
      run: {
        id: 'run-contract',
        traceId: 'trace-contract',
        requestId: 'request-contract',
        sessionId: 'session-contract',
        userId: 'grey',
        channel: 'web',
        title: 'Contrato publico',
        input: inbound.text,
        workspace: null,
        status: 'completed',
        createdAt: '2026-04-27T00:00:00.000Z',
        updatedAt: '2026-04-27T00:00:00.000Z',
        summary: 'Contrato validado.',
        events: [],
        toolExposure,
        replyPorts: [replyPort],
        modelProfile: {
          providerLabel: 'Zavorth',
          modelLabel: 'modelo atual',
          routingPolicy: 'gateway',
        },
        approvals: [],
        artifacts: [],
        memorySignals: [],
        metadata: {},
      },
      replies: [
        {
          id: 'reply-contract',
          runId: 'run-contract',
          port: replyPort,
          text: 'Contrato validado.',
          createdAt: '2026-04-27T00:00:00.000Z',
        },
      ],
    });

    const context: AssembledAgentContext = {
      sessionId: inbound.sessionId,
      canonicalSessionPrompt: 'Sessao canonicalizada para teste de contrato.',
      metadata: {
        source: 'contract-facade-test',
      },
    };

    const options: AgentRunOptions = {
      executor: null,
    };

    expect(typeof ZavorthAgentGateway).toBe('function');
    expect(runtimeRequest).toBe(rootRequest);
    expect(runtimeRequest.metadata?.transport).toBe('web');
    expect(runtimeReplyPort.primary).toBe(true);
    expect(runtimeToolExposure.mode).toBe('safe');
    expect(runResult.run.toolExposure.tools[0].id).toBe('read_file');
    expect(runResult.run.traceId).toBe('trace-contract');
    expect(context.metadata?.source).toBe('contract-facade-test');
    expect(options.executor).toBeNull();
  });

  it('publishes Zavorth-native aliases without creating a parallel gateway contract', () => {
    const request: ZavorthAgentRequest = {
      requestId: 'request-zavorth-contract',
      traceId: 'trace-zavorth-contract',
      userId: 'operator',
      sessionId: 'session-zavorth-contract',
      channel: 'cli',
      text: 'diagnostique o workspace',
      metadata: {
        source: 'zavorth-contract-alias-test',
      },
    };
    const replyPort: ZavorthReplyPort = {
      id: 'cli-primary',
      label: 'Zavorth CLI',
      kind: 'cli',
      status: 'available',
      primary: true,
    };
    const toolExposure: ZavorthToolExposureProfile = {
      mode: 'confirm',
      summary: 'Tools mutaveis exigem confirmacao.',
      tools: [
        {
          id: 'workspace.apply_patch',
          label: 'Workspace apply patch',
          risk: 'attention',
          requiresApproval: true,
        },
      ],
    };
    const runResult: ZavorthAgentRunResult = {
      ok: true,
      run: {
        id: 'run-zavorth-contract',
        traceId: 'trace-zavorth-contract',
        requestId: 'request-zavorth-contract',
        sessionId: 'session-zavorth-contract',
        userId: request.userId,
        channel: request.channel,
        title: 'Contrato Zavorth',
        input: request.text,
        status: 'waiting_approval',
        createdAt: '2026-05-02T00:00:00.000Z',
        updatedAt: '2026-05-02T00:00:00.000Z',
        summary: 'Aguardando approval.',
        events: [],
        toolExposure,
        replyPorts: [replyPort],
        modelProfile: {
          providerLabel: 'Zavorth',
          modelLabel: 'modelo atual',
          routingPolicy: 'gateway',
        },
        approvals: [],
        artifacts: [],
        memorySignals: [],
        metadata: {},
      },
      replies: [],
    };
    const context: ZavorthContextSnapshot = new CanonicalSessionContextAssembler().assemble({
      sessionId: request.sessionId,
      userId: request.userId,
      channel: request.channel,
      traceId: request.traceId,
      profile: 'warm',
      hot: {
        canonicalSessionPrompt: 'Sessao canonica pronta.',
      },
      warm: {
        workspacePrompt: 'Workspace Zavorth com instrucoes locais.',
      },
      metadata: {
        source: 'zavorth-contract-alias-test',
      },
    });
    const gatewaySnapshot: ZavorthAgentGatewaySnapshot = new ZavorthAgentGateway().buildSnapshot();

    expect(asZavorthRequest(request)).toBe(request);
    expect(asZavorthReplyPort(replyPort)).toBe(replyPort);
    expect(asZavorthToolExposureProfile(toolExposure)).toBe(toolExposure);
    expect(asZavorthRunResult(runResult)).toBe(runResult);
    expect(context.profile.depth).toBe('warm');
    expect(gatewaySnapshot.source.label).toBe('Zavorth Agent Gateway');
  });

  it('publishes a small ecosystem contract manifest without exposing internal services as stable API', () => {
    const names = PUBLIC_ECOSYSTEM_CONTRACTS.map((contract) => contract.name);
    const stableNames = PUBLIC_ECOSYSTEM_CONTRACTS
      .filter((contract) => contract.stability === 'stable')
      .map((contract) => contract.name);

    expect(PUBLIC_ECOSYSTEM_CONTRACT_VERSION).toBe('2026-05-02.z0-z1');
    expect(names).toEqual(expect.arrayContaining([
      'ZavorthAgentRequest',
      'ZavorthReplyPort',
      'ZavorthAgentRunResult',
      'ZavorthContextSnapshot',
      'ZavorthToolExposureProfile',
      'ZavorthAgentGatewaySnapshot',
      'NormalizedInboundMessage',
      'InboundAdapterContract',
      'AgentReplyPort',
      'AgentReplyPacket',
      'AgentRunResult',
      'AgentRunSnapshot',
      'ToolExposureProfile',
      'PublicSkillSnapshot',
      'PublicMcpCapabilitySnapshot',
      'PublicToolSurfaceSnapshot',
      'AssembledAgentContext',
    ]));
    expect(stableNames).toEqual(expect.arrayContaining([
      'ZavorthAgentRequest',
      'ZavorthReplyPort',
      'ZavorthAgentRunResult',
      'ZavorthToolExposureProfile',
      'NormalizedInboundMessage',
      'AgentReplyPort',
      'AgentReplyPacket',
      'AgentRunResult',
      'AgentRunSnapshot',
      'ToolExposureProfile',
    ]));
    expect(PUBLIC_ECOSYSTEM_CONTRACTS).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceType: 'ZavorthAgentGateway',
        stability: 'stable',
      }),
    ]));
    expect(PUBLIC_ECOSYSTEM_CONTRACTS.every((contract) =>
      contract.sourceModule.startsWith('src/') && contract.notes.length > 0)).toBe(true);
  });

  it('keeps skill, MCP and tool surface public aliases assignable to canonical snapshots', () => {
    const skillSnapshot: PublicSkillSnapshot = {
      status: 'available',
      skillCount: 1,
      toolCount: 1,
      trustSummary: {
        trusted: 1,
        safe: 0,
        quarantined: 0,
      },
      skills: [
        {
          id: 'workspace-reporter',
          directory: 'C:/repo/Zavorth/skill-library/workspace-reporter',
          toolCount: 1,
          toolNames: ['workspace_report'],
          hasToolsMarkdown: true,
          hasEntryPoint: true,
          trustState: 'trusted',
          quarantined: false,
          riskReport: {
            kind: 'skill',
            id: 'workspace-reporter',
            trustState: 'trusted',
            riskLevel: 'low',
            quarantined: false,
            requiresReview: false,
            canExposeToModel: true,
            canExposeTools: true,
            reasons: [],
            toolNames: ['workspace_report'],
          },
          metadata: {},
          summary: 'Reports workspace state.',
        },
      ],
      cold: {
        skillPrompt: 'SKILLS DISPONIVEIS:\n- workspace-reporter',
        metadata: {},
      },
      metadata: {},
    };
    const mcpSnapshot: PublicMcpCapabilitySnapshot = {
      status: 'degraded',
      generatedAt: '2026-04-27T00:00:00.000Z',
      manifestPath: 'config/mcp-servers.json',
      capabilities: ['core'],
      summary: {
        total: 1,
        enabled: 1,
        connected: 0,
        failed: 1,
        disabled: 0,
        stopped: 0,
        toolCount: 1,
      },
      trustSummary: {
        trusted: 0,
        safe: 0,
        quarantined: 1,
      },
      entries: [
        {
          id: 'imported-draft',
          capability: 'experimental',
          enabled: true,
          status: 'failed',
          toolCount: 1,
          toolNames: ['unsafe_remote_tool'],
          trustState: 'quarantined',
          quarantined: true,
          riskReport: {
            kind: 'mcp',
            id: 'imported-draft',
            trustState: 'quarantined',
            riskLevel: 'high',
            quarantined: true,
            requiresReview: true,
            canExposeToModel: false,
            canExposeTools: false,
            reasons: ['mcp-server-not-connected'],
            toolNames: ['unsafe_remote_tool'],
          },
          lastError: 'review required',
        },
      ],
      cold: {
        mcpSnapshot: null,
        metadata: {},
      },
      metadata: {},
    };
    const toolSurface: PublicToolSurfaceSnapshot = {
      generatedAt: '2026-04-27T00:00:00.000Z',
      summary: {
        families: 1,
        ready: 1,
        partial: 0,
        planned: 0,
        explicitTools: 1,
      },
      families: [
        {
          id: 'session',
          label: 'Session tools',
          status: 'ready',
          total: 1,
          summary: 'Session tools ready.',
          examples: ['session.list'],
        },
      ],
      catalog: {
        generatedAt: '2026-04-27T00:00:00.000Z',
        summary: {
          totalFamilies: 1,
          readyFamilies: 1,
          partialFamilies: 0,
          plannedFamilies: 0,
          totalTools: 1,
          visibleTools: 1,
        },
        families: [
          {
            id: 'session',
            label: 'Session tools',
            readiness: 'ready',
            total: 1,
            operatorSummary: 'Session tools ready.',
            featured: [],
          },
        ],
        entries: [],
        selected: null,
        featuredIds: [],
        query: null,
        narrative: {
          headline: 'Tool catalog ready.',
          operatorSummary: '1 tool ready.',
        },
      },
      narrative: {
        headline: 'Zavorth expoe 1 familia de tools no plano atual.',
        operatorSummary: '1 familia pronta.',
      },
    };

    expect(skillSnapshot.skills[0].toolNames).toEqual(['workspace_report']);
    expect(mcpSnapshot.entries[0].quarantined).toBe(true);
    expect(toolSurface.families[0].status).toBe('ready');
  });
});
