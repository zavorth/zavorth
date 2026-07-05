import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { BaseTool } from './BaseTool.js';
import { globalLiveNodeRegistry, LiveNodeRegistryService } from '../services/LiveNodeRegistryService.js';
import { NodeInvokeService } from '../services/NodeInvokeService.js';
import { NodeRegistryService } from '../services/NodeRegistryService.js';
import { ZavorthNodeMeshService } from '../services/ZavorthNodeMeshService.js';
import { logger } from '../logger.js';

type Runtime = {
  registryService?: NodeRegistryService;
  invokeService?: NodeInvokeService;
  nodeMeshService?: ZavorthNodeMeshService;
  liveNodeRegistry?: LiveNodeRegistryService;
};

type NodeMeshToolAction =
  | 'list'
  | 'live'
  | 'describe'
  | 'activity'
  | 'preview'
  | 'invoke'
  | 'pending'
  | 'recent'
  | 'disconnect';

function parseJsonObject(input: unknown): Record<string, unknown> | null {
  if (!input) {
    return null;
  }
  if (typeof input === 'object' && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  if (typeof input !== 'string') {
    return null;
  }
  const raw = input.trim();
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch (error) { logger.warn('[Node Mesh] JSON parse failed', error); return null; }
}

function parsePayload(input: unknown): { ok: true; payload: Record<string, unknown> } | { ok: false; error: string } {
  if (input === null || input === undefined || String(input || '').trim() === '') {
    return { ok: true, payload: {} };
  }
  const parsed = parseJsonObject(input);
  if (!parsed) {
    return {
      ok: false,
      error: 'Invalid payloadJson. Expected a JSON object and never raw secrets.',
    };
  }
  return { ok: true, payload: parsed };
}

function normalizeAction(input: unknown): NodeMeshToolAction {
  const raw = String(input || '').trim().toLowerCase();
  if (
    raw === 'list'
    || raw === 'live'
    || raw === 'describe'
    || raw === 'activity'
    || raw === 'preview'
    || raw === 'invoke'
    || raw === 'pending'
    || raw === 'recent'
    || raw === 'disconnect'
  ) {
    return raw;
  }
  return 'list';
}

function normalizeLimit(input: unknown): number {
  const value = Number(input);
  return Number.isFinite(value) ? Math.min(50, Math.max(1, Math.floor(value))) : 12;
}

export class NodeMeshTool extends BaseTool {
  public readonly name = 'nodes';
  public readonly description = [
    'Inspect and operate Zavorth Node Mesh companions.',
    'Use list/live/describe/activity freely for node awareness.',
    'Use preview before invoke; invoke only queues governed work for paired nodes and never serializes node secrets.',
  ].join(' ');
  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Node action: list, live, describe, activity, preview, invoke, pending, recent, disconnect.',
        enum: ['list', 'live', 'describe', 'activity', 'preview', 'invoke', 'pending', 'recent', 'disconnect'],
      },
      nodeId: {
        type: 'string',
        description: 'Target node id when the action needs a specific node.',
      },
      capabilityId: {
        type: 'string',
        description: 'Capability to preview or invoke, for example device.info, files.read, screen.capture, system.run.',
      },
      nodeAction: {
        type: 'string',
        description: 'Action name passed to the node capability when previewing or invoking.',
      },
      payloadJson: {
        type: 'string',
        description: 'JSON object payload for preview/invoke. Keep it minimal and never include raw secrets.',
      },
      limit: {
        type: 'number',
        description: 'Maximum recent or pending invocation records to return.',
      },
      requestedBy: {
        type: 'string',
        description: 'Optional actor/session label for audit receipts.',
      },
    },
    required: ['action'],
  };

  private readonly registryService: NodeRegistryService;
  private readonly invokeService: NodeInvokeService;
  private readonly nodeMeshService: ZavorthNodeMeshService;
  private readonly liveNodeRegistry: LiveNodeRegistryService;

  public constructor(runtime: Runtime = {}) {
    super();
    this.registryService = runtime.registryService || new NodeRegistryService();
    this.invokeService = runtime.invokeService || new NodeInvokeService({
      registryService: this.registryService,
    });
    this.nodeMeshService = runtime.nodeMeshService || new ZavorthNodeMeshService({
      registryService: this.registryService,
      invokeService: this.invokeService,
    });
    this.liveNodeRegistry = runtime.liveNodeRegistry || globalLiveNodeRegistry;
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = normalizeAction(args.action);
    const nodeId = String(args.nodeId || '').trim();
    const limit = normalizeLimit(args.limit);

    switch (action) {
      case 'live':
        return this.stringify({
          ok: true,
          action,
          live: this.liveNodeRegistry.buildSnapshot(),
        });
      case 'describe':
        return this.stringify({
          ok: Boolean(this.nodeMeshService.getNodeEntry(nodeId)),
          action,
          node: this.nodeMeshService.getNodeEntry(nodeId),
          live: this.liveNodeRegistry.buildSnapshot().sessions.find((session) => session.nodeId === nodeId) || null,
        });
      case 'activity':
        return this.stringify({
          ok: Boolean(this.nodeMeshService.buildActivitySnapshot(nodeId)),
          action,
          activity: this.nodeMeshService.buildActivitySnapshot(nodeId),
        });
      case 'pending':
        return this.stringify({
          ok: true,
          action,
          records: this.invokeService.listActive(nodeId || undefined, limit),
        });
      case 'recent':
        return this.stringify({
          ok: true,
          action,
          records: this.invokeService.listRecent(nodeId || undefined, limit),
        });
      case 'preview':
      case 'invoke':
        return this.handlePreviewOrInvoke(action, args);
      case 'disconnect':
        this.liveNodeRegistry.markDisconnected(nodeId, 'Disconnected through nodes tool.');
        return this.stringify({
          ok: true,
          action,
          live: this.liveNodeRegistry.buildSnapshot(),
        });
      case 'list':
      default:
        return this.stringify({
          ok: true,
          action: 'list',
          nodeMesh: this.nodeMeshService.buildSnapshot({ selectedNodeId: nodeId || null }),
          live: this.liveNodeRegistry.buildSnapshot(),
        });
    }
  }

  private handlePreviewOrInvoke(action: 'preview' | 'invoke', args: Record<string, unknown>): string {
    const nodeId = String(args.nodeId || '').trim();
    const capabilityId = String(args.capabilityId || '').trim();
    const nodeAction = String(args.nodeAction || args.actionName || 'invoke').trim() || 'invoke';
    if (!nodeId || !capabilityId) {
      return this.stringify({
        ok: false,
        action,
        error: 'nodeId and capabilityId are required for preview/invoke.',
        nextSafeAction: 'Run nodes with action=list or action=describe before invoking a companion.',
      });
    }
    const payloadResult = parsePayload(args.payloadJson || args.payload);
    if (!payloadResult.ok) {
      return this.stringify({
        ok: false,
        action,
        error: payloadResult.error,
        nextSafeAction: 'Pass payloadJson as a small JSON object, for example {"path":"README.md"}.',
      });
    }
    const request = {
      nodeId,
      capabilityId,
      action: nodeAction,
      payload: payloadResult.payload,
      requestedBy: String(args.requestedBy || 'llm-agent').trim() || 'llm-agent',
      surface: 'llm-nodes-tool',
    };
    const result = action === 'preview'
      ? this.invokeService.preview(request)
      : this.invokeService.invoke(request);
    return this.stringify({
      ok: result.ok,
      action,
      result,
      live: this.liveNodeRegistry.buildSnapshot().sessions.find((session) => session.nodeId === nodeId) || null,
      rawSecretsSerialized: false,
    });
  }

  private stringify(payload: Record<string, unknown>): string {
    return JSON.stringify(payload, null, 2);
  }
}
