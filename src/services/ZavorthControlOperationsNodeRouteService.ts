import * as http from 'http';
import { NodeMeshRecoveryService } from './NodeMeshRecoveryService.js';
import { NodeMeshTransportRouteService } from './NodeMeshTransportRouteService.js';
import { NodeOnboardingService } from './NodeOnboardingService.js';
type OperationsNodeDynamic = any;

type WriteJson = (res: http.ServerResponse, body: unknown, statusCode?: number) => void;
type ReadJsonBody = (req: http.IncomingMessage) => Promise<Record<string, OperationsNodeDynamic>>;
type EnsureAuthorized = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  errorMessage: string,
  statusCode: number,
) => boolean;

type NodeMeshLike = {
  buildSnapshot: (input?: OperationsNodeDynamic) => OperationsNodeDynamic;
  getNodeEntry?: (nodeId: string | null | undefined) => OperationsNodeDynamic;
  buildActivitySnapshot?: (nodeId: string | null | undefined) => OperationsNodeDynamic;
  buildCapabilitiesSnapshot?: (nodeId: string | null | undefined) => OperationsNodeDynamic;
};

type NodeInvokeLike = {
  invoke: (input: OperationsNodeDynamic) => OperationsNodeDynamic;
  requeueStaleClaimed?: (nodeId: string | null | undefined, limit?: number) => OperationsNodeDynamic[];
};

type NodePairingLike = {
  createPairingDraft: (input: OperationsNodeDynamic) => OperationsNodeDynamic;
  buildBootstrapForNode?: (nodeId: string | null | undefined) => OperationsNodeDynamic;
  regeneratePairingDraft?: (nodeId: string | null | undefined, input?: OperationsNodeDynamic) => OperationsNodeDynamic;
  approvePairing: (nodeId: string, input: OperationsNodeDynamic) => OperationsNodeDynamic;
  setApprovedCapabilities?: (
    nodeId: string,
    approvedCapabilityIds: OperationsNodeDynamic,
    input?: OperationsNodeDynamic,
  ) => OperationsNodeDynamic;
  revokePairing: (nodeId: string, reason: string | null) => OperationsNodeDynamic;
};

type NodeHeartbeatLike = {
  claimPairing: (input: OperationsNodeDynamic) => OperationsNodeDynamic;
  receiveHeartbeat: (input: OperationsNodeDynamic) => OperationsNodeDynamic;
};

export type ZavorthControlOperationsNodeRouteDeps = {
  continuityUserId: string | null;
  nodeMesh: NodeMeshLike;
  nodeInvoke: NodeInvokeLike;
  nodePairing: NodePairingLike;
  nodeHeartbeat: NodeHeartbeatLike;
  writeJson: WriteJson;
  readJsonBody: ReadJsonBody;
  ensureAuthorized: EnsureAuthorized;
};

export class ZavorthControlOperationsNodeRouteService {
  private readonly transportRoutes = new NodeMeshTransportRouteService();
  private readonly onboarding = new NodeOnboardingService();

  private buildRecoveryService(deps: ZavorthControlOperationsNodeRouteDeps): NodeMeshRecoveryService {
    return new NodeMeshRecoveryService({
      nodeMeshService: deps.nodeMesh as OperationsNodeDynamic,
      nodePairingService: deps.nodePairing as OperationsNodeDynamic,
      nodeInvokeService: deps.nodeInvoke as OperationsNodeDynamic,
    });
  }

  private matchNodeScopedRoute(pathname: string, suffix: string): string | null {
    const prefix = '/api/operations/nodes/';
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
    deps: ZavorthControlOperationsNodeRouteDeps,
  ): Promise<boolean> {
    if (pathname === '/api/operations/nodes') {
      deps.writeJson(
        res,
        deps.nodeMesh.buildSnapshot({
          selectedNodeId: String(url.searchParams.get('selectedId') || '').trim() || null,
        }),
        200,
      );
      return true;
    }

    if (pathname === '/api/operations/nodes/onboarding' && req.method === 'GET') {
      if (!deps.ensureAuthorized(req, res, 'Unauthorized', 401)) {
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

    if (pathname === '/api/operations/nodes/doctor' && req.method === 'GET') {
      if (!deps.ensureAuthorized(req, res, 'Unauthorized', 401)) {
        return true;
      }

      deps.writeJson(
        res,
        {
          ok: true,
          doctor: this.buildRecoveryService(deps).runDoctor(),
        },
        200,
      );
      return true;
    }

    const activityNodeId = this.matchNodeScopedRoute(pathname, '/activity');
    if (activityNodeId && req.method === 'GET') {
      const node = deps.nodeMesh.getNodeEntry?.(activityNodeId);
      const activity = deps.nodeMesh.buildActivitySnapshot?.(activityNodeId) || null;
      if (!node) {
        deps.writeJson(res, { ok: false, error: 'Node not found in the current mesh.' }, 404);
        return true;
      }

      deps.writeJson(res, { ok: true, node, activity }, 200);
      return true;
    }

    const capabilitiesNodeId = this.matchNodeScopedRoute(pathname, '/capabilities');
    if (capabilitiesNodeId && req.method === 'GET') {
      const node = deps.nodeMesh.getNodeEntry?.(capabilitiesNodeId);
      const capabilities = deps.nodeMesh.buildCapabilitiesSnapshot?.(capabilitiesNodeId) || null;
      if (!node || !capabilities) {
        deps.writeJson(res, { ok: false, error: 'Node not found in the current mesh.' }, 404);
        return true;
      }

      deps.writeJson(res, { ok: true, node, capabilities }, 200);
      return true;
    }

    const approvedCapabilitiesNodeId = this.matchNodeScopedRoute(pathname, '/approved-capabilities');
    if (approvedCapabilitiesNodeId && req.method === 'POST') {
      if (!deps.ensureAuthorized(req, res, 'Unauthorized', 401)) {
        return true;
      }

      if (!deps.nodePairing?.setApprovedCapabilities) {
        deps.writeJson(res, { ok: false, error: 'Policy do Node Mesh indisponivel.' }, 503);
        return true;
      }

      const body = await deps.readJsonBody(req);
      if (!Array.isArray(body.approvedCapabilityIds)) {
        deps.writeJson(res, { ok: false, error: 'approvedCapabilityIds precisa ser um array.' }, 400);
        return true;
      }

      const updated = deps.nodePairing.setApprovedCapabilities(approvedCapabilitiesNodeId, body.approvedCapabilityIds, {
        approvedBy: deps.continuityUserId || 'operations',
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

    if (pathname === '/api/operations/nodes/invoke' && req.method === 'POST') {
      if (!deps.ensureAuthorized(req, res, 'Unauthorized', 401)) {
        return true;
      }

      const body = await deps.readJsonBody(req);
      const result = deps.nodeInvoke.invoke({
        nodeId: String(body.nodeId || '').trim(),
        capabilityId: String(body.capabilityId || '').trim(),
        action: String(body.action || 'invoke').trim() || 'invoke',
        payload: body.payload && typeof body.payload === 'object' ? body.payload : null,
        requestedBy: String(body.requestedBy || deps.continuityUserId || '').trim() || null,
      });

      deps.writeJson(
        res,
        {
          ok: result.ok,
          invoke: result,
          nodeMesh: deps.nodeMesh.buildSnapshot({
            selectedNodeId: String(body.nodeId || '').trim() || null,
          }),
        },
        result.ok ? 202 : 400,
      );
      return true;
    }

    if (pathname === '/api/operations/nodes/pairing-draft' && req.method === 'POST') {
      if (!deps.ensureAuthorized(req, res, 'Unauthorized', 401)) {
        return true;
      }

      const body = await deps.readJsonBody(req);
      const draft = deps.nodePairing.createPairingDraft({
        nodeId: String(body.nodeId || '').trim() || null,
        profileId: String(body.profileId || '').trim() || null,
        label: String(body.label || '').trim() || null,
        kind: String(body.kind || '').trim() as OperationsNodeDynamic,
        transport: String(body.transport || '').trim() as OperationsNodeDynamic,
        capabilityIds: Array.isArray(body.capabilityIds) ? body.capabilityIds : null,
        approvedCapabilityIds: Array.isArray(body.approvedCapabilityIds) ? body.approvedCapabilityIds : null,
        requestedBy: String(body.requestedBy || deps.continuityUserId || '').trim() || null,
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

    if (pathname === '/api/operations/nodes/recover' && req.method === 'POST') {
      if (!deps.ensureAuthorized(req, res, 'Unauthorized', 401)) {
        return true;
      }

      const body = await deps.readJsonBody(req);
      const result = this.buildRecoveryService(deps).recover({
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

    if (pathname === '/api/operations/nodes/pairing/approve' && req.method === 'POST') {
      if (!deps.ensureAuthorized(req, res, 'Unauthorized', 401)) {
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
        deps.writeJson(res, { ok: false, error: 'Nao foi possivel validar o pairing informado.' }, 400);
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

    if (pathname === '/api/operations/nodes/pairing/revoke' && req.method === 'POST') {
      if (!deps.ensureAuthorized(req, res, 'Unauthorized', 401)) {
        return true;
      }

      const body = await deps.readJsonBody(req);
      const revoked = deps.nodePairing.revokePairing(
        String(body.nodeId || '').trim(),
        String(body.reason || '').trim() || null,
      );
      if (!revoked) {
        deps.writeJson(res, { ok: false, error: 'Nao foi possivel revogar o pairing informado.' }, 400);
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

    if (pathname === '/api/operations/nodes/pairing/claim' && req.method === 'POST') {
      if (!deps.ensureAuthorized(req, res, 'Unauthorized', 401)) {
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

    if (pathname === '/api/operations/nodes/heartbeat' && req.method === 'POST') {
      if (!deps.ensureAuthorized(req, res, 'Unauthorized', 401)) {
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
