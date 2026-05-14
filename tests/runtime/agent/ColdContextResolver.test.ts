import {
  ColdContextResolver,
  McpSnapshotAssembler,
  MemoryContextAssembler,
  SkillSnapshotAssembler,
} from '../../../src/runtime/agent/index.js';
import type { SkillManifest } from '../../../src/context-engine/SkillScanner.js';
import type { McpRuntimeSnapshot } from '../../../src/mcp/McpRuntimeService.js';

function createSkillManifest(overrides: Partial<SkillManifest> = {}): SkillManifest {
  return {
    id: 'workspace-reporter',
    directory: 'C:/repo/Zavorth/skill-library/workspace-reporter',
    toolsMarkdown: '# Workspace reporter\nReports workspace state.',
    toolDefinitions: [
      {
        name: 'workspace_report',
      },
    ],
    entryPoint: 'C:/repo/Zavorth/skill-library/workspace-reporter/index.ts',
    metadata: {
      category: 'workspace',
    },
    ...overrides,
  };
}

function createMcpRuntimeSnapshot(overrides: Partial<McpRuntimeSnapshot> = {}): McpRuntimeSnapshot {
  return {
    generatedAt: '2026-04-27T12:00:00.000Z',
    manifestPath: 'C:/repo/Zavorth/config/mcp-servers.json',
    summary: {
      total: 1,
      enabled: 1,
      connected: 1,
      failed: 0,
      disabled: 0,
      stopped: 0,
      toolCount: 1,
    },
    capabilities: ['filesystem'],
    entries: [
      {
        id: 'filesystem',
        capability: 'filesystem',
        enabled: true,
        status: 'connected',
        toolCount: 1,
        toolNames: ['read_file'],
        command: 'npx.cmd',
        args: [],
        lastAttemptedAt: null,
        lastConnectedAt: '2026-04-27T12:00:00.000Z',
        lastError: null,
      },
    ],
    ...overrides,
  };
}

describe('ColdContextResolver', () => {
  it('delegates to the canonical assembler with a forced cold profile', () => {
    const assemble = jest.fn((input) => ({
      sessionId: input.sessionId,
      userId: input.userId,
      channel: input.channel,
      traceId: input.traceId,
      workspace: input.workspace,
      continuityPrompt: input.hot.continuityPrompt,
      summaryPrompt: input.hot.summaryPrompt,
      canonicalSessionPrompt: input.hot.canonicalSessionPrompt,
      workspacePrompt: input.warm.workspacePrompt,
      memoryPrompt: input.cold.memoryPrompt,
      skillPrompt: input.cold.skillPrompt,
      mcpSnapshot: input.cold.mcpSnapshot,
      profile: {
        id: 'cold-context',
        depth: 'cold',
        includeHot: true,
        includeWarm: true,
        includeCold: true,
        reason: 'forced cold',
        suggestedBy: 'test',
        gatesToolExposure: false,
      },
      hot: {
        continuityPrompt: input.hot.continuityPrompt,
        summaryPrompt: input.hot.summaryPrompt,
        canonicalSessionPrompt: input.hot.canonicalSessionPrompt,
        recentEvents: input.hot.recentEvents,
        metadata: input.hot.metadata || {},
      },
      warm: {
        workspacePrompt: input.warm.workspacePrompt,
        workspaceProfile: input.warm.workspaceProfile || null,
        identityFiles: input.warm.identityFiles || [],
        metadata: input.warm.metadata || {},
      },
      cold: {
        memoryPrompt: input.cold.memoryPrompt,
        skillPrompt: input.cold.skillPrompt,
        mcpSnapshot: input.cold.mcpSnapshot,
        metadata: input.cold.metadata || {},
      },
      metadata: {
        ...input.metadata,
        contextProfile: 'cold-context',
        contextDepth: 'cold',
        contextLayers: ['hot', 'warm', 'cold'],
        toolExposureGatedByContextProfile: false,
      },
    }));
    const resolver = new ColdContextResolver({
      canonicalAssembler: {
        assemble,
      },
    });

    const snapshot = resolver.resolve({
      sessionId: 'web:cold-context',
      userId: 'grey',
      channel: 'web',
      traceId: 'trace-cold',
      workspace: 'C:/repo/Zavorth',
      hot: {
        continuityPrompt: 'Recent continuity.',
      },
      warm: {
        workspacePrompt: 'Workspace loaded.',
      },
      memory: {
        memoryPrompt: 'Memory prompt.',
        metadata: {
          source: 'memory',
        },
      },
      skill: {
        skillPrompt: 'Skill prompt.',
        metadata: {
          source: 'skill',
        },
      },
      mcp: {
        mcpSnapshot: {
          status: 'available',
        },
        metadata: {
          source: 'mcp',
        },
      },
      metadata: {
        source: 'test',
      },
    });

    expect(assemble).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'web:cold-context',
      profile: 'cold',
      cold: expect.objectContaining({
        memoryPrompt: 'Memory prompt.',
        skillPrompt: 'Skill prompt.',
        mcpSnapshot: {
          status: 'available',
        },
        metadata: expect.objectContaining({
          memoryContext: expect.objectContaining({
            source: 'memory',
          }),
          skillContext: expect.objectContaining({
            source: 'skill',
          }),
          mcpContext: expect.objectContaining({
            source: 'mcp',
          }),
          resolverSource: 'ColdContextResolver',
          toolExposureGatedByColdContext: false,
        }),
      }),
      metadata: expect.objectContaining({
        source: 'test',
        coldContextSource: 'ColdContextResolver',
      }),
    }));
    expect(snapshot.cold.memoryPrompt).toBe('Memory prompt.');
    expect(snapshot.canonical.profile).toEqual(expect.objectContaining({
      depth: 'cold',
      includeWarm: true,
      includeCold: true,
      gatesToolExposure: false,
    }));
    expect(snapshot.metadata).toEqual(expect.objectContaining({
      source: 'CanonicalSessionContextAssembler',
      layer: 'cold',
      required: false,
      includesWarm: true,
      includesCold: true,
      toolExposureGatedByColdContext: false,
    }));
  });

  it('combines existing memory, skill and MCP cold fragments without exposing tools by itself', () => {
    const memoryContext = new MemoryContextAssembler().assemble({
      connectedToolNames: ['search_memory', 'scan_local_metadata'],
      compact: true,
    });
    const skillSnapshot = new SkillSnapshotAssembler().assemble({
      manifests: [
        createSkillManifest(),
      ],
      maxPromptChars: 600,
    });
    const mcpSnapshot = new McpSnapshotAssembler().assemble({
      snapshot: createMcpRuntimeSnapshot(),
    });
    const resolver = new ColdContextResolver();

    const snapshot = resolver.resolve({
      sessionId: 'web:cold-context-real',
      channel: 'web',
      hot: {
        continuityPrompt: 'Recent continuity.',
      },
      warm: {
        workspacePrompt: 'Workspace loaded.',
      },
      memory: memoryContext.cold,
      skill: skillSnapshot.cold,
      mcp: mcpSnapshot.cold,
    });

    expect(snapshot.canonical.profile).toEqual(expect.objectContaining({
      depth: 'cold',
      includeWarm: true,
      includeCold: true,
      gatesToolExposure: false,
    }));
    expect(snapshot.canonical.metadata.contextLayers).toEqual(['hot', 'warm', 'cold']);
    expect(snapshot.canonical.memoryPrompt).toContain('search_memory');
    expect(snapshot.canonical.skillPrompt).toContain('workspace_report');
    expect(snapshot.canonical.mcpSnapshot).toEqual(expect.objectContaining({
      status: 'available',
      capabilities: ['filesystem'],
    }));
    expect(snapshot.cold.metadata).toEqual(expect.objectContaining({
      memoryContext: expect.objectContaining({
        toolExposureGatedByMemoryContext: false,
      }),
      skillContext: expect.objectContaining({
        toolExposureGatedBySkillSnapshot: false,
      }),
      mcpContext: expect.objectContaining({
        toolExposureGatedByMcpSnapshot: false,
      }),
      toolExposureGatedByColdContext: false,
    }));
    expect(snapshot.metadata.toolExposureGatedByContextProfile).toBe(false);
    expect(snapshot.metadata.toolExposureGatedByColdContext).toBe(false);
  });

  it('infers Mnemos memory context from connected MCP tools when no memory fragment is provided', () => {
    const mcpSnapshot = new McpSnapshotAssembler().assemble({
      snapshot: createMcpRuntimeSnapshot({
        summary: {
          total: 1,
          enabled: 1,
          connected: 1,
          failed: 0,
          disabled: 0,
          stopped: 0,
          toolCount: 3,
        },
        capabilities: ['memory'],
        entries: [
          {
            id: 'mnemos',
            capability: 'memory',
            enabled: true,
            status: 'connected',
            toolCount: 3,
            toolNames: ['search_memory', 'scan_local_metadata', 'index_file'],
            command: 'node',
            args: ['mnemos.js'],
            lastAttemptedAt: null,
            lastConnectedAt: '2026-04-27T12:00:00.000Z',
            lastError: null,
          },
        ],
      }),
    });
    const resolver = new ColdContextResolver();

    const snapshot = resolver.resolve({
      sessionId: 'cli:mnemos-cold-context',
      channel: 'cli',
      hot: {
        continuityPrompt: 'Recent continuity.',
      },
      warm: {
        workspacePrompt: 'Workspace loaded.',
      },
      mcp: mcpSnapshot.cold,
    });

    expect(snapshot.canonical.memoryPrompt).toContain('MNEMOS');
    expect(snapshot.canonical.memoryPrompt).toContain('search_memory');
    expect(snapshot.cold.metadata).toEqual(expect.objectContaining({
      memoryContext: expect.objectContaining({
        source: 'MnemosCognitiveProtocol',
        memoryContextSource: 'ColdContextResolver.mcpSnapshot',
        connectedToolSource: 'McpSnapshotAssembler',
        mnemosAvailable: true,
        connectedToolNames: ['search_memory', 'scan_local_metadata', 'index_file'],
        cadence: ['search_memory', 'scan_local_metadata', 'index_file'],
        indexingTool: 'index_file',
        indexingRequiresApproval: true,
        indexingApprovalBoundary: 'human-in-the-loop',
        toolExposureGatedByMemoryContext: false,
      }),
      mcpContext: expect.objectContaining({
        source: 'McpRuntimeService.readSnapshot',
        mcpAvailable: true,
      }),
      toolExposureGatedByColdContext: false,
    }));
  });

  it('does not infer Mnemos memory context from failed MCP entries', () => {
    const mcpSnapshot = new McpSnapshotAssembler().assemble({
      snapshot: createMcpRuntimeSnapshot({
        summary: {
          total: 1,
          enabled: 1,
          connected: 0,
          failed: 1,
          disabled: 0,
          stopped: 0,
          toolCount: 3,
        },
        capabilities: ['memory'],
        entries: [
          {
            id: 'mnemos',
            capability: 'memory',
            enabled: true,
            status: 'failed',
            toolCount: 3,
            toolNames: ['search_memory', 'scan_local_metadata', 'index_file'],
            command: 'node',
            args: ['mnemos.js'],
            lastAttemptedAt: '2026-04-27T11:59:00.000Z',
            lastConnectedAt: null,
            lastError: 'connection refused',
          },
        ],
      }),
    });
    const resolver = new ColdContextResolver();

    const snapshot = resolver.resolve({
      sessionId: 'cli:mnemos-failed-context',
      channel: 'cli',
      hot: {
        continuityPrompt: 'Recent continuity.',
      },
      warm: {
        workspacePrompt: 'Workspace loaded.',
      },
      mcp: mcpSnapshot.cold,
    });

    expect(snapshot.canonical.memoryPrompt).toBeNull();
    expect(snapshot.cold.metadata).not.toHaveProperty('memoryContext');
    expect(snapshot.cold.metadata).toEqual(expect.objectContaining({
      mcpContext: expect.objectContaining({
        status: 'degraded',
        mcpAvailable: true,
      }),
      toolExposureGatedByColdContext: false,
    }));
  });
});
