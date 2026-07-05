import * as crypto from 'node:crypto';
import * as http from 'node:http';
import { logger } from '../logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ZavorthMobileSupervisionEvent = {
  id: string;
  type:
    | 'agent-log'
    | 'receipt'
    | 'approval-pending'
    | 'approval-resolved'
    | 'status-change'
    | 'provider-switch';
  timestamp: string;
  data: Record<string, unknown>;
  redacted: boolean;
};

export type ZavorthMobileSupervisionSnapshot = {
  generatedAt: string;
  surface: 'mobile-supervision';
  status: 'idle' | 'running' | 'awaiting-approval' | 'error';
  agentStatus: {
    currentTask: string | null;
    provider: string | null;
    model: string | null;
    upSince: string | null;
    autonomyLevel: number;
  };
  pendingApprovals: Array<{
    id: string;
    description: string;
    riskLevel: string;
    createdAt: string;
  }>;
  recentEvents: ZavorthMobileSupervisionEvent[];
  connectedClients: number;
  safety: {
    redactionEnabled: boolean;
    approvalRequired: boolean;
    receiptLedgerActive: boolean;
    sessionTokenRequired: boolean;
  };
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const SECRET_PATTERNS = [
  /api[-_]?key/i,
  /secret/i,
  /password/i,
  /token/i,
  /authorization/i,
  /credential/i,
  /private[-_]?key/i,
];

function redactSensitiveFields(
  data: Record<string, unknown>,
): { redactedData: Record<string, unknown>; wasRedacted: boolean } {
  let wasRedacted = false;
  const redactedData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SECRET_PATTERNS.some((p) => p.test(key))) {
      redactedData[key] = '[REDACTED]';
      wasRedacted = true;
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const nested = redactSensitiveFields(value as Record<string, unknown>);
      redactedData[key] = nested.redactedData;
      if (nested.wasRedacted) wasRedacted = true;
    } else {
      redactedData[key] = value;
    }
  }
  return { redactedData, wasRedacted };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 h
const MAX_RECENT_EVENTS = 100;

type SessionEntry = {
  token: string;
  createdAt: number;
  expiresAt: number;
};

export class ZavorthMobileSupervisionService {
  private readonly clients = new Map<string, http.ServerResponse>();
  private readonly recentEvents: ZavorthMobileSupervisionEvent[] = [];
  private readonly sessions = new Map<string, SessionEntry>();
  private currentStatus: ZavorthMobileSupervisionSnapshot['status'] = 'idle';
  private agentStatus: ZavorthMobileSupervisionSnapshot['agentStatus'] = {
    currentTask: null,
    provider: null,
    model: null,
    upSince: null,
    autonomyLevel: 1,
  };
  private pendingApprovals: ZavorthMobileSupervisionSnapshot['pendingApprovals'] = [];

  // -----------------------------------------------------------------------
  // SSE client management
  // -----------------------------------------------------------------------

  public addClient(clientId: string, res: http.ServerResponse): void {
    // Remove previous connection for the same clientId, if any
    const existing = this.clients.get(clientId);
    if (existing && !existing.writableEnded) {
      try {
        existing.end();
      } catch (error) { // noop – client may already be dead logger.warn('[Zavorth Mobile Supervision] network request failed', error); }
    }
    this.clients.set(clientId, res);

    res.on('close', () => {
      this.clients.delete(clientId);
    });
  }

  public removeClient(clientId: string): void {
    const res = this.clients.get(clientId);
    if (res && !res.writableEnded) {
      try {
        res.end();
      } catch (error) { // noop logger.warn('[Zavorth Mobile Supervision] resource cleanup failed', error); }
    }
    this.clients.delete(clientId);
  }

  public getConnectedClients(): number {
    return this.clients.size;
  }

  // -----------------------------------------------------------------------
  // Broadcasting
  // -----------------------------------------------------------------------

  public broadcast(event: ZavorthMobileSupervisionEvent): void {
    const { redactedData, wasRedacted } = redactSensitiveFields(event.data);
    const safeEvent: ZavorthMobileSupervisionEvent = {
      ...event,
      data: redactedData,
      redacted: wasRedacted || event.redacted,
    };

    // Persist in recent buffer
    this.recentEvents.unshift(safeEvent);
    if (this.recentEvents.length > MAX_RECENT_EVENTS) {
      this.recentEvents.length = MAX_RECENT_EVENTS;
    }

    // Push to all connected SSE clients
    const payload = `id: ${safeEvent.id}\nevent: ${safeEvent.type}\ndata: ${JSON.stringify(safeEvent)}\n\n`;
    for (const [clientId, res] of this.clients.entries()) {
      if (res.writableEnded) {
        this.clients.delete(clientId);
        continue;
      }
      try {
        res.write(payload);
      } catch {
        this.clients.delete(clientId);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Snapshot
  // -----------------------------------------------------------------------

  public buildSnapshot(): ZavorthMobileSupervisionSnapshot {
    return {
      generatedAt: new Date().toISOString(),
      surface: 'mobile-supervision',
      status: this.currentStatus,
      agentStatus: { ...this.agentStatus },
      pendingApprovals: [...this.pendingApprovals],
      recentEvents: this.recentEvents.slice(0, 50),
      connectedClients: this.clients.size,
      safety: {
        redactionEnabled: true,
        approvalRequired: true,
        receiptLedgerActive: true,
        sessionTokenRequired: true,
      },
    };
  }

  // -----------------------------------------------------------------------
  // Session token management
  // -----------------------------------------------------------------------

  public generateSessionToken(): string {
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    this.sessions.set(token, {
      token,
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS,
    });
    // Purge expired sessions opportunistically
    this.purgeExpiredSessions();
    return token;
  }

  public validateSessionToken(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }
    const entry = this.sessions.get(token.trim());
    if (!entry) {
      return false;
    }
    if (Date.now() > entry.expiresAt) {
      this.sessions.delete(token.trim());
      return false;
    }
    return true;
  }

  // -----------------------------------------------------------------------
  // Mutators (for external services to push state)
  // -----------------------------------------------------------------------

  public setStatus(status: ZavorthMobileSupervisionSnapshot['status']): void {
    this.currentStatus = status;
    this.broadcast({
      id: crypto.randomUUID(),
      type: 'status-change',
      timestamp: new Date().toISOString(),
      data: { status },
      redacted: false,
    });
  }

  public setAgentStatus(
    update: Partial<ZavorthMobileSupervisionSnapshot['agentStatus']>,
  ): void {
    Object.assign(this.agentStatus, update);
  }

  public addPendingApproval(approval: {
    id: string;
    description: string;
    riskLevel: string;
  }): void {
    this.pendingApprovals.push({
      ...approval,
      createdAt: new Date().toISOString(),
    });
    this.currentStatus = 'awaiting-approval';
    this.broadcast({
      id: crypto.randomUUID(),
      type: 'approval-pending',
      timestamp: new Date().toISOString(),
      data: { approval },
      redacted: false,
    });
  }

  public resolveApproval(approvalId: string, decision: 'approve' | 'reject'): boolean {
    const idx = this.pendingApprovals.findIndex((a) => a.id === approvalId);
    if (idx === -1) {
      return false;
    }
    const removed = this.pendingApprovals.splice(idx, 1)[0];
    if (this.pendingApprovals.length === 0 && this.currentStatus === 'awaiting-approval') {
      this.currentStatus = 'running';
    }
    this.broadcast({
      id: crypto.randomUUID(),
      type: 'approval-resolved',
      timestamp: new Date().toISOString(),
      data: { approvalId, decision, description: removed?.description },
      redacted: false,
    });
    return true;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private purgeExpiredSessions(): void {
    const now = Date.now();
    for (const [key, entry] of this.sessions.entries()) {
      if (now > entry.expiresAt) {
        this.sessions.delete(key);
      }
    }
  }
}
