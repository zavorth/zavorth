import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveZavorthLocalStateDir } from '../../config/localStatePaths.js';
import { safeFetch } from '../../security/SafeFetchService.js';
import { DeviceCapabilityPolicy } from '../policy/DeviceCapabilityPolicy.js';

export interface NodeCredentials {
  nodeId: string;
  sharedSecret: string;
  pairedAt: string;
  baseUrl?: string;
  token?: string | null;
  heartbeatIntervalMs?: number;
  capabilityIds?: string[];
  approvedCapabilityIds?: string[];
  label?: string | null;
  workspace?: string | null;
  surface?: string | null;
  stateFile?: string | null;
  hostHints?: Record<string, unknown> | null;
}

type PairingFetchResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<any>;
};

type PairingFetch = (url: string, init: {
  method: 'POST';
  headers: Record<string, string>;
  body: string;
}) => Promise<PairingFetchResponse>;

export type NodePairingManagerOptions = {
  configDir?: string;
  baseUrl?: string;
  token?: string | null;
  nodeId?: string | null;
  label?: string | null;
  profileId?: string | null;
  capabilityIds?: string[] | null;
  approvedCapabilityIds?: string[] | null;
  workspace?: string | null;
  surface?: string | null;
  stateFile?: string | null;
  hostHints?: Record<string, unknown> | null;
  fetchImpl?: PairingFetch;
  now?: () => Date;
};

type ResolvedPairingInput = {
  nodeId: string;
  pairingCode: string;
};

function normalizeBaseUrl(input: string | null | undefined): string {
  const raw = String(input || '').trim();
  if (!raw) {
    return 'http://127.0.0.1:33333';
  }
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

function normalizeNodeId(input: string | null | undefined): string {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildDefaultNodeId(): string {
  return normalizeNodeId(`desktop-${os.hostname()}`) || 'desktop-companion';
}

async function defaultFetch(url: string, init: {
  method: 'POST';
  headers: Record<string, string>;
  body: string;
}): Promise<PairingFetchResponse> {
  return await safeFetch(url, init as any, {
    allowLoopback: true,
    serviceName: 'Node Mesh pairing',
  }) as PairingFetchResponse;
}

export class NodePairingManager {
  private readonly configDir: string;
  private readonly configPath: string;
  private readonly baseUrl: string;
  private readonly token: string | null;
  private readonly configuredNodeId: string | null;
  private readonly label: string | null;
  private readonly profileId: string | null;
  private readonly capabilityIds: string[];
  private readonly approvedCapabilityIds: string[];
  private readonly workspace: string | null;
  private readonly surface: string | null;
  private readonly stateFile: string;
  private readonly hostHints: Record<string, unknown> | null;
  private readonly fetchImpl: PairingFetch;
  private readonly now: () => Date;
  private readonly devicePolicy: DeviceCapabilityPolicy;

  constructor(configDirOrOptions: string | NodePairingManagerOptions = resolveZavorthLocalStateDir()) {
    const options = typeof configDirOrOptions === 'string'
      ? { configDir: configDirOrOptions }
      : (configDirOrOptions || {});

    this.configDir = path.resolve(options.configDir || resolveZavorthLocalStateDir());
    this.configPath = path.join(this.configDir, 'node_credentials.json');
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.token = String(options.token || '').trim() || null;
    this.configuredNodeId = normalizeNodeId(options.nodeId) || null;
    this.label = String(options.label || '').trim() || null;
    this.profileId = String(options.profileId || '').trim() || 'desktop-companion';
    this.capabilityIds = (options.capabilityIds || [
      'device.info',
      'system.run',
      'files.read',
      'files.write',
      'files.watch',
      'browser.proxy',
      'clipboard.read',
      'clipboard.write',
      'notifications.send',
      'screen.capture',
    ]).map((entry) => String(entry || '').trim()).filter(Boolean);
    this.approvedCapabilityIds = (options.approvedCapabilityIds || [])
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
    this.workspace = String(options.workspace || process.cwd()).trim() || null;
    this.surface = String(options.surface || 'desktop-companion').trim() || 'desktop-companion';
    this.stateFile = String(options.stateFile || '').trim()
      || path.join(this.configDir, 'node_host_state.json');
    this.hostHints = options.hostHints && typeof options.hostHints === 'object'
      ? { ...options.hostHints }
      : null;
    this.fetchImpl = options.fetchImpl || defaultFetch;
    this.now = options.now || (() => new Date());
    this.devicePolicy = new DeviceCapabilityPolicy({
      policyFile: path.join(this.configDir, 'device-capability-policy.json'),
      now: this.now,
    });

    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  public async storeCredentials(credentials: NodeCredentials): Promise<void> {
    const normalized: NodeCredentials = {
      ...credentials,
      nodeId: normalizeNodeId(credentials.nodeId) || buildDefaultNodeId(),
      baseUrl: normalizeBaseUrl(credentials.baseUrl || this.baseUrl),
      token: credentials.token === undefined ? this.token : credentials.token,
      heartbeatIntervalMs: Math.max(5000, Number(credentials.heartbeatIntervalMs || 15000)),
      capabilityIds: Array.isArray(credentials.capabilityIds)
        ? credentials.capabilityIds.map((entry) => String(entry || '').trim()).filter(Boolean)
        : [...this.capabilityIds],
      approvedCapabilityIds: Array.isArray(credentials.approvedCapabilityIds)
        ? credentials.approvedCapabilityIds.map((entry) => String(entry || '').trim()).filter(Boolean)
        : [...this.approvedCapabilityIds],
      label: credentials.label === undefined ? this.label : credentials.label,
      workspace: credentials.workspace === undefined ? this.workspace : credentials.workspace,
      surface: credentials.surface === undefined ? this.surface : credentials.surface,
      stateFile: credentials.stateFile === undefined ? this.stateFile : credentials.stateFile,
      hostHints: credentials.hostHints === undefined ? this.buildHostHints() : credentials.hostHints,
    };
    fs.writeFileSync(this.configPath, `${JSON.stringify(normalized, null, 2)}\n`, { mode: 0o600 });
    this.devicePolicy.syncFromCapabilities({
      nodeId: normalized.nodeId,
      capabilityIds: normalized.capabilityIds || [],
      approvedCapabilityIds: normalized.approvedCapabilityIds || [],
      source: 'pairing-credentials',
    });
  }

  public async readCredentials(): Promise<NodeCredentials | null> {
    if (!fs.existsSync(this.configPath)) {
      return null;
    }
    try {
      const data = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      if (!data || typeof data !== 'object') {
        return null;
      }
      return {
        nodeId: normalizeNodeId(data.nodeId) || this.configuredNodeId || buildDefaultNodeId(),
        sharedSecret: String(data.sharedSecret || '').trim(),
        pairedAt: String(data.pairedAt || '').trim(),
        baseUrl: normalizeBaseUrl(data.baseUrl || this.baseUrl),
        token: String(data.token || '').trim() || null,
        heartbeatIntervalMs: Math.max(5000, Number(data.heartbeatIntervalMs || 15000)),
        capabilityIds: Array.isArray(data.capabilityIds)
          ? data.capabilityIds.map((entry: unknown) => String(entry || '').trim()).filter(Boolean)
          : [...this.capabilityIds],
        approvedCapabilityIds: Array.isArray(data.approvedCapabilityIds)
          ? data.approvedCapabilityIds.map((entry: unknown) => String(entry || '').trim()).filter(Boolean)
          : [...this.approvedCapabilityIds],
        label: String(data.label || '').trim() || this.label,
        workspace: String(data.workspace || '').trim() || this.workspace,
        surface: String(data.surface || '').trim() || this.surface,
        stateFile: String(data.stateFile || '').trim() || this.stateFile,
        hostHints: data.hostHints && typeof data.hostHints === 'object'
          ? data.hostHints as Record<string, unknown>
          : this.buildHostHints(),
      };
    } catch (error: any) { const err = error; const e = error;
      return null;
    }
  }

  public async initiatePairing(passcode: string): Promise<NodeCredentials> {
    const { nodeId, pairingCode } = this.resolvePairingInput(passcode);
    const payload = await this.claimPairing(nodeId, pairingCode);
    const claim = payload?.claim || payload;
    const sharedSecret = String(claim?.sharedSecret || '').trim();
    if (!sharedSecret) {
      throw new Error('O claim do Node Mesh nao retornou sharedSecret.');
    }

    const credentials: NodeCredentials = {
      nodeId,
      sharedSecret,
      pairedAt: String(claim?.claimedAt || this.now().toISOString()),
      baseUrl: this.baseUrl,
      token: this.token,
      heartbeatIntervalMs: Math.max(5000, Number(claim?.heartbeatIntervalMs || 15000)),
      capabilityIds: [...this.capabilityIds],
      approvedCapabilityIds: [...this.approvedCapabilityIds],
      label: this.label,
      workspace: this.workspace,
      surface: this.surface,
      stateFile: this.stateFile,
      hostHints: this.buildHostHints(),
    };
    await this.storeCredentials(credentials);
    return credentials;
  }

  private resolvePairingInput(passcode: string): ResolvedPairingInput {
    const raw = String(passcode || '').trim();
    if (!raw) {
      throw new Error('Informe o passcode de pareamento do Node Mesh.');
    }

    const separators = [':', '|', '#'];
    for (const separator of separators) {
      const index = raw.indexOf(separator);
      if (index > 0) {
        const nodeId = normalizeNodeId(raw.slice(0, index));
        const pairingCode = raw.slice(index + 1).trim();
        if (nodeId && pairingCode) {
          return { nodeId, pairingCode };
        }
      }
    }

    if (!this.configuredNodeId) {
      throw new Error('O passcode precisa incluir o nodeId no formato nodeId:codigo ou o companion precisa de nodeId configurado.');
    }
    return {
      nodeId: this.configuredNodeId,
      pairingCode: raw,
    };
  }

  private async claimPairing(nodeId: string, pairingCode: string): Promise<any> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/node-mesh/pairing/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: JSON.stringify({
        nodeId,
        pairingCode,
        capabilityIds: this.capabilityIds,
        approvedCapabilityIds: this.approvedCapabilityIds,
        hostHints: this.buildHostHints(),
        operatorSummary: this.label
          ? `${this.label} concluiu o pareamento inicial e vai iniciar heartbeat recorrente.`
          : null,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.error || `Falha HTTP ${response.status} ao concluir o claim do Node Mesh.`);
    }
    return payload;
  }

  private buildHostHints(): Record<string, unknown> {
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      workspace: this.workspace,
      surface: this.surface,
      arch: process.arch,
      osRelease: os.release(),
      nodeVersion: process.version,
      deviceModel: this.label,
      ...this.hostHints,
    };
  }
}
