import fs from 'fs';
import path from 'path';

import {
  buildDeveloperWorkspaceActionPayload,
  buildDeveloperWorkspaceReadPayload,
  parseDeveloperWorkspaceRouteOptions,
} from '../../src/ai-gateway/app/api/developer-workspace/developerWorkspaceRouteSupport.js';
import {
  DEVELOPER_WORKSPACE_SURFACE_CONTRACT_VERSION,
  type DeveloperWorkspaceSurfaceActionInput,
} from '../../src/domain/surface/application/developer-workspace/index.js';

describe('Developer Workspace surface route', () => {
  const routeRoot = path.resolve(__dirname, '../../src', 'zavorth-control', 'app', 'api', 'developer-workspace');

  it('ships the official read/write route without importing Dashboard internals', () => {
    const routeSource = fs.readFileSync(path.join(routeRoot, 'route.ts'), 'utf8');
    const supportSource = fs.readFileSync(path.join(routeRoot, 'developerWorkspaceRouteSupport.ts'), 'utf8');

    expect(routeSource).toContain('export async function GET');
    expect(routeSource).toContain('export async function POST');
    expect(supportSource).toContain('DeveloperWorkspaceSurfaceService');
    expect(supportSource).not.toContain('dashboard');
  });

  it('parses cwd and manifestPath for local project inspection', () => {
    const request = new Request('http://127.0.0.1:3000/api/developer-workspace?cwd=C:/repo&manifestPath=C:/repo/zavorth.yml');

    expect(parseDeveloperWorkspaceRouteOptions(request)).toEqual({
      cwd: 'C:/repo',
      manifestPath: 'C:/repo/zavorth.yml',
    });
  });

  it('returns a read payload through the presenter contract', () => {
    const payload = buildDeveloperWorkspaceReadPayload({
      service: {
        buildSnapshot: jest.fn(() => ({
          ok: true,
          contractVersion: DEVELOPER_WORKSPACE_SURFACE_CONTRACT_VERSION,
          generatedAt: '2026-05-03T12:00:00.000Z',
          source: 'ProjectWorkspaceService+ProjectProcessSupervisor',
          manifestPath: 'C:/repo/zavorth.yml',
          projectRoot: 'C:/repo',
          project: { name: 'demo', description: 'Demo' },
          policy: { defaultMode: 'suggest', requireApprovalFor: ['process.kill'] },
          summary: { processes: 1, running: 0, failed: 0, idle: 1, hooks: 0, agents: 0, logs: 0 },
          processes: [],
          hooks: [],
          agents: [],
          ptyProfiles: [],
          operations: [],
          warnings: [],
          error: null,
        })),
      } as any,
    });

    expect(payload).toEqual(expect.objectContaining({
      ok: true,
      contractVersion: DEVELOPER_WORKSPACE_SURFACE_CONTRACT_VERSION,
      project: expect.objectContaining({ name: 'demo' }),
    }));
  });

  it('keeps process actions behind the Developer Workspace approval contract', async () => {
    const request = new Request('http://127.0.0.1:3000/api/developer-workspace', {
      method: 'POST',
      body: JSON.stringify({
        action: 'stop',
        processId: 'app',
      } satisfies DeveloperWorkspaceSurfaceActionInput),
    });
    const payload = await buildDeveloperWorkspaceActionPayload(request, {
      service: {
        executeAction: jest.fn((input: DeveloperWorkspaceSurfaceActionInput) => ({
          ok: false,
          httpStatus: 403,
          status: 'approval_required',
          contractVersion: DEVELOPER_WORKSPACE_SURFACE_CONTRACT_VERSION,
          generatedAt: '2026-05-03T12:00:00.000Z',
          operation: {
            id: 'stop',
            label: 'Stop process',
            method: 'POST',
            publicPath: '/api/developer-workspace',
            requiresApproval: true,
            approvalScope: 'process.kill',
            risk: 'sensitive',
            status: 'available',
          },
          approval: {
            required: true,
            satisfied: false,
            approvalId: null,
            approvedBy: null,
            reason: 'developer_workspace_policy',
          },
          processId: input.processId || null,
          message: 'approval required',
          errors: [],
          snapshot: {
            ok: true,
            contractVersion: DEVELOPER_WORKSPACE_SURFACE_CONTRACT_VERSION,
            generatedAt: '2026-05-03T12:00:00.000Z',
            source: 'ProjectWorkspaceService+ProjectProcessSupervisor',
            manifestPath: 'C:/repo/zavorth.yml',
            projectRoot: 'C:/repo',
            project: { name: 'demo', description: 'Demo' },
            policy: { defaultMode: 'suggest', requireApprovalFor: ['process.kill'] },
            summary: { processes: 1, running: 0, failed: 0, idle: 1, hooks: 0, agents: 0, logs: 0 },
            processes: [],
            hooks: [],
            agents: [],
            ptyProfiles: [],
            operations: [],
            warnings: [],
            error: null,
          },
        })),
      } as any,
    });

    expect(payload.httpStatus).toBe(403);
    expect(payload.payload).toEqual(expect.objectContaining({
      status: 'approval_required',
      processId: 'app',
      approval: expect.objectContaining({
        required: true,
        satisfied: false,
      }),
    }));
  });
});
