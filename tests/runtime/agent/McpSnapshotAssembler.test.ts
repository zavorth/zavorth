import {
  CanonicalSessionContextAssembler,
  McpSnapshotAssembler,
} from '../../../src/runtime/agent/index.js';
import type { McpRuntimeSnapshot } from '../../../src/mcp/McpRuntimeService.js';

function createMcpRuntimeSnapshot(overrides: Partial<McpRuntimeSnapshot> = {}): McpRuntimeSnapshot {
  return {
    generatedAt: '2026-04-27T12:00:00.000Z',
    manifestPath: 'C:/repo/Zavorth/config/mcp-servers.json',
    summary: {
      total: 2,
      enabled: 2,
      connected: 1,
      failed: 1,
      disabled: 0,
      stopped: 0,
      toolCount: 2,
    },
    capabilities: ['filesystem', 'memory'],
    entries: [
      {
        id: 'filesystem',
        capability: 'filesystem',
        enabled: true,
        status: 'connected',
        toolCount: 2,
        toolNames: ['read_file', 'list_directory'],
        command: 'npx.cmd',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
        lastAttemptedAt: '2026-04-27T11:59:00.000Z',
        lastConnectedAt: '2026-04-27T12:00:00.000Z',
        lastError: null,
      },
      {
        id: 'mnemos',
        capability: 'memory',
        enabled: true,
        status: 'failed',
        toolCount: 0,
        toolNames: [],
        command: 'node',
        args: ['mnemos.js'],
        lastAttemptedAt: '2026-04-27T11:59:00.000Z',
        lastConnectedAt: null,
        lastError: 'connection refused',
      },
    ],
    ...overrides,
  };
}

describe('McpSnapshotAssembler', () => {
  it('returns an honest unavailable snapshot when no MCP runtime snapshot is provided', () => {
    const assembler = new McpSnapshotAssembler();

    const snapshot = assembler.assemble();

    expect(snapshot.status).toBe('unavailable');
    expect(snapshot.summary).toEqual({
      total: 0,
      enabled: 0,
      connected: 0,
      failed: 0,
      disabled: 0,
      stopped: 0,
      toolCount: 0,
    });
    expect(snapshot.trustSummary).toEqual({
      trusted: 0,
      safe: 0,
      quarantined: 0,
    });
    expect(snapshot.cold.mcpSnapshot).toEqual(expect.objectContaining({
      status: 'unavailable',
      entries: [],
    }));
    expect(snapshot.metadata).toEqual(expect.objectContaining({
      source: 'McpRuntimeService.readSnapshot',
      status: 'unavailable',
      mcpAvailable: false,
      trustSummary: {
        trusted: 0,
        safe: 0,
        quarantined: 0,
      },
      toolExposureGatedByMcpSnapshot: false,
    }));
  });

  it('adapts McpRuntimeService.readSnapshot output without leaking command args into entries', () => {
    const readSnapshot = jest.fn(() => createMcpRuntimeSnapshot());
    const assembler = new McpSnapshotAssembler();

    const snapshot = assembler.assemble({
      runtime: {
        readSnapshot,
      },
    });

    expect(readSnapshot).toHaveBeenCalled();
    expect(snapshot.status).toBe('degraded');
    expect(snapshot.capabilities).toEqual(['filesystem', 'memory']);
    expect(snapshot.summary).toEqual(expect.objectContaining({
      total: 2,
      connected: 1,
      failed: 1,
      toolCount: 2,
    }));
    expect(snapshot.trustSummary).toEqual({
      trusted: 0,
      safe: 1,
      quarantined: 1,
    });
    expect(snapshot.entries).toEqual([
      expect.objectContaining({
        id: 'filesystem',
        capability: 'filesystem',
        enabled: true,
        status: 'connected',
        toolCount: 2,
        toolNames: ['read_file', 'list_directory'],
        trustState: 'safe',
        quarantined: false,
        lastError: null,
      }),
      expect.objectContaining({
        id: 'mnemos',
        capability: 'memory',
        enabled: true,
        status: 'failed',
        toolCount: 0,
        toolNames: [],
        trustState: 'quarantined',
        quarantined: true,
        lastError: 'connection refused',
      }),
    ]);
    expect(snapshot.cold.mcpSnapshot).toEqual(expect.objectContaining({
      status: 'degraded',
      capabilities: ['filesystem', 'memory'],
    }));
    expect(snapshot.metadata).toEqual(expect.objectContaining({
      mcpAvailable: true,
      trustSummary: {
        trusted: 0,
        safe: 1,
        quarantined: 1,
      },
      toolExposureGatedByMcpSnapshot: false,
    }));
  });

  it('marks trusted, safe and quarantined MCP entries in the run snapshot', () => {
    const assembler = new McpSnapshotAssembler();

    const snapshot = assembler.assemble({
      snapshot: createMcpRuntimeSnapshot({
        summary: {
          total: 3,
          enabled: 3,
          connected: 2,
          failed: 1,
          disabled: 0,
          stopped: 0,
          toolCount: 3,
        },
        capabilities: ['core', 'filesystem', 'memory'],
        entries: [
          {
            id: 'zavorth-core',
            capability: 'core',
            enabled: true,
            status: 'connected',
            toolCount: 1,
            toolNames: ['runtime_status'],
            command: 'node',
            args: ['core.js'],
            lastAttemptedAt: null,
            lastConnectedAt: '2026-04-27T12:00:00.000Z',
            lastError: null,
          },
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
          {
            id: 'imported-draft',
            capability: 'experimental',
            enabled: true,
            status: 'failed',
            toolCount: 1,
            toolNames: ['unsafe_remote_tool'],
            command: 'node',
            args: ['draft.js'],
            lastAttemptedAt: '2026-04-27T11:59:00.000Z',
            lastConnectedAt: null,
            lastError: 'review required',
          },
        ],
      }),
    });

    expect(snapshot.trustSummary).toEqual({
      trusted: 1,
      safe: 1,
      quarantined: 1,
    });
    expect(snapshot.entries.map((entry) => [entry.id, entry.trustState, entry.quarantined])).toEqual([
      ['zavorth-core', 'trusted', false],
      ['filesystem', 'safe', false],
      ['imported-draft', 'quarantined', true],
    ]);
    expect(snapshot.cold.mcpSnapshot).toEqual(expect.objectContaining({
      trustSummary: snapshot.trustSummary,
      riskReports: expect.arrayContaining([
        expect.objectContaining({
          id: 'imported-draft',
          toolNames: ['unsafe_remote_tool'],
          trustState: 'quarantined',
        }),
      ]),
    }));
    expect(snapshot.metadata.trustSummary).toEqual(snapshot.trustSummary);
    expect(snapshot.metadata.riskReports).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'mcp',
        id: 'imported-draft',
        toolNames: ['unsafe_remote_tool'],
        trustState: 'quarantined',
      }),
    ]));
  });

  it('feeds canonical cold context without becoming a tool exposure gate', () => {
    const mcpAssembler = new McpSnapshotAssembler();
    const canonicalAssembler = new CanonicalSessionContextAssembler();
    const mcpSnapshot = mcpAssembler.assemble({
      snapshot: createMcpRuntimeSnapshot({
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
      }),
    });

    const snapshot = canonicalAssembler.assemble({
      sessionId: 'web:mcp-context',
      channel: 'web',
      profile: 'cold',
      hot: {
        continuityPrompt: 'Continuidade recente.',
      },
      warm: {
        workspacePrompt: 'Workspace carregado.',
      },
      cold: {
        ...mcpSnapshot.cold,
      },
    });

    expect(snapshot.profile).toEqual(expect.objectContaining({
      depth: 'cold',
      includeWarm: true,
      includeCold: true,
      gatesToolExposure: false,
    }));
    expect(snapshot.mcpSnapshot).toEqual(expect.objectContaining({
      status: 'available',
      capabilities: ['filesystem'],
    }));
    expect(snapshot.cold?.metadata).toEqual(expect.objectContaining({
      trustSummary: {
        trusted: 0,
        safe: 1,
        quarantined: 0,
      },
      toolExposureGatedByMcpSnapshot: false,
    }));
    expect(snapshot.metadata.toolExposureGatedByContextProfile).toBe(false);
  });

  it('keeps readSnapshot failures as failed snapshots instead of failing the run context', () => {
    const assembler = new McpSnapshotAssembler();

    const snapshot = assembler.assemble({
      runtime: {
        readSnapshot: () => {
          throw new Error('snapshot unavailable');
        },
      },
    });

    expect(snapshot.status).toBe('failed');
    expect(snapshot.cold.mcpSnapshot).toEqual(expect.objectContaining({
      status: 'failed',
      entries: [],
      error: 'snapshot unavailable',
    }));
    expect(snapshot.metadata).toEqual(expect.objectContaining({
      source: 'McpRuntimeService.readSnapshot',
      status: 'failed',
      error: 'snapshot unavailable',
      mcpAvailable: false,
      trustSummary: {
        trusted: 0,
        safe: 0,
        quarantined: 0,
      },
      toolExposureGatedByMcpSnapshot: false,
    }));
  });
});
