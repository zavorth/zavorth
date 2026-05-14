import type {
  ZavorthPluginLifecycleAction,
  ZavorthPluginManifest,
  ZavorthPluginReceipt,
  ZavorthPluginRegistryEntry,
  ZavorthPluginRuntimeState,
  ZavorthPluginSandboxDecision,
  ZavorthPluginStateEntry,
  ZavorthPluginTrustLevel,
} from '../contracts/PluginManifestContract.js';
import {
  ZAVORTH_PLUGIN_OS_API_VERSION,
  ZAVORTH_PLUGIN_OS_CONTRACT_VERSION,
} from '../contracts/PluginManifestContract.js';
import { PluginSandboxPolicyService } from './PluginSandboxPolicyService.js';

export type PluginInvocationRequest = {
  pluginId: string;
  capabilityId: string;
  input?: Record<string, unknown>;
  requestedBy?: string | null;
  approved?: boolean;
};

export type PluginInvocationPlan = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_PLUGIN_OS_CONTRACT_VERSION;
  pluginId: string;
  capabilityId: string;
  manifest: ZavorthPluginManifest;
  decision: ZavorthPluginSandboxDecision;
  receipt: ZavorthPluginReceipt;
};

export type PluginInvocationResult = {
  generatedAt: string;
  pluginId: string;
  capabilityId: string;
  status: 'executed' | 'planned' | 'blocked' | 'approval_required';
  output: unknown;
  receipt: ZavorthPluginReceipt;
};

export type PluginRegistrySnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_PLUGIN_OS_CONTRACT_VERSION;
  summary: {
    total: number;
    installed: number;
    enabled: number;
    blocked: number;
    trusted: number;
    capabilities: number;
  };
  entries: ZavorthPluginRegistryEntry[];
  receipts: ZavorthPluginReceipt[];
};

export type PluginRuntimeHandler = (
  request: PluginInvocationRequest,
  plan: PluginInvocationPlan,
) => unknown | Promise<unknown>;

type PluginRegistryRuntime = {
  now?: () => Date;
  manifests?: ZavorthPluginManifest[];
  policyService?: PluginSandboxPolicyService;
  handlers?: Record<string, PluginRuntimeHandler>;
};

export class PluginRegistryService {
  private readonly now: () => Date;
  private readonly policy: PluginSandboxPolicyService;
  private readonly handlers: Record<string, PluginRuntimeHandler>;
  private readonly manifests = new Map<string, ZavorthPluginManifest>();
  private readonly states = new Map<string, ZavorthPluginStateEntry>();
  private readonly receipts: ZavorthPluginReceipt[] = [];

  constructor(runtime: PluginRegistryRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.policy = runtime.policyService || new PluginSandboxPolicyService({ now: this.now });
    this.handlers = runtime.handlers || {};

    for (const manifest of runtime.manifests || []) {
      this.registerManifest(manifest);
    }
  }

  public registerManifest(manifest: ZavorthPluginManifest): ZavorthPluginRegistryEntry {
    const validation = this.validateManifest(manifest);
    if (validation.length > 0) {
      throw new Error(`Invalid plugin manifest ${manifest.id || '<missing>'}: ${validation.join('; ')}`);
    }

    const id = this.normalizeId(manifest.id);
    const normalizedManifest = {
      ...manifest,
      id,
    };
    this.manifests.set(id, normalizedManifest);
    if (!this.states.has(id)) {
      this.states.set(id, this.createState(normalizedManifest, 'available'));
    }

    return this.getEntry(id) as ZavorthPluginRegistryEntry;
  }

  public listEntries(): ZavorthPluginRegistryEntry[] {
    return Array.from(this.manifests.keys())
      .sort((left, right) => left.localeCompare(right))
      .map((id) => this.getEntry(id))
      .filter((entry): entry is ZavorthPluginRegistryEntry => Boolean(entry));
  }

  public getEntry(pluginId: string | null | undefined): ZavorthPluginRegistryEntry | null {
    const id = this.normalizeId(pluginId);
    const manifest = this.manifests.get(id);
    if (!manifest) {
      return null;
    }

    const state = this.states.get(id) || this.createState(manifest, 'available');
    const findings = this.validateManifest(manifest);
    return {
      manifest,
      state,
      health: {
        ok: findings.length === 0,
        summary: findings.length === 0 ? 'manifest ready' : 'manifest needs repair',
        findings,
      },
    };
  }

  public install(pluginId: string, options: { approved?: boolean } = {}): ZavorthPluginReceipt {
    return this.applyLifecycleAction(pluginId, 'install', options, (state, nowIso) => ({
      ...state,
      state: 'installed',
      installedAt: state.installedAt || nowIso,
      updatedAt: nowIso,
    }));
  }

  public enable(pluginId: string, options: { approved?: boolean } = {}): ZavorthPluginReceipt {
    return this.applyLifecycleAction(pluginId, 'enable', options, (state, nowIso) => {
      if (state.state === 'available') {
        throw new Error(`Plugin must be installed before enable: ${pluginId}`);
      }
      return {
        ...state,
        state: 'enabled',
        updatedAt: nowIso,
      };
    });
  }

  public disable(pluginId: string): ZavorthPluginReceipt {
    return this.applyLifecycleAction(pluginId, 'disable', { approved: true }, (state, nowIso) => ({
      ...state,
      state: state.state === 'blocked' ? 'blocked' : 'disabled',
      updatedAt: nowIso,
    }));
  }

  public uninstall(pluginId: string): ZavorthPluginReceipt {
    return this.applyLifecycleAction(pluginId, 'uninstall', { approved: true }, (state, nowIso) => ({
      ...state,
      state: 'available',
      installedAt: null,
      updatedAt: nowIso,
    }));
  }

  public prepareInvocation(request: PluginInvocationRequest): PluginInvocationPlan {
    const generatedAt = this.now().toISOString();
    const entry = this.getRequiredEntry(request.pluginId);
    const capability = entry.manifest.capabilities.find((item) => item.id === request.capabilityId);
    if (!capability) {
      throw new Error(`Capability ${request.capabilityId} is not declared by plugin ${entry.manifest.id}`);
    }

    const decision = this.policy.evaluate({
      manifest: entry.manifest,
      action: 'invoke',
      approved: request.approved,
      trustOverride: entry.state.trust,
    });
    const receipt = this.buildReceipt({
      generatedAt,
      manifest: entry.manifest,
      action: 'invoke',
      decision,
      plannedSummary: `Prepared ${capability.id} through Plugin OS.`,
    });
    this.receipts.push(receipt);

    return {
      generatedAt,
      contractVersion: ZAVORTH_PLUGIN_OS_CONTRACT_VERSION,
      pluginId: entry.manifest.id,
      capabilityId: capability.id,
      manifest: entry.manifest,
      decision,
      receipt,
    };
  }

  public async invoke(request: PluginInvocationRequest): Promise<PluginInvocationResult> {
    const plan = this.prepareInvocation(request);
    if (plan.decision.status === 'blocked') {
      return {
        generatedAt: this.now().toISOString(),
        pluginId: plan.pluginId,
        capabilityId: plan.capabilityId,
        status: 'blocked',
        output: null,
        receipt: plan.receipt,
      };
    }

    if (plan.decision.status === 'needs_approval') {
      return {
        generatedAt: this.now().toISOString(),
        pluginId: plan.pluginId,
        capabilityId: plan.capabilityId,
        status: 'approval_required',
        output: null,
        receipt: plan.receipt,
      };
    }

    const handler = this.handlers[plan.pluginId];
    if (!handler) {
      return {
        generatedAt: this.now().toISOString(),
        pluginId: plan.pluginId,
        capabilityId: plan.capabilityId,
        status: 'planned',
        output: {
          summary: 'No runtime handler registered; invocation was planned only.',
        },
        receipt: plan.receipt,
      };
    }

    return {
      generatedAt: this.now().toISOString(),
      pluginId: plan.pluginId,
      capabilityId: plan.capabilityId,
      status: 'executed',
      output: await handler(request, plan),
      receipt: plan.receipt,
    };
  }

  public buildSnapshot(): PluginRegistrySnapshot {
    const entries = this.listEntries();
    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_PLUGIN_OS_CONTRACT_VERSION,
      summary: {
        total: entries.length,
        installed: entries.filter((entry) => ['installed', 'enabled', 'disabled'].includes(entry.state.state)).length,
        enabled: entries.filter((entry) => entry.state.state === 'enabled').length,
        blocked: entries.filter((entry) => entry.state.state === 'blocked' || entry.state.trust === 'blocked').length,
        trusted: entries.filter((entry) => entry.state.trust === 'trusted').length,
        capabilities: entries.reduce((total, entry) => total + entry.manifest.capabilities.length, 0),
      },
      entries,
      receipts: [...this.receipts],
    };
  }

  public validateManifest(manifest: Partial<ZavorthPluginManifest>): string[] {
    const findings: string[] = [];
    if (!this.normalizeId(manifest.id)) {
      findings.push('id is required');
    }
    if (manifest.schemaVersion !== ZAVORTH_PLUGIN_OS_API_VERSION) {
      findings.push(`schemaVersion must be ${ZAVORTH_PLUGIN_OS_API_VERSION}`);
    }
    if (manifest.compatibility?.pluginApiVersion !== ZAVORTH_PLUGIN_OS_API_VERSION) {
      findings.push(`compatibility.pluginApiVersion must be ${ZAVORTH_PLUGIN_OS_API_VERSION}`);
    }
    if (!manifest.label) {
      findings.push('label is required');
    }
    if (!manifest.version) {
      findings.push('version is required');
    }
    if (!Array.isArray(manifest.capabilities) || manifest.capabilities.length === 0) {
      findings.push('at least one capability is required');
    }
    if (!manifest.entrypoint?.exportName || !manifest.entrypoint?.runtime) {
      findings.push('entrypoint exportName and runtime are required');
    }
    if (!manifest.lifecycle?.actions?.includes('invoke')) {
      findings.push('lifecycle must include invoke');
    }
    if (!manifest.policy) {
      findings.push('policy is required');
    }
    return findings;
  }

  private applyLifecycleAction(
    pluginId: string,
    action: ZavorthPluginLifecycleAction,
    options: { approved?: boolean },
    apply: (state: ZavorthPluginStateEntry, nowIso: string) => ZavorthPluginStateEntry,
  ): ZavorthPluginReceipt {
    const generatedAt = this.now().toISOString();
    const entry = this.getRequiredEntry(pluginId);
    const decision = this.policy.evaluate({
      manifest: entry.manifest,
      action,
      approved: options.approved,
      trustOverride: entry.state.trust,
    });
    const receipt = this.buildReceipt({
      generatedAt,
      manifest: entry.manifest,
      action,
      decision,
      plannedSummary: `${action} ${entry.manifest.id}`,
    });
    this.receipts.push(receipt);

    if (decision.status !== 'allow') {
      return receipt;
    }

    const nextState = apply(entry.state, generatedAt);
    this.states.set(entry.manifest.id, nextState);
    return {
      ...receipt,
      status: 'applied',
      summary: `${action} applied for ${entry.manifest.id}`,
    };
  }

  private buildReceipt(input: {
    generatedAt: string;
    manifest: ZavorthPluginManifest;
    action: ZavorthPluginLifecycleAction;
    decision: ZavorthPluginSandboxDecision;
    plannedSummary: string;
  }): ZavorthPluginReceipt {
    const status = input.decision.status === 'blocked'
      ? 'blocked'
      : input.decision.status === 'needs_approval'
        ? 'approval_required'
        : 'planned';
    return {
      generatedAt: input.generatedAt,
      pluginId: input.manifest.id,
      action: input.action,
      status,
      summary: status === 'planned'
        ? input.plannedSummary
        : input.decision.reasons.concat(input.decision.requiredApprovals).join('; '),
      decision: input.decision,
    };
  }

  private getRequiredEntry(pluginId: string): ZavorthPluginRegistryEntry {
    const entry = this.getEntry(pluginId);
    if (!entry) {
      throw new Error(`Plugin not registered: ${pluginId}`);
    }
    return entry;
  }

  private createState(
    manifest: ZavorthPluginManifest,
    state: ZavorthPluginRuntimeState,
  ): ZavorthPluginStateEntry {
    const nowIso = this.now().toISOString();
    return {
      pluginId: manifest.id,
      revision: manifest.version,
      state,
      trust: manifest.policy.defaultTrust as ZavorthPluginTrustLevel,
      installedAt: null,
      updatedAt: nowIso,
    };
  }

  private normalizeId(value: string | null | undefined): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.:/-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
