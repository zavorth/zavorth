type NodeMeshLike = {
  buildSnapshot: (input?: any) => any;
};

type NodeHeartbeatLike = {
  claimPairing: (input: any) => any;
  receiveHeartbeat: (input: any) => any;
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
    body: Record<string, any>,
    deps: NodeMeshTransportRouteDeps,
  ): NodeMeshTransportRouteResponse {
    const claim = deps.nodeHeartbeat.claimPairing({
      nodeId: String(body.nodeId || '').trim(),
      pairingCode: String(body.pairingCode || '').trim() || null,
      capabilityIds: Array.isArray(body.capabilityIds) ? body.capabilityIds : null,
      hostHints: body.hostHints && typeof body.hostHints === 'object' ? body.hostHints : null,
      operatorSummary: String(body.operatorSummary || '').trim() || null,
    });
    if (!claim) {
      return {
        statusCode: 400,
        body: { ok: false, error: 'Nao foi possivel concluir o claim do node.' },
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
    body: Record<string, any>,
    deps: NodeMeshTransportRouteDeps,
  ): NodeMeshTransportRouteResponse {
    const heartbeat = deps.nodeHeartbeat.receiveHeartbeat({
      nodeId: String(body.nodeId || '').trim(),
      sharedSecret: String(body.sharedSecret || '').trim() || null,
      status: String(body.status || '').trim() as any,
      capabilityIds: Array.isArray(body.capabilityIds) ? body.capabilityIds : null,
      hostHints: body.hostHints && typeof body.hostHints === 'object' ? body.hostHints : null,
      results: Array.isArray(body.results)
        ? body.results
        : (Array.isArray(body.completedInvocations) ? body.completedInvocations : null),
    });
    if (!heartbeat) {
      return {
        statusCode: 401,
        body: { ok: false, error: 'Heartbeat rejeitado para o node informado.' },
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
