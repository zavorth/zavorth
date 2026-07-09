import fs from 'node:fs';
import path from 'node:path';
import type {
  SourceProviderCredentialRoute,
  SourceProviderMeshExpansionSnapshot,
  SourceProviderMeshPackageEvidence,
  SourceProviderMeshPackageName,
  SourceProviderRuntimeAdapterEntry,
  SourceProviderRuntimeDecision,
  SourceProviderRuntimeFamily,
  SourceProviderRuntimeId,
  SourceProviderRuntimeStatus,
  ProviderRuntimeContract,
} from '../contracts/SourceProviderMeshExpansionContract.js';
import {
  SOURCE_PROVIDER_MESH_PACKAGES,
  ZAVORTH_SOURCE_PROVIDER_MESH_EXPANSION_CONTRACT_VERSION,
} from '../contracts/SourceProviderMeshExpansionContract.js';
import { ProviderFactory } from '../providers/ProviderFactory.js';
import { SourceProviderCredentialRouteService } from './SourceProviderCredentialRouteService.js';
import { resolveZavorthSourceRoot } from './ZavorthSourceRootResolver.js';
import { logger } from '../logger.js';

type Runtime = {
  now?: () => Date;
  sourceRoot?: string;
  zavorthRoot?: string;
  credentialRouteService?: SourceProviderCredentialRouteService;
};

type AdapterDescriptor = {
  providerId: SourceProviderRuntimeId;
  family: SourceProviderRuntimeFamily;
  decision: SourceProviderRuntimeDecision;
  adapterPath: string;
  providerFactoryName: string;
  defaultModelName: string;
  route: {
    kind: ProviderRuntimeContract['routeKind'];
    requiredEnv: string[];
    optionalEnv: string[];
    ownerApprovalRequired: boolean;
    reason: string;
  };
  packages: SourceProviderMeshPackageName[];
  ownerGated: boolean;
  notes: string[];
};

type PackageJsonShape = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

type Reference = {
  relativePath: string;
  kind: 'package-json' | 'lockfile' | 'source';
};

const GENERATED_OR_VENDOR_ROOTS = new Set([
  '.git',
  '.next',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'target',
  'tmp',
]);

const LOCKFILE_NAMES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
]);

const SOURCE_EXTENSIONS = new Set([
  '.cjs',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx',
]);

const ADAPTERS: AdapterDescriptor[] = [
  {
    providerId: 'anthropic-direct',
    family: 'anthropic-direct-sdk',
    decision: 'implemented',
    adapterPath: 'src/adapters/providers/AnthropicDirectProviderAdapter.ts',
    providerFactoryName: 'anthropic-direct',
    defaultModelName: 'claude-sonnet-4-6',
    route: {
      kind: 'api-key',
      requiredEnv: ['ANTHROPIC_API_KEY'],
      optionalEnv: ['ANTHROPIC_BASE_URL', 'ANTHROPIC_MODEL', 'ANTHROPIC_VERSION'],
      ownerApprovalRequired: false,
      reason: 'Direct Anthropic route requires a real Anthropic API key and explicit provider selection.',
    },
    packages: ['@anthropic-ai/sdk'],
    ownerGated: false,
    notes: ['Direct SDK adapter is separate from Claude Agent SDK and does not expose agent tools.'],
  },
  {
    providerId: 'anthropic-vertex',
    family: 'anthropic-vertex-sdk',
    decision: 'implemented-owner-gated',
    adapterPath: 'src/adapters/providers/AnthropicVertexProviderAdapter.ts',
    providerFactoryName: 'anthropic-vertex',
    defaultModelName: 'claude-sonnet-4-6',
    route: {
      kind: 'vertex',
      requiredEnv: ['ANTHROPIC_VERTEX_PROJECT_ID'],
      optionalEnv: ['ANTHROPIC_VERTEX_REGION', 'ANTHROPIC_VERTEX_MODEL', 'GOOGLE_CLOUD_PROJECT', 'GOOGLE_CLOUD_LOCATION'],
      ownerApprovalRequired: true,
      reason: 'Vertex route uses Google Cloud identity/project routing and never pretends to be the Anthropic API.',
    },
    packages: ['@anthropic-ai/vertex-sdk'],
    ownerGated: true,
    notes: ['Owner approval is required because cloud project/region selection changes billing and data route.'],
  },
  {
    providerId: 'bedrock-claude',
    family: 'aws-bedrock-runtime',
    decision: 'implemented-owner-gated',
    adapterPath: 'src/adapters/providers/BedrockClaudeProviderAdapter.ts',
    providerFactoryName: 'bedrock-claude',
    defaultModelName: 'anthropic.claude-3-5-sonnet-latest-20250929-v1:0',
    route: {
      kind: 'bedrock',
      requiredEnv: ['AWS_REGION'],
      optionalEnv: ['AWS_PROFILE', 'AWS_DEFAULT_REGION', 'BEDROCK_CLAUDE_MODEL'],
      ownerApprovalRequired: true,
      reason: 'Bedrock Claude route uses AWS Bedrock Runtime credentials and region, not Anthropic API emulation.',
    },
    packages: ['@aws-sdk/client-bedrock-runtime'],
    ownerGated: true,
    notes: ['Live use is gated by AWS credentials and explicit provider selection.'],
  },
  {
    providerId: 'google-genai',
    family: 'google-genai-sdk',
    decision: 'implemented',
    adapterPath: 'src/adapters/providers/GoogleGenAiProviderAdapter.ts',
    providerFactoryName: 'google-genai',
    defaultModelName: 'gemini-2.5-flash',
    route: {
      kind: 'google-genai',
      requiredEnv: ['GOOGLE_GENAI_API_KEY'],
      optionalEnv: ['GEMINI_API_KEY', 'GOOGLE_GENAI_MODEL', 'GOOGLE_GENAI_VERTEXAI', 'GOOGLE_CLOUD_PROJECT', 'GOOGLE_CLOUD_LOCATION'],
      ownerApprovalRequired: false,
      reason: 'Google GenAI route is an explicit Gemini/Vertex-capable Provider Mesh route.',
    },
    packages: ['@google/genai'],
    ownerGated: false,
    notes: ['Existing Gemini provider remains supported; this adapter adds the newer Google GenAI SDK route.'],
  },
  {
    providerId: 'provider-proxy-network',
    family: 'proxy-network-runtime',
    decision: 'implemented',
    adapterPath: 'src/services/SourceProviderMeshExpansionService.ts',
    providerFactoryName: 'provider-proxy-network',
    defaultModelName: 'n/a',
    route: {
      kind: 'proxy',
      requiredEnv: [],
      optionalEnv: ['HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY', 'ZAVORTH_PROVIDER_PROXY_URL'],
      ownerApprovalRequired: false,
      reason: 'Proxy packages are tracked as Provider Mesh network plumbing, not as a model provider.',
    },
    packages: ['proxy-agent', 'https-proxy-agent', 'undici'],
    ownerGated: false,
    notes: ['Proxy support is policy metadata for provider routes; no network call is performed by the Approval gate check.'],
  },
  {
    providerId: 'local-openai-compatible',
    family: 'local-openai-compatible',
    decision: 'provider-mesh-only',
    adapterPath: 'src/providers/LocalLlamaProvider.ts + src/providers/GatewayProvider.ts',
    providerFactoryName: 'ollama|lmstudio|vllm|custom-openai-compatible',
    defaultModelName: 'local-model',
    route: {
      kind: 'local',
      requiredEnv: [],
      optionalEnv: ['OLLAMA_BASE_URL', 'LMSTUDIO_BASE_URL', 'VLLM_BASE_URL', 'CUSTOM_OPENAI_COMPATIBLE_BASE_URL'],
      ownerApprovalRequired: false,
      reason: 'Local models must use Provider Mesh local/OpenAI-compatible routes instead of Anthropic API impersonation.',
    },
    packages: ['undici'],
    ownerGated: false,
    notes: ['Recommended local route remains Ollama, LM Studio, vLLM or any explicit OpenAI-compatible adapter.'],
  },
];

export class SourceProviderMeshExpansionService {
  private readonly now: () => Date;
  private readonly sourceRoot?: string;
  private readonly zavorthRoot?: string;
  private readonly credentialRoutes: SourceProviderCredentialRouteService;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.sourceRoot = runtime.sourceRoot;
    this.zavorthRoot = runtime.zavorthRoot;
    this.credentialRoutes = runtime.credentialRouteService || new SourceProviderCredentialRouteService();
  }

  public buildSnapshot(input: {
    sourceRoot?: string | null;
    zavorthRoot?: string | null;
  } = {}): SourceProviderMeshExpansionSnapshot {
    const zavorthRoot = path.resolve(input.zavorthRoot || this.zavorthRoot || process.cwd());
    const sourceRoot = resolveZavorthSourceRoot({
      sourceRoot: input.sourceRoot || this.sourceRoot,
      zavorthRoot,
    });
    const packageEvidence = SOURCE_PROVIDER_MESH_PACKAGES.map((packageName) =>
      this.buildPackageEvidence(packageName, sourceRoot, zavorthRoot),
    );
    const adapters = ADAPTERS.map((adapter) =>
      this.buildAdapterEntry(adapter, packageEvidence, zavorthRoot),
    );
    const status = this.resolveStatus(adapters, packageEvidence);

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_SOURCE_PROVIDER_MESH_EXPANSION_CONTRACT_VERSION,
      status,
      phase: 3,
      statement: 'Source provider breadth is absorbed as explicit Zavorth Provider Mesh adapters, credential routes, local-provider alternatives and receipts.',
      sourceRoot: normalizePath(sourceRoot),
      zavorthRoot: normalizePath(zavorthRoot),
      packageEvidence,
      adapters,
      summary: {
        packagesTracked: SOURCE_PROVIDER_MESH_PACKAGES.length,
        packagesPresentInSource: packageEvidence.filter((entry) => entry.presentInSource).length,
        packagesImplementedInZavorth: packageEvidence.filter((entry) => entry.presentInZavorthPackageJson).length,
        adaptersReady: adapters.filter((entry) => entry.status === 'ready' || entry.status === 'configured').length,
        adaptersOwnerGated: adapters.filter((entry) => entry.credentialRoute.ownerApprovalRequired).length,
        adaptersConfigured: adapters.filter((entry) => entry.configured).length,
        providerFactoryRoutes: adapters.filter((entry) => this.providerFactoryResolves(entry.providerFactoryName)).length,
        liveIoPerformed: false,
        enabledByDefault: false,
        secretValuesSerialized: false,
      },
      localModelPolicy: {
        recommendation: 'Use Provider Mesh via Ollama, LM Studio, vLLM or OpenAI-compatible local providers.',
        noAnthropicApiImpersonationForLocalModels: true,
        openAiCompatibleRoutes: ['ollama', 'lmstudio', 'vllm', 'custom-openai-compatible'],
      },
      networkPolicy: {
        proxyEnvSupported: ['HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY', 'ZAVORTH_PROVIDER_PROXY_URL'],
        proxyPackagesTracked: ['proxy-agent', 'https-proxy-agent', 'undici'],
        noNetworkWithoutProviderSelection: true,
        noSecretValuesInReceipts: true,
      },
      policy: {
        noSourceSourceCopy: true,
        noAnthropicApiImpersonation: true,
        noProviderBypass: true,
        directAnthropicNeverEnabledByDefault: true,
        vertexNeverEnabledByDefault: true,
        bedrockNeverEnabledByDefault: true,
        googleGenAiNeverEnabledByDefault: true,
        artifactFirstReceipts: true,
      },
      commands: {
        inspect: 'npm run source-provider-mesh-expansion --silent',
        inspectJson: 'npm run source-provider-mesh-expansion:json --silent',
        check: 'npm run source-provider-mesh-expansion:check --silent',
        qa: 'npm run qa:source-provider-mesh-expansion --silent',
        liveSmoke: 'npm run source-provider-mesh-expansion -- --provider <provider> --confirm-live-io',
        nextStage: 'Connector registry - Channel Mesh Expansion Pack',
      },
    };
  }

  public formatSnapshotText(snapshot = this.buildSnapshot()): string {
    const lines = [
      'Zavorth Source Provider Mesh Expansion - Approval gate',
      `Status: ${snapshot.status}`,
      `Contract: ${snapshot.contractVersion}`,
      `Provider packages tracked: ${snapshot.summary.packagesTracked}`,
      `Provider packages present in Source: ${snapshot.summary.packagesPresentInSource}`,
      `Provider packages implemented in Zavorth: ${snapshot.summary.packagesImplementedInZavorth}`,
      `Adapters ready: ${snapshot.summary.adaptersReady}`,
      `Adapters configured: ${snapshot.summary.adaptersConfigured}`,
      `Owner-gated adapters: ${snapshot.summary.adaptersOwnerGated}`,
      `ProviderFactory routes: ${snapshot.summary.providerFactoryRoutes}`,
      `Live I/O performed: ${snapshot.summary.liveIoPerformed}`,
      `Enabled by default: ${snapshot.summary.enabledByDefault}`,
    ];

    lines.push('Adapters:');
    for (const adapter of snapshot.adapters) {
      lines.push(`- ${adapter.providerId}: ${adapter.status}, decision=${adapter.decision}, configured=${adapter.configured}, route=${adapter.credentialRoute.routeKind}`);
    }

    lines.push(`Local models: ${snapshot.localModelPolicy.recommendation}`);
    lines.push(`Next: ${snapshot.commands.nextStage}`);
    return lines.join('\n');
  }

  private buildAdapterEntry(
    descriptor: AdapterDescriptor,
    packageEvidence: SourceProviderMeshPackageEvidence[],
    zavorthRoot: string,
  ): SourceProviderRuntimeAdapterEntry {
    const credentialRoute = this.credentialRoutes.buildRoute({
      providerId: descriptor.providerId,
      routeKind: descriptor.route.kind,
      requiredEnv: descriptor.route.requiredEnv,
      optionalEnv: descriptor.route.optionalEnv,
      ownerApprovalRequired: descriptor.route.ownerApprovalRequired,
      reason: descriptor.route.reason,
    });
    const allPackagesImplemented = descriptor.packages.every((packageName) =>
      packageEvidence.find((entry) => entry.packageName === packageName)?.presentInZavorthPackageJson === true,
    );
    const adapterExists = descriptor.adapterPath.includes(' + ')
      ? true
      : fs.existsSync(path.join(zavorthRoot, descriptor.adapterPath));
    const status = this.resolveAdapterStatus({
      descriptor,
      credentialRoute,
      adapterExists,
      allPackagesImplemented,
    });

    return {
      providerId: descriptor.providerId,
      family: descriptor.family,
      status,
      decision: descriptor.decision,
      contract: {
        providerId: descriptor.providerId,
        family: descriptor.family,
        defaultModelName: descriptor.defaultModelName,
        routeKind: descriptor.route.kind,
        liveIoByDefault: false,
        explicitProviderSelectionRequired: true,
        secretValuesSerialized: false,
      },
      adapterPath: descriptor.adapterPath,
      providerFactoryName: descriptor.providerFactoryName,
      defaultModelName: descriptor.defaultModelName,
      credentialRoute,
      packages: descriptor.packages,
      configured: credentialRoute.status === 'configured',
      enabledByDefault: false,
      liveIoPerformed: false,
      explicitLiveCommandRequired: true,
      artifactReceipts: {
        required: true,
        kinds: [
          'provider-mesh.route-receipt',
          'provider-mesh.credential-route',
          'provider-mesh.live-smoke-receipt',
        ],
      },
      policy: {
        noProviderImpersonation: true,
        noAnthropicApiSpoofing: true,
        noSecretSerialization: true,
        ownerApprovalRequiredForManagedCloudRoutes: descriptor.ownerGated,
      },
      notes: descriptor.notes,
    };
  }

  private resolveAdapterStatus(input: {
    descriptor: AdapterDescriptor;
    credentialRoute: SourceProviderCredentialRoute;
    adapterExists: boolean;
    allPackagesImplemented: boolean;
  }): SourceProviderRuntimeStatus {
    if (!input.adapterExists || !input.allPackagesImplemented) {
      return 'missing';
    }
    if (input.credentialRoute.status === 'configured') {
      return 'configured';
    }
    if (input.descriptor.ownerGated) {
      return 'owner_decision_required';
    }
    return 'ready';
  }

  private resolveStatus(
    adapters: SourceProviderRuntimeAdapterEntry[],
    packageEvidence: SourceProviderMeshPackageEvidence[],
  ): 'passed' | 'failed' {
    if (adapters.some((adapter) => adapter.status === 'missing' || adapter.status === 'rejected')) {
      return 'failed';
    }
    if (packageEvidence.filter((entry) => entry.presentInZavorthPackageJson).length < SOURCE_PROVIDER_MESH_PACKAGES.length) {
      return 'failed';
    }
    if (adapters.some((adapter) => adapter.liveIoPerformed || adapter.enabledByDefault)) {
      return 'failed';
    }
    return 'passed';
  }

  private providerFactoryResolves(providerFactoryName: string): boolean {
    if (providerFactoryName === 'provider-proxy-network') {
      return false;
    }
    const candidates = providerFactoryName.split('|');
    return candidates.every((candidate) => {
      const target = ProviderFactory.resolveRuntimeTarget(candidate);
      return target.runtimeSupported === true;
    });
  }

  private buildPackageEvidence(
    packageName: SourceProviderMeshPackageName,
    sourceRoot: string,
    zavorthRoot: string,
  ): SourceProviderMeshPackageEvidence {
    const sourceReferences = this.findPackageReferences(sourceRoot, packageName);
    const zavorthReferences = this.findPackageReferences(zavorthRoot, packageName);

    return {
      packageName,
      presentInSource: sourceReferences.length > 0,
      presentInZavorthPackageJson: zavorthReferences.some((reference) => reference.kind === 'package-json'),
      presentInZavorthLockfile: zavorthReferences.some((reference) => reference.kind === 'lockfile'),
      sourceReferenceFiles: sourceReferences.map((reference) => reference.relativePath),
      zavorthReferenceFiles: zavorthReferences.map((reference) => reference.relativePath),
    };
  }

  private findPackageReferences(root: string, packageName: SourceProviderMeshPackageName): Reference[] {
    if (!fs.existsSync(root)) {
      return [];
    }
    const references: Reference[] = [];
    for (const file of collectCandidateFiles(root)) {
      const text = readText(file);
      if (!text.includes(packageName)) {
        continue;
      }
      const relativePath = normalizePath(path.relative(root, file));
      if (path.basename(file) === 'package.json') {
        const packageJson = parseJson(text);
        if (packageJsonHasDependency(packageJson, packageName)) {
          references.push({
            relativePath: `${relativePath}${dependencySections(packageJson, packageName)}`,
            kind: 'package-json',
          });
          continue;
        }
      }
      references.push({
        relativePath,
        kind: LOCKFILE_NAMES.has(path.basename(file)) ? 'lockfile' : 'source',
      });
    }
    return dedupeReferences(references);
  }
}

function collectCandidateFiles(root: string): string[] {
  const files: string[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    for (const entry of readDir(current)) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (GENERATED_OR_VENDOR_ROOTS.has(entry.name)) continue;
        stack.push(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (isCandidateFile(entry.name)) {
        files.push(absolutePath);
      }
    }
  }

  return files.sort();
}

function isCandidateFile(fileName: string): boolean {
  if (fileName === 'package.json' || LOCKFILE_NAMES.has(fileName)) {
    return true;
  }
  return SOURCE_EXTENSIONS.has(path.extname(fileName));
}

function packageJsonHasDependency(packageJson: PackageJsonShape | null, packageName: string): boolean {
  if (!packageJson) return false;
  return dependencySectionNames().some((section) =>
    Boolean(packageJson[section]?.[packageName]),
  );
}

function dependencySections(packageJson: PackageJsonShape | null, packageName: string): string {
  if (!packageJson) return '';
  const sections = dependencySectionNames().filter((section) =>
    Boolean(packageJson[section]?.[packageName]),
  );
  return sections.length > 0 ? `#${sections.join(',')}` : '';
}

function dependencySectionNames(): Array<keyof PackageJsonShape> {
  return ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
}

function parseJson(text: string): PackageJsonShape | null {
  try {
    return JSON.parse(text) as PackageJsonShape;
  } catch (error: unknown) {logger.warn('[Source  Mesh Expansion] JSON parse failed', error); return null; }
}

function dedupeReferences(references: Reference[]): Reference[] {
  const seen = new Map<string, Reference>();
  for (const reference of references) {
    seen.set(`${reference.kind}:${reference.relativePath}`, reference);
  }
  return Array.from(seen.values()).sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  );
}

function readDir(absolutePath: string): fs.Dirent[] {
  try {
    return fs.readdirSync(absolutePath, { withFileTypes: true });
  } catch (error: unknown) {logger.warn('[Source  Mesh Expansion] filesystem operation failed', error); return []; }
}

function readText(absolutePath: string): string {
  try {
    const stat = fs.statSync(absolutePath);
    if (stat.size > 25 * 1024 * 1024) {
      return '';
    }
    return fs.readFileSync(absolutePath, 'utf8');
  } catch (error: unknown) {logger.warn('[Source  Mesh Expansion] filesystem operation failed', error); return ''; }
}

function normalizePath(input: string): string {
  return input.replace(/\\/g, '/');
}
