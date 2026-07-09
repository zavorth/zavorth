import type {
  CapabilityManifestTemplate,
  CapabilityNormalizationFamily,
  CapabilityNormalizationSnapshot,
  CapabilityPrimitiveDefinition,
  CapabilitySourceMapping,
} from '../contracts/CapabilityNormalizationContract.js';
import { ZAVORTH_CAPABILITY_NORMALIZATION_CONTRACT_VERSION } from '../contracts/CapabilityNormalizationContract.js';
import { ZAVORTH_PLUGIN_OS_API_VERSION } from '../contracts/PluginManifestContract.js';
import {
  DEFAULT_PRIVATE_CAPABILITY_SOURCE_MODULES,
  GROUPS,
  PRIMITIVES,
  type SourceGroup,
} from './CapabilityNormalizationCatalog.js';

import type {
  ZavorthPluginManifest,
} from '../contracts/PluginManifestContract.js';

type CapabilityNormalizationRuntime = {
  now?: () => Date;
  sourceModules?: string[];
};


export { DEFAULT_PRIVATE_CAPABILITY_SOURCE_MODULES } from './CapabilityNormalizationCatalog.js';

export class CapabilityNormalizationService {
  private readonly now: () => Date;
  private readonly sourceModules: string[];
  private readonly primitivesById = new Map(PRIMITIVES.map((definition) => [definition.primitiveId, definition]));
  private readonly groupsByName = new Map<string, SourceGroup>();

  constructor(runtime: CapabilityNormalizationRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.sourceModules = runtime.sourceModules || DEFAULT_PRIVATE_CAPABILITY_SOURCE_MODULES;
    for (const groupItem of GROUPS) {
      for (const name of groupItem.names) {
        this.groupsByName.set(this.normalizeSourceName(name), groupItem);
      }
    }
  }

  public listPrimitives(): CapabilityPrimitiveDefinition[] {
    return [...PRIMITIVES];
  }

  public getPrimitive(primitiveId: string | null | undefined): CapabilityPrimitiveDefinition | null {
    return this.primitivesById.get(String(primitiveId || '').trim()) || null;
  }

  public resolveSourceModule(sourceName: string | null | undefined): CapabilitySourceMapping {
    const normalizedSourceName = this.normalizeSourceName(sourceName);
    const groupItem = this.groupsByName.get(normalizedSourceName);
    if (!groupItem) {
      return {
        sourceName: String(sourceName || '').trim(),
        normalizedSourceName,
        sourceKind: 'private-extension',
        primitiveId: null,
        family: null,
        moduleKind: null,
        status: 'unmapped',
        reason: 'No normalization rule exists yet.',
        targetFiles: {
          contract: null,
          service: null,
          adapter: null,
          policy: null,
        },
      };
    }

    const primitiveDefinition = this.getRequiredPrimitive(groupItem.primitiveId);
    const needsReview = primitiveDefinition.runtimeStatus === 'needs-contract';
    return {
      sourceName: String(sourceName || '').trim(),
      normalizedSourceName,
      sourceKind: 'private-extension',
      primitiveId: primitiveDefinition.primitiveId,
      family: primitiveDefinition.family,
      moduleKind: groupItem.moduleKind,
      status: needsReview ? 'needs-review' : 'normalized',
      reason: needsReview
        ? `${normalizedSourceName} maps to ${primitiveDefinition.primitiveId}, but the primitive still needs a native contract.`
        : `${normalizedSourceName} maps to ${primitiveDefinition.primitiveId}.`,
      targetFiles: {
        contract: primitiveDefinition.contractTarget,
        service: primitiveDefinition.serviceTarget,
        adapter: primitiveDefinition.adapterTarget,
        policy: primitiveDefinition.policyTarget,
      },
    };
  }

  public buildManifestTemplate(sourceName: string): CapabilityManifestTemplate {
    const source = this.resolveSourceModule(sourceName);
    if (!source.primitiveId || !source.moduleKind) {
      throw new Error(`Cannot build manifest template for unmapped source module: ${sourceName}`);
    }

    const primitiveDefinition = this.getRequiredPrimitive(source.primitiveId);
    const manifestId = this.buildManifestId(source.normalizedSourceName, primitiveDefinition.family);
    const manifest: ZavorthPluginManifest = {
      schemaVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
      id: manifestId,
      label: this.toLabel(source.normalizedSourceName),
      version: '0.1.0-template',
      moduleKind: source.moduleKind,
      summary: `${this.toLabel(source.normalizedSourceName)} module template for ${primitiveDefinition.primitiveId}.`,
      description: `Zavorth-native module template that binds ${source.normalizedSourceName} behavior to ${primitiveDefinition.primitiveId}.`,
      tags: [primitiveDefinition.family, source.normalizedSourceName, 'capability-normalized'],
      source: {
        kind: 'generated',
        locator: `zavorth-normalized://${source.normalizedSourceName}`,
        digest: null,
        trusted: false,
      },
      compatibility: {
        zavorthVersion: '>=1.1.0',
        pluginApiVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
      },
      capabilities: [
        {
          id: primitiveDefinition.primitiveId,
          intent: primitiveDefinition.intent,
          label: primitiveDefinition.label,
          summary: primitiveDefinition.summary,
          artifactKinds: primitiveDefinition.artifactKinds,
          command: primitiveDefinition.commandName
            ? {
                name: primitiveDefinition.commandName,
                aliases: [],
                usage: null,
              }
            : null,
        },
      ],
      permissions: primitiveDefinition.permissions,
      entrypoint: {
        module: `modules/${source.normalizedSourceName}/index.js`,
        exportName: 'createZavorthModule',
        runtime: 'none',
      },
      lifecycle: {
        actions: ['install', 'enable', 'disable', 'uninstall', 'invoke', 'doctor', 'upgrade'],
        defaultAction: 'invoke',
      },
      policy: {
        defaultTrust: 'review',
        requiresApproval: primitiveDefinition.permissions.some((item) =>
          ['secret.read', 'filesystem.write', 'process.spawn', 'network.external'].includes(item.kind),
        ),
        allowNetworkByDefault: !primitiveDefinition.permissions.some((item) => item.kind === 'network.external'),
        allowFilesystemWriteByDefault: false,
        allowProcessSpawnByDefault: false,
        sandboxProfile: primitiveDefinition.permissions.some((item) => item.kind === 'provider.call')
          ? 'networked'
          : 'restricted',
      },
      artifactKinds: primitiveDefinition.artifactKinds,
      receiptKinds: primitiveDefinition.receiptKinds,
    };

    return {
      source,
      primitive: primitiveDefinition,
      manifest,
    };
  }

  public buildSnapshot(input: { sourceModules?: string[] } = {}): CapabilityNormalizationSnapshot {
    const sourceModules = input.sourceModules || this.sourceModules;
    const mappings = sourceModules.map((sourceName) => this.resolveSourceModule(sourceName));
    const manifestTemplates = mappings.filter((mapping) => mapping.primitiveId !== null).length;
    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_CAPABILITY_NORMALIZATION_CONTRACT_VERSION,
      summary: {
        sourceModules: sourceModules.length,
        normalized: mappings.filter((mapping) => mapping.status === 'normalized').length,
        needsReview: mappings.filter((mapping) => mapping.status === 'needs-review').length,
        unmapped: mappings.filter((mapping) => mapping.status === 'unmapped').length,
        primitives: PRIMITIVES.length,
        manifestTemplates,
      },
      primitives: this.listPrimitives(),
      mappings,
    };
  }

  private getRequiredPrimitive(primitiveId: string): CapabilityPrimitiveDefinition {
    const primitiveDefinition = this.getPrimitive(primitiveId);
    if (!primitiveDefinition) {
      throw new Error(`Unknown capability primitive: ${primitiveId}`);
    }
    return primitiveDefinition;
  }

  private buildManifestId(sourceName: string, family: CapabilityNormalizationFamily): string {
    return `zavorth.${family}.${sourceName}`.replace(/[^a-z0-9_.:-]+/g, '-');
  }

  private normalizeSourceName(value: string | null | undefined): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private toLabel(value: string): string {
    return value
      .split(/[-_.:]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
