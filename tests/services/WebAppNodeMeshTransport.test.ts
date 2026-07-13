import { config } from '../../src/config/index.js';
import { DashboardService } from '../../src/services/DashboardService.js';
import {
  createTestLogRepo,
  fetchDashboardJson,
  fetchJson,
  fetchNoKeepAlive,
} from '../helpers/dashboardWebTestUtils.js';

describe('Web app node mesh transport routes', () => {
  const logRepo = createTestLogRepo();
  const originalWebAuthToken = config.zavorthWebAuthToken;

  afterEach(() => {
    config.zavorthWebAuthToken = originalWebAuthToken;
  });

  it('exposes claim, heartbeat and invoke through the protected web surface', async () => {
    config.zavorthWebAuthToken = 'web-secret';
    const nodeHeartbeatService = {
      claimPairing: jest.fn(() => ({
        claimedAt: '2026-04-02T22:00:00.000Z',
        sharedSecret: 'shared-secret',
        heartbeatIntervalMs: 9000,
        operatorSummary: 'Node claim confirmado.',
        actionHint: 'Publique heartbeat.',
        assignments: [],
        node: {
          id: 'oracle-node',
          label: 'Oracle Node',
        },
      })),
      receiveHeartbeat: jest.fn(() => ({
        receivedAt: '2026-04-02T22:00:10.000Z',
        heartbeatIntervalMs: 9000,
        operatorSummary: 'Heartbeat recebido.',
        acceptedResults: 1,
        assignments: [],
        node: {
          id: 'oracle-node',
          label: 'Oracle Node',
        },
      })),
    };
    const nodeInvokeService = {
      invoke: jest.fn(() => ({
        ok: true,
        status: 'queued',
        nodeId: 'oracle-node',
        capabilityId: 'system.run',
        action: 'run',
        reason: 'Invocacao colocada na fila.',
        transport: 'bridge',
        commandHint: 'Acompanhe o heartbeat.',
        queuedAt: '2026-04-02T22:00:20.000Z',
        invocationId: 'invoke-web-1',
      })),
    };
    const nodeMeshService = {
      buildSnapshot: jest.fn(() => ({
        generatedAt: '2026-04-02T22:00:00.000Z',
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
          headline: 'Node Mesh ready.',
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
    const token = 'web-secret';

    const claimResult = await fetchDashboardJson(
      baseUrl,
      '/api/web/nodes/pairing/claim',
      {
        token,
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            nodeId: 'oracle-node',
            pairingCode: 'PAIR-WEB-1',
          }),
        },
      },
    );

    const heartbeatResult = await fetchDashboardJson(
      baseUrl,
      '/api/web/nodes/heartbeat',
      {
        token,
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            nodeId: 'oracle-node',
            sharedSecret: 'shared-secret',
            results: [],
          }),
        },
      },
    );

    const invokeResult = await fetchDashboardJson(
      baseUrl,
      '/api/web/nodes/invoke',
      {
        token,
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
      },
    );

    await service.stopAsync();

    expect(claimResult.status).toBe(200);
    expect(heartbeatResult.status).toBe(200);
    expect(invokeResult.status).toBe(202);
    expect(claimResult.payload.ok).toBe(true);
    expect(heartbeatResult.payload.ok).toBe(true);
    expect(invokeResult.payload.ok).toBe(true);
    expect(nodeHeartbeatService.claimPairing).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'oracle-node',
        pairingCode: 'PAIR-WEB-1',
      }),
    );
    expect(nodeHeartbeatService.receiveHeartbeat).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'oracle-node',
        sharedSecret: 'shared-secret',
      }),
    );
    expect(nodeInvokeService.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'oracle-node',
        capabilityId: 'system.run',
        action: 'run',
      }),
    );
    expect(invokeResult.payload.invoke.invocationId).toBe('invoke-web-1');
  });

  it('keeps claim and heartbeat public but blocks protected node mesh routes without auth', async () => {
    config.zavorthWebAuthToken = 'web-secret';
    const nodeHeartbeatService = {
      claimPairing: jest.fn(() => ({
        claimedAt: '2026-04-02T22:10:00.000Z',
        sharedSecret: 'shared-secret',
        heartbeatIntervalMs: 9000,
        operatorSummary: 'Node claim confirmado.',
        actionHint: 'Publique heartbeat.',
        assignments: [],
        node: {
          id: 'oracle-node',
          label: 'Oracle Node',
        },
      })),
      receiveHeartbeat: jest.fn(() => ({
        receivedAt: '2026-04-02T22:10:10.000Z',
        heartbeatIntervalMs: 9000,
        operatorSummary: 'Heartbeat recebido.',
        acceptedResults: 0,
        assignments: [],
        node: {
          id: 'oracle-node',
          label: 'Oracle Node',
        },
      })),
    };
    const nodeInvokeService = {
      invoke: jest.fn(),
    };
    const nodePairingService = {
      createPairingDraft: jest.fn(),
    };
    const nodeMeshService = {
      buildSnapshot: jest.fn(() => ({
        generatedAt: '2026-04-02T22:10:00.000Z',
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
        },
        entries: [],
        selected: null,
        capabilityCatalog: [],
        suggestedActions: [],
        narrative: {
          headline: 'Node Mesh ready.',
          operatorSummary: '1 node online.',
        },
      })),
    };

    const service = new DashboardService(logRepo, {
      nodeHeartbeatService: nodeHeartbeatService as any,
      nodeInvokeService: nodeInvokeService as any,
      nodePairingService: nodePairingService as any,
      nodeMeshService: nodeMeshService as any,
    });

    await service.start();
    const baseUrl = service.getUrl();

    const claimResult = await fetchNoKeepAlive(`${baseUrl}/api/web/nodes/pairing/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nodeId: 'oracle-node',
        pairingCode: 'PAIR-PUBLIC-1',
      }),
    });
    const heartbeatResult = await fetchNoKeepAlive(`${baseUrl}/api/web/nodes/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nodeId: 'oracle-node',
        sharedSecret: 'shared-secret',
        results: [],
      }),
    });
    const invokeResult = await fetchNoKeepAlive(`${baseUrl}/api/web/nodes/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nodeId: 'oracle-node',
        capabilityId: 'system.run',
        action: 'run',
      }),
    });
    const pairingDraftResult = await fetchNoKeepAlive(`${baseUrl}/api/web/nodes/pairing-draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        profileId: 'desktop-companion',
      }),
    });

    const claimPayload = await claimResult.json();
    const heartbeatPayload = await heartbeatResult.json();
    const invokePayload = await invokeResult.json();
    const pairingDraftPayload = await pairingDraftResult.json();

    await service.stopAsync();

    expect(claimResult.status).toBe(200);
    expect(heartbeatResult.status).toBe(200);
    expect(invokeResult.status).toBe(401);
    expect(pairingDraftResult.status).toBe(401);
    expect(claimPayload.ok).toBe(true);
    expect(heartbeatPayload.ok).toBe(true);
    expect(invokePayload.error).toBe('Unauthorized');
    expect(pairingDraftPayload.error).toBe('Unauthorized');
    expect(nodeHeartbeatService.claimPairing).toHaveBeenCalledTimes(1);
    expect(nodeHeartbeatService.receiveHeartbeat).toHaveBeenCalledTimes(1);
    expect(nodeInvokeService.invoke).not.toHaveBeenCalled();
    expect(nodePairingService.createPairingDraft).not.toHaveBeenCalled();
  });

  it('supports approve and revoke through the protected web surface', async () => {
    config.zavorthWebAuthToken = 'web-secret';
    const nodePairingService = {
      approvePairing: jest.fn((nodeId: string, input: any) => {
        if (nodeId !== 'oracle-node' || input.pairingCode !== 'PAIR-APPROVE-1') {
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
        generatedAt: '2026-04-02T22:20:00.000Z',
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
          headline: 'Node Mesh ready.',
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
    const token = 'web-secret';

    const approveResult = await fetchDashboardJson(baseUrl, '/api/web/nodes/pairing/approve', {
      token,
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nodeId: 'oracle-node',
          pairingCode: 'PAIR-APPROVE-1',
        }),
      },
    });
    const approveInvalidResult = await fetchDashboardJson(baseUrl, '/api/web/nodes/pairing/approve', {
      token,
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
    const revokeResult = await fetchDashboardJson(baseUrl, '/api/web/nodes/pairing/revoke', {
      token,
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
    const revokeInvalidResult = await fetchDashboardJson(baseUrl, '/api/web/nodes/pairing/revoke', {
      token,
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

  it('accepts profile-aware pairing drafts through the protected web surface', async () => {
    config.zavorthWebAuthToken = 'web-secret';
    const nodePairingService = {
      createPairingDraft: jest.fn(() => ({
        generatedAt: '2026-04-02T22:05:00.000Z',
        pairingCode: 'PAIR-DESKTOP-1',
        bootstrap: {
          packageScript: 'companion:start',
          command: 'npm run companion:start -- --passcode \"desktop-bridge:PAIR-DESKTOP-1\" --base-url http://127.0.0.1:33333 --node-id desktop-bridge --workspace \"C:/workspace/demo\" --label \"Desktop Companion\" --surface desktop --capabilities screen.capture,notifications.send,files.read,files.write,clipboard.read',
          fallbackCommand: 'node apps/zavorth-companion/index.js \"desktop-bridge:PAIR-DESKTOP-1\"',
          pairingToken: 'desktop-bridge:PAIR-DESKTOP-1',
          workspaceHint: 'C:/workspace/demo',
          notes: ['Desktop bootstrap'],
        },
        profile: {
          id: 'desktop-companion',
          label: 'Desktop Companion',
          kind: 'desktop',
          transport: 'remote',
          defaultCapabilityIds: ['screen.capture', 'notifications.send', 'files.read', 'files.write', 'clipboard.read'],
        },
        entry: {
          id: 'desktop-bridge',
          label: 'Desktop Companion',
          profileId: 'desktop-companion',
          kind: 'desktop',
          transport: 'remote',
        },
      })),
    };
    const nodeMeshService = {
      buildSnapshot: jest.fn(() => ({
        generatedAt: '2026-04-02T22:05:00.000Z',
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
          headline: 'Node Mesh aguardando desktop pairing.',
          operatorSummary: '1 pairing pendente.',
        },
      })),
    };

    const service = new DashboardService(logRepo, {
      nodePairingService: nodePairingService as any,
      nodeMeshService: nodeMeshService as any,
    });

    await service.start();
    const response = await fetchNoKeepAlive(`${service.getUrl()}/api/web/nodes/pairing-draft`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer web-secret',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        profileId: 'desktop-companion',
        label: 'Desktop Companion',
      }),
    });
    const payload = await response.json();

    await service.stopAsync();

    expect(response.status).toBe(200);
    expect(nodePairingService.createPairingDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'desktop-companion',
        label: 'Desktop Companion',
      }),
    );
    expect(payload.draft.profile).toEqual(
      expect.objectContaining({
        id: 'desktop-companion',
      }),
    );
    expect(payload.draft.bootstrap).toEqual(
      expect.objectContaining({
        packageScript: 'companion:start',
      }),
    );
  });

  it('exposes pending node bootstrap through the protected web surface', async () => {
    config.zavorthWebAuthToken = 'web-secret';
    const nodePairingService = {
      buildBootstrapForNode: jest.fn(() => ({
        generatedAt: '2026-04-02T22:06:00.000Z',
        pairingCode: 'PAIR-NODE-1',
        bootstrap: {
          packageScript: 'nodes:host',
          command: 'npm run nodes:host -- --pairing-code PAIR-NODE-1',
          pairingToken: 'oracle-node:PAIR-NODE-1',
          notes: ['Headless bootstrap'],
        },
        profile: {
          id: 'headless-worker',
          label: 'Headless Worker',
          kind: 'headless',
          transport: 'bridge',
          defaultCapabilityIds: ['system.run'],
        },
        entry: {
          id: 'oracle-node',
          label: 'Oracle Node',
          pairingStatus: 'pending',
        },
      })),
    };
    const nodeMeshService = {
      buildSnapshot: jest.fn(() => ({
        generatedAt: '2026-04-02T22:06:00.000Z',
        summary: {
          total: 1,
          paired: 0,
          pending: 1,
          online: 0,
          offline: 0,
          invokable: 0,
          capabilities: 1,
          queued: 0,
          completedRecently: 0,
        },
        entries: [],
        selected: {
          id: 'oracle-node',
          pairingStatus: 'pending',
        },
        capabilityCatalog: [],
        suggestedActions: [],
        narrative: {
          headline: 'Node Mesh aguardando claim.',
          operatorSummary: '1 node pendente.',
        },
      })),
    };

    const service = new DashboardService(logRepo, {
      nodePairingService: nodePairingService as any,
      nodeMeshService: nodeMeshService as any,
    });

    await service.start();
    const result = await fetchDashboardJson(service.getUrl(), '/api/web/nodes/oracle-node/bootstrap', {
      token: 'web-secret',
    });
    await service.stopAsync();

    expect(result.status).toBe(200);
    expect(nodePairingService.buildBootstrapForNode).toHaveBeenCalledWith('oracle-node');
    expect(result.payload.draft.bootstrap).toEqual(
      expect.objectContaining({
        packageScript: 'nodes:host',
      }),
    );
    expect(result.payload.nodeMesh.selected).toEqual(
      expect.objectContaining({
        id: 'oracle-node',
      }),
    );
  });

  it('exposes node activity and capabilities through the protected web surface', async () => {
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
    const token = 'web-secret';

    const activityResult = await fetchDashboardJson(
      baseUrl,
      '/api/web/nodes/oracle-node/activity',
      { token },
    );
    const capabilitiesResult = await fetchDashboardJson(
      baseUrl,
      '/api/web/nodes/oracle-node/capabilities',
      { token },
    );

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
          summary: expect.objectContaining({
            active: 1,
          }),
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

  it('exposes node mesh doctor and recover through the protected web surface', async () => {
    config.zavorthWebAuthToken = 'web-secret';
    const nodeMeshService = {
      buildSnapshot: jest.fn((input?: any) => ({
        generatedAt: '2026-04-02T22:30:00.000Z',
        summary: {
          total: 2,
          paired: 1,
          pending: 1,
          online: 1,
          offline: 0,
          invokable: 1,
          capabilities: 2,
          queued: 1,
          completedRecently: 0,
          expiredDrafts: 1,
          staleQueued: 1,
          staleClaimedInvocations: 1,
        },
        entries: [
          {
            id: 'desktop-node',
            label: 'Desktop Node',
            pairingStatus: 'pending',
            capabilityIds: [],
            lifecycle: { pairingDraftStale: true },
            operatorSummary: 'Draft expirado.',
            nextAction: 'Regenerar pairing.',
            stalePendingInvocations: 0,
            staleClaimedInvocations: 0,
          },
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
          headline: 'Node Mesh com pendencias.',
          operatorSummary: 'Doctor encontrou 2 pontos.',
        },
      })),
    };
    const nodePairingService = {
      regeneratePairingDraft: jest.fn(() => ({
        generatedAt: '2026-04-02T22:31:00.000Z',
        pairingCode: 'PAIR-REGEN-1',
        entry: {
          id: 'desktop-node',
        },
      })),
    };
    const nodeInvokeService = {
      requeueStaleClaimed: jest.fn(() => []),
    };
    const service = new DashboardService(logRepo, {
      nodeMeshService: nodeMeshService as any,
      nodePairingService: nodePairingService as any,
      nodeInvokeService: nodeInvokeService as any,
    });

    await service.start();
    const baseUrl = service.getUrl();
    const doctorResult = await fetchDashboardJson(baseUrl, '/api/web/nodes/doctor', {
      token: 'web-secret',
    });
    const recoverResult = await fetchDashboardJson(baseUrl, '/api/web/nodes/recover', {
      token: 'web-secret',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kind: 'regenerate-pairing-draft',
          nodeId: 'desktop-node',
          profileId: 'desktop-companion',
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
            kind: 'expired-pairing-draft',
            nodeId: 'desktop-node',
          }),
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
          kind: 'regenerate-pairing-draft',
        }),
        result: expect.objectContaining({
          pairingCode: 'PAIR-REGEN-1',
        }),
      }),
    );
    expect(nodePairingService.regeneratePairingDraft).toHaveBeenCalledWith(
      'desktop-node',
      expect.objectContaining({
        profileId: 'desktop-companion',
      }),
    );
  });

  it('queues node host maintenance through the protected web recover surface', async () => {
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
          headline: 'Node Mesh ready.',
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
        invocationId: 'invoke-web-maint-1',
      })),
      requeueStaleClaimed: jest.fn(() => []),
    };
    const service = new DashboardService(logRepo, {
      nodeMeshService: nodeMeshService as any,
      nodeInvokeService: nodeInvokeService as any,
    });

    await service.start();
    const result = await fetchDashboardJson(service.getUrl(), '/api/web/nodes/recover', {
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

  it('keeps only claim and heartbeat public on the web node mesh surface', async () => {
    config.zavorthWebAuthToken = 'web-secret';
    const nodeHeartbeatService = {
      claimPairing: jest.fn(() => ({
        claimedAt: '2026-04-02T22:10:00.000Z',
        sharedSecret: 'shared-secret',
        heartbeatIntervalMs: 9000,
        operatorSummary: 'Node claim confirmado.',
        actionHint: 'Publique heartbeat.',
        assignments: [],
        node: {
          id: 'oracle-node',
          label: 'Oracle Node',
        },
      })),
      receiveHeartbeat: jest.fn(() => ({
        receivedAt: '2026-04-02T22:10:10.000Z',
        heartbeatIntervalMs: 9000,
        operatorSummary: 'Heartbeat recebido.',
        acceptedResults: 0,
        assignments: [],
        node: {
          id: 'oracle-node',
          label: 'Oracle Node',
        },
      })),
    };
    const nodeMeshService = {
      buildSnapshot: jest.fn(() => ({
        generatedAt: '2026-04-02T22:10:00.000Z',
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
          headline: 'Node Mesh ready.',
          operatorSummary: '1 node online.',
        },
      })),
    };
    const service = new DashboardService(logRepo, {
      nodeHeartbeatService: nodeHeartbeatService as any,
      nodeMeshService: nodeMeshService as any,
    });

    await service.start();
    const baseUrl = service.getUrl();

    const claimResult = await fetchJson(`${baseUrl}/api/web/nodes/pairing/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nodeId: 'oracle-node',
        pairingCode: 'PAIR-WEB-PUBLIC',
      }),
    });
    const heartbeatResult = await fetchJson(`${baseUrl}/api/web/nodes/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nodeId: 'oracle-node',
        sharedSecret: 'shared-secret',
        results: [],
      }),
    });
    const draftResult = await fetchJson(`${baseUrl}/api/web/nodes/pairing-draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        profileId: 'desktop-companion',
      }),
    });
    const invokeResult = await fetchJson(`${baseUrl}/api/web/nodes/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nodeId: 'oracle-node',
        capabilityId: 'system.run',
        action: 'run',
      }),
    });
    const approveResult = await fetchJson(`${baseUrl}/api/web/nodes/pairing/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nodeId: 'oracle-node',
      }),
    });
    const revokeResult = await fetchJson(`${baseUrl}/api/web/nodes/pairing/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nodeId: 'oracle-node',
      }),
    });

    await service.stopAsync();

    expect(claimResult.status).toBe(200);
    expect(heartbeatResult.status).toBe(200);
    expect(draftResult.status).toBe(401);
    expect(invokeResult.status).toBe(401);
    expect(approveResult.status).toBe(401);
    expect(revokeResult.status).toBe(401);
    expect(draftResult.payload.error).toBe('Unauthorized');
    expect(invokeResult.payload.error).toBe('Unauthorized');
    expect(approveResult.payload.error).toBe('Unauthorized');
    expect(revokeResult.payload.error).toBe('Unauthorized');
  });

  it('keeps doctor and recover protected on the web node mesh surface', async () => {
    config.zavorthWebAuthToken = 'web-secret';
    const nodeMeshService = {
      buildSnapshot: jest.fn(() => ({
        generatedAt: '2026-04-02T22:35:00.000Z',
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
    const doctorResult = await fetchNoKeepAlive(`${baseUrl}/api/web/nodes/doctor`);
    const recoverResult = await fetchNoKeepAlive(`${baseUrl}/api/web/nodes/recover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kind: 'regenerate-pairing-draft',
        nodeId: 'desktop-node',
      }),
    });
    const doctorPayload = await doctorResult.json();
    const recoverPayload = await recoverResult.json();

    await service.stopAsync();

    expect(doctorResult.status).toBe(401);
    expect(recoverResult.status).toBe(401);
    expect(doctorPayload.error).toBe('Unauthorized');
    expect(recoverPayload.error).toBe('Unauthorized');
  });

  it('exposes approve and revoke through the protected web surface', async () => {
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
        createdAt: '2026-04-02T22:15:00.000Z',
        updatedAt: '2026-04-02T22:15:00.000Z',
        pairedAt: '2026-04-02T22:15:00.000Z',
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
        createdAt: '2026-04-02T22:15:00.000Z',
        updatedAt: '2026-04-02T22:16:00.000Z',
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
        generatedAt: '2026-04-02T22:15:00.000Z',
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
          headline: 'Node Mesh ready.',
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
    const approveResult = await fetchDashboardJson(baseUrl, '/api/web/nodes/pairing/approve', {
      token: 'web-secret',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nodeId: 'oracle-node',
          pairingCode: 'PAIR-APPROVE-1',
        }),
      },
    });
    const revokeResult = await fetchDashboardJson(baseUrl, '/api/web/nodes/pairing/revoke', {
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
        pairingCode: 'PAIR-APPROVE-1',
      }),
    );
    expect(nodePairingService.revokePairing).toHaveBeenCalledWith('oracle-node', 'manual revoke');
  });

  it('returns 400 on invalid approve and revoke requests on the protected web surface', async () => {
    config.zavorthWebAuthToken = 'web-secret';
    const nodePairingService = {
      approvePairing: jest.fn(() => null),
      revokePairing: jest.fn(() => null),
    };
    const nodeMeshService = {
      buildSnapshot: jest.fn(() => ({
        generatedAt: '2026-04-02T22:20:00.000Z',
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
    const approveResult = await fetchDashboardJson(baseUrl, '/api/web/nodes/pairing/approve', {
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
    const revokeResult = await fetchDashboardJson(baseUrl, '/api/web/nodes/pairing/revoke', {
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

  it('updates approved capabilities on the protected web surface', async () => {
    config.zavorthWebAuthToken = 'web-secret';
    const nodePairingService = {
      setApprovedCapabilities: jest.fn(() => ({
        id: 'oracle-node',
        approvedCapabilityIds: ['files.read'],
        allowlistAudit: {
          approvedAt: '2026-04-02T22:30:00.000Z',
          approvedBy: 'web-user',
          reason: 'Allowlist ajustada no shell oficial.',
          mode: 'custom',
        },
      })),
    };
    const nodeMeshService = {
      buildSnapshot: jest.fn(() => ({
        generatedAt: '2026-04-02T22:30:00.000Z',
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
          approvedCapabilityIds: ['files.read'],
        },
        capabilityCatalog: [],
        suggestedActions: [],
        narrative: {
          headline: 'Node Mesh ready.',
          operatorSummary: '1 node online.',
        },
      })),
    };
    const service = new DashboardService(logRepo, {
      nodePairingService: nodePairingService as any,
      nodeMeshService: nodeMeshService as any,
    });

    await service.start();
    const result = await fetchDashboardJson(service.getUrl(), '/api/web/nodes/oracle-node/approved-capabilities', {
      token: 'web-secret',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          approvedCapabilityIds: ['files.read'],
        }),
      },
    });
    await service.stopAsync();

    expect(result.status).toBe(200);
    expect(nodePairingService.setApprovedCapabilities).toHaveBeenCalledWith(
      'oracle-node',
      ['files.read'],
      expect.objectContaining({
        approvedBy: 'web-user',
        mode: 'custom',
      }),
    );
    expect(result.payload.node.approvedCapabilityIds).toEqual(['files.read']);
    expect(result.payload.node.allowlistAudit).toEqual(
      expect.objectContaining({
        approvedBy: 'web-user',
        mode: 'custom',
      }),
    );
  });

  it('blocks approved capability updates on the protected web surface without auth', async () => {
    config.zavorthWebAuthToken = 'web-secret';
    const nodePairingService = {
      setApprovedCapabilities: jest.fn(),
    };
    const nodeMeshService = {
      buildSnapshot: jest.fn(),
    };
    const service = new DashboardService(logRepo, {
      nodePairingService: nodePairingService as any,
      nodeMeshService: nodeMeshService as any,
    });

    await service.start();
    const result = await fetchDashboardJson(service.getUrl(), '/api/web/nodes/oracle-node/approved-capabilities', {
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          approvedCapabilityIds: ['files.read'],
        }),
      },
    });
    await service.stopAsync();

    expect(result.status).toBe(401);
    expect(nodePairingService.setApprovedCapabilities).not.toHaveBeenCalled();
  });
});
