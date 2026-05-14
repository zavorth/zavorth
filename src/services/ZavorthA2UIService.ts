export interface A2UIComponent {
  type: string;
  id: string;
  props: Record<string, any>;
  children?: A2UIComponent[];
}

export interface A2UISurfaceState {
  surfaceId: string;
  components: A2UIComponent[];
  dataModel: Record<string, any>;
  lastUpdated: string;
  metadata?: Record<string, unknown>;
}

export interface A2UIAssetRecord {
  id: string;
  surfaceId: string;
  kind: string;
  mimeType: string;
  contentUrl?: string | null;
  contentBase64?: string | null;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface A2UIEventRecord {
  id: string;
  surfaceId: string;
  eventType:
    | 'surface_initialized'
    | 'snapshot_updated'
    | 'data_model_updated'
    | 'asset_linked'
    | 'action_dispatched'
    | 'action_completed'
    | 'action_blocked';
  createdAt: string;
  payload: Record<string, unknown>;
}

export interface A2UISnapshot {
  generatedAt: string;
  protocolVersion: 'a2ui.v1';
  capabilities: Array<'snapshot' | 'action' | 'event' | 'stream' | 'asset'>;
  allowedComponents: string[];
  surfaceId: string | null;
  surfaces: A2UISurfaceState[];
  commands: {
    snapshot: string;
    action: string;
    events: string;
    stream: string;
    assets: string;
  };
}

export interface A2UIStreamSnapshot {
  generatedAt: string;
  protocolVersion: 'a2ui.v1';
  surfaceId: string | null;
  items: A2UIEventRecord[];
  commands: {
    events: string;
    action: string;
  };
}

export interface A2UIActionRequest {
  surfaceId: string;
  actionId: string;
  requestedBy?: string;
  payload?: Record<string, unknown>;
  correlation?: Record<string, unknown> | null;
}

export interface A2UIActionResult {
  ok: boolean;
  surfaceId: string;
  actionId: string;
  status: 'accepted' | 'blocked' | 'not_found' | 'error';
  summary: string;
  event: A2UIEventRecord | null;
  data?: Record<string, unknown> | null;
}

type A2UIActionHandler = (request: A2UIActionRequest) => Promise<Record<string, unknown> | void> | Record<string, unknown> | void;

type ZavorthA2UIRuntime = {
  now?: () => Date;
  maxEventsPerSurface?: number;
  maxAssetsPerSurface?: number;
  allowedComponents?: string[];
};

const DEFAULT_ALLOWED_COMPONENTS = [
  'stack',
  'panel',
  'section',
  'text',
  'badge',
  'button',
  'list',
  'table',
  'image',
  'metric',
  'timeline',
  'form',
  'input',
] as const;

/**
 * ZavorthA2UIService
 * Stores declarative surface snapshots and a bounded event stream so adapters
 * can consume the protocol through snapshot, action, event, stream and asset.
 */
export class ZavorthA2UIService {
  private readonly now: () => Date;
  private readonly maxEventsPerSurface: number;
  private readonly maxAssetsPerSurface: number;
  private readonly allowedComponentTypes: Set<string>;
  private readonly surfaces = new Map<string, A2UISurfaceState>();
  private readonly events = new Map<string, A2UIEventRecord[]>();
  private readonly assets = new Map<string, A2UIAssetRecord[]>();
  private readonly actionHandlers = new Map<string, A2UIActionHandler>();

  constructor(runtime: ZavorthA2UIRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.maxEventsPerSurface = Math.max(10, Number(runtime.maxEventsPerSurface || 50));
    this.maxAssetsPerSurface = Math.max(5, Number(runtime.maxAssetsPerSurface || 25));
    this.allowedComponentTypes = new Set(
      (runtime.allowedComponents || Array.from(DEFAULT_ALLOWED_COMPONENTS))
        .map((entry) => this.normalizeComponentType(entry))
        .filter(Boolean),
    );
  }

  public beginRendering(
    surfaceId: string,
    initialData: Record<string, any> = {},
    metadata: Record<string, unknown> = {},
  ): A2UISurfaceState {
    const normalizedSurfaceId = this.normalizeSurfaceId(surfaceId);
    const state: A2UISurfaceState = {
      surfaceId: normalizedSurfaceId,
      components: [],
      dataModel: this.clone(initialData || {}),
      lastUpdated: this.timestamp(),
      metadata: this.clone(metadata || {}),
    };
    this.surfaces.set(normalizedSurfaceId, state);
    this.appendEvent(normalizedSurfaceId, 'surface_initialized', {
      metadata: state.metadata || {},
    });
    return this.cloneSurface(state);
  }

  public updateSurface(surfaceId: string, components: A2UIComponent[]): boolean {
    const state = this.surfaces.get(this.normalizeSurfaceId(surfaceId));
    if (!state) {
      return false;
    }

    const blockedTypes: string[] = [];
    state.components = this.sanitizeComponents(Array.isArray(components) ? components : [], blockedTypes);
    state.lastUpdated = this.timestamp();
    this.appendEvent(state.surfaceId, 'snapshot_updated', {
      components: state.components.length,
      blockedTypes,
    });
    return true;
  }

  public updateDataModel(surfaceId: string, partialData: Record<string, any>): boolean {
    const state = this.surfaces.get(this.normalizeSurfaceId(surfaceId));
    if (!state) {
      return false;
    }

    state.dataModel = {
      ...state.dataModel,
      ...this.clone(partialData || {}),
    };
    state.lastUpdated = this.timestamp();
    this.appendEvent(state.surfaceId, 'data_model_updated', {
      keys: Object.keys(partialData || {}),
    });
    return true;
  }

  public writeAsset(
    surfaceId: string,
    input: {
      kind: string;
      mimeType: string;
      contentUrl?: string | null;
      contentBase64?: string | null;
      metadata?: Record<string, unknown>;
    },
  ): A2UIAssetRecord | null {
    const state = this.surfaces.get(this.normalizeSurfaceId(surfaceId));
    if (!state) {
      return null;
    }

    const record: A2UIAssetRecord = {
      id: this.buildId('asset'),
      surfaceId: state.surfaceId,
      kind: this.normalizeText(input.kind, 'asset'),
      mimeType: this.normalizeText(input.mimeType, 'application/octet-stream'),
      contentUrl: this.normalizeNullableText(input.contentUrl),
      contentBase64: this.normalizeNullableText(input.contentBase64),
      createdAt: this.timestamp(),
      metadata: this.clone(input.metadata || {}),
    };
    const entries = this.assets.get(state.surfaceId) || [];
    entries.push(record);
    if (entries.length > this.maxAssetsPerSurface) {
      entries.splice(0, entries.length - this.maxAssetsPerSurface);
    }
    this.assets.set(state.surfaceId, entries);
    this.appendEvent(state.surfaceId, 'asset_linked', {
      assetId: record.id,
      kind: record.kind,
      mimeType: record.mimeType,
    });
    return this.clone(record);
  }

  public registerActionHandler(surfaceId: string, actionId: string, handler: A2UIActionHandler): void {
    const key = this.buildActionKey(surfaceId, actionId);
    this.actionHandlers.set(key, handler);
  }

  public async dispatchAction(request: A2UIActionRequest): Promise<A2UIActionResult> {
    const surfaceId = this.normalizeSurfaceId(request.surfaceId);
    const actionId = this.normalizeText(request.actionId);
    const state = this.surfaces.get(surfaceId);
    if (!state) {
      return {
        ok: false,
        surfaceId,
        actionId,
        status: 'not_found',
        summary: `Surface "${surfaceId}" nao encontrada.`,
        event: null,
        data: null,
      };
    }

    const handler = this.resolveActionHandler(surfaceId, actionId);
    if (!handler) {
      const event = this.appendEvent(surfaceId, 'action_blocked', {
        actionId,
        reason: 'handler_missing',
      });
      return {
        ok: false,
        surfaceId,
        actionId,
        status: 'blocked',
        summary: `Action "${actionId}" nao esta registrada para a surface "${surfaceId}".`,
        event,
        data: null,
      };
    }

    const dispatchedEvent = this.appendEvent(surfaceId, 'action_dispatched', {
      actionId,
      requestedBy: this.normalizeText(request.requestedBy, 'unknown'),
      correlation: this.clone(request.correlation || {}),
    });

    try {
      const handlerResult = await handler({
        ...request,
        surfaceId,
        actionId,
        requestedBy: this.normalizeText(request.requestedBy, 'unknown'),
        payload: this.clone(request.payload || {}),
        correlation: request.correlation ? this.clone(request.correlation) : null,
      });
      const completionEvent = this.appendEvent(surfaceId, 'action_completed', {
        actionId,
        requestedBy: this.normalizeText(request.requestedBy, 'unknown'),
      });
      return {
        ok: true,
        surfaceId,
        actionId,
        status: 'accepted',
        summary: `Action "${actionId}" aceita para a surface "${surfaceId}".`,
        event: completionEvent,
        data: handlerResult ? this.clone(handlerResult) : null,
      };
    } catch (error: any) {
      const event = this.appendEvent(surfaceId, 'action_blocked', {
        actionId,
        reason: error?.message || 'unknown_error',
      });
      return {
        ok: false,
        surfaceId,
        actionId,
        status: 'error',
        summary: `Falha ao despachar action "${actionId}": ${error?.message || 'erro desconhecido'}.`,
        event: event || dispatchedEvent,
        data: null,
      };
    }
  }

  public getSurfaceState(surfaceId: string): A2UISurfaceState | undefined {
    const state = this.surfaces.get(this.normalizeSurfaceId(surfaceId));
    return state ? this.cloneSurface(state) : undefined;
  }

  public listSurfaces(): A2UISurfaceState[] {
    return Array.from(this.surfaces.values()).map((state) => this.cloneSurface(state));
  }

  public listEvents(surfaceId?: string, limit?: number): A2UIEventRecord[] {
    const entries = surfaceId
      ? (this.events.get(this.normalizeSurfaceId(surfaceId)) || [])
      : Array.from(this.events.values()).flat();
    const normalizedLimit = this.normalizeLimit(limit, this.maxEventsPerSurface);
    return entries.slice(-normalizedLimit).map((event) => this.clone(event));
  }

  public listAssets(surfaceId?: string): A2UIAssetRecord[] {
    const entries = surfaceId
      ? (this.assets.get(this.normalizeSurfaceId(surfaceId)) || [])
      : Array.from(this.assets.values()).flat();
    return entries.map((asset) => this.clone(asset));
  }

  public readSnapshot(surfaceId?: string): A2UISnapshot {
    const normalizedSurfaceId = this.normalizeNullableText(surfaceId);
    const surfaces = normalizedSurfaceId
      ? this.listSurfaces().filter((entry) => entry.surfaceId === normalizedSurfaceId)
      : this.listSurfaces();
    return {
      generatedAt: this.timestamp(),
      protocolVersion: 'a2ui.v1',
      capabilities: ['snapshot', 'action', 'event', 'stream', 'asset'],
      allowedComponents: Array.from(this.allowedComponentTypes.values()).sort(),
      surfaceId: normalizedSurfaceId,
      surfaces,
      commands: {
        snapshot: '/api/v2/a2ui/snapshot',
        action: '/api/v2/a2ui/action',
        events: '/api/v2/a2ui/events',
        stream: '/api/v2/a2ui/stream',
        assets: '/api/v2/a2ui/assets',
      },
    };
  }

  public readStream(surfaceId?: string, limit?: number): A2UIStreamSnapshot {
    return {
      generatedAt: this.timestamp(),
      protocolVersion: 'a2ui.v1',
      surfaceId: this.normalizeNullableText(surfaceId),
      items: this.listEvents(surfaceId, limit),
      commands: {
        events: '/api/v2/a2ui/events',
        action: '/api/v2/a2ui/action',
      },
    };
  }

  private sanitizeComponents(
    components: A2UIComponent[],
    blockedTypes: string[],
  ): A2UIComponent[] {
    return components.flatMap((component, index) => {
      const type = this.normalizeComponentType(component?.type);
      if (!type || !this.allowedComponentTypes.has(type)) {
        blockedTypes.push(String(component?.type || 'unknown'));
        return [];
      }
      return [{
        type,
        id: this.normalizeText(component?.id, `component_${index}`),
        props: this.clone(component?.props || {}),
        children: component?.children
          ? this.sanitizeComponents(component.children, blockedTypes)
          : undefined,
      }];
    });
  }

  private resolveActionHandler(surfaceId: string, actionId: string): A2UIActionHandler | null {
    return this.actionHandlers.get(this.buildActionKey(surfaceId, actionId))
      || this.actionHandlers.get(this.buildActionKey(surfaceId, '*'))
      || this.actionHandlers.get(this.buildActionKey('*', actionId))
      || this.actionHandlers.get(this.buildActionKey('*', '*'))
      || null;
  }

  private appendEvent(
    surfaceId: string,
    eventType: A2UIEventRecord['eventType'],
    payload: Record<string, unknown>,
  ): A2UIEventRecord {
    const event: A2UIEventRecord = {
      id: this.buildId('evt'),
      surfaceId: this.normalizeSurfaceId(surfaceId),
      eventType,
      createdAt: this.timestamp(),
      payload: this.clone(payload || {}),
    };
    const entries = this.events.get(event.surfaceId) || [];
    entries.push(event);
    if (entries.length > this.maxEventsPerSurface) {
      entries.splice(0, entries.length - this.maxEventsPerSurface);
    }
    this.events.set(event.surfaceId, entries);
    return this.clone(event);
  }

  private cloneSurface(state: A2UISurfaceState): A2UISurfaceState {
    return {
      ...state,
      components: this.clone(state.components || []),
      dataModel: this.clone(state.dataModel || {}),
      metadata: this.clone(state.metadata || {}),
    };
  }

  private buildActionKey(surfaceId: string, actionId: string): string {
    return `${this.normalizeSurfaceId(surfaceId)}::${this.normalizeText(actionId, '*')}`;
  }

  private buildId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private timestamp(): string {
    return this.now().toISOString();
  }

  private normalizeLimit(value: unknown, fallback: number): number {
    const numeric = Number(value || fallback) || fallback;
    return Math.max(1, Math.min(Math.round(numeric), fallback));
  }

  private normalizeSurfaceId(value: unknown): string {
    return this.normalizeText(value, 'default-surface');
  }

  private normalizeComponentType(value: unknown): string {
    return this.normalizeText(value).toLowerCase();
  }

  private normalizeNullableText(value: unknown): string | null {
    const normalized = this.normalizeText(value);
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeText(value: unknown, fallback = ''): string {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
  }
}
