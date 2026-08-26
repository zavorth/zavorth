import * as http from 'http';
import { CompanionDistributionService } from '../nodes/companion/CompanionDistributionService.js';
import { NodeMeshRecoveryService } from './NodeMeshRecoveryService.js';
import { NodeMeshTransportRouteService } from './NodeMeshTransportRouteService.js';
import { NodeOnboardingService } from './NodeOnboardingService.js';
import type { SharedSurfaceRuntime } from '../orchestrator/SurfaceRuntime.js';
import { errorMessage } from '../utils/errorLike.js';
// Dynamic service bag: route handlers access node services by key.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NodeRouteDynamic = any;

type WriteJson = (res: http.ServerResponse, body: unknown, statusCode?: number) => void;
type ReadJsonBody = (req: http.IncomingMessage) => Promise<Record<string, NodeRouteDynamic>>;

type SnapshotReader = {
  buildSnapshot: (input?: NodeRouteDynamic) => NodeRouteDynamic;
  getNodeEntry?: (nodeId: string | null | undefined) => NodeRouteDynamic;
  buildActivitySnapshot?: (nodeId: string | null | undefined) => NodeRouteDynamic;
  buildCapabilitiesSnapshot?: (nodeId: string | null | undefined) => NodeRouteDynamic;
};

type NodeInvokeLike = {
  invoke: (input: NodeRouteDynamic) => NodeRouteDynamic;
  requeueStaleClaimed?: (nodeId: string | null | undefined, limit?: number) => NodeRouteDynamic[];
};

type NodePairingLike = {
  createPairingDraft: (input: NodeRouteDynamic) => NodeRouteDynamic;
  buildBootstrapForNode?: (nodeId: string | null | undefined) => NodeRouteDynamic;
  regeneratePairingDraft?: (nodeId: string | null | undefined, input?: NodeRouteDynamic) => NodeRouteDynamic;
  approvePairing: (nodeId: string, input: NodeRouteDynamic) => NodeRouteDynamic;
  setApprovedCapabilities?: (
    nodeId: string,
    approvedCapabilityIds: NodeRouteDynamic,
    input?: NodeRouteDynamic,
  ) => NodeRouteDynamic;
  revokePairing: (nodeId: string, reason: string | null) => NodeRouteDynamic;
};

type NodeHeartbeatLike = {
  claimPairing: (input: NodeRouteDynamic) => NodeRouteDynamic;
  receiveHeartbeat: (input: NodeRouteDynamic) => NodeRouteDynamic;
};

export type WebAppNodeRouteDeps = {
  nodeMesh: SnapshotReader | null;
  nodeInvoke: NodeInvokeLike | null;
  nodePairing: NodePairingLike | null;
  nodeHeartbeat: NodeHeartbeatLike | null;
  runtime: SharedSurfaceRuntime | null;
  writeJson: WriteJson;
  readJsonBody: ReadJsonBody;
};

export class WebAppNodeRouteService {
  private readonly transportRoutes = new NodeMeshTransportRouteService();
  private readonly onboarding = new NodeOnboardingService();
  private readonly companionDistribution = new CompanionDistributionService();

  private buildRecoveryService(deps: WebAppNodeRouteDeps): NodeMeshRecoveryService | null {
    if (!deps.nodeMesh) {
      return null;
    }
    return new NodeMeshRecoveryService({
      nodeMeshService: deps.nodeMesh as NodeRouteDynamic,
      nodePairingService: deps.nodePairing as NodeRouteDynamic,
      nodeInvokeService: deps.nodeInvoke as NodeRouteDynamic,
    });
  }

  private matchNodeScopedRoute(pathname: string, suffix: string): string | null {
    const prefix = '/api/web/nodes/';
    if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) {
      return null;
    }

    const rawNodeId = pathname.slice(prefix.length, pathname.length - suffix.length);
    const normalizedNodeId = decodeURIComponent(rawNodeId || '').trim();
    return normalizedNodeId || null;
  }

  public async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL,
    pathname: string,
    deps: WebAppNodeRouteDeps,
  ): Promise<boolean> {
    if (pathname === '/api/web/nodes' && req.method === 'GET') {
      if (!deps.nodeMesh) {
        deps.writeJson(res, { ok: false, error: 'Node Mesh unavailable.' }, 503);
        return true;
      }
      const selectedNodeId = String(url.searchParams.get('selectedId') || '').trim() || null;
      const nodeMesh = deps.nodeMesh.buildSnapshot({
        selectedNodeId,
      });

      deps.writeJson(
        res,
        {
          ok: true,
          nodeMesh,
          onboarding: this.onboarding.buildOnboardingSnapshot({
            nodeMeshSnapshot: nodeMesh,
            selectedNodeId,
          }),
        },
        200,
      );
      return true;
    }

    if (pathname === '/api/web/nodes/onboarding' && req.method === 'GET') {
      if (!deps.nodeMesh) {
        deps.writeJson(res, { ok: false, error: 'Onboarding do Node Mesh unavailable.' }, 503);
        return true;
      }
      const selectedNodeId = String(url.searchParams.get('selectedId') || '').trim() || null;
      const nodeMesh = deps.nodeMesh.buildSnapshot({ selectedNodeId });
      const bootstrapDraft =
        selectedNodeId && deps.nodePairing?.buildBootstrapForNode
          ? deps.nodePairing.buildBootstrapForNode(selectedNodeId)
          : null;
      deps.writeJson(
        res,
        {
          ok: true,
          onboarding: this.onboarding.buildOnboardingSnapshot({
            nodeMeshSnapshot: nodeMesh,
            selectedNodeId,
            bootstrapDraft,
          }),
          nodeMesh,
        },
        200,
      );
      return true;
    }

    if (pathname === '/api/web/nodes/companion/manifest' && req.method === 'GET') {
      try {
        const bundle = this.companionDistribution.buildBundle();
        deps.writeJson(
          res,
          {
            ok: true,
            manifest: bundle.manifest,
          },
          200,
        );
      } catch (error: unknown) {
        deps.writeJson(
          res,
          {
            ok: false,
            error: errorMessage(error, 'Manifesto do companion unavailable.'),
            actionHint: 'Run npm run build before publishing the official bundle do companion.',
          },
          503,
        );
      }
      return true;
    }

    if (pathname === '/api/web/nodes/companion/download' && req.method === 'GET') {
      try {
        const download = this.companionDistribution.buildLauncherDownload();
        res.writeHead(200, {
          'Content-Type': download.contentType,
          'Content-Disposition': `attachment; filename="${download.fileName}"`,
          'X-Zavorth-Companion-SHA256': download.bundle.manifest.sha256,
        });
        res.end(download.body);
      } catch (error: unknown) {
        deps.writeJson(
          res,
          {
            ok: false,
            error: errorMessage(error, 'Download do companion unavailable.'),
            actionHint: 'Run npm run build before publishing the official launcher do companion.',
          },
          503,
        );
      }
      return true;
    }

    if (pathname === '/api/web/nodes/doctor' && req.method === 'GET') {
      const recovery = this.buildRecoveryService(deps);
      if (!recovery) {
        deps.writeJson(res, { ok: false, error: 'Doctor do Node Mesh unavailable.' }, 503);
        return true;
      }

      deps.writeJson(
        res,
        {
          ok: true,
          doctor: recovery.runDoctor(),
        },
        200,
      );
      return true;
    }

    const activityNodeId = this.matchNodeScopedRoute(pathname, '/activity');
    if (activityNodeId && req.method === 'GET') {
      if (!deps.nodeMesh?.getNodeEntry || !deps.nodeMesh?.buildActivitySnapshot) {
        deps.writeJson(res, { ok: false, error: 'Atividade do Node Mesh unavailable.' }, 503);
        return true;
      }

      const node = deps.nodeMesh.getNodeEntry(activityNodeId);
      if (!node) {
        deps.writeJson(res, { ok: false, error: 'Node not found in the current mesh.' }, 404);
        return true;
      }

      deps.writeJson(
        res,
        {
          ok: true,
          node,
          activity: deps.nodeMesh.buildActivitySnapshot(activityNodeId),
        },
        200,
      );
      return true;
    }

    const capabilitiesNodeId = this.matchNodeScopedRoute(pathname, '/capabilities');
    if (capabilitiesNodeId && req.method === 'GET') {
      if (!deps.nodeMesh?.getNodeEntry || !deps.nodeMesh?.buildCapabilitiesSnapshot) {
        deps.writeJson(res, { ok: false, error: 'Capabilities do Node Mesh indisponiveis.' }, 503);
        return true;
      }

      const node = deps.nodeMesh.getNodeEntry(capabilitiesNodeId);
      const capabilities = deps.nodeMesh.buildCapabilitiesSnapshot(capabilitiesNodeId);
      if (!node || !capabilities) {
        deps.writeJson(res, { ok: false, error: 'Node not found in the current mesh.' }, 404);
        return true;
      }

      deps.writeJson(
        res,
        {
          ok: true,
          node,
          capabilities,
        },
        200,
      );
      return true;
    }

    const bootstrapNodeId = this.matchNodeScopedRoute(pathname, '/bootstrap');
    if (bootstrapNodeId && req.method === 'GET') {
      if (!deps.nodePairing?.buildBootstrapForNode || !deps.nodeMesh) {
        deps.writeJson(res, { ok: false, error: 'Bootstrap do Node Mesh unavailable.' }, 503);
        return true;
      }

      const draft = deps.nodePairing.buildBootstrapForNode(bootstrapNodeId);
      if (!draft) {
        deps.writeJson(res, { ok: false, error: 'Node not found or no pending bootstrap in the current mesh.' }, 404);
        return true;
      }
      const nodeMesh = deps.nodeMesh.buildSnapshot({ selectedNodeId: draft.entry.id });

      deps.writeJson(
        res,
        {
          ok: true,
          draft,
          onboarding: this.onboarding.buildOnboardingSnapshot({
            nodeMeshSnapshot: nodeMesh,
            selectedNodeId: draft.entry.id,
            bootstrapDraft: draft,
          }),
          nodeMesh,
        },
        200,
      );
      return true;
    }

    const approvedCapabilitiesNodeId = this.matchNodeScopedRoute(pathname, '/approved-capabilities');
    if (approvedCapabilitiesNodeId && req.method === 'POST') {
      if (!deps.nodePairing?.setApprovedCapabilities || !deps.nodeMesh) {
        deps.writeJson(res, { ok: false, error: 'Policy do Node Mesh unavailable.' }, 503);
        return true;
      }

      const body = await deps.readJsonBody(req);
      if (!Array.isArray(body.approvedCapabilityIds)) {
        deps.writeJson(res, { ok: false, error: 'approvedCapabilityIds must be an array.' }, 400);
        return true;
      }

      const updated = deps.nodePairing.setApprovedCapabilities(approvedCapabilitiesNodeId, body.approvedCapabilityIds, {
        approvedBy: deps.runtime?.webUserId || 'web-user',
        reason: String(body.reason || '').trim() || null,
        mode: String(body.mode || '').trim() || (body.approvedCapabilityIds.length > 0 ? 'custom' : 'clear'),
      });
      if (!updated) {
        deps.writeJson(res, { ok: false, error: 'Node not found in the current mesh.' }, 404);
        return true;
      }

      deps.writeJson(
        res,
        {
          ok: true,
          node: updated,
          nodeMesh: deps.nodeMesh.buildSnapshot({ selectedNodeId: updated.id }),
        },
        200,
      );
      return true;
    }

    if (pathname === '/api/web/nodes/invoke' && req.method === 'POST') {
      if (!deps.nodeInvoke || !deps.nodeMesh) {
        deps.writeJson(res, { ok: false, error: 'Invoke do Node Mesh unavailable.' }, 503);
        return true;
      }

      const body = await deps.readJsonBody(req);
      const invoke = deps.nodeInvoke.invoke({
        nodeId: String(body.nodeId || '').trim(),
        capabilityId: String(body.capabilityId || '').trim(),
        action: String(body.action || 'invoke').trim() || 'invoke',
        payload: body.payload && typeof body.payload === 'object' ? body.payload : null,
        requestedBy: String(body.requestedBy || deps.runtime?.webUserId || '').trim() || null,
      });

      deps.writeJson(
        res,
        {
          ok: invoke.ok,
          invoke,
          nodeMesh: deps.nodeMesh.buildSnapshot({
            selectedNodeId: String(body.nodeId || '').trim() || null,
          }),
        },
        invoke.ok ? 202 : 400,
      );
      return true;
    }

    if (pathname === '/api/web/nodes/pairing-draft' && req.method === 'POST') {
      if (!deps.nodePairing || !deps.nodeMesh) {
        deps.writeJson(res, { ok: false, error: 'Pairing do Node Mesh unavailable.' }, 503);
        return true;
      }

      const body = await deps.readJsonBody(req);
      const draft = deps.nodePairing.createPairingDraft({
        nodeId: String(body.nodeId || '').trim() || null,
        profileId: String(body.profileId || '').trim() || null,
        label: String(body.label || '').trim() || null,
        kind: String(body.kind || '').trim() as NodeRouteDynamic,
        transport: String(body.transport || '').trim() as NodeRouteDynamic,
        capabilityIds: Array.isArray(body.capabilityIds) ? body.capabilityIds : null,
        approvedCapabilityIds: Array.isArray(body.approvedCapabilityIds) ? body.approvedCapabilityIds : null,
        requestedBy: String(body.requestedBy || deps.runtime?.webUserId || '').trim() || null,
        hostHints: body.hostHints && typeof body.hostHints === 'object' ? body.hostHints : null,
        notes: Array.isArray(body.notes) ? body.notes : null,
      });
      const nodeMesh = deps.nodeMesh.buildSnapshot({ selectedNodeId: draft.entry.id });
      deps.writeJson(
        res,
        {
          ok: true,
          draft,
          onboarding: this.onboarding.buildOnboardingSnapshot({
            nodeMeshSnapshot: nodeMesh,
            selectedNodeId: draft.entry.id,
            bootstrapDraft: draft,
          }),
          nodeMesh,
        },
        200,
      );
      return true;
    }

    if (pathname === '/api/web/nodes/recover' && req.method === 'POST') {
      const recovery = this.buildRecoveryService(deps);
      if (!recovery) {
        deps.writeJson(res, { ok: false, error: 'Recover do Node Mesh unavailable.' }, 503);
        return true;
      }

      const body = await deps.readJsonBody(req);
      const result = recovery.recover({
        actionId: String(body.actionId || '').trim() || null,
        kind: String(body.kind || '').trim() || null,
        nodeId: String(body.nodeId || '').trim() || null,
        limit: body.limit,
        profileId: String(body.profileId || '').trim() || null,
        label: String(body.label || '').trim() || null,
        notes: Array.isArray(body.notes) ? body.notes : null,
      });

      deps.writeJson(
        res,
        {
          ok: result.ok,
          recover: result,
        },
        result.ok ? 200 : 400,
      );
      return true;
    }

    if (pathname === '/api/web/nodes/pairing/approve' && req.method === 'POST') {
      if (!deps.nodePairing || !deps.nodeMesh) {
        deps.writeJson(res, { ok: false, error: 'Pairing do Node Mesh unavailable.' }, 503);
        return true;
      }

      const body = await deps.readJsonBody(req);
      const approved = deps.nodePairing.approvePairing(String(body.nodeId || '').trim(), {
        pairingCode: String(body.pairingCode || '').trim() || null,
        capabilityIds: Array.isArray(body.capabilityIds) ? body.capabilityIds : null,
        approvedCapabilityIds: Array.isArray(body.approvedCapabilityIds) ? body.approvedCapabilityIds : null,
        hostHints: body.hostHints && typeof body.hostHints === 'object' ? body.hostHints : null,
        operatorSummary: String(body.operatorSummary || '').trim() || null,
      });
      if (!approved) {
        deps.writeJson(res, { ok: false, error: 'Could not validate the provided pairing.' }, 400);
        return true;
      }

      deps.writeJson(
        res,
        {
          ok: true,
          node: approved,
          nodeMesh: deps.nodeMesh.buildSnapshot({ selectedNodeId: approved.id }),
        },
        200,
      );
      return true;
    }

    if (pathname === '/api/web/nodes/pairing/revoke' && req.method === 'POST') {
      if (!deps.nodePairing || !deps.nodeMesh) {
        deps.writeJson(res, { ok: false, error: 'Pairing do Node Mesh unavailable.' }, 503);
        return true;
      }

      const body = await deps.readJsonBody(req);
      const revoked = deps.nodePairing.revokePairing(
        String(body.nodeId || '').trim(),
        String(body.reason || '').trim() || null,
      );
      if (!revoked) {
        deps.writeJson(res, { ok: false, error: 'Could not revoke the provided pairing.' }, 400);
        return true;
      }

      deps.writeJson(
        res,
        {
          ok: true,
          node: revoked,
          nodeMesh: deps.nodeMesh.buildSnapshot({ selectedNodeId: revoked.id }),
        },
        200,
      );
      return true;
    }

    if (pathname === '/api/web/nodes/pairing/claim' && req.method === 'POST') {
      if (!deps.nodeHeartbeat || !deps.nodeMesh) {
        deps.writeJson(res, { ok: false, error: 'Claim do Node Mesh unavailable.' }, 503);
        return true;
      }

      const body = await deps.readJsonBody(req);
      const result = this.transportRoutes.handleClaim(body, {
        nodeHeartbeat: deps.nodeHeartbeat,
        nodeMesh: deps.nodeMesh,
      });
      deps.writeJson(res, result.body, result.statusCode);
      return true;
    }

    if (pathname === '/api/web/nodes/heartbeat' && req.method === 'POST') {
      if (!deps.nodeHeartbeat || !deps.nodeMesh) {
        deps.writeJson(res, { ok: false, error: 'Heartbeat do Node Mesh unavailable.' }, 503);
        return true;
      }

      const body = await deps.readJsonBody(req);
      const result = this.transportRoutes.handleHeartbeat(body, {
        nodeHeartbeat: deps.nodeHeartbeat,
        nodeMesh: deps.nodeMesh,
      });
      deps.writeJson(res, result.body, result.statusCode);
      return true;
    }

    return false;
  }
}
