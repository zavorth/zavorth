import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZavorthRuntimeStateBusService } from '../../src/services/ZavorthRuntimeStateBusService.js';

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-runtime-state-bus-'));
}

describe('ZavorthRuntimeStateBusService', () => {
  it('persists effort, model and workspace as replayable runtime state', () => {
    const root = makeRoot();
    const workspace = path.join(root, 'workspace');
    fs.mkdirSync(workspace, { recursive: true });
    const stateFilePath = path.join(root, 'runtime-state.json');
    const service = new ZavorthRuntimeStateBusService({
      stateFilePath,
      allowedWorkspaceRoots: [root],
      now: () => new Date('2026-06-09T10:00:00.000Z'),
    });

    service.dispatch({
      type: 'set-effort',
      approved: true,
      source: 'zavorth-desktop',
      payload: { effort: 'ultra' },
    });
    service.dispatch({
      type: 'set-model',
      approved: true,
      source: 'zavorth-desktop',
      connectedModelIds: ['zavorth:core', 'openai:gpt-5'],
      payload: { model: 'openai:gpt-5' },
    });
    const workspaceResult = service.dispatch({
      type: 'set-workspace',
      approved: true,
      source: 'zavorth-desktop',
      payload: {
        workspace: {
          id: 'folder:test',
          label: 'workspace',
          kind: 'folder',
          path: workspace,
        },
      },
    });

    expect(workspaceResult.ok).toBe(true);
    expect(workspaceResult.receipt.safety.pathValidated).toBe(true);

    const restored = new ZavorthRuntimeStateBusService({
      stateFilePath,
      allowedWorkspaceRoots: [root],
      now: () => new Date('2026-06-09T10:01:00.000Z'),
    }).buildSnapshot();

    expect(restored.restoredFromDisk).toBe(true);
    expect(restored.state.effort.level).toBe('ultra-code');
    expect(restored.state.model.id).toBe('openai:gpt-5');
    expect(restored.projections.commandBar.connectedModelIds).toEqual(['zavorth:core', 'openai:gpt-5']);
    expect(restored.state.workspace.path).toBe(path.resolve(workspace));
    expect(restored.replay.receiptCount).toBeGreaterThanOrEqual(3);
    expect(restored.projections.lifecycle.everyImportantActionRequiresReceipt).toBe(true);
  });

  it('blocks disconnected models before mutating state', () => {
    const root = makeRoot();
    const service = new ZavorthRuntimeStateBusService({
      stateFilePath: path.join(root, 'runtime-state.json'),
    });

    const result = service.dispatch({
      type: 'set-model',
      approved: true,
      connectedModelIds: ['zavorth:core'],
      payload: { model: 'anthropic:claude-opus' },
    });

    expect(result.ok).toBe(false);
    expect(result.applied).toBe(false);
    expect(result.error).toBe('model_not_connected:anthropic:claude-opus');
    expect(result.snapshot.state.model.id).toBe('zavorth:core');
  });

  it('blocks workspace paths outside allowed roots', () => {
    const root = makeRoot();
    const allowed = path.join(root, 'allowed');
    const outside = path.join(root, 'outside');
    fs.mkdirSync(allowed, { recursive: true });
    fs.mkdirSync(outside, { recursive: true });
    const service = new ZavorthRuntimeStateBusService({
      stateFilePath: path.join(root, 'runtime-state.json'),
      allowedWorkspaceRoots: [allowed],
    });

    const result = service.dispatch({
      type: 'set-workspace',
      source: 'api',
      approved: true,
      payload: {
        workspace: {
          id: 'folder:escape',
          kind: 'folder',
          path: path.join(allowed, '..', 'outside'),
        },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('workspace_path_outside_allowed_roots');
    expect(result.receipt.status).toBe('blocked');
    expect(result.snapshot.state.workspace.path).toBeNull();
  });

  it('blocks sensitive workspace folders even when they are under an allowed root', () => {
    const root = makeRoot();
    const sensitive = path.join(root, '.ssh');
    fs.mkdirSync(sensitive, { recursive: true });
    const service = new ZavorthRuntimeStateBusService({
      stateFilePath: path.join(root, 'runtime-state.json'),
      allowedWorkspaceRoots: [root],
    });

    const result = service.dispatch({
      type: 'set-workspace',
      source: 'api',
      approved: true,
      payload: {
        workspace: {
          id: 'folder:sensitive',
          kind: 'folder',
          path: sensitive,
        },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('workspace_path_sensitive_blocked');
    expect(result.snapshot.state.workspace.path).toBeNull();
  });

  it('blocks workspace symlinks or junctions that escape the allowed root', () => {
    const root = makeRoot();
    const allowed = path.join(root, 'allowed');
    const outside = path.join(root, 'outside');
    const link = path.join(allowed, 'linked-outside');
    fs.mkdirSync(allowed, { recursive: true });
    fs.mkdirSync(outside, { recursive: true });
    try {
      fs.symlinkSync(outside, link, 'junction');
    } catch {
      return;
    }
    const service = new ZavorthRuntimeStateBusService({
      stateFilePath: path.join(root, 'runtime-state.json'),
      allowedWorkspaceRoots: [allowed],
    });

    const result = service.dispatch({
      type: 'set-workspace',
      source: 'api',
      approved: true,
      payload: {
        workspace: {
          id: 'folder:symlink',
          kind: 'folder',
          path: link,
        },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('workspace_path_outside_allowed_roots');
    expect(result.snapshot.state.workspace.path).toBeNull();
  });

  it('redacts secrets and prevents caller-provided receipt spoofing', () => {
    const root = makeRoot();
    const service = new ZavorthRuntimeStateBusService({
      stateFilePath: path.join(root, 'runtime-state.json'),
      idFactory: (prefix) => `${prefix}-trusted`,
    });

    const result = service.dispatch({
      type: 'sync-command',
      approved: true,
      source: 'test',
      payload: {
        metadata: {
          receiptId: 'runtime-receipt-forged',
          secret: 'runtime-fixture-sensitive-value',
        },
      },
    });

    expect(result.receipt.id).toBe('runtime-receipt-trusted');
    expect(JSON.stringify(result.receipt.metadata)).not.toContain('runtime-fixture-sensitive-value');
    expect(result.receipt.safety.receiptSpoofingPrevented).toBe(true);
  });

  it('does not trust spoofed desktop metadata as approval', () => {
    const root = makeRoot();
    const workspace = path.join(root, 'workspace');
    fs.mkdirSync(workspace, { recursive: true });
    const service = new ZavorthRuntimeStateBusService({
      stateFilePath: path.join(root, 'runtime-state.json'),
      allowedWorkspaceRoots: [root],
    });

    const snapshot = service.syncExperienceCommand({
      surface: 'api',
      userId: 'desktop-user',
      sessionId: 'desktop-main',
      text: 'use the big route',
      metadata: {
        client: 'zavorth-desktop',
        trustedDesktopBridge: true,
        effort: 'ultra',
        workspace: {
          id: 'folder:test',
          label: 'workspace',
          kind: 'folder',
          path: workspace,
        },
      },
    });

    expect(snapshot.state.effort.level).toBe('standard');
    expect(snapshot.state.workspace.path).toBeNull();
    expect(snapshot.receipts.some((receipt) => receipt.status === 'pending-approval')).toBe(true);
  });

  it('operates runtime domains with receipts and approval gating', () => {
    const root = makeRoot();
    const service = new ZavorthRuntimeStateBusService({
      stateFilePath: path.join(root, 'runtime-state.json'),
    });

    const syncResult = service.dispatch({
      type: 'operate-domain',
      approved: true,
      payload: {
        domain: {
          domain: 'gateway',
          operation: 'sync',
        },
      },
    });
    expect(syncResult.ok).toBe(true);
    expect(syncResult.snapshot.state.gateway.status).toBe('ready');
    expect(syncResult.receipt.preview.mutation).toBe('sync gateway');

    const restartResult = service.dispatch({
      type: 'operate-domain',
      approved: false,
      payload: {
        domain: {
          domain: 'gateway',
          operation: 'restart',
        },
      },
    });
    expect(restartResult.ok).toBe(true);
    expect(restartResult.applied).toBe(false);
    expect(restartResult.receipt.status).toBe('pending-approval');
    expect(restartResult.snapshot.state.gateway.status).toBe('ready');
  });

  it('projects best-of governed runtime surfaces by default', () => {
    const root = makeRoot();
    const service = new ZavorthRuntimeStateBusService({
      stateFilePath: path.join(root, 'runtime-state.json'),
      now: () => new Date('2026-06-10T10:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.projections.capabilities.summary).toMatchObject({
      available: expect.any(Number),
      blocked: expect.any(Number),
      configurable: expect.any(Number),
      pending: expect.any(Number),
    });
    expect(snapshot.projections.permissionsMatrix.domains.filesystem.actions.write.requiresApproval).toBe(true);
    expect(snapshot.projections.permissionsMatrix.domains.chat.actions.read.default).toBe('allow');
    expect(snapshot.projections.modelSpecs.selectedSpecId).toBe('daily');
    expect(snapshot.projections.modelSpecs.specs.map((spec) => spec.id)).toEqual([
      'daily',
      'coding',
      'research',
      'local-private',
      'budget',
    ]);
    expect(snapshot.projections.dynamicRouting.selected.modelId).toBe('zavorth:core');
    expect(snapshot.projections.workspaceKnowledge.untrustedContextWrapping).toBe(true);
    expect(snapshot.projections.personalOps.connectors.every((connector) => connector.status === 'disabled')).toBe(true);
    expect(snapshot.projections.mcpTrust.policy.externalServersRequireTrust).toBe(true);
    expect(snapshot.projections.skillHistory.entries).toEqual([]);
    expect(snapshot.projections.streamSession.resumable).toBe(true);
    expect(snapshot.projections.safety.rawSecretsSerialized).toBe(false);
    expect(JSON.stringify(snapshot.projections)).not.toContain('should-never-leak');
  });

  it('applies model specs, routing, network policy, personal connectors, MCP trust and stream state with receipts', () => {
    const root = makeRoot();
    const service = new ZavorthRuntimeStateBusService({
      stateFilePath: path.join(root, 'runtime-state.json'),
      now: () => new Date('2026-06-10T10:00:00.000Z'),
    });

    expect(service.dispatch({
      type: 'select-model-spec',
      approved: true,
      payload: { modelSpec: { id: 'coding' } },
    }).snapshot.state.modelSpec.selectedSpecId).toBe('coding');

    const routeResult = service.dispatch({
      type: 'route-model',
      approved: true,
      connectedModelIds: ['zavorth:core', 'openai:gpt-5'],
      payload: {
        dynamicRouting: {
          intent: 'coding',
          modelId: 'openai:gpt-5',
          providerId: 'openai',
          fallbackModelIds: ['zavorth:core'],
          estimatedCost: 'medium',
          risk: 'medium',
        },
      },
    });
    expect(routeResult.ok).toBe(true);
    expect(routeResult.snapshot.state.model.id).toBe('openai:gpt-5');
    expect(routeResult.snapshot.state.dynamicRouting.selected.reason).toContain('coding');

    const blockedNetwork = service.dispatch({
      type: 'set-provider-connection',
      approved: true,
      payload: {
        providerConnection: {
          providerId: 'internal-test',
          targetUrl: 'http://169.254.169.254/latest/meta-data',
        },
      },
    });
    expect(blockedNetwork.ok).toBe(false);
    expect(blockedNetwork.error).toBe('network_target_blocked');

    const personal = service.dispatch({
      type: 'register-personal-connector',
      approved: true,
      payload: {
        personalConnector: {
          id: 'email:primary',
          kind: 'email',
          label: 'Primary email',
          configured: true,
        },
      },
    });
    expect(personal.snapshot.projections.personalOps.connectors.find((entry) => entry.id === 'email:primary')).toMatchObject({
      status: 'configured',
      sendRequiresApproval: true,
    });
    expect(personal.snapshot.state.context.status).toBe('ready');

    const mcp = service.dispatch({
      type: 'set-mcp-trust',
      approved: true,
      payload: {
        mcpTrust: {
          id: 'mcp:filesystem',
          label: 'Filesystem MCP',
          origin: 'local',
          trustState: 'review',
          toolNames: ['read_file', 'write_file'],
        },
      },
    });
    expect(mcp.snapshot.projections.mcpTrust.servers[0]).toMatchObject({
      id: 'mcp:filesystem',
      trustState: 'review',
      exposedToModel: false,
    });

    const stream = service.dispatch({
      type: 'resume-stream',
      approved: true,
      payload: {
        streamSession: {
          sessionId: 'desktop-main',
          status: 'resumable',
          resumeToken: 'stream-token-1',
        },
      },
    });
    expect(stream.snapshot.projections.streamSession.resumeToken).toBe('stream-token-1');
    expect(stream.receipt.status).toBe('applied');
  });
});
