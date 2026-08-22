type NodeMeshLike = {
  buildSnapshot: (input: { selectedNodeId: string }) => unknown;
};

type ClaimPairingInput = {
  nodeId: string;
  pairingCode: string | null;
  capabilityIds: string[] | null;
  hostHints: Record<string, unknown> | null;
  operatorSummary: string | null;
};

type ReceiveHeartbeatInput = {
  nodeId: string;
  sharedSecret: string | null;
  status: string;
  capabilityIds: string[] | null;
  hostHints: Record<string, unknown> | null;
  results: unknown[] | null;
};

type ClaimResult = { node: { id: string } } | null;

type NodeHeartbeatLike = {
  claimPairing: (input: ClaimPairingInput) => ClaimResult;
  receiveHeartbeat: (input: ReceiveHeartbeatInput) => ClaimResult;
};

export type NodeMeshTransportRouteDeps = {
  nodeHeartbeat: NodeHeartbeatLike;
  nodeMesh?: NodeMeshLike | null;
};

export type NodeMeshTransportRouteResponse = {
  statusCode: number;
  body: Record<string, unknown>;
};

export class NodeMeshTransportRouteService {
  public handleClaim(
    body: Record<string, unknown>,
    deps: NodeMeshTransportRouteDeps,
  ): NodeMeshTransportRouteResponse {
    const claim = deps.nodeHeartbeat.claimPairing({
      nodeId: String(body.nodeId || '').trim(),
      pairingCode: String(body.pairingCode || '').trim() || null,
      capabilityIds: Array.isArray(body.capabilityIds) ? body.capabilityIds : null,
      hostHints: body.hostHints && typeof body.hostHints === 'object' ? body.hostHints as Record<string, unknown> : null,
      operatorSummary: String(body.operatorSummary || '').trim() || null,
    });
    if (!claim) {
      return {
        statusCode: 400,
        body: { ok: false, error: 'Could not complete the node claim.' },
      };
    }

    return {
      statusCode: 200,
      body: {
        ok: true,
        claim,
        nodeMesh: deps.nodeMesh?.buildSnapshot({ selectedNodeId: claim.node.id }) || null,
      },
    };
  }

  public handleHeartbeat(
    body: Record<string, unknown>,
    deps: NodeMeshTransportRouteDeps,
  ): NodeMeshTransportRouteResponse {
    const heartbeat = deps.nodeHeartbeat.receiveHeartbeat({
      nodeId: String(body.nodeId || '').trim(),
      sharedSecret: String(body.sharedSecret || '').trim() || null,
      status: String(body.status || '').trim(),
      capabilityIds: Array.isArray(body.capabilityIds) ? body.capabilityIds : null,
      hostHints: body.hostHints && typeof body.hostHints === 'object' ? body.hostHints as Record<string, unknown> : null,
      results: Array.isArray(body.results)
        ? body.results
        : (Array.isArray(body.completedInvocations) ? body.completedInvocations : null),
    });
    if (!heartbeat) {
      return {
        statusCode: 401,
        body: { ok: false, error: 'Heartbeat rejected para o node informado.' },
      };
    }

    return {
      statusCode: 200,
      body: {
        ok: true,
        heartbeat,
        nodeMesh: deps.nodeMesh?.buildSnapshot({ selectedNodeId: heartbeat.node.id }) || null,
      },
    };
  }
}
