import fs from 'fs';
import path from 'path';
import type { WebhookGateway } from './WebhookGateway.js';
import type { ChannelGatewayRegistry } from './ChannelGatewayRegistry.js';
import { logger } from '../logger.js';

export type ScaleToZeroConfig = {
  enabled: boolean;
  defaultIdleTimeoutMs: number;
  gatewayTimeouts: Record<string, number>;
  warmUpTimeoutMs: number;
  checkIntervalMs: number;
};

export type GatewayIdleState = {
  gatewayId: string;
  lastActivityAt: number;
  idleSince?: number;
  isIdle: boolean;
  isShutdown: boolean;
};

export type ScaleToZeroEvent = {
  type: 'shutdown' | 'warmup' | 'idle_detected';
  gatewayId: string;
  timestamp: number;
};

type ScaleToZeroStats = {
  totalShutdowns: number;
  totalWarmUps: number;
  totalIdleDetections: number;
  currentlyIdle: number;
  currentlyShutdown: number;
  eventsCount: number;
};

type PersistedState = {
  config: ScaleToZeroConfig;
  states: Record<string, GatewayIdleState>;
  events: ScaleToZeroEvent[];
};

interface LifecycleGateway {
  shutdown(): Promise<void>;
  initialize(): Promise<void>;
}

function isLifecycleGateway(gateway: unknown): gateway is LifecycleGateway {
  return (
    typeof gateway === 'object'
    && gateway !== null
    && typeof (gateway as LifecycleGateway).shutdown === 'function'
    && typeof (gateway as LifecycleGateway).initialize === 'function'
  );
}

const DEFAULT_CONFIG: ScaleToZeroConfig = {
  enabled: false,
  defaultIdleTimeoutMs: 300_000,
  gatewayTimeouts: {},
  warmUpTimeoutMs: 30_000,
  checkIntervalMs: 30_000,
};

export class ScaleToZeroManager {
  private config: ScaleToZeroConfig;
  private readonly states = new Map<string, GatewayIdleState>();
  private readonly events: ScaleToZeroEvent[] = [];
  private readonly pendingWarmUps = new Map<string, Promise<void>>();
  private readonly stateFilePath: string;
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private registry: ChannelGatewayRegistry | null = null;
  private onShutdown?: (gatewayId: string) => void | Promise<void>;
  private onWarmUp?: (gatewayId: string) => void | Promise<void>;

  constructor(options?: {
    stateFilePath?: string;
    registry?: ChannelGatewayRegistry;
    onShutdown?: (gatewayId: string) => void | Promise<void>;
    onWarmUp?: (gatewayId: string) => void | Promise<void>;
  }) {
    this.config = { ...DEFAULT_CONFIG };
    this.stateFilePath = options?.stateFilePath
      || path.join(process.cwd(), '.zavorth', 'scale-to-zero-state.json');
    this.registry = options?.registry || null;
    this.onShutdown = options?.onShutdown;
    this.onWarmUp = options?.onWarmUp;
    this.loadState();
  }

  configure(config: Partial<ScaleToZeroConfig>): void {
    this.config = { ...this.config, ...config };
    this.persistState();
  }

  getConfig(): ScaleToZeroConfig {
    return { ...this.config, gatewayTimeouts: { ...this.config.gatewayTimeouts } };
  }

  setRegistry(registry: ChannelGatewayRegistry): void {
    this.registry = registry;
  }

  start(): void {
    if (this.checkTimer) return;
    this.checkTimer = setInterval(() => {
      this.runCheck().catch((err) => { logger.warn("[auto-fix] Empty catch block", err); });
    }, this.config.checkIntervalMs);
  }

  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  recordActivity(gatewayId: string): void {
    const normalized = this.normalizeId(gatewayId);
    const now = Date.now();
    const existing = this.states.get(normalized);

    if (existing) {
      existing.lastActivityAt = now;
      if (existing.isShutdown) {
        existing.isShutdown = false;
      }
      if (existing.isIdle) {
        existing.isIdle = false;
        existing.idleSince = undefined;
      }
    } else {
      this.states.set(normalized, {
        gatewayId: normalized,
        lastActivityAt: now,
        isIdle: false,
        isShutdown: false,
      });
    }

    this.persistState();
  }

  isIdle(gatewayId: string): boolean {
    const normalized = this.normalizeId(gatewayId);
    const state = this.states.get(normalized);
    return state ? state.isIdle : false;
  }

  isShutdown(gatewayId: string): boolean {
    const normalized = this.normalizeId(gatewayId);
    const state = this.states.get(normalized);
    return state ? state.isShutdown : false;
  }

  async shutdown(gatewayId: string): Promise<boolean> {
    const normalized = this.normalizeId(gatewayId);
    const state = this.states.get(normalized);
    if (!state || state.isShutdown) return false;

    const gateway = this.registry?.resolveGateway(normalized);
    if (gateway && isLifecycleGateway(gateway)) {
      try {
        await gateway.shutdown();
      } catch (error) { logger.warn('[Scale To Zero Manager] filesystem check failed', error); return false; }
    }

    if (this.onShutdown) {
      try {
        await this.onShutdown(normalized);
      } catch (error) { logger.warn('[Scale To Zero Manager] filesystem check failed', error); return false; }
    }

    state.isShutdown = true;
    state.isIdle = true;
    this.recordEvent('shutdown', normalized);
    this.persistState();
    return true;
  }

  async warmUp(gatewayId: string): Promise<boolean> {
    const normalized = this.normalizeId(gatewayId);
    const state = this.states.get(normalized);
    if (!state || !state.isShutdown) return false;

    if (this.pendingWarmUps.has(normalized)) {
      return this.pendingWarmUps.get(normalized)!.then(() => true).catch(() => false);
    }

    const warmUpPromise = this.executeWarmUp(normalized);
    this.pendingWarmUps.set(normalized, warmUpPromise.then(() => {}));

    try {
      const result = await warmUpPromise;
      return result;
    } finally {
      this.pendingWarmUps.delete(normalized);
    }
  }

  private async executeWarmUp(gatewayId: string): Promise<boolean> {
    const gateway = this.registry?.resolveGateway(gatewayId);
    if (gateway && isLifecycleGateway(gateway)) {
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        setTimeout(() => reject(new Error('warmup_timeout')), this.config.warmUpTimeoutMs);
      });

      const initPromise = gateway.initialize().then(() => true).catch(() => false);

      try {
        await Promise.race([initPromise, timeoutPromise]);
      } catch (error) { logger.warn('[Scale To Zero Manager] operation failed', error); return false; }
    }

    if (this.onWarmUp) {
      try {
        await this.onWarmUp(gatewayId);
      } catch (error) { logger.warn('[Scale To Zero Manager] operation failed', error); return false; }
    }

    const state = this.states.get(gatewayId);
    if (state) {
      state.isShutdown = false;
      state.isIdle = false;
      state.idleSince = undefined;
      state.lastActivityAt = Date.now();
    }

    this.recordEvent('warmup', gatewayId);
    this.persistState();
    return true;
  }

  getStates(): GatewayIdleState[] {
    return Array.from(this.states.values()).map(s => ({ ...s }));
  }

  getState(gatewayId: string): GatewayIdleState | null {
    const normalized = this.normalizeId(gatewayId);
    const state = this.states.get(normalized);
    return state ? { ...state } : null;
  }

  getEvents(): ScaleToZeroEvent[] {
    return [...this.events];
  }

  getStats(): ScaleToZeroStats {
    let currentlyIdle = 0;
    let currentlyShutdown = 0;
    let totalShutdowns = 0;
    let totalWarmUps = 0;
    let totalIdleDetections = 0;

    for (const state of this.states.values()) {
      if (state.isIdle) currentlyIdle++;
      if (state.isShutdown) currentlyShutdown++;
    }

    for (const event of this.events) {
      switch (event.type) {
        case 'shutdown':
          totalShutdowns++;
          break;
        case 'warmup':
          totalWarmUps++;
          break;
        case 'idle_detected':
          totalIdleDetections++;
          break;
      }
    }

    return {
      totalShutdowns,
      totalWarmUps,
      totalIdleDetections,
      currentlyIdle,
      currentlyShutdown,
      eventsCount: this.events.length,
    };
  }

  private async runCheck(): Promise<void> {
    if (!this.config.enabled) return;
    const now = Date.now();

    for (const [gatewayId, state] of this.states.entries()) {
      if (state.isShutdown) continue;

      const idleTimeout = this.config.gatewayTimeouts[gatewayId]
        ?? this.config.defaultIdleTimeoutMs;
      const timeSinceLastActivity = now - state.lastActivityAt;

      if (timeSinceLastActivity >= idleTimeout) {
        if (!state.isIdle) {
          state.isIdle = true;
          state.idleSince = state.lastActivityAt + idleTimeout;
          this.recordEvent('idle_detected', gatewayId);
          this.persistState();
        }

        await this.shutdown(gatewayId);
      }
    }
  }

  private recordEvent(type: ScaleToZeroEvent['type'], gatewayId: string): void {
    this.events.push({
      type,
      gatewayId,
      timestamp: Date.now(),
    });
  }

  private normalizeId(value: string): string {
    return String(value || '').trim().toLowerCase();
  }

  private persistState(): void {
    try {
      const dir = path.dirname(this.stateFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const state: PersistedState = {
        config: this.config,
        states: Object.fromEntries(this.states),
        events: this.events,
      };

      fs.writeFileSync(this.stateFilePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (error) { // Persistence failure is non-critical logger.warn('[Scale To Zero Manager] filesystem operation failed', error); }
  }

  private loadState(): void {
    try {
      if (!fs.existsSync(this.stateFilePath)) return;

      const raw = fs.readFileSync(this.stateFilePath, 'utf-8');
      const persisted: PersistedState = JSON.parse(raw);

      if (persisted.config) {
        this.config = { ...DEFAULT_CONFIG, ...persisted.config };
      }

      if (persisted.states) {
        for (const [id, state] of Object.entries(persisted.states)) {
          this.states.set(id, state as GatewayIdleState);
        }
      }

      if (Array.isArray(persisted.events)) {
        this.events.push(...persisted.events);
      }
    } catch (error) { // Load failure is non-critical; start fresh logger.warn('[Scale To Zero Manager] operation failed', error); }
  }
}
