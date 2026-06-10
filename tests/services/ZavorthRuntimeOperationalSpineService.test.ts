import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZavorthRuntimeOperationalSpineService } from '../../src/services/ZavorthRuntimeOperationalSpineService.js';
import { ZavorthRuntimeStateBusService } from '../../src/services/ZavorthRuntimeStateBusService.js';

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-runtime-spine-'));
}

describe('ZavorthRuntimeOperationalSpineService', () => {
  it('publishes provider, workspace, MCP, scheduler and session services into the runtime bus', async () => {
    const root = makeRoot();
    const workspace = path.join(root, 'workspace');
    fs.mkdirSync(workspace, { recursive: true });
    const runtimeStateBus = new ZavorthRuntimeStateBusService({
      stateFilePath: path.join(root, 'runtime-state.json'),
      allowedWorkspaceRoots: [root],
      now: () => new Date('2026-06-10T12:00:00.000Z'),
    });
    const service = new ZavorthRuntimeOperationalSpineService({
      now: () => new Date('2026-06-10T12:00:00.000Z'),
      runtimeStateBus,
      providerCatalog: {
        buildSnapshot: async () => ({
          activeProvider: 'openai',
          activeModel: 'gpt-5',
          providers: [
            {
              id: 'openai',
              label: 'OpenAI',
              status: 'ready',
              defaultRouteAllowed: true,
              liveReady: true,
              catalogReady: true,
              model: 'gpt-5',
              modelSample: ['gpt-5', 'gpt-4.1'],
              defaultBlockReason: null,
              issue: null,
              userAction: 'ready',
              testCommand: 'zavorth providers test openai',
            },
            {
              id: 'anthropic',
              label: 'Anthropic',
              status: 'needs_credentials',
              defaultRouteAllowed: false,
              liveReady: false,
              catalogReady: true,
              model: null,
              modelSample: ['claude-sonnet'],
              defaultBlockReason: 'missing credentials',
              issue: 'missing credentials',
              userAction: 'configure credentials',
              testCommand: 'zavorth providers test anthropic',
            },
          ],
        }),
      },
      schedulerSurface: {
        list: () => ({
          status: 'completed',
          summary: '1 agendamento encontrado.',
          tasks: [
            {
              id: 'task-running',
              shortId: 'task',
              command: '/status',
              schedule: 'every 1h',
              status: 'running',
              nextRun: null,
              lastRun: '2026-06-10T11:59:00.000Z',
              governed: true,
              approvalId: 'approval-task',
              surface: 'desktop',
            },
            {
              id: 'task-orphan',
              shortId: 'orph',
              command: '/review',
              schedule: 'every 1d',
              status: 'orphaned',
              nextRun: null,
              lastRun: '2026-06-09T11:59:00.000Z',
              governed: true,
              approvalId: 'approval-orphan',
              surface: 'desktop',
            },
          ],
        }),
      },
      mcpPolicy: {
        readPolicy: () => ({
          version: 1,
          updatedAt: '2026-06-10T11:00:00.000Z',
          profile: 'safe',
          allowlist: ['read_file'],
        }),
      },
      workspacePolicy: {
        list: () => [
          {
            id: 'tw:workspace',
            path: workspace,
            label: 'Workspace',
            state: 'trusted',
            createdAt: '2026-06-10T11:00:00.000Z',
            updatedAt: '2026-06-10T11:00:00.000Z',
          },
        ],
      },
      sessionPlane: {
        buildStatusSummary: async () => ({
          generatedAt: '2026-06-10T12:00:00.000Z',
          summary: {
            sessions: 2,
            historyItems: 8,
            sendReady: true,
            spawnReady: true,
          },
          narrative: {
            headline: 'Session plane ready',
            operatorSummary: 'Two sessions restored.',
          },
        }),
      },
    });

    const result = await service.syncOperationalState({
      userId: 'desktop-user',
      sessionId: 'desktop-main',
      workspacePath: workspace,
    });

    expect(result.ok).toBe(true);
    expect(result.summary.providerConnections).toBe(2);
    expect(result.summary.recoverableJobs).toBe(1);
    const snapshot = runtimeStateBus.buildSnapshot();
    expect(snapshot.projections.dynamicRouting.providerConnections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'openai',
        status: 'configured',
      }),
      expect.objectContaining({
        id: 'anthropic',
        status: 'needs-setup',
      }),
    ]));
    expect(snapshot.projections.commandBar.connectedModelIds).toEqual(expect.arrayContaining([
      'openai:gpt-5',
      'openai:gpt-4.1',
    ]));
    expect(snapshot.projections.workspaceKnowledge.trustedWorkspaceIds).toContain('tw:workspace');
    expect(snapshot.projections.mcpTrust.servers[0]).toMatchObject({
      id: 'mcp:policy:safe',
      trustState: 'review',
      exposedToModel: false,
    });
    expect(snapshot.projections.streamSession).toMatchObject({
      sessionId: 'desktop-main',
      status: 'resumable',
      resumable: true,
    });
    expect(snapshot.state.cron.summary).toContain('1 orphaned scheduled job');
  });

  it('keeps sensitive runtime actions in preview until approval and records learning receipts after execution', async () => {
    const root = makeRoot();
    const runtimeStateBus = new ZavorthRuntimeStateBusService({
      stateFilePath: path.join(root, 'runtime-state.json'),
      now: () => new Date('2026-06-10T12:00:00.000Z'),
    });
    const remembered: unknown[] = [];
    const service = new ZavorthRuntimeOperationalSpineService({
      now: () => new Date('2026-06-10T12:00:00.000Z'),
      runtimeStateBus,
      memoryLearning: {
        remember: async (input: unknown) => {
          remembered.push(input);
          return {
            id: 'memory-receipt-1',
            decision: 'accepted',
          };
        },
      },
    });

    const preview = service.previewRuntimeAction({
      type: 'operate-domain',
      source: 'test',
      payload: {
        domain: {
          domain: 'gateway',
          operation: 'restart',
        },
      },
    });

    expect(preview.status).toBe('pending-approval');
    expect(preview.applied).toBe(false);
    expect(runtimeStateBus.buildSnapshot().state.gateway.status).toBe('offline');

    const rejected = await service.approveRuntimeAction(preview.previewId, 'reject');
    expect(rejected.status).toBe('rejected');
    expect(runtimeStateBus.buildSnapshot().state.gateway.status).toBe('offline');

    const approvedPreview = service.previewRuntimeAction({
      type: 'operate-domain',
      source: 'test',
      payload: {
        domain: {
          domain: 'gateway',
          operation: 'restart',
        },
      },
    });
    const approved = await service.approveRuntimeAction(approvedPreview.previewId, 'approve');
    const executed = await service.executeRuntimeAction(approved.approvalId);

    expect(executed.status).toBe('executed');
    expect(runtimeStateBus.buildSnapshot().state.gateway.status).toBe('running');
    expect(remembered.length).toBe(1);
    expect(JSON.stringify(runtimeStateBus.buildSnapshot())).toContain('memory-receipt-1');
  });
});
