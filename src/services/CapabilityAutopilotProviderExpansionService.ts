import { CapabilityAutopilotFallbackSelectionService } from './CapabilityAutopilotFallbackSelectionService.js';
import { CapabilityAutopilotReadinessService } from './CapabilityAutopilotReadinessService.js';
import { CapabilityAutopilotReceiptService } from './CapabilityAutopilotReceiptService.js';
import { IntegrationRegistryService } from './IntegrationRegistryService.js';
import type {
  CapabilityAutopilotAudience,
  CapabilityAutopilotSurface,
  CapabilityOperationalDescriptor,
  CapabilityReadinessSnapshot,
  CapabilityReceipt,
} from '../contracts/CapabilityAutopilotContract.js';
import type { IntegrationManifest } from '../contracts/IntegrationHubContract.js';
import { logger } from '../logger.js';

export type CapabilityProviderExpansionTarget = {
  id: string;
  kind: 'capability' | 'integration';
  required: boolean;
};

export type CapabilityProviderExpansionEntry = {
  id: string;
  label: string;
  kind: CapabilityProviderExpansionTarget['kind'];
  category: 'executor' | 'provider' | 'local_runtime' | 'channel' | 'service' | 'unknown';
  supportLevel: string | null;
  readinessStatus: CapabilityReadinessSnapshot['status'];
  ready: boolean;
  safeToRun: boolean;
  summary: string;
  issue: string | null;
  repairPlanStatus: string | null;
  permissionCount: number;
  fallbackCount: number;
  selectableFallbackCount: number;
  explicitFallbackRequired: true;
  autoFallbackExecuted: false;
  descriptorFound: boolean;
  manifestFound: boolean;
  metadata: Record<string, unknown>;
};

export type CapabilityProviderExpansionSnapshot = {
  generatedAt: string;
  profile: 'capability-autopilot-provider-expansion';
  surface: CapabilityAutopilotSurface;
  audience: CapabilityAutopilotAudience;
  entries: CapabilityProviderExpansionEntry[];
  coverage: {
    requiredTargets: number;
    coveredRequiredTargets: number;
    capabilityTargets: number;
    integrationTargets: number;
    remoteProviders: number;
    localRuntimes: number;
    channels: number;
    selectableFallbacks: number;
  };
  adapters: {
    executionGatewayRunner: 'available';
    fallbackSelection: 'available';
    autoFallbackExecuted: false;
  };
  recommendations: string[];
};

export type CapabilityProviderExpansionOptions = {
  targets?: CapabilityProviderExpansionTarget[];
  surface?: CapabilityAutopilotSurface;
  audience?: CapabilityAutopilotAudience;
};

type ReadinessLike = Pick<
  CapabilityAutopilotReadinessService,
  'getOperationalDescriptor' | 'buildReadinessSnapshot'
>;
type ReceiptLike = Pick<CapabilityAutopilotReceiptService, 'buildCapabilityReceipt'>;
type IntegrationRegistryLike = Pick<IntegrationRegistryService, 'listManifests' | 'getManifestById'>;
type FallbackSelectionLike = Pick<CapabilityAutopilotFallbackSelectionService, 'buildFallbackMenu'>;

export type CapabilityAutopilotProviderExpansionRuntime = {
  now?: () => Date;
  readinessService?: ReadinessLike;
  receiptService?: ReceiptLike;
  integrationRegistryService?: IntegrationRegistryLike;
  fallbackSelectionService?: FallbackSelectionLike;
};

const DEFAULT_TARGETS: CapabilityProviderExpansionTarget[] = [
  { id: 'executor-codex', kind: 'capability', required: true },
  { id: 'executor-gemini-cli', kind: 'capability', required: true },
  { id: 'executor-external-executor', kind: 'capability', required: true },
  { id: 'executor-aistudio', kind: 'capability', required: true },
  { id: 'gemini', kind: 'integration', required: true },
  { id: 'openai', kind: 'integration', required: true },
  { id: 'openrouter', kind: 'integration', required: true },
  { id: 'minimax', kind: 'integration', required: true },
  { id: 'external-executor', kind: 'integration', required: true },
  { id: 'ollama', kind: 'integration', required: true },
  { id: 'AIGateway', kind: 'integration', required: true },
  { id: 'zavorth-terminal', kind: 'integration', required: true },
  { id: 'telegram', kind: 'integration', required: true },
  { id: 'slack', kind: 'integration', required: true },
  { id: 'discord', kind: 'integration', required: false },
  { id: 'whatsapp', kind: 'integration', required: false },
];

export class CapabilityAutopilotProviderExpansionService {
  private readonly now: () => Date;
  private readonly readinessService: ReadinessLike;
  private readonly receiptService: ReceiptLike;
  private readonly integrationRegistryService: IntegrationRegistryLike;
  private readonly fallbackSelectionService: FallbackSelectionLike;

  constructor(runtime: CapabilityAutopilotProviderExpansionRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.readinessService = runtime.readinessService || new CapabilityAutopilotReadinessService();
    this.receiptService = runtime.receiptService || new CapabilityAutopilotReceiptService({
      readinessService: this.readinessService,
    });
    this.integrationRegistryService = runtime.integrationRegistryService || new IntegrationRegistryService();
    this.fallbackSelectionService = runtime.fallbackSelectionService || new CapabilityAutopilotFallbackSelectionService();
  }

  public async buildExpansionSnapshot(
    options: CapabilityProviderExpansionOptions = {},
  ): Promise<CapabilityProviderExpansionSnapshot> {
    const surface = options.surface || 'cli';
    const audience = options.audience || 'technical_operator';
    const targets = options.targets || DEFAULT_TARGETS;
    const entries: CapabilityProviderExpansionEntry[] = [];

    for (const target of targets) {
      entries.push(await this.buildEntry(target, surface, audience));
    }

    return {
      generatedAt: this.now().toISOString(),
      profile: 'capability-autopilot-provider-expansion',
      surface,
      audience,
      entries,
      coverage: this.buildCoverage(entries, targets),
      adapters: {
        executionGatewayRunner: 'available',
        fallbackSelection: 'available',
        autoFallbackExecuted: false,
      },
      recommendations: this.buildRecommendations(entries),
    };
  }

  private async buildEntry(
    target: CapabilityProviderExpansionTarget,
    surface: CapabilityAutopilotSurface,
    audience: CapabilityAutopilotAudience,
  ): Promise<CapabilityProviderExpansionEntry> {
    const descriptor = this.readinessService.getOperationalDescriptor(target.id);
    const manifest = target.kind === 'integration'
      ? this.integrationRegistryService.getManifestById(target.id)
      : this.findManifestForCapability(descriptor);
    const readiness = await this.readinessService.buildReadinessSnapshot(target.id);
    const receipt = await this.safeBuildReceipt(target.id, surface, audience);
    const fallbackMenu = this.fallbackSelectionService.buildFallbackMenu({
      receipt,
      repairPlan: receipt?.repairPlan || null,
      surface,
      audience,
    });

    return {
      id: target.id,
      label: descriptor?.label || manifest?.label || target.id,
      kind: target.kind,
      category: this.resolveCategory(target, descriptor, manifest),
      supportLevel: manifest?.supportLevel || null,
      readinessStatus: readiness.status,
      ready: readiness.ready,
      safeToRun: readiness.safeToRun,
      summary: readiness.summary,
      issue: readiness.ready ? null : readiness.blockingReason || readiness.detail,
      repairPlanStatus: receipt?.repairPlan?.status || null,
      permissionCount: receipt?.repairPlan?.permissionRequirements.length || 0,
      fallbackCount: fallbackMenu.candidates.length,
      selectableFallbackCount: fallbackMenu.candidates.filter((candidate) => candidate.selectable).length,
      explicitFallbackRequired: true,
      autoFallbackExecuted: false,
      descriptorFound: Boolean(descriptor),
      manifestFound: Boolean(manifest),
      metadata: {
        phase: 'capability-autopilot-checkpoint-65',
        required: target.required,
        fallbackMenuStatus: fallbackMenu.status,
        integrationId: manifest?.id || descriptor?.integration?.integrationId || null,
      },
    };
  }

  private async safeBuildReceipt(
    id: string,
    surface: CapabilityAutopilotSurface,
    audience: CapabilityAutopilotAudience,
  ): Promise<CapabilityReceipt | null> {
    try {
      return await this.receiptService.buildCapabilityReceipt(id, { surface, audience });
    } catch (error: any) { logger.warn('[Capability Autopilot  Expansion] creation failed', error); return null; }
  }

  private findManifestForCapability(
    descriptor: CapabilityOperationalDescriptor | null,
  ): IntegrationManifest | null {
    const integrationId = descriptor?.integration?.integrationId || null;
    if (integrationId) {
      return this.integrationRegistryService.getManifestById(integrationId);
    }
    return null;
  }

  private resolveCategory(
    target: CapabilityProviderExpansionTarget,
    descriptor: CapabilityOperationalDescriptor | null,
    manifest: IntegrationManifest | null,
  ): CapabilityProviderExpansionEntry['category'] {
    if (target.kind === 'capability' && descriptor?.type === 'executor') {
      return 'executor';
    }
    if (manifest?.tags.includes('channel')) {
      return 'channel';
    }
    if (manifest?.category === 'local') {
      return 'local_runtime';
    }
    if (manifest?.binding.kind === 'provider') {
      return 'provider';
    }
    if (manifest?.binding.kind === 'service') {
      return 'service';
    }
    return 'unknown';
  }

  private buildCoverage(
    entries: CapabilityProviderExpansionEntry[],
    targets: CapabilityProviderExpansionTarget[],
  ): CapabilityProviderExpansionSnapshot['coverage'] {
    const requiredIds = new Set(targets.filter((target) => target.required).map((target) => target.id));
    return {
      requiredTargets: requiredIds.size,
      coveredRequiredTargets: entries.filter((entry) =>
        requiredIds.has(entry.id) && entry.descriptorFound && (entry.kind === 'capability' || entry.manifestFound)
      ).length,
      capabilityTargets: entries.filter((entry) => entry.kind === 'capability').length,
      integrationTargets: entries.filter((entry) => entry.kind === 'integration').length,
      remoteProviders: entries.filter((entry) => entry.category === 'provider').length,
      localRuntimes: entries.filter((entry) => entry.category === 'local_runtime').length,
      channels: entries.filter((entry) => entry.category === 'channel').length,
      selectableFallbacks: entries.reduce((total, entry) => total + entry.selectableFallbackCount, 0),
    };
  }

  private buildRecommendations(entries: CapabilityProviderExpansionEntry[]): string[] {
    const missing = entries.filter((entry) => !entry.ready);
    const channels = entries.filter((entry) => entry.category === 'channel');
    const localRuntimes = entries.filter((entry) => entry.category === 'local_runtime');
    const recommendations = [
      `${entries.length} provider/capability target(s) mapped for Capability Autopilot.`,
      `${missing.length} target(s) need configuration, permission or probe before use.`,
      `${channels.length} channel surface(s) covered by the same fallback and readiness contract.`,
      `${localRuntimes.length} local runtime(s) covered without persistent sidecar activation.`,
    ];

    if (entries.some((entry) => entry.selectableFallbackCount > 0)) {
      recommendations.push('Fallbacks are available only as explicit user selections.');
    }

    return recommendations;
  }
}
