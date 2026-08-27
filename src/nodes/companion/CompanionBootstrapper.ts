import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveZavorthLocalStateFile } from '../../config/localStatePaths.js';
import { safeFetch } from '../../security/SafeFetchService.js';
import { NodeHostCapabilityService } from '../../services/NodeHostCapabilityService.js';
import { NodeCredentials, NodePairingManager } from '../pairing/NodePairingManager.js';
import { CapabilityId, DeviceCapabilityPolicy } from '../policy/DeviceCapabilityPolicy.js';
type CompanionFetchResponse = {
  ok: boolean;
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: () => Promise<any>;
};

type CompanionFetch = (url: string, init: {
  method: 'POST';
  headers: Record<string, string>;
  body: string;
}) => Promise<CompanionFetchResponse>;

type CompanionCapabilityRuntime = Pick<NodeHostCapabilityService, 'executeAssignment'>;

export type CompanionBootstrapperOptions = {
  pairingManager?: NodePairingManager;
  capabilityService?: CompanionCapabilityRuntime | null;
  fetchImpl?: CompanionFetch;
  sleep?: (ms: number) => Promise<void>;
  workspaceRoot?: string;
  tempRoot?: string;
  stateFile?: string | null;
  capabilities?: string[];
  intervalMs?: number;
  once?: boolean;
  token?: string | null;
  surface?: string;
  hostname?: string;
  deviceModel?: string | null;
  appVersion?: string | null;
  networkType?: string | null;
  locationLabel?: string | null;
  devicePolicy?: DeviceCapabilityPolicy;
  policyFile?: string | null;
};

type Assignment = {
  id: string;
  capabilityId: string;
  action: string;
  payload?: Record<string, unknown> | null;
};

async function defaultFetch(url: string, init: {
  method: 'POST';
  headers: Record<string, string>;
  body: string;
}): Promise<CompanionFetchResponse> {
  return await safeFetch(url, init as any, { // eslint-disable-line @typescript-eslint/no-explicit-any
    allowLoopback: true,
    serviceName: 'Node Mesh companion',
  }) as CompanionFetchResponse;
}

function loadPendingResults(stateFile: string | null): Array<Record<string, unknown>> {
  if (!stateFile || !fs.existsSync(stateFile)) {
    return [];
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    return Array.isArray(parsed?.pendingResults) ? parsed.pendingResults : [];
  } catch (error: unknown) {return [];
  }
}

function savePendingResults(stateFile: string | null, pendingResults: Array<Record<string, unknown>>): void {
  if (!stateFile) {
    return;
  }
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, `${JSON.stringify({ pendingResults }, null, 2)}\n`, 'utf8');
}

export class CompanionBootstrapper {
  private readonly pairingManager: NodePairingManager;
  private readonly capabilityService: CompanionCapabilityRuntime;
  private readonly fetchImpl: CompanionFetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly workspaceRoot: string;
  private readonly tempRoot: string;
  private readonly configuredStateFile: string | null;
  private readonly capabilities: string[];
  private readonly intervalMs: number;
  private readonly once: boolean;
  private readonly token: string | null;
  private readonly surface: string;
  private readonly hostname: string;
  private readonly deviceModel: string | null;
  private readonly appVersion: string | null;
  private readonly networkType: string | null;
  private readonly locationLabel: string | null;
  private readonly devicePolicy: DeviceCapabilityPolicy;
  private controller: AbortController | null = null;
  private loop: Promise<void> | null = null;

  constructor(options: CompanionBootstrapperOptions = {}) {
    this.workspaceRoot = path.resolve(options.workspaceRoot || process.cwd());
    this.tempRoot = path.resolve(options.tempRoot || path.join(this.workspaceRoot, 'data', 'runtime', 'companion'));
    this.configuredStateFile = String(options.stateFile || '').trim() || null;
    this.capabilities = (options.capabilities || [
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
    this.intervalMs = Math.max(3000, Number(options.intervalMs || 15000) || 15000);
    this.once = options.once === true;
    this.token = String(options.token || '').trim() || null;
    this.surface = String(options.surface || 'desktop-companion').trim() || 'desktop-companion';
    this.hostname = String(options.hostname || os.hostname()).trim() || os.hostname();
    this.deviceModel = String(options.deviceModel || '').trim() || null;
    this.appVersion = String(options.appVersion || '').trim() || null;
    this.networkType = String(options.networkType || '').trim() || null;
    this.locationLabel = String(options.locationLabel || '').trim() || null;
    this.fetchImpl = options.fetchImpl || defaultFetch;
    this.sleep = options.sleep || (async (ms: number) => await new Promise((resolve) => setTimeout(resolve, ms)));
    this.devicePolicy = options.devicePolicy || new DeviceCapabilityPolicy({
      policyFile: String(options.policyFile || '').trim()
        || resolveZavorthLocalStateFile('device-capability-policy.json', this.workspaceRoot),
    });
    this.pairingManager = options.pairingManager || new NodePairingManager({
      workspace: this.workspaceRoot,
      surface: this.surface,
      capabilityIds: this.capabilities,
      stateFile: this.resolveStateFile(null) || undefined,
      token: this.token,
    });
    this.capabilityService = options.capabilityService || new NodeHostCapabilityService({
      workspaceRoot: this.workspaceRoot,
      tempRoot: this.tempRoot,
      stateFile: this.resolveStateFile(null) || undefined,
      allowedRoots: [this.workspaceRoot, this.tempRoot],
      env: {
        ...process.env,
        ...(this.deviceModel ? { ZAVORTH_NODE_HOST_DEVICE_MODEL: this.deviceModel } : {}),
        ...(this.appVersion ? { ZAVORTH_NODE_HOST_APP_VERSION: this.appVersion } : {}),
        ...(this.networkType ? { ZAVORTH_NODE_HOST_NETWORK_TYPE: this.networkType } : {}),
        ...(this.locationLabel ? { ZAVORTH_NODE_HOST_LOCATION_LABEL: this.locationLabel } : {}),
      },
    });
  }

  public async startCompanion(passcode?: string): Promise<void> {
    console.log('[Companion] Starting Zavorth Desktop Companion...');

    let creds = await this.pairingManager.readCredentials();
    if (!creds) {
      if (!passcode) {
        throw new Error('No desktop credentials found. Device must be paired using a Passcode.');
      }
      creds = await this.pairingManager.initiatePairing(passcode);
      console.log(`[Companion] Desktop successfully paired to Gateway as ${creds.nodeId}.`);
    } else {
      console.log(`[Companion] Connected to Node Mesh. Node Identity: ${creds.nodeId}`);
    }

    this.devicePolicy.syncFromCapabilities({
      nodeId: creds.nodeId,
      capabilityIds: creds.capabilityIds && creds.capabilityIds.length > 0 ? creds.capabilityIds : this.capabilities,
      approvedCapabilityIds: creds.approvedCapabilityIds || [],
      source: 'pairing-credentials',
    });

    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
    this.controller = new AbortController();
    this.loop = this.connectToGatewayMesh(creds, this.controller.signal);
    if (this.once) {
      await this.loop;
    }
  }

  public async stop(): Promise<void> {
    if (!this.controller) {
      return;
    }
    this.controller.abort();
    this.controller = null;
    await this.loop?.catch(() => undefined);
    this.loop = null;
  }

  private async connectToGatewayMesh(creds: NodeCredentials, abortSignal: AbortSignal): Promise<void> {
    console.log('[Companion] Establishing deep-capability tunnel with Core...');
    const stateFile = this.resolveStateFile(creds);
    const allowedCapabilities = this.resolveAllowedCapabilities(creds);
    let pendingResults = loadPendingResults(stateFile);


    while (!abortSignal.aborted) {
      const payload = await this.apiPost(`${this.resolveBaseUrl(creds)}/api/node-mesh/heartbeat`, creds, {
        nodeId: creds.nodeId,
        sharedSecret: creds.sharedSecret,
        status: 'online',
        capabilityIds: allowedCapabilities,
        hostHints: this.buildHostHints(creds),
        results: pendingResults,
      });

      pendingResults = [];
      savePendingResults(stateFile, pendingResults);

      const heartbeat = payload?.heartbeat || payload || {};
      const assignments = Array.isArray(heartbeat.assignments) ? heartbeat.assignments : [];
      if (assignments.length > 0) {
        for (const assignment of assignments) {
          if (!this.devicePolicy.isCapabilityAllowed(creds.nodeId, String(assignment.capabilityId || '').trim() as CapabilityId)) {
            pendingResults.push(this.buildBlockedAssignmentResult(String(assignment.id || ''), String(assignment.capabilityId || '')));
            savePendingResults(stateFile, pendingResults);
            continue;
          }
          const result = await this.capabilityService.executeAssignment(assignment as Assignment);
          pendingResults.push(result);
          savePendingResults(stateFile, pendingResults);
        }
      }

      if (this.once) {
        if (pendingResults.length > 0) {
          await this.apiPost(`${this.resolveBaseUrl(creds)}/api/node-mesh/heartbeat`, creds, {
            nodeId: creds.nodeId,
            sharedSecret: creds.sharedSecret,
            status: 'online',
            capabilityIds: allowedCapabilities,
            hostHints: this.buildHostHints(creds),
            results: pendingResults,
          });
          pendingResults = [];
          savePendingResults(stateFile, pendingResults);
        }
        break;
      }

      const heartbeatIntervalMs = Math.max(
        3000,
        Number(heartbeat?.heartbeatIntervalMs || creds.heartbeatIntervalMs || this.intervalMs) || this.intervalMs,
      );
      await this.sleep(heartbeatIntervalMs);
    }
  }

  private async apiPost(// eslint-disable-next-line @typescript-eslint/no-explicit-any
    url: string, creds: NodeCredentials, body: Record<string, unknown>): Promise<any> {
    const response = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(String(creds.token || this.token || '').trim() ? { Authorization: `Bearer ${String(creds.token || this.token || '').trim()}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.error || `HTTP ${response.status} failure while contacting Node Mesh.`);
    }
    return payload;
  }

  private resolveBaseUrl(creds: NodeCredentials): string {
    const raw = String(creds.baseUrl || '').trim();
    if (!raw) {
      return 'http://127.0.0.1:33333';
    }
    return raw.endsWith('/') ? raw.slice(0, -1) : raw;
  }

  private resolveStateFile(creds: NodeCredentials | null): string | null {
    const raw = String(creds?.stateFile || this.configuredStateFile || '').trim();
    if (raw) {
      return path.resolve(raw);
    }
    const nodeId = String(creds?.nodeId || 'desktop-companion').trim() || 'desktop-companion';
    return path.resolve(this.tempRoot, `${nodeId}.json`);
  }

  private resolveAllowedCapabilities(creds: NodeCredentials): string[] {
    const declaredCapabilities = creds.capabilityIds && creds.capabilityIds.length > 0
      ? creds.capabilityIds
      : this.capabilities;
    return this.devicePolicy.resolveAllowedCapabilities(
      creds.nodeId,
      (declaredCapabilities as CapabilityId[]),
    );
  }

  private buildHostHints(creds: NodeCredentials): Record<string, unknown> {
    return {
      hostname: this.hostname,
      platform: process.platform,
      workspace: creds.workspace || this.workspaceRoot,
      surface: creds.surface || this.surface,
      arch: process.arch,
      osRelease: os.release(),
      nodeVersion: process.version,
      deviceModel: this.deviceModel || creds.label || null,
      appVersion: this.appVersion,
      networkType: this.networkType,
      locationLabel: this.locationLabel,
      ...(creds.hostHints || {}),
    };
  }

  private buildBlockedAssignmentResult(invocationId: string, capabilityId: string): Record<string, unknown> {
    return {
      invocationId,
      ok: false,
      resultSummary: `Capability ${capabilityId} blocked by the local companion allowlist.`,
      stdout: null,
      stderr: `capability blocked locally: ${capabilityId}`,
      exitCode: null,
      data: {
        capabilityId,
        policy: 'device-capability-policy',
      },
    };
  }
}
