export interface GatewayMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  uptime: number;
}

export interface GatewayInfo {
  id: string;
  name: string;
  type: string;
  status: 'running' | 'stopped' | 'draining' | 'starting' | 'error';
  startedAt?: string;
  lastActivityAt?: string;
  metrics: GatewayMetrics;
}

export interface GatewayEvent {
  type: 'started' | 'stopped' | 'draining' | 'error' | 'health_check';
  gatewayId: string;
  timestamp: string;
  data?: unknown;
}

export type GatewayEventCallback = (event: GatewayEvent) => void;

export class GatewayLifecycleService {
  private gateways: Map<string, GatewayInfo> = new Map();
  private eventCallbacks: GatewayEventCallback[] = [];
  private healthCheckIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();

  registerGateway(info: Omit<GatewayInfo, 'metrics'>): GatewayInfo {
    const gateway: GatewayInfo = {
      ...info,
      status: info.status || 'stopped',
      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        avgResponseTime: 0,
        uptime: 0,
      },
    };
    this.gateways.set(gateway.id, gateway);
    return gateway;
  }

  unregisterGateway(id: string): boolean {
    this.stopHealthCheck(id);
    return this.gateways.delete(id);
  }

  startGateway(id: string): boolean {
    const gateway = this.gateways.get(id);
    if (!gateway) return false;

    gateway.status = 'starting';
    this.emit({ type: 'started', gatewayId: id, timestamp: new Date().toISOString() });

    gateway.status = 'running';
    gateway.startedAt = new Date().toISOString();
    this.startHealthCheck(id);
    return true;
  }

  stopGateway(id: string): boolean {
    const gateway = this.gateways.get(id);
    if (!gateway) return false;

    gateway.status = 'draining';
    this.emit({ type: 'draining', gatewayId: id, timestamp: new Date().toISOString() });

    gateway.status = 'stopped';
    this.emit({ type: 'stopped', gatewayId: id, timestamp: new Date().toISOString() });

    this.stopHealthCheck(id);
    return true;
  }

  startAll(): number {
    let count = 0;
    for (const [id] of this.gateways) {
      if (this.startGateway(id)) count++;
    }
    return count;
  }

  stopAll(): number {
    let count = 0;
    for (const [id] of this.gateways) {
      if (this.stopGateway(id)) count++;
    }
    return count;
  }

  getGateway(id: string): GatewayInfo | undefined {
    return this.gateways.get(id);
  }

  listGateways(): GatewayInfo[] {
    return Array.from(this.gateways.values());
  }

  getStatus(): { total: number; running: number; stopped: number; draining: number; error: number } {
    const gateways = this.listGateways();
    return {
      total: gateways.length,
      running: gateways.filter((g) => g.status === 'running').length,
      stopped: gateways.filter((g) => g.status === 'stopped').length,
      draining: gateways.filter((g) => g.status === 'draining').length,
      error: gateways.filter((g) => g.status === 'error').length,
    };
  }

  recordRequest(id: string, success: boolean, responseTime: number): void {
    const gateway = this.gateways.get(id);
    if (!gateway) return;

    gateway.metrics.totalRequests++;
    if (success) {
      gateway.metrics.successfulRequests++;
    } else {
      gateway.metrics.failedRequests++;
    }
    const total = gateway.metrics.totalRequests;
    gateway.metrics.avgResponseTime =
      (gateway.metrics.avgResponseTime * (total - 1) + responseTime) / total;
    gateway.lastActivityAt = new Date().toISOString();
  }

  getMetrics(id: string): GatewayMetrics | undefined {
    return this.gateways.get(id)?.metrics;
  }

  onEvent(callback: GatewayEventCallback): () => void {
    this.eventCallbacks.push(callback);
    return () => {
      this.eventCallbacks = this.eventCallbacks.filter((cb) => cb !== callback);
    };
  }

  private emit(event: GatewayEvent): void {
    for (const callback of this.eventCallbacks) {
      callback(event);
    }
  }

  private startHealthCheck(id: string): void {
    this.stopHealthCheck(id);
    const interval = setInterval(() => {
      const gateway = this.gateways.get(id);
      if (!gateway || gateway.status !== 'running') {
        this.stopHealthCheck(id);
        return;
      }
      this.emit({
        type: 'health_check',
        gatewayId: id,
        timestamp: new Date().toISOString(),
        data: { metrics: gateway.metrics },
      });
    }, 30_000);
    this.healthCheckIntervals.set(id, interval);
  }

  private stopHealthCheck(id: string): void {
    const interval = this.healthCheckIntervals.get(id);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(id);
    }
  }
}
