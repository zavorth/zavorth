import path from 'node:path';
import { AgentRunLlmRequestBuilder } from '../../src/runtime/agent/AgentRunLlmRequestBuilder';
import { AgentRunNativeToolLoopService } from '../../src/runtime/agent/AgentRunNativeToolLoopService';
import type { UniversalAgentRequest, UniversalAgentRun } from '../../src/runtime/agent/UniversalAgentRuntimeTypes';
import type { UniversalAgentToolRuntime } from '../../src/runtime/agent/AgentRunEchoHandsExecutor';
import type { ToolDefinition } from '../../src/providers/ILlmProvider';
import { ProfileManifestService } from '../../src/services/ProfileManifestService';

const tool = (name: string): ToolDefinition => ({
  name,
  description: name,
  parameters: {
    type: 'object',
    properties: {},
  },
});

function run(profileBundle: unknown): UniversalAgentRun {
  return {
    id: 'run-profile-policy',
    traceId: 'trace-profile-policy',
    requestId: 'request-profile-policy',
    sessionId: 'session-profile-policy',
    userId: 'operator',
    channel: 'cli',
    title: 'Profile policy binding',
    input: 'inspect this workspace',
    workspace: 'C:/workspace',
    status: 'running',
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    summary: '',
    events: [],
    toolExposure: {
      mode: 'safe',
      summary: 'test exposure',
      tools: [
        { id: 'read_file', label: 'Read file', risk: 'safe', requiresApproval: false },
        { id: 'write_file', label: 'Write file', risk: 'attention', requiresApproval: false },
        { id: 'remote_shell', label: 'Shell', risk: 'danger', requiresApproval: false },
      ],
    },
    replyPorts: [],
    modelProfile: {
      providerLabel: 'test',
      modelLabel: 'test',
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
  sessionId: 'session-profile-policy',
  text: 'inspect this workspace',
  workspace: 'C:/workspace',
  metadata: {
    profile: 'developer',
  },
};

describe('profile-aware runtime policy binding', () => {
  it('binds RuntimePolicyBundle to native tool exposure and loop limits', () => {
    const profiles = new ProfileManifestService({
      profileDir: path.join(process.cwd(), 'config', 'profile-manifests'),
    });
    const developer = profiles.compileProfileById('developer');
    expect(developer).not.toBeNull();

    const toolRuntime: UniversalAgentToolRuntime = {
      isAvailable: () => true,
      getToolDefinitions: () => [
        tool('read_file'),
        tool('write_file'),
        tool('remote_shell'),
      ],
      hasTool: () => true,
      executeTool: async () => 'ok',
    };
    const service = new AgentRunNativeToolLoopService({
      llmRuntime: null,
      toolRuntime,
      requestBuilder: new AgentRunLlmRequestBuilder({
        hallucinationInstruction: () => '',
      }),
      mutationPlaneService: null,
      speculativeAutonomyService: null,
    });

    const activeRun = run(developer);
    const tools = service.resolveNativeTools(activeRun, request).map((entry) => entry.name);

    expect(service.maxRoundsFor(activeRun, request)).toBe(12);
    expect(tools).toContain('read_file');
    expect(tools).not.toContain('write_file');
    expect(tools).not.toContain('remote_shell');
    expect(activeRun.events.map((event) => event.metadata?.profileEnforcementReceipt)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'tool_exposure',
        subject: 'read_file',
        decision: 'allowed',
      }),
      expect.objectContaining({
        kind: 'approval_gate',
        subject: 'write_file',
        decision: 'requires_approval',
      }),
      expect.objectContaining({
        kind: 'approval_gate',
        subject: 'remote_shell',
        decision: 'requires_approval',
      }),
    ]));
  });
});
