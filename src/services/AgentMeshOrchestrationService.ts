import * as fs from 'fs';
import * as path from 'path';
import { createHash, randomUUID } from 'crypto';
import { config } from '../config/index.js';
import type {
  AgentMeshBridgeConfig,
  AgentMeshConnectionKind,
  AgentMeshConnectionRef,
  AgentMeshDynamicCapabilities,
  AgentMeshOrchestrationSnapshot,
  AgentMeshProtocol,
  AgentMeshUserConsent,
} from '../contracts/AgentMeshConsentContract.js';
import { AgentMeshPolicyService } from './AgentMeshPolicyService.js';
import {
  AgentMeshDriverRegistryService,
  type AgentMeshDriverContext,
} from './AgentMeshDriverRegistryService.js';

export type RegisterAgentBridgeRequest = {
  agentName: string;
  agentDescription: string;
  connectionUri?: string;
  connectionRef?: string;
  connectionLabel?: string;
  connectionKind?: AgentMeshConnectionKind;
  primaryProtocol: AgentMeshProtocol;
};

export class AgentMeshOrchestrationService {
  private readonly storagePath: string;
  private readonly registryPath: string;
  private readonly policy: AgentMeshPolicyService;
  private readonly driverRegistry: AgentMeshDriverRegistryService;
  private readonly connectionResolver?: (bridge: AgentMeshBridgeConfig) => Promise<string | null> | string | null;
  private readonly consents: Map<string, AgentMeshUserConsent> = new Map();
  private readonly bridges: Map<string, AgentMeshBridgeConfig> = new Map();
  private readonly runtimeConnections: Map<string, string> = new Map();

  constructor(options: {
    storagePath?: string;
    registryPath?: string;
    policy?: AgentMeshPolicyService;
    driverRegistry?: AgentMeshDriverRegistryService;
    connectionResolver?: (bridge: AgentMeshBridgeConfig) => Promise<string | null> | string | null;
  } = {}) {
    this.storagePath = options.storagePath || path.join(config.dataDir, 'runtime', 'agent-mesh-consents.json');
    this.registryPath = options.registryPath || path.join(config.dataDir, 'runtime', 'agent-mesh-registry.json');
    this.policy = options.policy || new AgentMeshPolicyService();
    this.driverRegistry = options.driverRegistry || new AgentMeshDriverRegistryService();
    this.connectionResolver = options.connectionResolver;
    this.loadState();
  }

  public buildSnapshot(): AgentMeshOrchestrationSnapshot {
    return {
      generatedAt: new Date().toISOString(),
      contractVersion: '2026-05-09.agent-mesh-maestro-dynamic',
      meshId: 'zavorth-agent-mesh',
      bridges: Array.from(this.bridges.values()).map((bridge) => ({
        ...bridge,
        consent: this.getConsent(bridge.id),
        status: this.resolveBridgeStatus(bridge),
      })),
      policy: {
        consentRequiredForEveryBridge: true,
        noBackgroundExecutionWithoutActiveSession: true,
        transparencyLogsRequired: true,
        redactSecretsBeforeDelegation: true,
        dynamicDiscoveryAllowed: true,
        rawConnectionMaterialPersisted: false,
        criticalPermissionsBlockedByDefault: true,
      },
      narrative: {
        headline: 'Zavorth Agent Mesh',
        description: 'Dynamic runtime adapter orchestration with explicit consent, redacted connection metadata, policy checks and auditable receipts.',
      },
    };
  }

  public async registerBridge(request: RegisterAgentBridgeRequest): Promise<AgentMeshBridgeConfig> {
    const connection = buildConnectionRef(request);
    const existing = Array.from(this.bridges.values()).find(
      (bridge) =>
        bridge.connection.fingerprint === connection.fingerprint
        && bridge.primaryProtocol === request.primaryProtocol,
    );

    if (existing) {
      this.rememberRuntimeConnection(existing.id, request);
      return cloneBridge(existing, this.getConsent(existing.id));
    }

    const newBridge: AgentMeshBridgeConfig = {
      id: `bridge-${randomUUID()}`,
      agentName: cleanText(request.agentName, 'Runtime Adapter'),
      agentDescription: cleanText(request.agentDescription, 'runtime adapter bridge'),
      connection,
      primaryProtocol: request.primaryProtocol,
      status: 'discovered_unverified',
      consent: null,
      capabilities: null,
      lastHandshakeAt: null,
      registeredAt: new Date().toISOString(),
    };

    this.bridges.set(newBridge.id, newBridge);
    this.rememberRuntimeConnection(newBridge.id, request);
    this.saveState();

    this.attemptHandshake(newBridge.id).catch(() => {
      // Background handshake failures are represented by the bridge remaining unverified.
    });

    return cloneBridge(newBridge, null);
  }

  public async authorize(consent: AgentMeshUserConsent): Promise<boolean> {
    if (!this.bridges.has(consent.authorizedAgentId)) {
      throw new Error(`Cannot authorize unknown agent bridge: ${consent.authorizedAgentId}`);
    }
    const decision = this.policy.evaluateConsent(consent);
    if (decision.decision === 'blocked') {
      throw new Error(`Agent Mesh consent blocked by policy: ${decision.reasons.join(' ')}`);
    }
    this.consents.set(consent.authorizedAgentId, cloneConsent(consent));
    this.saveState();
    return true;
  }

  public revoke(agentId: string): boolean {
    const deleted = this.consents.delete(agentId);
    if (deleted) {
      this.saveState();
    }
    return deleted;
  }

  public getConsent(agentId: string): AgentMeshUserConsent | null {
    const consent = this.consents.get(agentId);
    return consent ? cloneConsent(consent) : null;
  }

  public getBridge(agentId: string): AgentMeshBridgeConfig | null {
    const bridge = this.bridges.get(agentId);
    return bridge ? cloneBridge(bridge, this.getConsent(agentId)) : null;
  }

  public async buildDriverContext(agentId: string): Promise<AgentMeshDriverContext | null> {
    const bridge = this.bridges.get(agentId);
    if (!bridge) return null;
    const connectionValue = this.runtimeConnections.get(agentId)
      || await this.resolveConnectionValue(bridge);
    return {
      bridgeId: bridge.id,
      protocol: bridge.primaryProtocol,
      connectionRef: bridge.connection.ref,
      connectionLabel: bridge.connection.label,
      connectionValue,
    };
  }

  public isAuthorized(agentId: string): boolean {
    const consent = this.consents.get(agentId);
    if (!consent) return false;
    if (consent.expirationDate && new Date(consent.expirationDate) < new Date()) {
      return false;
    }
    return this.policy.evaluateConsent(consent).decision !== 'blocked';
  }

  private async attemptHandshake(bridgeId: string): Promise<void> {
    const bridge = this.bridges.get(bridgeId);
    if (!bridge) return;

    const capabilities = await this.discoverCapabilities(bridge);

    const updated: AgentMeshBridgeConfig = {
      ...bridge,
      capabilities,
      lastHandshakeAt: new Date().toISOString(),
      status: bridge.status === 'discovered_unverified' ? 'verified_not_authorized' : bridge.status,
    };

    this.bridges.set(bridgeId, updated);
    this.saveState();
  }

  private async discoverCapabilities(bridge: AgentMeshBridgeConfig): Promise<AgentMeshDynamicCapabilities> {
    try {
      const context = await this.buildDriverContext(bridge.id);
      if (context && this.driverRegistry.has(bridge.primaryProtocol)) {
        const handshake = await this.driverRegistry.handshake(context);
        return {
          ...handshake.capabilities,
          supportedProtocols: handshake.capabilities.supportedProtocols.length > 0
            ? handshake.capabilities.supportedProtocols
            : [bridge.primaryProtocol],
          discoverySource: 'driver-handshake',
          driverStatus: 'available',
        };
      }
    } catch {
      return createFallbackCapabilities(bridge.primaryProtocol, 'failed');
    }
    return createFallbackCapabilities(bridge.primaryProtocol, 'unavailable');
  }

  private resolveBridgeStatus(bridge: AgentMeshBridgeConfig): AgentMeshBridgeConfig['status'] {
    if (this.consents.has(bridge.id)) {
      return this.isAuthorized(bridge.id) ? 'authorized_ready' : 'revoked';
    }
    return bridge.capabilities ? 'verified_not_authorized' : 'discovered_unverified';
  }

  private loadState(): void {
    if (fs.existsSync(this.registryPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.registryPath, 'utf8'));
        if (Array.isArray(data)) {
          for (const entry of data) {
            const bridge = normalizeStoredBridge(entry);
            if (bridge) {
              this.bridges.set(bridge.id, bridge);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load Agent Mesh registry:', error);
      }
    }

    if (fs.existsSync(this.storagePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
        if (Array.isArray(data)) {
          for (const consent of data) {
            const normalized = normalizeStoredConsent(consent);
            if (normalized) {
              this.consents.set(normalized.authorizedAgentId, normalized);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load Agent Mesh consents:', error);
      }
    }
  }

  private saveState(): void {
    try {
      const consentDir = path.dirname(this.storagePath);
      if (!fs.existsSync(consentDir)) fs.mkdirSync(consentDir, { recursive: true });
      fs.writeFileSync(this.storagePath, JSON.stringify(Array.from(this.consents.values()), null, 2));

      const registryDir = path.dirname(this.registryPath);
      if (!fs.existsSync(registryDir)) fs.mkdirSync(registryDir, { recursive: true });
      fs.writeFileSync(this.registryPath, JSON.stringify(Array.from(this.bridges.values()), null, 2));
    } catch (error) {
      console.error('Failed to save Agent Mesh state:', error);
    }
  }

  private rememberRuntimeConnection(bridgeId: string, request: RegisterAgentBridgeRequest): void {
    const raw = cleanText(request.connectionRef || request.connectionUri, '');
    if (raw && !raw.startsWith('secret-ref:')) {
      this.runtimeConnections.set(bridgeId, raw);
    }
  }

  private async resolveConnectionValue(bridge: AgentMeshBridgeConfig): Promise<string | null> {
    if (!this.connectionResolver) {
      return null;
    }
    const resolved = await this.connectionResolver(cloneBridge(bridge, this.getConsent(bridge.id)));
    const normalized = String(resolved || '').trim();
    return normalized || null;
  }
}

function createFallbackCapabilities(
  protocol: AgentMeshProtocol,
  driverStatus: AgentMeshDynamicCapabilities['driverStatus'],
): AgentMeshDynamicCapabilities {
  return {
    reportedToolCount: 0,
    reportedChannelCount: 0,
    primaryDomain: 'dynamic-unclassified',
    discoveredTools: [],
    supportedProtocols: [protocol],
    supportsDryRun: true,
    supportsCancellation: false,
    discoverySource: 'local-fallback',
    driverStatus,
  };
}

function buildConnectionRef(request: RegisterAgentBridgeRequest): AgentMeshConnectionRef {
  const raw = cleanText(request.connectionRef || request.connectionUri, '');
  if (!raw) {
    throw new Error('Agent Mesh bridge registration requires connectionRef or connectionUri.');
  }
  const kind = request.connectionKind || inferConnectionKind(raw);
  const fingerprint = createHash('sha256').update(`${request.primaryProtocol}:${raw}`).digest('hex');
  const redacted = redactConnection(raw, kind);
  return {
    ref: `agent-mesh-connection:${fingerprint.slice(0, 16)}`,
    kind,
    label: cleanText(request.connectionLabel, redacted),
    redacted,
    fingerprint,
    secretMaterialPersisted: false,
  };
}

function normalizeStoredBridge(value: unknown): AgentMeshBridgeConfig | null {
  if (!value || typeof value !== 'object') return null;
  const bridge = value as Partial<AgentMeshBridgeConfig> & { connectionUri?: string };
  const primaryProtocol = bridge.primaryProtocol || 'webhook';
  const connection = bridge.connection || buildConnectionRef({
    agentName: bridge.agentName || 'Runtime Adapter',
    agentDescription: bridge.agentDescription || 'runtime adapter bridge',
    connectionUri: bridge.connectionUri || 'unknown',
    primaryProtocol,
  });
  return {
    id: cleanText(bridge.id, `bridge-${randomUUID()}`),
    agentName: cleanText(bridge.agentName, 'Runtime Adapter'),
    agentDescription: cleanText(bridge.agentDescription, 'runtime adapter bridge'),
    connection,
    primaryProtocol,
    status: bridge.status || 'discovered_unverified',
    consent: null,
    capabilities: bridge.capabilities || null,
    lastHandshakeAt: bridge.lastHandshakeAt || null,
    registeredAt: bridge.registeredAt || new Date().toISOString(),
  };
}

function normalizeStoredConsent(value: unknown): AgentMeshUserConsent | null {
  if (!value || typeof value !== 'object') return null;
  const consent = value as Partial<AgentMeshUserConsent>;
  if (!consent.authorizedAgentId) return null;
  return cloneConsent({
    id: cleanText(consent.id, `consent-${randomUUID()}`),
    signedAt: cleanText(consent.signedAt, new Date().toISOString()),
    userFingerprint: cleanText(consent.userFingerprint, 'unknown-user'),
    authorizedAgentId: cleanText(consent.authorizedAgentId, ''),
    grantedPermissions: Array.isArray(consent.grantedPermissions) ? consent.grantedPermissions : [],
    risksAcknowledged: Array.isArray(consent.risksAcknowledged) ? consent.risksAcknowledged : [],
    workspaceScope: consent.workspaceScope || null,
    sessionScope: consent.sessionScope || null,
    expirationDate: consent.expirationDate || null,
    revocable: true,
  });
}

function inferConnectionKind(raw: string): AgentMeshConnectionKind {
  const normalized = raw.trim().toLowerCase();
  if (normalized.startsWith('secret-ref:')) return 'secret-ref';
  if (normalized.startsWith('ws://127.0.0.1') || normalized.startsWith('ws://localhost')) return 'local-socket';
  if (normalized.startsWith('http://127.0.0.1') || normalized.startsWith('http://localhost')) return 'local-url';
  if (/^https?:\/\//.test(normalized) || /^wss?:\/\//.test(normalized)) return 'remote-url';
  if (/^[a-z]:[\\/]/i.test(raw) || raw.startsWith('/') || raw.includes('\\')) return 'local-command';
  return 'unknown';
}

function redactConnection(raw: string, kind: AgentMeshConnectionKind): string {
  if (kind === 'secret-ref') return 'secret-ref:[redacted]';
  try {
    const url = new URL(raw);
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    // Non-URL values are reduced to a basename-like display value.
  }
  const basename = raw.replace(/\\/g, '/').split('/').filter(Boolean).pop() || 'runtime-adapter';
  return `${kind}:${basename}`;
}

function cleanText(value: unknown, fallback: string): string {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function cloneConsent(consent: AgentMeshUserConsent): AgentMeshUserConsent {
  return {
    ...consent,
    grantedPermissions: consent.grantedPermissions.slice(),
    risksAcknowledged: consent.risksAcknowledged.slice(),
    workspaceScope: consent.workspaceScope || null,
    sessionScope: consent.sessionScope || null,
    expirationDate: consent.expirationDate || null,
    revocable: true,
  };
}

function cloneBridge(bridge: AgentMeshBridgeConfig, consent: AgentMeshUserConsent | null): AgentMeshBridgeConfig {
  return {
    ...bridge,
    connection: { ...bridge.connection },
    consent,
    capabilities: bridge.capabilities
      ? {
        ...bridge.capabilities,
        discoveredTools: bridge.capabilities.discoveredTools.slice(),
        supportedProtocols: bridge.capabilities.supportedProtocols.slice(),
      }
      : null,
  };
}
