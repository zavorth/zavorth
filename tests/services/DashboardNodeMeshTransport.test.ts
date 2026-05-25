import { config } from '../../src/config/index.js';
import { DashboardService } from '../../src/services/DashboardService.js';
import {
  createTestLogRepo,
  fetchDashboardJson,
  fetchJson,
} from '../helpers/dashboardWebTestUtils.js';

describe('Dashboard node mesh transport routes', () => {
  const logRepo = createTestLogRepo();
  const originalWebAuthToken = config.zavorthWebAuthToken;

  afterEach(() => {
    config.zavorthWebAuthToken = originalWebAuthToken;
  });

  it('exposes node mesh claim, heartbeat and invoke routes across dashboard and web surfaces', async () => {
    config.zavorthWebAuthToken = 'web-secret';
    const nodeHeartbeatService = {
      claimPairing: jest.fn(() => ({
        claimedAt: '2026-04-02T21:00:00.000Z',
        sharedSecret: 'node-secret',
        heartbeatIntervalMs: 9000,
        operatorSummary: 'Node host pareado.',
        actionHint: 'Continue com heartbeat.',
        assignments: [],
        node: {
          id: 'oracle-node',
          label: 'Oracle Node',
        },
      })),
      receiveHeartbeat: jest.fn(() => ({
        receivedAt: '2026-04-02T21:00:10.000Z',
        node: {
          id: 'oracle-node',
          label: 'Oracle Node',
        },
        heartbeatIntervalMs: 9000,
        operatorSummary: 'Heartbeat recebido.',
        acceptedResults: 1,
        assignments: [],
      })),
    };
    const nodeInvokeService = {
      invoke: jest.fn(() => ({
        ok: true,
        status: 'queued',
        nodeId: 'oracle-node',
        capabilityId: 'system.run',
        action: 'run',
        reason: 'Fila remota pronta.',
        transport: 'bridge',
        commandHint: 'Acompanhe o heartbeat.',
        queuedAt: '2026-04-02T21:00:20.000Z',
        invocationId: 'invoke-1',
      })),
    };
    const nodeMeshService = {
      buildSnapshot: jest.fn(() => ({
        generatedAt: '2026-04-02T21:00:00.000Z',
        summary: {
          total: 1,
          paired: 1,
          pending: 0,
          online: 1,
          offline: 0,
          invokable: 1,
          capabilities: 1,
          queued: 1,
          completedRecently: 0,
        },
        entries: [],
        selected: null,
        capabilityCatalog: [],
        suggestedActions: [],
        narrative: {
          headline: 'Node Mesh pronto.',
          operatorSummary: '1 node online.',
        },
      })),
    };
    const service = new DashboardService(logRepo, {
      nodeHeartbeatService: nodeHeartbeatService as any,
      nodeInvokeService: nodeInvokeService as any,
      nodeMeshService: nodeMeshService as any,
    });

    await service.start();
    const baseUrl = service.getUrl();

    const claimResult = await fetchJson(`${baseUrl}/api/node-mesh/pairing/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nodeId: 'oracle-node',
        pairingCode: 'PAIR-1',
      }),
    });

    const heartbeatResult = await fetchJson(`${baseUrl}/api/node-mesh/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nodeId: 'oracle-node',
        sharedSecret: 'node-secret',
        completedInvocations: [],
      }),
    });

    const operationsInvokeResult = await fetchDashboardJson(baseUrl, '/api/operations/nodes/invoke', {
      token: 'web-secret',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nodeId: 'oracle-node',
          capabilityId: 'system.run',
          action: 'run',
          payload: { command: 'echo ok' },
        }),
      },
    });

    const webInvokeResult = await fetchDashboardJson(baseUrl, '/api/web/nodes/invoke', {
      token: 'web-secret',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nodeId: 'oracle-node',
          capabilityId: 'system.run',
          action: 'run',
          payload: { command: 'echo ok' },
        }),
      },
    });

    await service.stopAsync();

    expect(claimResult.status).toBe(200);
    expect(claimResult.payload.ok).toBe(true);
    expect(nodeHeartbeatService.claimPairing).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'oracle-node',
        pairingCode: 'PAIR-1',
      }),
    );
    expect(heartbeatResult.status).toBe(200);
    expect(heartbeatResult.payload.ok).toBe(true);
    expect(heartbeatResult.payload.heartbeat.acceptedResults).toBe(1);
    expect(nodeHeartbeatService.receiveHeartbeat).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'oracle-node',
        sharedSecret: 'node-secret',
      }),
    );
    expect(operationsInvokeResult.status).toBe(202);
    expect(webInvokeResult.status).toBe(202);
    expect(operationsInvokeResult.payload.invoke.invocationId).toBe('invoke-1');
    expect(webInvokeResult.payload.invoke.invocationId).toBe('invoke-1');
    expect(nodeInvokeService.invoke).toHaveBeenCalledTimes(2);
  });

  it('protects live node mesh snapshot behind dashboard auth', async () => {
    config.zavorthWebAuthToken = 'web-secret';
    const nodeMeshService = {
      buildSnapshot: jest.fn(() => ({
        generatedAt: '2026-04-02T21:02:00.000Z',
        summary: {
          total: 0,
          paired: 0,
          pending: 0,
          online: 0,
          offline: 0,
          invokable: 0,
          capabilities: 0,
          queued: 0,
          completedRecently: 0,
        },
        entries: [],
        selected: null,
        capabilityCatalog: [],
        suggestedActions: [],
        narrative: {
          headline: 'Node Mesh vazio.',
          operatorSummary: 'Sem nodes.',
        },
      })),
    };
    const service = new DashboardService(logRepo, {
      nodeMeshService: nodeMeshService as any,
    });

    await service.start();
    const baseUrl = service.getUrl();
    const unauthenticated = await fetchJson(`${baseUrl}/api/node-mesh/live/snapshot`);
    const authenticated = await fetchDashboardJson(baseUrl, '/api/node-mesh/live/snapshot', {
      token: 'web-secret',
    });
    await service.stopAsync();

    expect(unauthenticated.status).toBe(401);
    expect(authenticated.status).toBe(200);
    expect(authenticated.payload).toEqual(
      expect.objectContaining({
        ok: true,
        live: expect.objectContaining({
          safety: expect.objectContaining({
            rawSecretsSerialized: false,
          }),
        }),
        nodeMesh: expect.objectContaining({
          narrative: expect.objectContaining({
            headline: 'Node Mesh vazio.',
          }),
        }),
      }),
    );
  });

  it('accepts profile-aware pairing drafts through the dashboard operations surface', async () => {
    config.zavorthWebAuthToken = 'web-secret';
    const nodePairingService = {
      createPairingDraft: jest.fn(() => ({
        generatedAt: '2026-04-02T21:05:00.000Z',
        pairingCode: 'PAIR-MOBILE-1',
        bootstrap: {
          packageScript: 'companion:start',
          command: 'npm run companion:start -- --passcode \"mobile-node:PAIR-MOBILE-1\" --base-url http://127.0.0.1:33333 --node-id mobile-node --workspace \"C:/workspace/demo\" --label \"Mobile Companion\" --surface mobile --capabilities camera.capture,notifications.send,location.read',
          fallbackCommand: 'node apps/zavorth-companion/index.js \"mobile-node:PAIR-MOBILE-1\"',
          pairingToken: 'mobile-node:PAIR-MOBILE-1',
          workspaceHint: 'C:/workspace/demo',
          notes: ['Mobile bootstrap'],
        },
        profile: {
          id: 'mobile-companion',
          label: 'Mobile Companion',
          kind: 'mobile',
          transport: 'remote',
          defaultCapabilityIds: ['camera.capture', 'notifications.send', 'location.read'],
        },
        entry: {
          id: 'mobile-node',
          label: 'Mobile Companion',
          profileId: 'mobile-companion',
          kind: 'mobile',
          transport: 'remote',
        },
      })),
    };
    const nodeMeshService = {
      buildSnapshot: jest.fn(() => ({
        generatedAt: '2026-04-02T21:05:00.000Z',
        summary: {
          total: 1,
          paired: 0,
          pending: 1,
          online: 0,
          offline: 0,
          invokable: 0,
          capabilities: 3,
          queued: 0,
          completedRecently: 0,
        },
        entries: [],
        selected: null,
        capabilityCatalog: [],
        deviceProfiles: [],
        recommendedProfiles: [],
        suggestedActions: [],
        narrative: {
          headline: 'Node Mesh aguardando mobile pairing.',
          operatorSummary: '1 pairing pendente.',
        },
      })),
    };
    const service = new DashboardService(logRepo, {
      nodePairingService: nodePairingService as any,
      nodeMeshService: nodeMeshService as any,
    });

    await service.start();
    const result = await fetchDashboardJson(service.getUrl(), '/api/operations/nodes/pairing-draft', {
      token: 'web-secret',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profileId: 'mobile-companion',
          label: 'Mobile Companion',
        }),
      },
    });

    await service.stopAsync();

    expect(result.status).toBe(200);
    expect(nodePairingService.createPairingDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'mobile-companion',
        label: 'Mobile Companion',
      }),
    );
    expect(result.payload.draft.profile).toEqual(
      expect.objectContaining({
        id: 'mobile-companion',
      }),
    );
    expect(result.payload.draft.bootstrap).toEqual(
      expect.objectContaining({
        packageScript: 'companion:start',
      }),
    );
  });

  it('supports approve and revoke through the dashboard operations surface', async () => {
    config.zavorthWebAuthToken = 'web-secret';
    const nodePairingService = {
      approvePairing: jest.fn((nodeId: string, input: any) => {
        if (nodeId !== 'oracle-node' || input.pairingCode !== 'PAIR-OPS-1') {
          return null;
        }
        return {
          id: 'oracle-node',
          label: 'Oracle Node',
          profileId: 'headless-worker',
          kind: 'headless',
          transport: 'bridge',
          status: 'offline',
          pairingStatus: 'paired',
          paired: true,
        };
      }),
      revokePairing: jest.fn((nodeId: string) => {
        if (nodeId !== 'oracle-node') {
          return null;
        }
        return {
          id: 'oracle-node',
          label: 'Oracle Node',
          profileId: 'headless-worker',
          kind: 'headless',
          transport: 'bridge',
          status: 'blocked',
          pairingStatus: 'revoked',
          paired: false,
        };
      }),
    };
    const nodeMeshService = {
      buildSnapshot: jest.fn(() => ({
        generatedAt: '2026-04-02T21:10:00.000Z',
        summary: {
          total: 1,
          paired: 1,
          pending: 0,
          online: 0,
          offline: 1,
          invokable: 0,
          capabilities: 1,
          queued: 0,
          completedRecently: 0,
        },
        entries: [],
        selected: null,
        capabilityCatalog: [],
        suggestedActions: [],
        narrative: {
          headline: 'Node Mesh pronto.',
          operatorSummary: '1 node pareado.',
        },
      })),
    };
    const service = new DashboardService(logRepo, {
      nodePairingService: nodePairingService as any,
      nodeMeshService: nodeMeshService as any,
    });

    await service.start();
    const baseUrl = service.getUrl();

    const approveResult = await fetchDashboardJson(baseUrl, '/api/operations/nodes/pairing/approve', {
      token: 'web-secret',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nodeId: 'oracle-node',
          pairingCode: 'PAIR-OPS-1',
        }),
      },
    });
    const approveInvalidResult = await fetchDashboardJson(baseUrl, '/api/operations/nodes/pairing/approve', {
      token: 'web-secret',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nodeId: 'oracle-node',
          pairingCode: 'PAIR-INVALID',
        }),
      },
    });
    const revokeResult = await fetchDashboardJson(baseUrl, '/api/operations/nodes/pairing/revoke', {
      token: 'web-secret',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nodeId: 'oracle-node',
          reason: 'operator-request',
        }),
      },
    });
    const revokeInvalidResult = await fetchDashboardJson(baseUrl, '/api/operations/nodes/pairing/revoke', {
      token: 'web-secret',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nodeId: 'missing-node',
          reason: 'operator-request',
        }),
      },
    });

    await service.stopAsync();

    expect(approveResult.status).toBe(200);
    expect(approveInvalidResult.status).toBe(400);
    expect(revokeResult.status).toBe(200);
    expect(revokeInvalidResult.status).toBe(400);
    expect(approveResult.payload.node).toEqual(
      expect.objectContaining({
        id: 'oracle-node',
        pairingStatus: 'paired',
      }),
    );
    expect(revokeResult.payload.node).toEqual(
      expect.objectContaining({
        id: 'oracle-node',
        pairingStatus: 'revoked',
      }),
    );
    expect(nodePairingService.approvePairing).toHaveBeenCalledTimes(2);
    expect(nodePairingService.revokePairing).toHaveBeenCalledTimes(2);
  });

  it('exposes node activity and capabilities through the dashboard operations surface', async () => {
    config.zavorthWebAuthToken = 'web-secret';
    const nodeMeshService = {
      buildSnapshot: jest.fn(),
      getNodeEntry: jest.fn((nodeId: string) => ({
        id: nodeId,
        label: 'Oracle Node',
        profileId: 'headless-worker',
        kind: 'headless',
        transport: 'bridge',
        status: 'online',
        pairingStatus: 'paired',
        paired: true,
        canInvoke: true,
      })),
      buildActivitySnapshot: jest.fn((nodeId: string) => ({
        nodeId,
        activeInvocations: [],
        recentInvocations: [],
        summary: {
          pending: 1,
          claimed: 0,
          completedRecently: 0,
          active: 1,
          recent: 1,
        },
        narrative: {
          headline: 'Fila remota ativa.',
          operatorSummary: 'Ultima activity: node.maintenance/repair concluiu com sucesso.',
        },
      })),
      buildCapabilitiesSnapshot: jest.fn((nodeId: string) => ({
        nodeId,
        label: 'Oracle Node',
        kind: 'headless',
        transport: 'bridge',
        paired: true,
        capabilities: [
          { id: 'system.run', label: 'System Run', summary: 'Execucao local', category: 'system', risky: true, actionHint: 'Executar comando' },
          { id: 'node.maintenance', label: 'Node Maintenance', summary: 'Doctor e repair local', category: 'system', risky: true, actionHint: 'Reparar host' },
          { id: 'files.write', label: 'Files Write', summary: 'Escrita de arquivos', category: 'files', risky: true, actionHint: 'Persistir artefato' },
        ],
        summary: {
          total: 3,
          risky: 3,
          categories: ['files', 'system'],
        },
        narrative: {
          headline: 'Capabilities declaradas.',
          operatorSummary: 'Maintenance local disponivel via node.maintenance (doctor/repair).',
        },
      })),
    };
    const service = new DashboardService(logRepo, {
      nodeMeshService: nodeMeshService as any,
    });

    await service.start();
    const baseUrl = service.getUrl();

    const activityResult = await fetchDashboardJson(baseUrl, '/api/operations/nodes/oracle-node/activity', {
      token: 'web-secret',
    });
    const capabilitiesResult = await fetchDashboardJson(baseUrl, '/api/operations/nodes/oracle-node/capabilities', {
      token: 'web-secret',
    });

    await service.stopAsync();

    expect(activityResult.status).toBe(200);
    expect(capabilitiesResult.status).toBe(200);
    expect(nodeMeshService.getNodeEntry).toHaveBeenCalledWith('oracle-node');
    expect(nodeMeshService.buildActivitySnapshot).toHaveBeenCalledWith('oracle-node');
    expect(nodeMeshService.buildCapabilitiesSnapshot).toHaveBeenCalledWith('oracle-node');
    expect(activityResult.payload).toEqual(
      expect.objectContaining({
        ok: true,
        node: expect.objectContaining({
          id: 'oracle-node',
        }),
        activity: expect.objectContaining({
          nodeId: 'oracle-node',
          narrative: expect.objectContaining({
            operatorSummary: expect.stringContaining('node.maintenance/repair'),
          }),
        }),
      }),
    );
    expect(capabilitiesResult.payload).toEqual(
      expect.objectContaining({
        ok: true,
        node: expect.objectContaining({
          id: 'oracle-node',
        }),
        capabilities: expect.objectContaining({
          nodeId: 'oracle-node',
          summary: expect.objectContaining({
            total: 3,
          }),
          narrative: expect.objectContaining({
            operatorSummary: expect.stringContaining('node.maintenance'),
          }),
        }),
      }),
    );
  });

  it('exposes node mesh doctor and recover through the dashboard operations surface', async () => {
    config.zavorthWebAuthToken = 'web-secret';
    const nodeMeshService = {
      buildSnapshot: jest.fn((input?: any) => ({
        generatedAt: '2026-04-02T22:30:00.000Z',
        summary: {
          total: 1,
          paired: 1,
          pending: 0,
          online: 1,
          offline: 0,
          invokable: 1,
          capabilities: 2,
          queued: 1,
          completedRecently: 0,
          expiredDrafts: 0,
          staleQueued: 1,
          staleClaimedInvocations: 1,
        },
        entries: [
          {
            id: 'oracle-node',
            label: 'Oracle Node',
            capabilityIds: [],
            lifecycle: { pairingDraftStale: false },
            operatorSummary: 'Fila antiga.',
            nextAction: 'Revisar fila.',
            stalePendingInvocations: 0,
            staleClaimedInvocations: 1,
          },
        ],
        selected: input?.selectedNodeId ? { id: input.selectedNodeId } : null,
        capabilityCatalog: [],
        suggestedActions: [],
        narrative: {
          headline: 'Node Mesh com pendencia.',
          operatorSummary: 'Fila precisa de recover.',
        },
      })),
    };
    const nodeInvokeService = {
      invoke: jest.fn(),
      requeueStaleClaimed: jest.fn(() => ([
        {
          id: 'invoke-ops-1',
          nodeId: 'oracle-node',
          status: 'pending',
        },
      ])),
    };
    const service = new DashboardService(logRepo, {
      nodeMeshService: nodeMeshService as any,
      nodeInvokeService: nodeInvokeService as any,
    });

    await service.start();
    const baseUrl = service.getUrl();
    const doctorResult = await fetchDashboardJson(baseUrl, '/api/operations/nodes/doctor', {
      token: 'web-secret',
    });
    const recoverResult = await fetchDashboardJson(baseUrl, '/api/operations/nodes/recover', {
      token: 'web-secret',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kind: 'release-stale-claims',
          nodeId: 'oracle-node',
          limit: 2,
        }),
      },
    });

    await service.stopAsync();

    expect(doctorResult.status).toBe(200);
    expect(doctorResult.payload.doctor).toEqual(
      expect.objectContaining({
        status: 'attention',
        issues: expect.arrayContaining([
          expect.objectContaining({
            kind: 'stale-claimed-queue',
            nodeId: 'oracle-node',
          }),
        ]),
      }),
    );
    expect(recoverResult.status).toBe(200);
    expect(recoverResult.payload.recover).toEqual(
      expect.objectContaining({
        ok: true,
        action: expect.objectContaining({
          kind: 'release-stale-claims',
        }),
        result: expect.objectContaining({
          nodeId: 'oracle-node',
          requeuedCount: 1,
        }),
      }),
    );
    expect(nodeInvokeService.requeueStaleClaimed).toHaveBeenCalledWith('oracle-node', 2);
  });

  it('allows doctor and recover on the loopback dashboard operations surface without explicit token', async () => {
    config.zavorthWebAuthToken = 'web-secret';
    const nodeMeshService = {
      buildSnapshot: jest.fn(() => ({
        generatedAt: '2026-04-02T22:25:00.000Z',
        summary: {
          total: 0,
          paired: 0,
          pending: 0,
          online: 0,
          offline: 0,
          invokable: 0,
          capabilities: 0,
          queued: 0,
          completedRecently: 0,
          expiredDrafts: 0,
          staleQueued: 0,
          staleClaimedInvocations: 0,
        },
        entries: [],
        selected: null,
        capabilityCatalog: [],
        suggestedActions: [],
        narrative: {
          headline: 'Node Mesh vazio.',
          operatorSummary: 'Sem nodes.',
        },
      })),
    };
    const service = new DashboardService(logRepo, {
      nodeMeshService: nodeMeshService as any,
    });

    await service.start();
    const baseUrl = service.getUrl();
    const doctorResult = await fetchJson(`${baseUrl}/api/operations/nodes/doctor`);
    const recoverResult = await fetchJson(`${baseUrl}/api/operations/nodes/recover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kind: 'release-stale-claims',
        nodeId: 'oracle-node',
      }),
    });

    await service.stopAsync();

    expect(doctorResult.status).toBe(200);
    expect(recoverResult.status).toBe(400);
    expect(doctorResult.payload.ok).toBe(true);
    expect(recoverResult.payload.ok).toBe(false);
  });

  it('exposes approve and revoke through the dashboard operations surface', async () => {
    config.zavorthWebAuthToken = 'web-secret';
    const nodePairingService = {
      approvePairing: jest.fn(() => ({
        id: 'oracle-node',
        label: 'Oracle Node',
        profileId: 'headless-worker',
        kind: 'headless',
        transport: 'bridge',
        status: 'online',
        pairingStatus: 'paired',
        paired: true,
        createdAt: '2026-04-02T22:20:00.000Z',
        updatedAt: '2026-04-02T22:20:00.000Z',
        pairedAt: '2026-04-02T22:20:00.000Z',
        lastSeenAt: null,
        requestedBy: 'dashboard',
        capabilityIds: ['system.run'],
        hostHints: {
          hostname: 'oracle',
          platform: 'linux',
          workspace: '/srv',
          surface: 'node-host',
        },
        notes: [],
        operatorSummary: 'Pareado.',
      })),
      revokePairing: jest.fn(() => ({
        id: 'oracle-node',
        label: 'Oracle Node',
        profileId: 'headless-worker',
        kind: 'headless',
        transport: 'bridge',
        status: 'blocked',
        pairingStatus: 'revoked',
        paired: false,
        createdAt: '2026-04-02T22:20:00.000Z',
        updatedAt: '2026-04-02T22:21:00.000Z',
        pairedAt: null,
        lastSeenAt: null,
        requestedBy: 'dashboard',
        capabilityIds: ['system.run'],
        hostHints: {
          hostname: 'oracle',
          platform: 'linux',
          workspace: '/srv',
          surface: 'node-host',
        },
        notes: ['manual revoke'],
        operatorSummary: 'Revogado.',
      })),
    };
    const nodeMeshService = {
      buildSnapshot: jest.fn(() => ({
        generatedAt: '2026-04-02T22:20:00.000Z',
        summary: {
          total: 1,
          paired: 1,
          pending: 0,
          online: 1,
          offline: 0,
          invokable: 1,
          capabilities: 1,
          queued: 0,
          completedRecently: 0,
          expiredDrafts: 0,
          staleQueued: 0,
          staleClaimedInvocations: 0,
        },
        entries: [],
        selected: null,
        capabilityCatalog: [],
        suggestedActions: [],
        narrative: {
          headline: 'Node Mesh pronto.',
          operatorSummary: '1 node online.',
        },
      })),
    };
    const service = new DashboardService(logRepo, {
      nodePairingService: nodePairingService as any,
      nodeMeshService: nodeMeshService as any,
    });

    await service.start();
    const baseUrl = service.getUrl();
    const approveResult = await fetchDashboardJson(baseUrl, '/api/operations/nodes/pairing/approve', {
      token: 'web-secret',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nodeId: 'oracle-node',
          pairingCode: 'PAIR-OPS-1',
        }),
      },
    });
    const revokeResult = await fetchDashboardJson(baseUrl, '/api/operations/nodes/pairing/revoke', {
      token: 'web-secret',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nodeId: 'oracle-node',
          reason: 'manual revoke',
        }),
      },
    });

    await service.stopAsync();

    expect(approveResult.status).toBe(200);
    expect(revokeResult.status).toBe(200);
    expect(nodePairingService.approvePairing).toHaveBeenCalledWith(
      'oracle-node',
      expect.objectContaining({
        pairingCode: 'PAIR-OPS-1',
      }),
    );
    expect(nodePairingService.revokePairing).toHaveBeenCalledWith('oracle-node', 'manual revoke');
  });

  it('returns 400 on invalid approve and revoke requests on the dashboard operations surface', async () => {
    config.zavorthWebAuthToken = 'web-secret';
    const nodePairingService = {
      approvePairing: jest.fn(() => null),
      revokePairing: jest.fn(() => null),
    };
    const nodeMeshService = {
      buildSnapshot: jest.fn(() => ({
        generatedAt: '2026-04-02T22:25:00.000Z',
        summary: {
          total: 0,
          paired: 0,
          pending: 0,
          online: 0,
          offline: 0,
          invokable: 0,
          capabilities: 0,
          queued: 0,
          completedRecently: 0,
          expiredDrafts: 0,
          staleQueued: 0,
          staleClaimedInvocations: 0,
        },
        entries: [],
        selected: null,
        capabilityCatalog: [],
        suggestedActions: [],
        narrative: {
          headline: 'Node Mesh vazio.',
          operatorSummary: 'Sem nodes.',
        },
      })),
    };
    const service = new DashboardService(logRepo, {
      nodePairingService: nodePairingService as any,
      nodeMeshService: nodeMeshService as any,
    });

    await service.start();
    const baseUrl = service.getUrl();
    const approveResult = await fetchDashboardJson(baseUrl, '/api/operations/nodes/pairing/approve', {
      token: 'web-secret',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nodeId: 'missing-node',
        }),
      },
    });
    const revokeResult = await fetchDashboardJson(baseUrl, '/api/operations/nodes/pairing/revoke', {
      token: 'web-secret',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nodeId: 'missing-node',
        }),
      },
    });

    await service.stopAsync();

    expect(approveResult.status).toBe(400);
    expect(revokeResult.status).toBe(400);
    expect(approveResult.payload.error).toContain('Nao foi possivel validar');
    expect(revokeResult.payload.error).toContain('Nao foi possivel revogar');
  });

  it('queues node host maintenance through the dashboard operations recover surface', async () => {
    config.zavorthWebAuthToken = 'web-secret';
    const nodeMeshService = {
      buildSnapshot: jest.fn(() => ({
        generatedAt: '2026-04-02T22:40:00.000Z',
        summary: {
          total: 1,
          paired: 1,
          pending: 0,
          online: 1,
          offline: 0,
          invokable: 1,
          capabilities: 2,
          queued: 1,
          completedRecently: 0,
          expiredDrafts: 0,
          staleQueued: 0,
          staleClaimedInvocations: 0,
        },
        entries: [],
        selected: { id: 'oracle-node' },
        capabilityCatalog: [],
        suggestedActions: [],
        narrative: {
          headline: 'Node Mesh pronto.',
          operatorSummary: '1 node online.',
        },
      })),
    };
    const nodeInvokeService = {
      invoke: jest.fn(() => ({
        ok: true,
        status: 'queued',
        nodeId: 'oracle-node',
        capabilityId: 'node.maintenance',
        action: 'repair',
        invocationId: 'invoke-maint-1',
      })),
      requeueStaleClaimed: jest.fn(() => []),
    };
    const service = new DashboardService(logRepo, {
      nodeMeshService: nodeMeshService as any,
      nodeInvokeService: nodeInvokeService as any,
    });

    await service.start();
    const result = await fetchDashboardJson(service.getUrl(), '/api/operations/nodes/recover', {
      token: 'web-secret',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kind: 'queue-node-host-maintenance',
          nodeId: 'oracle-node',
        }),
      },
    });

    await service.stopAsync();

    expect(result.status).toBe(200);
    expect(nodeInvokeService.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'oracle-node',
        capabilityId: 'node.maintenance',
        action: 'repair',
      }),
    );
    expect(result.payload.recover).toEqual(
      expect.objectContaining({
        ok: true,
        action: expect.objectContaining({
          kind: 'queue-node-host-maintenance',
        }),
      }),
    );
  });

  it('updates approved capabilities on the dashboard operations surface', async () => {
    config.zavorthWebAuthToken = 'web-secret';
    const nodePairingService = {
      setApprovedCapabilities: jest.fn(() => ({
        id: 'oracle-node',
        approvedCapabilityIds: ['files.read', 'system.run'],
      })),
    };
    const nodeMeshService = {
      buildSnapshot: jest.fn(() => ({
        generatedAt: '2026-04-02T22:45:00.000Z',
        summary: {
          total: 1,
          paired: 1,
          pending: 0,
          online: 1,
          offline: 0,
          invokable: 1,
          capabilities: 2,
          queued: 0,
          completedRecently: 0,
          expiredDrafts: 0,
          staleQueued: 0,
          staleClaimedInvocations: 0,
        },
        entries: [],
        selected: {
          id: 'oracle-node',
          approvedCapabilityIds: ['files.read', 'system.run'],
        },
        capabilityCatalog: [],
        suggestedActions: [],
        narrative: {
          headline: 'Node Mesh pronto.',
          operatorSummary: '1 node online.',
        },
      })),
    };
    const service = new DashboardService(logRepo, {
      nodePairingService: nodePairingService as any,
      nodeMeshService: nodeMeshService as any,
    });

    await service.start();
    const result = await fetchDashboardJson(service.getUrl(), '/api/operations/nodes/oracle-node/approved-capabilities', {
      token: 'web-secret',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          approvedCapabilityIds: ['files.read', 'system.run'],
        }),
      },
    });
    await service.stopAsync();

    expect(result.status).toBe(200);
    expect(nodePairingService.setApprovedCapabilities).toHaveBeenCalledWith(
      'oracle-node',
      ['files.read', 'system.run'],
      expect.objectContaining({
        approvedBy: expect.any(String),
        mode: 'custom',
      }),
    );
    expect(result.payload.node.approvedCapabilityIds).toEqual(['files.read', 'system.run']);
  });
});
