import * as http from 'http';
import { WebAppRuntimeInteractionRouteService } from '../../src/domain/surface/presentation/web-app/WebAppRuntimeInteractionRouteService.js';
import type { WebAppRuntimeRouteDeps } from '../../src/domain/surface/presentation/web-app/WebAppRuntimeRouteService.js';

describe('WebAppRuntimeInteractionRouteService', () => {
  it('routes dedicated session commands to the canonical command backend', async () => {
    const service = new WebAppRuntimeInteractionRouteService();
    const handleSessionCommand = jest.fn(async () => true);
    const handled = await service.handleRequest(
      { method: 'POST' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/session/status'),
      '/api/web/session/status',
      {} as WebAppRuntimeRouteDeps,
      {
        handleSessionCommand,
      } as any,
    );

    expect(handled).toBe(true);
    expect(handleSessionCommand).toHaveBeenCalledTimes(1);
  });

  it('allows safe session commands over GET but requires POST for mutating commands', async () => {
    const service = new WebAppRuntimeInteractionRouteService();
    const handleSessionCommand = jest.fn(async () => true);
    const writeJson = jest.fn();
    const deps = { writeJson } as unknown as WebAppRuntimeRouteDeps;

    const safeHandled = await service.handleRequest(
      { method: 'GET' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/session/status'),
      '/api/web/session/status',
      deps,
      { handleSessionCommand } as any,
    );

    expect(safeHandled).toBe(true);
    expect(handleSessionCommand).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'status',
    );

    handleSessionCommand.mockClear();

    const mutatingHandled = await service.handleRequest(
      { method: 'GET' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/session/model-args=openai/gpt-5.5'),
      '/api/web/session/model',
      deps,
      { handleSessionCommand } as any,
    );

    expect(mutatingHandled).toBe(true);
    expect(handleSessionCommand).not.toHaveBeenCalled();
    expect(writeJson).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        ok: false,
        error: 'Session command model requires POST.',
        rawSecretsSerialized: false,
      }),
      405,
    );
  });

  it('serves tool run cards and diff payloads for the session artifact plane', async () => {
    const service = new WebAppRuntimeInteractionRouteService();
    const writeJson = jest.fn();
    const sessionId = 'session-web-1';
    const toolRun = {
      runId: 'task-task-1-01-apply-patch',
      toolName: 'apply_patch',
      filesTouched: ['C:/repo/src/app.ts'],
      artifacts: [{ id: 'artifact-1', name: 'patch.diff' }],
      diff: {
        summary: 'Patch aplicado.',
        patches: [{ path: 'C:/repo/src/app.ts', diff: '@@\n+ok\n', summary: null }],
      },
    };
    const deps: WebAppRuntimeRouteDeps = {
      realtime: {
        getResolvedSnapshot: jest.fn(async () => ({
          toolRuns: [toolRun],
        })),
      } as any,
      resolveSessionId: jest.fn(() => sessionId),
      writeJson,
    } as any;

    const handledList = await service.handleRequest(
      { method: 'GET' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL(`http://localhost/api/web/tool-runs-sessionId=${sessionId}`),
      '/api/web/tool-runs',
      deps,
      {} as any,
    );

    expect(handledList).toBe(true);
    expect(writeJson).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        ok: true,
        toolRuns: [toolRun],
        filesTouched: ['C:/repo/src/app.ts'],
      }),
      200,
    );

    writeJson.mockClear();

    const handledDiff = await service.handleRequest(
      { method: 'GET' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL(`http://localhost/api/web/tool-runs/${encodeURIComponent(toolRun.runId)}/diff-sessionId=${sessionId}`),
      `/api/web/tool-runs/${encodeURIComponent(toolRun.runId)}/diff`,
      deps,
      {} as any,
    );

    expect(handledDiff).toBe(true);
    expect(writeJson).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        ok: true,
        runId: toolRun.runId,
        diff: toolRun.diff,
      }),
      200,
    );
  });

  it('lists real artifacts from tool runs and universal agent runs', async () => {
    const service = new WebAppRuntimeInteractionRouteService();
    const writeJson = jest.fn();
    const sessionId = 'session-web-artifacts';
    const toolRun = {
      runId: 'tool-run-1',
      summary: 'Patch aplicado.',
      filesTouched: ['C:/repo/src/app.ts'],
      artifacts: [
        {
          id: 'artifact-report-1',
          name: 'report.md',
          path: 'artifacts/report.md',
          summary: 'Report textual gerado.',
        },
      ],
      diff: {
        summary: '1 file alterado.',
        patches: [{ path: 'C:/repo/src/app.ts', diff: '@@\n+ok\n' }],
      },
    };
    const agentRun = {
      id: 'agent-run-1',
      sessionId,
      summary: 'Execution completed.',
      artifacts: [
        {
          id: 'agent-run-report',
          title: 'Resumo final',
          kind: 'report',
          status: 'ready',
          createdAt: '2026-04-26T10:00:00.000Z',
        },
      ],
    };
    const deps: WebAppRuntimeRouteDeps = {
      realtime: {
        getResolvedSnapshot: jest.fn(async () => ({
          toolRuns: [toolRun],
        })),
      } as any,
      agentGateway: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-26T10:00:00.000Z',
          runs: [agentRun],
        })),
      } as any,
      resolveSessionId: jest.fn(() => sessionId),
      writeJson,
    } as any;

    const handled = await service.handleRequest(
      { method: 'GET' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL(`http://localhost/api/web/artifacts-sessionId=${sessionId}`),
      '/api/web/artifacts',
      deps,
      {} as any,
    );

    expect(handled).toBe(true);
    expect(deps.agentGateway?.buildSnapshot).toHaveBeenCalledWith({
      activeSessionId: sessionId,
    });
    expect(writeJson).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        ok: true,
        sessionId,
        artifacts: expect.arrayContaining([
          expect.objectContaining({
            id: 'artifact-report-1',
            source: 'tool-run',
            path: 'artifacts/report.md',
          }),
          expect.objectContaining({
            id: `file:${toolRun.runId}:C:/repo/src/app.ts`,
            source: 'file',
            kind: 'file',
          }),
          expect.objectContaining({
            id: `diff:${toolRun.runId}`,
            kind: 'diff',
          }),
          expect.objectContaining({
            id: 'agent-run-report',
            source: 'agent-run',
            runId: 'agent-run-1',
          }),
        ]),
      }),
      200,
    );
  });

  it('approves a permission and returns a refreshed snapshot', async () => {
    const service = new WebAppRuntimeInteractionRouteService();
    const writeJson = jest.fn();
    const permission = { id: 'perm-1' };
    const deps: WebAppRuntimeRouteDeps = {
      runtime: {
        permissionController: {
          resolvePermissionReference: jest.fn(async () => permission),
          shortPermissionId: jest.fn(() => 'perm-1'),
          handlePermissionCallback: jest.fn(async () => undefined),
        },
      } as any,
      realtime: {
        captureBaseline: jest.fn(async () => undefined),
        getResolvedSnapshot: jest.fn(async () => ({ sessionId: 'session-web-1' })),
      } as any,
      resolveSessionIdFromPermission: jest.fn(async () => 'session-web-1'),
      createWebContext: jest.fn(() => ({ surface: 'web' })),
      readJsonBody: jest.fn(async () => ({ permissionId: 'perm-1', scope: 'session' })),
      writeJson,
    } as any;

    const handled = await service.handleRequest(
      { method: 'POST' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/permissions/approve'),
      '/api/web/permissions/approve',
      deps,
      {} as any,
    );

    expect(handled).toBe(true);
    expect(deps.runtime.permissionController.handlePermissionCallback).toHaveBeenCalledWith(
      { surface: 'web' },
      'perm:approve:perm-1:session',
    );
    expect(writeJson).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        ok: true,
        snapshot: expect.objectContaining({
          sessionId: 'session-web-1',
        }),
      }),
      200,
    );
  });

  it('approves a universal agent run and returns the refreshed gateway snapshot', async () => {
    const service = new WebAppRuntimeInteractionRouteService();
    const writeJson = jest.fn();
    const run = {
      id: 'run-1',
      sessionId: 'session-web-1',
      title: 'Compare folder',
      status: 'queued',
      approvals: [
        {
          id: 'approval-1',
          runId: 'run-1',
          title: 'Autorizar tools',
          status: 'approved',
        },
      ],
    };
    const workflowJob = {
      id: 'run-1:resume:approval-1',
      runId: 'run-1',
      approvalId: 'approval-1',
      status: 'queued',
    };
    const approve = jest.fn(async () => ({
      ok: true,
      run,
      replies: [
        {
          id: 'reply-1',
          runId: 'run-1',
          text: 'Approval recorded.',
        },
      ],
      approval: run.approvals[0],
      decision: 'approved',
      resumed: false,
      queued: true,
      workflowJob,
      error: null,
    }));
    const buildSnapshot = jest.fn(() => ({
      generatedAt: '2026-04-26T10:00:00.000Z',
      activeRun: run,
      runs: [run],
      workflowJobs: [workflowJob],
      workflowQueue: {
        kind: 'memory',
      },
    }));
    const deps: WebAppRuntimeRouteDeps = {
      agentGateway: {
        approve,
        reject: jest.fn(),
        buildSnapshot,
      } as any,
      readJsonBody: jest.fn(async () => ({
        approvalId: 'approval-1',
        sessionId: 'session-web-1',
      })),
      writeJson,
    } as any;

    const handled = await service.handleRequest(
      { method: 'POST' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/agent-runs/approve'),
      '/api/web/agent-runs/approve',
      deps,
      {} as any,
    );

    expect(handled).toBe(true);
    expect(approve).toHaveBeenCalledWith('approval-1');
    expect(buildSnapshot).toHaveBeenCalledWith({
      activeRunId: 'run-1',
      activeSessionId: 'session-web-1',
    });
    expect(writeJson).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        ok: true,
        requestedDecision: 'approve',
        decision: 'approved',
        queued: true,
        workflowJob,
        snapshot: expect.objectContaining({
          runs: [run],
        }),
      }),
      200,
    );
  });

  it('applies an Intelligence Fabric draft plan through the agent gateway', async () => {
    const service = new WebAppRuntimeInteractionRouteService();
    const writeJson = jest.fn();
    const sourceRun = {
      id: 'run-draft-1',
      traceId: 'trace-draft-1',
      userId: 'ana',
      sessionId: 'session-web-1',
      workspace: 'C:/repo',
      modelProfile: {
        providerId: 'local',
        modelId: 'fast',
      },
    };
    const appliedRun = {
      ...sourceRun,
      id: 'run-draft-apply-1',
      status: 'completed',
      summary: 'Draft applied.',
    };
    const handle = jest.fn(async () => ({
      ok: true,
      run: appliedRun,
      replies: [
        {
          id: 'reply-apply-1',
          runId: appliedRun.id,
          text: 'Draft applied.',
        },
      ],
    }));
    const buildSnapshot = jest.fn((options-: any) => ({
      generatedAt: '2026-04-26T10:00:00.000Z',
      activeRun: options?.activeRunId === appliedRun.id ? appliedRun : sourceRun,
      runs: [sourceRun, appliedRun],
    }));
    const deps: WebAppRuntimeRouteDeps = {
      runtime: {
        webUserId: 'web-owner',
      } as any,
      agentGateway: {
        approve: jest.fn(),
        reject: jest.fn(),
        buildSnapshot,
        handle,
      } as any,
      readJsonBody: jest.fn(async () => ({
        planId: 'plan-risk3-1',
        runId: sourceRun.id,
        sessionId: sourceRun.sessionId,
        approvedBy: 'spoofed-browser-owner',
        confirmOwnerControlledApply: true,
      })),
      writeJson,
    } as any;

    const handled = await service.handleRequest(
      { method: 'POST' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/agent-runs/apply-draft'),
      '/api/web/agent-runs/apply-draft',
      deps,
      {} as any,
    );

    expect(handled).toBe(true);
    expect(handle).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'zavorthControl-apply-draft-plan-risk3-1',
        traceId: 'trace-draft-1',
        userId: 'ana',
        sessionId: 'session-web-1',
        channel: 'web',
        text: 'aplicar draft plan-risk3-1',
        workspace: 'C:/repo',
        metadata: expect.objectContaining({
          intelligenceFabricApplyDraftPlanId: 'plan-risk3-1',
          intelligenceFabricApplyDraftGuidance: true,
          intelligenceFabricApproveDraftPlan: true,
          intelligenceFabricApprovalId: 'zavorthControl:plan-risk3-1',
          zavorthControlApplyDraft: expect.objectContaining({
            source: 'ZavorthControl',
            runId: sourceRun.id,
            sessionId: sourceRun.sessionId,
            confirmOwnerControlledApply: true,
          }),
        }),
      }),
    );
    expect(buildSnapshot).toHaveBeenLastCalledWith({
      activeRunId: appliedRun.id,
      activeSessionId: sourceRun.sessionId,
    });
    expect(writeJson).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        ok: true,
        planId: 'plan-risk3-1',
        run: appliedRun,
        snapshot: expect.objectContaining({
          runs: [sourceRun, appliedRun],
        }),
      }),
      200,
    );
  });

  it('demotes Intelligence Fabric from ZavorthControl with explicit owner confirmation', async () => {
    const service = new WebAppRuntimeInteractionRouteService();
    const writeJson = jest.fn();
    const sourceRun = {
      id: 'run-fabric-health-1',
      traceId: 'trace-fabric-1',
      sessionId: 'session-web-1',
      userId: 'ana',
      workspace: 'C:/repo',
      modelProfile: {
        provider: 'local',
      },
    };
    const demoteRun = {
      ...sourceRun,
      id: 'run-fabric-demote-1',
      status: 'completed',
      summary: 'Fabric desativado por health degradado.',
    };
    const handle = jest.fn(async () => ({
      ok: true,
      run: demoteRun,
      replies: [
        {
          id: 'reply-demote-1',
          runId: demoteRun.id,
          text: 'Fabric desativado.',
        },
      ],
    }));
    const buildSnapshot = jest.fn((options-: any) => ({
      generatedAt: '2026-05-08T10:00:00.000Z',
      activeRun: options?.activeRunId === demoteRun.id ? demoteRun : sourceRun,
      runs: [sourceRun, demoteRun],
    }));
    const deps: WebAppRuntimeRouteDeps = {
      runtime: {
        webUserId: 'web-owner',
      } as any,
      agentGateway: {
        approve: jest.fn(),
        reject: jest.fn(),
        buildSnapshot,
        handle,
      } as any,
      readJsonBody: jest.fn(async () => ({
        runId: sourceRun.id,
        sessionId: sourceRun.sessionId,
        approvedBy: 'spoofed-browser-owner',
        status: 'degraded',
        recommendation: 'auto_demote_controlled',
        rollbackInstruction: 'Set intelligenceFabricMode=default after health recovers.',
        confirmOwnerControlledDemote: true,
      })),
      writeJson,
    } as any;

    const handled = await service.handleRequest(
      { method: 'POST' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/web/agent-runs/demote-fabric'),
      '/api/web/agent-runs/demote-fabric',
      deps,
      {} as any,
    );

    expect(handled).toBe(true);
    expect(handle).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'zavorthControl-demote-fabric',
        traceId: 'trace-fabric-1',
        userId: 'ana',
        sessionId: 'session-web-1',
        channel: 'web',
        text: 'desativar Intelligence Fabric por health degradado',
        workspace: 'C:/repo',
        metadata: expect.objectContaining({
          intelligenceFabricMode: 'disabled',
          intelligenceFabricDemoteControlled: true,
          zavorthControlDemoteFabric: expect.objectContaining({
            source: 'ZavorthControl',
            runId: sourceRun.id,
            sessionId: sourceRun.sessionId,
            status: 'degraded',
            recommendation: 'auto_demote_controlled',
            confirmOwnerControlledDemote: true,
          }),
        }),
      }),
    );
    expect(buildSnapshot).toHaveBeenLastCalledWith({
      activeRunId: demoteRun.id,
      activeSessionId: sourceRun.sessionId,
    });
    expect(writeJson).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        ok: true,
        demote: expect.objectContaining({
          mode: 'disabled',
          appliedTo: 'request',
          globalRuntimeChanged: false,
        }),
        run: demoteRun,
        snapshot: expect.objectContaining({
          runs: [sourceRun, demoteRun],
        }),
      }),
      200,
    );
  });
});
