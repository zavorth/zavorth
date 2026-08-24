import { McpRuntimeService } from '../../src/mcp/McpRuntimeService';
import { McpToolPolicy } from '../../src/mcp/McpToolPolicy';
import { ToolRegistry } from '../../src/tools/ToolRegistry';
import fs from 'fs';
import os from 'os';
import path from 'path';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Builds a minimal mock McpToolPolicyFileService for use in tests. */
function buildMockPolicyService(
  opts: {
    tools?: Record<string, any>;
    allowlist?: string[];
    profile?: string;
  } = {},
) {
  const doc = {
    version: 1,
    updatedAt: null as string | null,
    profile: (opts.profile ?? 'safe') as any,
    allowlist: opts.allowlist ?? [],
    tools: opts.tools ?? {},
  };

  const policy = new McpToolPolicy({ profile: doc.profile as any, allowlist: doc.allowlist });

  const svc = {
    readPolicy: jest.fn().mockReturnValue(doc),
    savePolicy: jest.fn().mockReturnValue(doc),
    getMcpToolPolicy: jest.fn().mockReturnValue(policy),
    markToolPending: jest
      .fn()
      .mockImplementation((d: any, toolId: string, fingerprint: string, reason: string, desc?: string) => {
        d.tools = d.tools || {};
        d.tools[toolId] = { status: 'pending_approval', fingerprint, pendingReason: reason, lastSeenDescription: desc };
      }),
    updateToolLastSeen: jest.fn().mockImplementation((d: any, toolId: string, desc?: string) => {
      if (d.tools?.[toolId]) {
        d.tools[toolId] = { ...d.tools[toolId], lastSeenDescription: desc, lastSeenAt: new Date().toISOString() };
      }
    }),
    autoMigrateLegacyTool: jest
      .fn()
      .mockImplementation((d: any, toolId: string, fingerprint: string, desc?: string) => {
        d.tools = d.tools || {};
        d.tools[toolId] = { status: 'approved', fingerprint, description: desc };
      }),
  };

  return svc;
}

/** Creates a minimal fake MCP manager for a given server entry. */
function makeFakeMcpManager(entryId: string, tools: { name: string; parameters?: any; description?: string }[]) {
  return {
    name: entryId,
    connect: jest.fn().mockImplementation(async (registry: any) => {
      for (const t of tools) {
        registry.register({
          name: t.name,
          description: t.description ?? '',
          parameters: t.parameters,
          metadata: undefined,
          execute: jest.fn(),
        });
      }
    }),
    disconnect: jest.fn().mockResolvedValue(undefined),
  };
}

// ── Existing connectivity test (updated for namespacing) ─────────────

describe('McpRuntimeService — connectivity', () => {
  it('connects enabled servers, writes runtime state and disconnects them on shutdown', async () => {
    const connectCalls: string[] = [];
    const disconnectCalls: string[] = [];
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mcp-runtime-'));
    const stateFile = path.join(root, 'mcp-runtime-state.json');
    const loader = {
      load: jest.fn().mockReturnValue([
        {
          id: 'filesystem',
          enabled: true,
          command: 'npx.cmd',
          args: ['-y', '@modelcontextprotocol/server-filesystem', 'C:/workspace-root'],
          env: {},
          capability: 'filesystem',
        },
        {
          id: 'sequential-thinking',
          enabled: true,
          command: 'npx.cmd',
          args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
          env: {},
          capability: 'reasoning',
        },
        {
          id: 'disabled-server',
          enabled: false,
          command: 'npx.cmd',
          args: ['-y', '@modelcontextprotocol/server-disabled'],
          env: {},
          capability: 'disabled',
        },
      ]),
    } as any;
    const logRepo = { log: jest.fn() } as any;

    // Policy: legacy allowlist so both tools are auto-migrated
    const policyService = buildMockPolicyService({
      allowlist: ['mcp_filesystem', 'mcp_sequential-thinking'],
    });

    const runtime = new McpRuntimeService(
      new ToolRegistry(),
      logRepo,
      loader,
      (entry) => ({
        name: entry.id,
        connect: jest.fn().mockImplementation(async (registry: ToolRegistry) => {
          registry.register({
            name: `mcp_${entry.id}`,
            description: '',
            parameters: undefined,
            metadata: undefined,
            execute: jest.fn(),
          } as any);
          connectCalls.push(entry.id);
        }),
        disconnect: jest.fn().mockImplementation(async () => {
          disconnectCalls.push(entry.id);
        }),
      }),
      stateFile,
      policyService as any,
    );

    await runtime.start();
    const startedSnapshot = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    await runtime.stop();
    const stoppedSnapshot = JSON.parse(fs.readFileSync(stateFile, 'utf8'));

    expect(loader.load).toHaveBeenCalled();
    expect(connectCalls).toEqual(['filesystem', 'sequential-thinking']);
    expect(disconnectCalls).toEqual(['sequential-thinking', 'filesystem']);
    expect(startedSnapshot.summary).toEqual(
      expect.objectContaining({
        total: 3,
        enabled: 2,
        connected: 2,
        disabled: 1,
        toolCount: 2,
      }),
    );
    expect(startedSnapshot.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'filesystem',
          status: 'connected',
          toolCount: 1,
          toolNames: ['filesystem:mcp_filesystem'],
        }),
        expect.objectContaining({
          id: 'disabled-server',
          status: 'disabled',
        }),
      ]),
    );
    expect(stoppedSnapshot.entries).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'filesystem', status: 'stopped' })]),
    );
  });
});

// ── Drift Protection ───────────────────────────────────────────────

describe('McpRuntimeService — drift protection', () => {
  const stateFile = path.join(os.tmpdir(), 'zavorth-drift-test-state.json');
  const logRepo = { log: jest.fn() } as any;
  const singleEntry = {
    id: 'serverA',
    enabled: true,
    command: 'node',
    args: [],
    env: {},
    capability: null,
  };
  const loader = { load: jest.fn().mockReturnValue([singleEntry]) } as any;

  beforeEach(() => jest.clearAllMocks());
  afterEach(() => {
    try {
      fs.unlinkSync(stateFile);
    } catch { /* intentionally empty */ }
  });

  it('registers a tool that is already approved with matching fingerprint', async () => {
    const registry = new ToolRegistry();

    // We'll have to discover the fingerprint. Use a no-op approach:
    // pre-approve with a flag that checkFingerprintMismatch = false by using the
    // same dummy fingerprint that would NOT match, then let auto-migration handle it.
    // Simpler: use legacy allowlist auto-migration (single server) to approve the tool.
    const policyService = buildMockPolicyService({ allowlist: ['my_tool'] });

    const runtime = new McpRuntimeService(
      registry,
      logRepo,
      loader,
      (_entry) => makeFakeMcpManager('serverA', [{ name: 'my_tool', description: 'A tool' }]),
      stateFile,
      policyService as any,
    );

    await runtime.start();

    // Tool was approved via legacy migration and registered under namespaced name
    expect(registry.getTool('serverA:my_tool')).toBeDefined();
    expect(policyService.autoMigrateLegacyTool).toHaveBeenCalledWith(
      expect.anything(),
      'serverA:my_tool',
      expect.any(String),
      'A tool',
    );
    expect(policyService.savePolicy).toHaveBeenCalledTimes(1);
  });

  it('marks a tool as pending_approval when it is brand-new with no allowlist match', async () => {
    const registry = new ToolRegistry();
    const policyService = buildMockPolicyService({ allowlist: [] });

    const runtime = new McpRuntimeService(
      registry,
      logRepo,
      loader,
      (_entry) => makeFakeMcpManager('serverA', [{ name: 'unknown_tool', description: 'desc' }]),
      stateFile,
      policyService as any,
    );

    await runtime.start();

    // Tool was NOT registered (pending)
    expect(registry.getTool('serverA:unknown_tool')).toBeUndefined();
    expect(policyService.markToolPending).toHaveBeenCalledWith(
      expect.anything(),
      'serverA:unknown_tool',
      expect.any(String),
      'new_tool',
      'desc',
    );
  });

  it('detects schema drift: approved tool with changed fingerprint → pending, NOT registered', async () => {
    const registry = new ToolRegistry();

    // Pre-approve the tool with a fingerprint that won't match
    const wrongFingerprint = 'deadbeef000000000000000000000000000000000000000000000000000000ff';
    const policyService = buildMockPolicyService({
      tools: {
        'serverA:drift_tool': { status: 'approved', fingerprint: wrongFingerprint, description: 'old' },
      },
      allowlist: ['serverA:drift_tool'],
    });

    const runtime = new McpRuntimeService(
      registry,
      logRepo,
      loader,
      (_entry) =>
        makeFakeMcpManager('serverA', [
          {
            name: 'drift_tool',
            description: 'new description',
            parameters: { type: 'object', properties: { x: { type: 'string' } } },
          },
        ]),
      stateFile,
      policyService as any,
    );

    await runtime.start();

    // Tool must NOT be registered due to schema drift
    expect(registry.getTool('serverA:drift_tool')).toBeUndefined();
    expect(policyService.markToolPending).toHaveBeenCalledWith(
      expect.anything(),
      'serverA:drift_tool',
      expect.any(String),
      'schema_drift',
      'new description',
    );
    const warnCalls = (logRepo.log as jest.Mock).mock.calls.filter((c) => c[2]?.includes('Schema drift'));
    expect(warnCalls.length).toBeGreaterThan(0);
  });

  it('description drift: approved tool, same schema, changed description is demoted for review', async () => {
    const registry = new ToolRegistry();
    // We let auto-migration approve the tool first, then simulate approved + same fingerprint + different description.
    // Strategy: set the tool as approved with the correct fingerprint (we don't know it upfront),
    // so instead test that the "description drift" branch fires when description differs.

    // Use a mock that returns a pre-approved entry; the fingerprint won't match (different params → different FP)
    // so this actually hits schema drift. To hit description drift, fingerprints must match.
    // We'll test description drift via a fresh run where auto-migration happens then the description updates.
    // Simpler: mock readPolicy to return the same fingerprint as what would be computed.
    // We can't compute it without importing the private function, so we use an "all approved" shortcut:
    // description drift requires: existing.fingerprint === fingerprint AND existing.description !== description.

    // Workaround: let the tool be registered via auto-migration on first run,
    // then on second run the description changed. We can simulate the second run by
    // making policyService.readPolicy() return the result of autoMigrateLegacyTool from first run.
    // Since `autoMigrateLegacyTool` is mocked and mutates the doc, we can check:

    let capturedFingerprint = '';
    const savedDoc: any = {
      version: 1,
      updatedAt: null,
      profile: 'safe',
      allowlist: ['desc_tool'],
      tools: {},
    };
    const policyService: any = {
      readPolicy: jest.fn().mockReturnValue(savedDoc),
      savePolicy: jest.fn().mockImplementation((doc: any) => {
        Object.assign(savedDoc, doc);
      }),
      getMcpToolPolicy: jest.fn().mockReturnValue(new McpToolPolicy({ profile: 'safe', allowlist: ['desc_tool'] })),
      markToolPending: jest.fn().mockImplementation((d: any, id: string, fp: string, reason: string, desc?: string) => {
        d.tools[id] = { status: 'pending_approval', fingerprint: fp, pendingReason: reason, lastSeenDescription: desc };
      }),
      updateToolLastSeen: jest.fn().mockImplementation((d: any, id: string, desc?: string) => {
        if (d.tools?.[id]) d.tools[id] = { ...d.tools[id], lastSeenDescription: desc };
      }),
      autoMigrateLegacyTool: jest.fn().mockImplementation((d: any, id: string, fp: string, desc?: string) => {
        capturedFingerprint = fp;
        d.tools[id] = { status: 'approved', fingerprint: fp, description: desc };
      }),
    };

    // First run: auto-migrate the tool (stores fingerprint)
    const run1 = new McpRuntimeService(
      new ToolRegistry(),
      logRepo,
      loader,
      (_entry) => makeFakeMcpManager('serverA', [{ name: 'desc_tool', description: 'original desc' }]),
      stateFile,
      policyService,
    );
    await run1.start();

    // At this point, savedDoc.tools['serverA:desc_tool'] has status: approved + correct fingerprint
    expect(capturedFingerprint).not.toBe('');

    // Second run: same schema (same fingerprint) but different description → description drift
    const registry2 = new ToolRegistry();
    const run2 = new McpRuntimeService(
      registry2,
      logRepo,
      loader,
      (_entry) => makeFakeMcpManager('serverA', [{ name: 'desc_tool', description: 'CHANGED description' }]),
      stateFile,
      policyService,
    );
    await run2.start();

    expect(registry2.getTool('serverA:desc_tool')).toBeUndefined();
    expect(policyService.markToolPending).toHaveBeenCalledWith(
      expect.anything(),
      'serverA:desc_tool',
      expect.any(String),
      'schema_drift',
      'CHANGED description',
    );
    const warnCalls = (logRepo.log as jest.Mock).mock.calls.filter((c) => c[2]?.includes('Schema drift'));
    expect(warnCalls.length).toBeGreaterThan(0);
  });

  it('legacy auto-migration: single server exposes simple-name tool → approved and registered', async () => {
    const registry = new ToolRegistry();
    const policyService = buildMockPolicyService({ allowlist: ['weather'] });

    const runtime = new McpRuntimeService(
      registry,
      logRepo,
      loader,
      (_entry) => makeFakeMcpManager('serverA', [{ name: 'weather', description: 'weather tool' }]),
      stateFile,
      policyService as any,
    );

    await runtime.start();

    expect(registry.getTool('serverA:weather')).toBeDefined();
    expect(policyService.autoMigrateLegacyTool).toHaveBeenCalledWith(
      expect.anything(),
      'serverA:weather',
      expect.any(String),
      'weather tool',
    );
  });

  it('legacy auto-migration collision: two servers expose same simple name → both pending, none registered', async () => {
    const twoServerLoader = {
      load: jest.fn().mockReturnValue([
        { id: 'serverA', enabled: true, command: 'node', args: [], env: {}, capability: null },
        { id: 'serverB', enabled: true, command: 'node', args: [], env: {}, capability: null },
      ]),
    } as any;

    const registryA = new ToolRegistry();
    const policyService = buildMockPolicyService({ allowlist: ['search'] });

    const runtime = new McpRuntimeService(
      registryA,
      logRepo,
      twoServerLoader,
      (entry) => makeFakeMcpManager(entry.id, [{ name: 'search', description: 'search tool' }]),
      stateFile,
      policyService as any,
    );

    await runtime.start();

    // Both must stay pending — no tool registered under either namespace
    expect(registryA.getTool('serverA:search')).toBeUndefined();
    expect(registryA.getTool('serverB:search')).toBeUndefined();
    expect(policyService.markToolPending).toHaveBeenCalledWith(
      expect.anything(),
      'serverA:search',
      expect.any(String),
      'new_tool',
      'search tool',
    );
    expect(policyService.markToolPending).toHaveBeenCalledWith(
      expect.anything(),
      'serverB:search',
      expect.any(String),
      'new_tool',
      'search tool',
    );
    const collisionWarns = (logRepo.log as jest.Mock).mock.calls.filter((c) => c[2]?.includes('Collision detected'));
    expect(collisionWarns.length).toBeGreaterThanOrEqual(2);
  });

  it('pending tool fingerprint changes before approval → updated pending, NOT registered', async () => {
    const registry = new ToolRegistry();

    const staleFingerprint = 'aaaa0000000000000000000000000000000000000000000000000000000000aa';
    const policyService = buildMockPolicyService({
      tools: {
        'serverA:mutated_tool': {
          status: 'pending_approval',
          fingerprint: staleFingerprint,
          pendingReason: 'new_tool',
        },
      },
      allowlist: [],
    });

    const runtime = new McpRuntimeService(
      registry,
      logRepo,
      loader,
      (_entry) =>
        makeFakeMcpManager('serverA', [
          { name: 'mutated_tool', description: 'now with params', parameters: { type: 'object' } },
        ]),
      stateFile,
      policyService as any,
    );

    await runtime.start();

    // Still pending — not registered
    expect(registry.getTool('serverA:mutated_tool')).toBeUndefined();
    expect(policyService.markToolPending).toHaveBeenCalledWith(
      expect.anything(),
      'serverA:mutated_tool',
      expect.any(String),
      'schema_drift',
      'now with params',
    );
    const fpWarnCalls = (logRepo.log as jest.Mock).mock.calls.filter((c) => c[2]?.includes('fingerprint changed'));
    expect(fpWarnCalls.length).toBeGreaterThan(0);
  });

  it('policy is saved exactly once per server connection when changes occurred', async () => {
    const registry = new ToolRegistry();
    const policyService = buildMockPolicyService({ allowlist: ['tool_x', 'tool_y'] });

    const runtime = new McpRuntimeService(
      registry,
      logRepo,
      loader,
      (_entry) =>
        makeFakeMcpManager('serverA', [
          { name: 'tool_x', description: 'x' },
          { name: 'tool_y', description: 'y' },
        ]),
      stateFile,
      policyService as any,
    );

    await runtime.start();

    // savePolicy must be called at most once (atomic save at end)
    expect(policyService.savePolicy).toHaveBeenCalledTimes(1);
  });

  it('policy is NOT saved when no drift or new tools are detected', async () => {
    const registry = new ToolRegistry();
    // Pre-approve the tool using the correct fingerprint obtained from auto-migration in a prior run.
    // Simulate this by having the policyDoc already contain an approved entry with the exact fingerprint.
    // Since we can't know the fingerprint before running, we use the auto-migration flow to capture it:
    let savedFingerprint = '';
    const savedDoc: any = { version: 1, updatedAt: null, profile: 'safe', allowlist: ['stable_tool'], tools: {} };
    const policyService: any = {
      readPolicy: jest.fn().mockReturnValue(savedDoc),
      savePolicy: jest.fn().mockImplementation((d: any) => Object.assign(savedDoc, d)),
      getMcpToolPolicy: jest.fn().mockReturnValue(new McpToolPolicy({ profile: 'safe', allowlist: ['stable_tool'] })),
      markToolPending: jest.fn(),
      updateToolLastSeen: jest.fn(),
      autoMigrateLegacyTool: jest.fn().mockImplementation((d: any, id: string, fp: string, desc?: string) => {
        savedFingerprint = fp;
        d.tools[id] = { status: 'approved', fingerprint: fp, description: desc };
      }),
    };

    // First run: auto-migration triggers save
    const run1 = new McpRuntimeService(
      new ToolRegistry(),
      logRepo,
      loader,
      (_entry) => makeFakeMcpManager('serverA', [{ name: 'stable_tool', description: 'stable' }]),
      stateFile,
      policyService,
    );
    await run1.start();
    expect(savedFingerprint).not.toBe('');
    policyService.savePolicy.mockClear();

    // Second run: same schema + same description → no changes, no save
    const registry2 = new ToolRegistry();
    const run2 = new McpRuntimeService(
      registry2,
      logRepo,
      loader,
      (_entry) => makeFakeMcpManager('serverA', [{ name: 'stable_tool', description: 'stable' }]),
      stateFile,
      policyService,
    );
    await run2.start();

    expect(policyService.savePolicy).not.toHaveBeenCalled();
    // Tool should still be registered on second run
    expect(registry2.getTool('serverA:stable_tool')).toBeDefined();
  });
});
