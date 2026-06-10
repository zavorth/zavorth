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
});
