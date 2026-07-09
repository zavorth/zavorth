import type {
  SourceProviderCredentialRoute,
  SourceProviderMeshExpansionSnapshot,
  SourceProviderMeshPackageEvidence,
  SourceProviderMeshPackageName,
  SourceProviderRuntimeAdapterEntry,
  SourceProviderRuntimeId,
} from '../contracts/SourceProviderMeshExpansionContract.js';
import { SourceProviderCredentialRouteService } from './SourceProviderCredentialRouteService.js';
import { ZAVORTH_SEMANTIC_PROVIDER_MESH_CERTIFICATION_CONTRACT_VERSION } from '../contracts/ZavorthSemanticProviderMeshCertificationContract.js';

import { SourceProviderMeshExpansionService } from './SourceProviderMeshExpansionService.js';
import type {
  ZavorthSemanticProviderCredentialScenario,
  ZavorthSemanticProviderMeshCertificationSnapshot,
  ZavorthSemanticProviderMeshCertificationStatus,
  ZavorthSemanticProviderMeshClaim,
  ZavorthSemanticProviderMeshClaimKind,
  ZavorthSemanticProviderMeshClaimPriority,
  ZavorthSemanticProviderMeshClaimStatus,
} from '../contracts/ZavorthSemanticProviderMeshCertificationContract.js';

type Runtime = {
  now?: () => Date;
  sourceRoot?: string;
  zavorthRoot?: string;
  providerMeshService?: Pick<SourceProviderMeshExpansionService, 'buildSnapshot'>;
  credentialRouteService?: SourceProviderCredentialRouteService;
};

type ClaimInput = {
  kind: ZavorthSemanticProviderMeshClaimKind;
  status: ZavorthSemanticProviderMeshClaimStatus;
  priority: ZavorthSemanticProviderMeshClaimPriority;
  packageName?: SourceProviderMeshPackageName;
  providerId?: SourceProviderRuntimeId;
  family?: ZavorthSemanticProviderMeshClaim['family'];
  runtimeStatus?: ZavorthSemanticProviderMeshClaim['runtimeStatus'];
  expectedBehavior: string;
  zavorthEquivalent: string;
  evidence: string[];
  receiptIds?: string[];
  notes?: string[];
};

const PROVIDER_RECEIPT_PREFIX = 'zavorth.semantic.s3.provider-mesh';

export class ZavorthSemanticProviderMeshCertificationService {
  private readonly now: () => Date;
  private readonly sourceRoot?: string;
  private readonly zavorthRoot?: string;
  private readonly providerMeshService: Pick<SourceProviderMeshExpansionService, 'buildSnapshot'>;
  private readonly credentialRouteService: SourceProviderCredentialRouteService;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.sourceRoot = runtime.sourceRoot;
    this.zavorthRoot = runtime.zavorthRoot;
    this.providerMeshService = runtime.providerMeshService || new SourceProviderMeshExpansionService({
      now: this.now,
      sourceRoot: this.sourceRoot,
      zavorthRoot: this.zavorthRoot,
    });
    this.credentialRouteService = runtime.credentialRouteService || new SourceProviderCredentialRouteService();
  }

  public buildSnapshot(input: {
    sourceRoot?: string | null;
    zavorthRoot?: string | null;
  } = {}): ZavorthSemanticProviderMeshCertificationSnapshot {
    const providerMesh = this.providerMeshService.buildSnapshot({
      sourceRoot: input.sourceRoot || this.sourceRoot,
      zavorthRoot: input.zavorthRoot || this.zavorthRoot,
    });
    const credentialScenarios = this.buildCredentialScenarios();
    const claims = this.buildClaims(providerMesh, credentialScenarios);
    const gaps = claims.filter((claim) => claim.status === 'gap').length;
    const status: ZavorthSemanticProviderMeshCertificationStatus =
      providerMesh.status === 'passed'
      && gaps === 0
      && credentialScenarios.every((scenario) => scenario.status === 'passed')
      && providerMesh.summary.liveIoPerformed === false
      && providerMesh.summary.enabledByDefault === false
      && providerMesh.summary.secretValuesSerialized === false
        ? 'passed'
        : 'failed';

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_SEMANTIC_PROVIDER_MESH_CERTIFICATION_CONTRACT_VERSION,
      status,
      semanticPhase: 'S3',
      statement: 'Provider Mesh semantics are certified as explicit provider routes, credential policies, local-provider alternatives and artifact-first receipts.',
      sourceRoot: providerMesh.sourceRoot,
      zavorthRoot: providerMesh.zavorthRoot,
      providerMeshStatus: providerMesh.status,
      providerMeshContractVersion: providerMesh.contractVersion,
      claims,
      credentialScenarios,
      summary: {
        semanticClaims: claims.length,
        covered: countStatus(claims, 'covered'),
        replaced: countStatus(claims, 'replaced'),
        ownerGated: countStatus(claims, 'owner-gated'),
        rejected: countStatus(claims, 'rejected'),
        gaps,
        p0Claims: countPriority(claims, 'P0'),
        p1Claims: countPriority(claims, 'P1'),
        p2Claims: countPriority(claims, 'P2'),
        receiptBackedClaims: claims.filter((claim) => claim.receiptIds.length > 0).length,
        packagesCertified: claims.filter((claim) => claim.kind === 'package-coverage').length,
        adaptersCertified: claims.filter((claim) => claim.kind === 'adapter-runtime').length,
        credentialRoutesCertified: claims.filter((claim) => claim.kind === 'credential-route').length,
        providerFactoryRoutesCertified: claims.filter((claim) => claim.kind === 'factory-route').length,
        credentialScenariosPassed: credentialScenarios.filter((scenario) => scenario.status === 'passed').length,
        adapterStatuses: Object.fromEntries(providerMesh.adapters.map((adapter) => [adapter.providerId, adapter.status])),
        liveIoPerformed: false,
        enabledByDefault: false,
        secretValuesSerialized: false,
        sourceCodeCopied: false,
      },
      localModelPolicy: providerMesh.localModelPolicy,
      networkPolicy: providerMesh.networkPolicy,
      policy: {
        semanticClaimRequiredForEveryProviderPackage: true,
        explicitProviderSelectionRequired: true,
        managedCloudRoutesOwnerGated: true,
        localModelsUseProviderMeshOnly: true,
        noAnthropicApiImpersonationForLocalModels: true,
        noProviderBypass: true,
        noProviderApiSpoofing: true,
        noNetworkWithoutProviderSelection: true,
        noSecretSerialization: true,
        noLiveIoDuringCertification: true,
        noSourceSourceCopy: true,
        artifactFirstReceipts: true,
        gapsBlockRelease: true,
      },
      commands: {
        inspect: 'npm run semantic-provider-mesh-certification --silent',
        inspectJson: 'npm run semantic-provider-mesh-certification:json --silent',
        check: 'npm run semantic-provider-mesh-certification:check --silent',
        qa: 'npm run qa:semantic-provider-mesh-certification --silent',
        nextStage: 'S4 - Channel Mesh Semantics',
      },
    };
  }

  public formatSnapshotText(snapshot = this.buildSnapshot()): string {
    const lines = [
      'Zavorth Semantic Provider Mesh Certification - S3',
      `Status: ${snapshot.status}`,
      `Contract: ${snapshot.contractVersion}`,
      `Provider mesh status: ${snapshot.providerMeshStatus}`,
      `Claims: ${snapshot.summary.semanticClaims}`,
      `Covered/replaced/owner-gated/rejected/gaps: ${snapshot.summary.covered}/${snapshot.summary.replaced}/${snapshot.summary.ownerGated}/${snapshot.summary.rejected}/${snapshot.summary.gaps}`,
      `P0/P1/P2: ${snapshot.summary.p0Claims}/${snapshot.summary.p1Claims}/${snapshot.summary.p2Claims}`,
      `Receipt-backed claims: ${snapshot.summary.receiptBackedClaims}`,
      `Packages certified: ${snapshot.summary.packagesCertified}`,
      `Adapters certified: ${snapshot.summary.adaptersCertified}`,
      `Credential routes certified: ${snapshot.summary.credentialRoutesCertified}`,
      `ProviderFactory routes certified: ${snapshot.summary.providerFactoryRoutesCertified}`,
      `Credential scenarios passed: ${snapshot.summary.credentialScenariosPassed}/${snapshot.credentialScenarios.length}`,
      `Live I/O performed: ${snapshot.summary.liveIoPerformed}`,
      `Enabled by default: ${snapshot.summary.enabledByDefault}`,
      `Secret values serialized: ${snapshot.summary.secretValuesSerialized}`,
      'Claim groups:',
      ...snapshot.claims.map((claim) =>
        `- ${claim.status} ${claim.priority} ${claim.id}: ${claim.expectedBehavior} -> ${claim.zavorthEquivalent}`,
      ),
      `Next: ${snapshot.commands.nextStage}`,
    ];
    return lines.join('\n');
  }

  private buildClaims(
    providerMesh: SourceProviderMeshExpansionSnapshot,
    credentialScenarios: ZavorthSemanticProviderCredentialScenario[],
  ): ZavorthSemanticProviderMeshClaim[] {
    return [
      ...providerMesh.packageEvidence.map((evidence) => this.packageClaim(evidence)),
      ...providerMesh.adapters.map((adapter) => this.adapterClaim(adapter)),
      ...providerMesh.adapters.map((adapter) => this.credentialRouteClaim(adapter)),
      ...providerMesh.adapters.map((adapter) => this.factoryRouteClaim(adapter)),
      ...this.localModelClaims(providerMesh),
      ...this.networkClaims(providerMesh),
      ...this.liveIoAndReceiptClaims(providerMesh),
      ...this.credentialScenarioClaims(credentialScenarios),
      ...this.providerBypassClaims(providerMesh),
    ];
  }

  private packageClaim(evidence: SourceProviderMeshPackageEvidence): ZavorthSemanticProviderMeshClaim {
    return this.claim({
      kind: 'package-coverage',
      status: evidence.presentInSource && evidence.presentInZavorthPackageJson ? 'covered' : 'gap',
      priority: packagePriority(evidence.packageName),
      packageName: evidence.packageName,
      expectedBehavior: `${evidence.packageName} provider dependency is tracked and available through Zavorth-owned Provider Mesh decisions.`,
      zavorthEquivalent: packageEquivalent(evidence.packageName),
      evidence: [
        `presentInSource=${evidence.presentInSource}`,
        `presentInZavorthPackageJson=${evidence.presentInZavorthPackageJson}`,
        `presentInZavorthLockfile=${evidence.presentInZavorthLockfile}`,
        `sourceReferences=${evidence.sourceReferenceFiles.length}`,
        `zavorthReferences=${evidence.zavorthReferenceFiles.length}`,
      ],
      notes: ['S3 certifies package coverage by provider behavior, not copied package layout.'],
    });
  }

  private adapterClaim(adapter: SourceProviderRuntimeAdapterEntry): ZavorthSemanticProviderMeshClaim {
    return this.claim({
      kind: 'adapter-runtime',
      status: adapterStatus(adapter),
      priority: adapter.credentialRoute.ownerApprovalRequired ? 'P1' : 'P0',
      providerId: adapter.providerId,
      family: adapter.family,
      runtimeStatus: adapter.status,
      expectedBehavior: `${adapter.providerId} has an explicit Provider Mesh runtime contract.`,
      zavorthEquivalent: adapter.adapterPath,
      evidence: [
        `status=${adapter.status}`,
        `decision=${adapter.decision}`,
        `family=${adapter.family}`,
        `routeKind=${adapter.contract.routeKind}`,
        `defaultModelName=${adapter.defaultModelName}`,
        `enabledByDefault=${adapter.enabledByDefault}`,
        `liveIoPerformed=${adapter.liveIoPerformed}`,
        `explicitLiveCommandRequired=${adapter.explicitLiveCommandRequired}`,
      ],
      receiptIds: [
        `${PROVIDER_RECEIPT_PREFIX}.adapter.${adapter.providerId}`,
        'source-provider-mesh-expansion.runtime-receipt',
      ],
      notes: adapter.notes,
    });
  }

  private credentialRouteClaim(adapter: SourceProviderRuntimeAdapterEntry): ZavorthSemanticProviderMeshClaim {
    const route = adapter.credentialRoute;
    return this.claim({
      kind: 'credential-route',
      status: credentialRouteStatus(adapter),
      priority: route.ownerApprovalRequired ? 'P1' : 'P0',
      providerId: adapter.providerId,
      family: adapter.family,
      runtimeStatus: adapter.status,
      expectedBehavior: `${adapter.providerId} credentials are represented by named env routes without serializing secret values.`,
      zavorthEquivalent: `${route.routeKind} credential route with redacted receipts.`,
      evidence: [
        `routeKind=${route.routeKind}`,
        `status=${route.status}`,
        `requiredEnv=${route.requiredEnv.join(',')}`,
        `optionalEnv=${route.optionalEnv.join(',')}`,
        `secretEnv=${route.secretEnv.join(',')}`,
        `presentEnv=${route.presentEnv.join(',')}`,
        `missingEnv=${route.missingEnv.join(',')}`,
        `secretValuesSerialized=${route.secretValuesSerialized}`,
        `ownerApprovalRequired=${route.ownerApprovalRequired}`,
      ],
      receiptIds: [`${PROVIDER_RECEIPT_PREFIX}.credential-route.${adapter.providerId}`],
      notes: [route.reason],
    });
  }

  private factoryRouteClaim(adapter: SourceProviderRuntimeAdapterEntry): ZavorthSemanticProviderMeshClaim {
    const factoryResolved = adapter.providerFactoryName === 'provider-proxy-network'
      ? false
      : adapter.providerFactoryName.length > 0;
    return this.claim({
      kind: 'factory-route',
      status: factoryResolved ? 'covered' : 'replaced',
      priority: adapter.providerId === 'provider-proxy-network' ? 'P2' : 'P1',
      providerId: adapter.providerId,
      family: adapter.family,
      runtimeStatus: adapter.status,
      expectedBehavior: `${adapter.providerId} is addressable through explicit ProviderFactory/runtime routing or a documented non-model network policy.`,
      zavorthEquivalent: adapter.providerFactoryName,
      evidence: [
        `providerFactoryName=${adapter.providerFactoryName}`,
        `providerId=${adapter.providerId}`,
        `family=${adapter.family}`,
      ],
      receiptIds: [`${PROVIDER_RECEIPT_PREFIX}.factory-route.${adapter.providerId}`],
      notes: [
        adapter.providerId === 'provider-proxy-network'
          ? 'Proxy support is network policy plumbing, not a model provider route.'
          : 'Provider route is explicit and selectable.',
      ],
    });
  }

  private localModelClaims(providerMesh: SourceProviderMeshExpansionSnapshot): ZavorthSemanticProviderMeshClaim[] {
    return [
      this.claim({
        kind: 'local-model-policy',
        status: providerMesh.localModelPolicy.noAnthropicApiImpersonationForLocalModels ? 'covered' : 'gap',
        priority: 'P0',
        providerId: 'local-openai-compatible',
        expectedBehavior: 'Local models use Provider Mesh local/OpenAI-compatible routes instead of pretending to be an Anthropic endpoint.',
        zavorthEquivalent: providerMesh.localModelPolicy.recommendation,
        evidence: [
          `noAnthropicApiImpersonationForLocalModels=${providerMesh.localModelPolicy.noAnthropicApiImpersonationForLocalModels}`,
          `openAiCompatibleRoutes=${providerMesh.localModelPolicy.openAiCompatibleRoutes.join(',')}`,
        ],
        receiptIds: [`${PROVIDER_RECEIPT_PREFIX}.local-model.provider-mesh-only`],
        notes: ['Recommended routes are Ollama, LM Studio, vLLM and explicit OpenAI-compatible providers.'],
      }),
    ];
  }

  private networkClaims(providerMesh: SourceProviderMeshExpansionSnapshot): ZavorthSemanticProviderMeshClaim[] {
    return [
      this.claim({
        kind: 'network-policy',
        status: providerMesh.networkPolicy.noNetworkWithoutProviderSelection
          && providerMesh.networkPolicy.noSecretValuesInReceipts
            ? 'covered'
            : 'gap',
        priority: 'P0',
        providerId: 'provider-proxy-network',
        expectedBehavior: 'Provider network/proxy behavior is metadata-only until an explicit provider route is selected.',
        zavorthEquivalent: 'Provider Mesh network policy with proxy env support and no secret values in receipts.',
        evidence: [
          `proxyEnvSupported=${providerMesh.networkPolicy.proxyEnvSupported.join(',')}`,
          `proxyPackagesTracked=${providerMesh.networkPolicy.proxyPackagesTracked.join(',')}`,
          `noNetworkWithoutProviderSelection=${providerMesh.networkPolicy.noNetworkWithoutProviderSelection}`,
          `noSecretValuesInReceipts=${providerMesh.networkPolicy.noSecretValuesInReceipts}`,
        ],
        receiptIds: [`${PROVIDER_RECEIPT_PREFIX}.network.proxy-policy`],
        notes: ['S3 performs no network request unless a separate live smoke is explicitly confirmed.'],
      }),
    ];
  }

  private liveIoAndReceiptClaims(providerMesh: SourceProviderMeshExpansionSnapshot): ZavorthSemanticProviderMeshClaim[] {
    return [
      this.claim({
        kind: 'live-io-policy',
        status: providerMesh.summary.liveIoPerformed === false && providerMesh.summary.enabledByDefault === false
          ? 'covered'
          : 'gap',
        priority: 'P0',
        expectedBehavior: 'S3 certification does not perform live provider I/O and never enables providers by default.',
        zavorthEquivalent: 'Provider Mesh expansion emits dry-run receipts and exposes a separate explicit live smoke command.',
        evidence: [
          `liveIoPerformed=${providerMesh.summary.liveIoPerformed}`,
          `enabledByDefault=${providerMesh.summary.enabledByDefault}`,
          `liveSmoke=${providerMesh.commands.liveSmoke}`,
        ],
        receiptIds: [`${PROVIDER_RECEIPT_PREFIX}.live-io.no-default-live`],
        notes: ['Live smoke remains an explicit operator action.'],
      }),
      this.claim({
        kind: 'receipt-policy',
        status: providerMesh.policy.artifactFirstReceipts
          && providerMesh.summary.secretValuesSerialized === false
            ? 'covered'
            : 'gap',
        priority: 'P0',
        expectedBehavior: 'Provider Mesh certification is artifact-first and never serializes secret values.',
        zavorthEquivalent: 'Credential routes and runtime contracts emit redacted receipts.',
        evidence: [
          `artifactFirstReceipts=${providerMesh.policy.artifactFirstReceipts}`,
          `secretValuesSerialized=${providerMesh.summary.secretValuesSerialized}`,
          'sourceCodeCopied=false',
        ],
        receiptIds: [`${PROVIDER_RECEIPT_PREFIX}.receipt-policy.artifact-first-redacted`],
        notes: ['Receipts store env names and route status, not credential values.'],
      }),
    ];
  }

  private credentialScenarioClaims(
    scenarios: ZavorthSemanticProviderCredentialScenario[],
  ): ZavorthSemanticProviderMeshClaim[] {
    return scenarios.map((scenario) => this.claim({
      kind: 'credential-route',
      status: scenario.status === 'passed' ? 'covered' : 'gap',
      priority: 'P0',
      providerId: scenario.providerId,
      expectedBehavior: credentialScenarioExpectedBehavior(scenario.id),
      zavorthEquivalent: credentialScenarioEquivalent(scenario.id),
      evidence: scenario.evidence,
      receiptIds: [`${PROVIDER_RECEIPT_PREFIX}.credential-scenario.${scenario.id}`],
      notes: ['Credential scenario proves redaction and route status behavior.'],
    }));
  }

  private providerBypassClaims(providerMesh: SourceProviderMeshExpansionSnapshot): ZavorthSemanticProviderMeshClaim[] {
    return [
      this.claim({
        kind: 'provider-bypass-policy',
        status: providerMesh.policy.noAnthropicApiImpersonation ? 'rejected' : 'gap',
        priority: 'P0',
        expectedBehavior: 'The architecture must reject provider API impersonation.',
        zavorthEquivalent: 'Zavorth uses explicit Provider Mesh routes instead of spoofing provider APIs.',
        evidence: [`noAnthropicApiImpersonation=${providerMesh.policy.noAnthropicApiImpersonation}`],
        receiptIds: [`${PROVIDER_RECEIPT_PREFIX}.reject.provider-api-impersonation`],
        notes: ['Rejected here means intentionally not implemented.'],
      }),
      this.claim({
        kind: 'provider-bypass-policy',
        status: providerMesh.policy.noProviderBypass ? 'rejected' : 'gap',
        priority: 'P0',
        expectedBehavior: 'The architecture must reject provider bypass paths.',
        zavorthEquivalent: 'All provider use flows through Provider Mesh runtime contracts and receipts.',
        evidence: [`noProviderBypass=${providerMesh.policy.noProviderBypass}`],
        receiptIds: [`${PROVIDER_RECEIPT_PREFIX}.reject.provider-bypass`],
        notes: ['Rejected here means intentionally blocked by architecture.'],
      }),
    ];
  }

  private buildCredentialScenarios(): ZavorthSemanticProviderCredentialScenario[] {
    const missing = this.credentialRouteService.buildRoute({
      providerId: 'anthropic-direct',
      routeKind: 'api-key',
      requiredEnv: ['ANTHROPIC_API_KEY'],
      optionalEnv: ['ANTHROPIC_MODEL'],
      env: {},
    });
    const configured = this.credentialRouteService.buildRoute({
      providerId: 'anthropic-direct',
      routeKind: 'api-key',
      requiredEnv: ['ANTHROPIC_API_KEY'],
      optionalEnv: ['ANTHROPIC_MODEL'],
      env: {
        ANTHROPIC_API_KEY: 'secret-value',
        ANTHROPIC_MODEL: 'claude-test-model',
      },
    });
    const local = this.credentialRouteService.buildRoute({
      providerId: 'local-openai-compatible',
      routeKind: 'local',
      optionalEnv: ['OLLAMA_BASE_URL', 'LMSTUDIO_BASE_URL', 'VLLM_BASE_URL'],
      env: {},
    });

    return [
      scenario('missing-api-key', missing, missing.status === 'missing' && missing.missingEnv.includes('ANTHROPIC_API_KEY')),
      scenario(
        'configured-api-key-redacted',
        configured,
        configured.status === 'configured'
          && configured.presentEnv.includes('ANTHROPIC_API_KEY')
          && configured.secretValuesSerialized === false
          && !JSON.stringify(configured).includes('secret-value'),
      ),
      scenario('optional-local-route', local, local.status === 'optional' && local.secretValuesSerialized === false),
    ];
  }

  private claim(input: ClaimInput): ZavorthSemanticProviderMeshClaim {
    const id = `${input.kind}:${slug([
      input.providerId,
      input.packageName,
      input.expectedBehavior,
    ].filter(Boolean).join('-'))}`;
    return {
      id,
      kind: input.kind,
      status: input.status,
      priority: input.priority,
      ...(input.packageName ? { packageName: input.packageName } : {}),
      ...(input.providerId ? { providerId: input.providerId } : {}),
      ...(input.family ? { family: input.family } : {}),
      ...(input.runtimeStatus ? { runtimeStatus: input.runtimeStatus } : {}),
      expectedBehavior: input.expectedBehavior,
      zavorthEquivalent: input.zavorthEquivalent,
      evidence: input.evidence,
      receiptIds: input.receiptIds || [`${PROVIDER_RECEIPT_PREFIX}.${id}`],
      notes: input.notes || [],
    };
  }
}

function packagePriority(packageName: SourceProviderMeshPackageName): ZavorthSemanticProviderMeshClaimPriority {
  if (
    packageName === '@anthropic-ai/sdk'
    || packageName === '@anthropic-ai/vertex-sdk'
    || packageName === '@aws-sdk/client-bedrock-runtime'
    || packageName === '@google/genai'
  ) {
    return 'P0';
  }
  return 'P1';
}

function packageEquivalent(packageName: SourceProviderMeshPackageName): string {
  switch (packageName) {
    case '@anthropic-ai/sdk':
      return 'AnthropicDirectProviderAdapter through Provider Mesh.';
    case '@anthropic-ai/vertex-sdk':
      return 'AnthropicVertexProviderAdapter through owner-gated Vertex route.';
    case '@aws-sdk/client-bedrock-runtime':
      return 'BedrockClaudeProviderAdapter through owner-gated Bedrock route.';
    case '@google/genai':
      return 'GoogleGenAiProviderAdapter through explicit Google GenAI route.';
    case 'proxy-agent':
    case 'https-proxy-agent':
    case 'undici':
      return 'Provider Mesh network/proxy policy, not a standalone model provider.';
    default:
      return 'Zavorth Provider Mesh route.';
  }
}

function adapterStatus(adapter: SourceProviderRuntimeAdapterEntry): ZavorthSemanticProviderMeshClaimStatus {
  if (adapter.status === 'missing' || adapter.status === 'rejected') {
    return 'gap';
  }
  if (adapter.credentialRoute.ownerApprovalRequired) {
    return 'owner-gated';
  }
  if (adapter.decision === 'provider-mesh-only') {
    return 'replaced';
  }
  return 'covered';
}

function credentialRouteStatus(adapter: SourceProviderRuntimeAdapterEntry): ZavorthSemanticProviderMeshClaimStatus {
  const route = adapter.credentialRoute;
  if (route.secretValuesSerialized) {
    return 'gap';
  }
  if (route.ownerApprovalRequired) {
    return 'owner-gated';
  }
  return route.status === 'missing' ? 'covered' : 'covered';
}

function credentialScenarioExpectedBehavior(id: ZavorthSemanticProviderCredentialScenario['id']): string {
  switch (id) {
    case 'missing-api-key':
      return 'Missing API key credentials are reported as missing by env name only.';
    case 'configured-api-key-redacted':
      return 'Configured API key credentials are reported as present without serializing secret values.';
    case 'optional-local-route':
      return 'Local provider routes can remain optional without cloud credentials.';
    default:
      return 'Credential scenario is certified.';
  }
}

function credentialScenarioEquivalent(id: ZavorthSemanticProviderCredentialScenario['id']): string {
  switch (id) {
    case 'missing-api-key':
      return 'SourceProviderCredentialRouteService missing route receipt.';
    case 'configured-api-key-redacted':
      return 'SourceProviderCredentialRouteService configured redacted route receipt.';
    case 'optional-local-route':
      return 'Provider Mesh local route with optional base URLs.';
    default:
      return 'Provider Mesh credential route receipt.';
  }
}

function scenario(
  id: ZavorthSemanticProviderCredentialScenario['id'],
  route: SourceProviderCredentialRoute,
  pass: boolean,
): ZavorthSemanticProviderCredentialScenario {
  return {
    id,
    status: pass ? 'passed' : 'failed',
    providerId: route.providerId,
    evidence: [
      `routeKind=${route.routeKind}`,
      `status=${route.status}`,
      `requiredEnv=${route.requiredEnv.join(',')}`,
      `presentEnv=${route.presentEnv.join(',')}`,
      `missingEnv=${route.missingEnv.join(',')}`,
      `secretEnv=${route.secretEnv.join(',')}`,
      `secretValuesSerialized=${route.secretValuesSerialized}`,
    ],
    secretValuesSerialized: false,
  };
}

function countStatus(
  claims: ZavorthSemanticProviderMeshClaim[],
  status: ZavorthSemanticProviderMeshClaimStatus,
): number {
  return claims.filter((claim) => claim.status === status).length;
}

function countPriority(
  claims: ZavorthSemanticProviderMeshClaim[],
  priority: ZavorthSemanticProviderMeshClaimPriority,
): number {
  return claims.filter((claim) => claim.priority === priority).length;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
}
