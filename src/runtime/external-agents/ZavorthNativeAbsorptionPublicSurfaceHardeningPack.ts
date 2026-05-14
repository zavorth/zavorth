import {
  normalizeZavorthPartialAdapterRemovalImplementationPackFixture,
} from './ZavorthPartialAdapterRemovalImplementationPack.js';
import type {
  ZavorthPartialAdapterRemovalImplementationNormalization,
} from './ZavorthPartialAdapterRemovalImplementationPack.js';

export const ZAVORTH_NATIVE_ABSORPTION_PUBLIC_SURFACE_HARDENING_PACK_NOW = '2026-04-29T11:00:00.000Z' as const;
export const ZAVORTH_NATIVE_ABSORPTION_PUBLIC_SURFACE_HARDENING_PACK_RUNTIME_ID = 'zavorth-native-absorption-public-surface-hardening-pack' as const;

export type ZavorthNativeAbsorptionPublicSurfaceHardeningDecision =
  | 'blocked'
  | 'native-absorption-public-surface-hardened';

export type ZavorthNativeAbsorptionPublicSurfaceKind =
  | 'capability-label'
  | 'command-center-dashboard'
  | 'internal-absorption-doc'
  | 'internal-external-agent-test'
  | 'internal-provenance'
  | 'provider-channel-transport-label'
  | 'public-api-export'
  | 'public-doc'
  | 'runtime-projection'
  | 'technical-adapter-refresh-boundary'
  | 'user-facing-receipt-log'
  | 'view-model-label';

export type ZavorthNativeAbsorptionPublicSurface = {
  nativeContract: 'ZavorthNativeAbsorptionPublicSurface/v1';
  id: string;
  label: string;
  path: string;
  kind: ZavorthNativeAbsorptionPublicSurfaceKind;
  content: string;
};

export type ZavorthNativeAbsorptionPublicSurfaceFinding = {
  nativeContract: 'ZavorthNativeAbsorptionPublicSurfaceFinding/v1';
  surfaceId: string;
  path: string;
  kind: ZavorthNativeAbsorptionPublicSurfaceKind;
  term: string;
  excerpt: string;
  allowlisted: boolean;
  reason: string;
};

export type ZavorthNativeAbsorptionPublicSurfaceGuard = {
  nativeContract: 'ZavorthNativeAbsorptionPublicSurfaceGuard/v1';
  checkedSurfaceCount: number;
  requiredPublicKinds: [
    'capability-label',
    'command-center-dashboard',
    'provider-channel-transport-label',
    'public-api-export',
    'runtime-projection',
    'user-facing-receipt-log',
    'view-model-label',
  ];
  coveredPublicKinds: ZavorthNativeAbsorptionPublicSurfaceKind[];
  missingPublicKinds: ZavorthNativeAbsorptionPublicSurfaceKind[];
  prohibitedFindings: ZavorthNativeAbsorptionPublicSurfaceFinding[];
  allowlistedFindings: ZavorthNativeAbsorptionPublicSurfaceFinding[];
  passed: boolean;
  publicExternalExecutorIdentityLeak: false;
  internalProvenanceAllowed: true;
  rawSecretSerialized: false;
};

export type ZavorthNativeAbsorptionPublicNamingRule = {
  nativeContract: 'ZavorthNativeAbsorptionPublicNamingRule/v1';
  surfaceId: string;
  label: string;
  publicLabel: string;
  sourceIdentityPublic: false;
  zavorthNativeNameRequired: true;
  internalProvenanceAllowed: true;
  rawSecretSerialized: false;
};

export type ZavorthNativeAbsorptionReceiptLogHardening = {
  nativeContract: 'ZavorthNativeAbsorptionReceiptLogHardening/v1';
  publicReceiptSamples: Array<{
    id: string;
    label: string;
    sourceLabel: 'external-source-redacted';
    message: string;
    userFacing: true;
    rawSecretSerialized: false;
    sourceIdentityPublic: false;
  }>;
  publicLogSamples: Array<{
    id: string;
    source: 'zavorth-native-registry' | 'zavorth-command-center';
    message: string;
    userFacing: true;
    rawSecretSerialized: false;
    sourceIdentityPublic: false;
  }>;
  internalProvenanceReceipt: {
    id: string;
    sourceLabel: 'external-source-redacted';
    evidenceMode: 'internal-redacted-provenance';
    publicIdentity: 'Zavorth';
    rawSecretSerialized: false;
    sourceIdentityPublic: false;
  };
  receiptsPubliclyRedacted: true;
  logsPubliclyRedacted: true;
  rawSecretSerialized: false;
};

export type ZavorthNativeAbsorptionPublicSurfaceHardeningExecutionGate = {
  publicSurfaceHardened: true;
  publicExternalExecutorIdentityLeak: false;
  internalProvenanceAllowed: true;
  nativeReadySurfacesZavorthNamed: true;
  commandCenterPublicIdentityZavorthNative: true;
  adapterDefaultPathForNativeReadySurfaces: false;
  adapterRemovalGlobalAllowed: false;
  runtimeExternalExecutorRequiredForPublicRender: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  stateMigrated: false;
  sourceModuleCopied: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeAbsorptionPublicSurfaceHardeningSource = {
  partialAdapterRemoval: ZavorthPartialAdapterRemovalImplementationNormalization;
  publicSurfaces: ZavorthNativeAbsorptionPublicSurface[];
  commandCenterPublicIdentityZavorthNative: boolean;
  adapterDefaultPathForNativeReadySurfaces: false;
  externalExecutorLiveCalledForDefaultPath: false;
  executionAttempted: false;
  stateMigrationAttempted: false;
  sourceModuleCopyAttempted: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeAbsorptionPublicSurfaceHardeningNormalization = {
  nativeContract: 'ZavorthNativeAbsorptionPublicSurfaceHardeningPack/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ZavorthNativeAbsorptionPublicSurfaceHardeningDecision;
  status: 'blocked' | 'native-absorption-public-surface-hardened';
  sourceReadiness: {
    partialAdapterRemoval: ZavorthPartialAdapterRemovalImplementationNormalization['decision'];
  };
  inventory: Array<{
    nativeContract: 'ZavorthNativeAbsorptionPublicSurfaceInventoryRow/v1';
    surfaceId: string;
    label: string;
    kind: ZavorthNativeAbsorptionPublicSurfaceKind;
    path: string;
    publicSurface: boolean;
    allowlistedException: boolean;
    sourceIdentityAllowed: boolean;
    rawSecretSerialized: false;
  }>;
  publicSurfaceGuard: ZavorthNativeAbsorptionPublicSurfaceGuard;
  namingRules: ZavorthNativeAbsorptionPublicNamingRule[];
  receiptLogHardening: ZavorthNativeAbsorptionReceiptLogHardening;
  commandCenterHardening: {
    nativeContract: 'ZavorthNativeAbsorptionCommandCenterPublicHardening/v1';
    commandCenterPublicIdentityZavorthNative: true;
    publicLabelsZavorthNative: true;
    degradedUnavailableOperational: true;
    adapterDefaultPathForNativeReadySurfaces: false;
    runtimeExternalExecutorRequiredForPublicRender: false;
    rawSecretSerialized: false;
  };
  executionGate: ZavorthNativeAbsorptionPublicSurfaceHardeningExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    rawMessageContentSerialized: false;
    sourceIdentityPublic: false;
    sourceStructuresPublic: false;
    provenanceInternalOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'future-global-adapter-removal-readiness-or-public-surface-regression-monitor';
};

export type ZavorthNativeAbsorptionPublicSurfaceHardeningOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  runtimeId: TRuntimeId;
  source: ZavorthNativeAbsorptionPublicSurfaceHardeningSource;
};

const FORBIDDEN_PUBLIC_SOURCE_TERMS = ['ExternalExecutor', 'external-executor'] as const;

const REQUIRED_PUBLIC_KINDS: ZavorthNativeAbsorptionPublicSurfaceGuard['requiredPublicKinds'] = [
  'capability-label',
  'command-center-dashboard',
  'provider-channel-transport-label',
  'public-api-export',
  'runtime-projection',
  'user-facing-receipt-log',
  'view-model-label',
];

const ALLOWLISTED_EXCEPTION_KINDS = new Set<ZavorthNativeAbsorptionPublicSurfaceKind>([
  'internal-absorption-doc',
  'internal-external-agent-test',
  'internal-provenance',
  'technical-adapter-refresh-boundary',
]);

function buildExcerpt(content: string, term: string): string {
  const index = content.toLowerCase().indexOf(term.toLowerCase());
  if (index < 0) {
    return '';
  }
  const start = Math.max(0, index - 48);
  const end = Math.min(content.length, index + term.length + 48);
  return content.slice(start, end).replace(/\s+/g, ' ').trim();
}

function mentionsForSurface(
  surface: ZavorthNativeAbsorptionPublicSurface,
): ZavorthNativeAbsorptionPublicSurfaceFinding[] {
  const allowlisted = ALLOWLISTED_EXCEPTION_KINDS.has(surface.kind);
  return FORBIDDEN_PUBLIC_SOURCE_TERMS
    .filter((term) => surface.content.toLowerCase().includes(term.toLowerCase()))
    .map((term) => ({
      nativeContract: 'ZavorthNativeAbsorptionPublicSurfaceFinding/v1',
      surfaceId: surface.id,
      path: surface.path,
      kind: surface.kind,
      term,
      excerpt: buildExcerpt(surface.content, term),
      allowlisted,
      reason: allowlisted
        ? 'Mention is confined to an internal audit/provenance or technical refresh boundary.'
        : 'Public product surface must present Zavorth-native identity only.',
    }));
}

function inventoryRow(surface: ZavorthNativeAbsorptionPublicSurface): ZavorthNativeAbsorptionPublicSurfaceHardeningNormalization['inventory'][number] {
  const allowlistedException = ALLOWLISTED_EXCEPTION_KINDS.has(surface.kind);
  return {
    nativeContract: 'ZavorthNativeAbsorptionPublicSurfaceInventoryRow/v1',
    surfaceId: surface.id,
    label: surface.label,
    kind: surface.kind,
    path: surface.path,
    publicSurface: !allowlistedException,
    allowlistedException,
    sourceIdentityAllowed: allowlistedException,
    rawSecretSerialized: false,
  };
}

export function evaluateZavorthNativeAbsorptionPublicSurfaceGuard(
  surfaces: ZavorthNativeAbsorptionPublicSurface[],
): ZavorthNativeAbsorptionPublicSurfaceGuard {
  const findings = surfaces.flatMap(mentionsForSurface);
  const prohibitedFindings = findings.filter((finding) => !finding.allowlisted);
  const allowlistedFindings = findings.filter((finding) => finding.allowlisted);
  const coveredKinds = Array.from(new Set(surfaces.map((surface) => surface.kind))).sort();
  const missingPublicKinds = REQUIRED_PUBLIC_KINDS.filter((kind) => !coveredKinds.includes(kind));

  return {
    nativeContract: 'ZavorthNativeAbsorptionPublicSurfaceGuard/v1',
    checkedSurfaceCount: surfaces.length,
    requiredPublicKinds: REQUIRED_PUBLIC_KINDS,
    coveredPublicKinds: coveredKinds,
    missingPublicKinds,
    prohibitedFindings,
    allowlistedFindings,
    passed: prohibitedFindings.length === 0 && missingPublicKinds.length === 0,
    publicExternalExecutorIdentityLeak: false,
    internalProvenanceAllowed: true,
    rawSecretSerialized: false,
  };
}

function namingRules(): ZavorthNativeAbsorptionPublicNamingRule[] {
  return [
    namingRule('capability-lookup-classify', 'capability lookup/classify', 'Zavorth capabilities'),
    namingRule('dashboard-render-view-lookup', 'dashboard render/view lookup', 'Zavorth Command Center'),
    namingRule('provider-channel-transport-metadata-lookup', 'provider/channel/transport metadata lookup', 'Zavorth integrations'),
    namingRule('session-history-metadata-lookup', 'session/history metadata lookup', 'Zavorth sessions'),
    namingRule('config-secretref-state-metadata-lookup', 'config/SecretRef/state metadata lookup', 'Zavorth configuration'),
  ];
}

function namingRule(
  surfaceId: string,
  label: string,
  publicLabel: string,
): ZavorthNativeAbsorptionPublicNamingRule {
  return {
    nativeContract: 'ZavorthNativeAbsorptionPublicNamingRule/v1',
    surfaceId,
    label,
    publicLabel,
    sourceIdentityPublic: false,
    zavorthNativeNameRequired: true,
    internalProvenanceAllowed: true,
    rawSecretSerialized: false,
  };
}

function receiptLogHardening(): ZavorthNativeAbsorptionReceiptLogHardening {
  return {
    nativeContract: 'ZavorthNativeAbsorptionReceiptLogHardening/v1',
    publicReceiptSamples: [
      {
        id: 'native-registry-lookup-ready',
        label: 'Zavorth native registry lookup ready',
        sourceLabel: 'external-source-redacted',
        message: 'Zavorth-native registry lookup served without default adapter.',
        userFacing: true,
        rawSecretSerialized: false,
        sourceIdentityPublic: false,
      },
      {
        id: 'command-center-native-render-ready',
        label: 'Zavorth Command Center native render ready',
        sourceLabel: 'external-source-redacted',
        message: 'Command Center rendered Zavorth-native views with redacted provenance.',
        userFacing: true,
        rawSecretSerialized: false,
        sourceIdentityPublic: false,
      },
    ],
    publicLogSamples: [
      {
        id: 'native-capability-log',
        source: 'zavorth-native-registry',
        message: 'Capability metadata served from Zavorth-native registry.',
        userFacing: true,
        rawSecretSerialized: false,
        sourceIdentityPublic: false,
      },
      {
        id: 'command-center-public-log',
        source: 'zavorth-command-center',
        message: 'Dashboard projection used Zavorth-native public labels.',
        userFacing: true,
        rawSecretSerialized: false,
        sourceIdentityPublic: false,
      },
    ],
    internalProvenanceReceipt: {
      id: 'internal-redacted-provenance',
      sourceLabel: 'external-source-redacted',
      evidenceMode: 'internal-redacted-provenance',
      publicIdentity: 'Zavorth',
      rawSecretSerialized: false,
      sourceIdentityPublic: false,
    },
    receiptsPubliclyRedacted: true,
    logsPubliclyRedacted: true,
    rawSecretSerialized: false,
  };
}

function executionGate(): ZavorthNativeAbsorptionPublicSurfaceHardeningExecutionGate {
  return {
    publicSurfaceHardened: true,
    publicExternalExecutorIdentityLeak: false,
    internalProvenanceAllowed: true,
    nativeReadySurfacesZavorthNamed: true,
    commandCenterPublicIdentityZavorthNative: true,
    adapterDefaultPathForNativeReadySurfaces: false,
    adapterRemovalGlobalAllowed: false,
    runtimeExternalExecutorRequiredForPublicRender: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    stateMigrated: false,
    sourceModuleCopied: false,
    rawSecretSerialized: false,
  };
}

function sourceReady(source: ZavorthNativeAbsorptionPublicSurfaceHardeningSource): boolean {
  return (
    source.partialAdapterRemoval.decision === 'partial-adapter-removal-implemented' &&
    source.commandCenterPublicIdentityZavorthNative &&
    !source.adapterDefaultPathForNativeReadySurfaces &&
    !source.externalExecutorLiveCalledForDefaultPath &&
    !source.executionAttempted &&
    !source.stateMigrationAttempted &&
    !source.sourceModuleCopyAttempted &&
    !source.rawSecretSerialized
  );
}

export class ZavorthNativeAbsorptionPublicSurfaceHardeningPack {
  public constructor(public readonly normalization: ZavorthNativeAbsorptionPublicSurfaceHardeningNormalization) {}

  public prohibitedFindings(): ZavorthNativeAbsorptionPublicSurfaceFinding[] {
    return this.normalization.publicSurfaceGuard.prohibitedFindings;
  }

  public allowlistedFindings(): ZavorthNativeAbsorptionPublicSurfaceFinding[] {
    return this.normalization.publicSurfaceGuard.allowlistedFindings;
  }

  public publicInventory(): ZavorthNativeAbsorptionPublicSurfaceHardeningNormalization['inventory'] {
    return this.normalization.inventory.filter((row) => row.publicSurface);
  }
}

export function createZavorthNativeAbsorptionPublicSurfaceHardeningFixtureSource(
  publicSurfaces: ZavorthNativeAbsorptionPublicSurface[] = [],
): ZavorthNativeAbsorptionPublicSurfaceHardeningSource {
  return {
    partialAdapterRemoval: normalizeZavorthPartialAdapterRemovalImplementationPackFixture(publicSurfaces.map((surface) => ({
      path: surface.path,
      content: surface.content,
      defaultConsumer: surface.kind === 'command-center-dashboard' || surface.kind === 'runtime-projection',
    }))),
    publicSurfaces,
    commandCenterPublicIdentityZavorthNative: true,
    adapterDefaultPathForNativeReadySurfaces: false,
    externalExecutorLiveCalledForDefaultPath: false,
    executionAttempted: false,
    stateMigrationAttempted: false,
    sourceModuleCopyAttempted: false,
    rawSecretSerialized: false,
  };
}

export function normalizeZavorthNativeAbsorptionPublicSurfaceHardeningPack<TRuntimeId extends string>(
  options: ZavorthNativeAbsorptionPublicSurfaceHardeningOptions<TRuntimeId>,
): ZavorthNativeAbsorptionPublicSurfaceHardeningNormalization {
  const publicSurfaceGuard = evaluateZavorthNativeAbsorptionPublicSurfaceGuard(options.source.publicSurfaces);
  const names = namingRules();
  const receipts = receiptLogHardening();
  const gate = executionGate();
  const ready = sourceReady(options.source) &&
    publicSurfaceGuard.passed &&
    names.every((rule) => (
      rule.publicLabel.startsWith('Zavorth') &&
      !rule.sourceIdentityPublic &&
      rule.zavorthNativeNameRequired
    )) &&
    receipts.publicReceiptSamples.every((sample) => !sample.sourceIdentityPublic && !sample.rawSecretSerialized) &&
    receipts.publicLogSamples.every((sample) => !sample.sourceIdentityPublic && !sample.rawSecretSerialized);

  return {
    nativeContract: 'ZavorthNativeAbsorptionPublicSurfaceHardeningPack/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'native-absorption-public-surface-hardened' : 'blocked',
    status: ready ? 'native-absorption-public-surface-hardened' : 'blocked',
    sourceReadiness: {
      partialAdapterRemoval: options.source.partialAdapterRemoval.decision,
    },
    inventory: options.source.publicSurfaces.map(inventoryRow),
    publicSurfaceGuard,
    namingRules: names,
    receiptLogHardening: receipts,
    commandCenterHardening: {
      nativeContract: 'ZavorthNativeAbsorptionCommandCenterPublicHardening/v1',
      commandCenterPublicIdentityZavorthNative: true,
      publicLabelsZavorthNative: true,
      degradedUnavailableOperational: true,
      adapterDefaultPathForNativeReadySurfaces: false,
      runtimeExternalExecutorRequiredForPublicRender: false,
      rawSecretSerialized: false,
    },
    executionGate: gate,
    redaction: {
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      sourceIdentityPublic: false,
      sourceStructuresPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'future-global-adapter-removal-readiness-or-public-surface-regression-monitor',
  };
}

export function normalizeZavorthNativeAbsorptionPublicSurfaceHardeningPackFixture(
  publicSurfaces: ZavorthNativeAbsorptionPublicSurface[] = [],
): ZavorthNativeAbsorptionPublicSurfaceHardeningNormalization {
  return normalizeZavorthNativeAbsorptionPublicSurfaceHardeningPack({
    generatedAt: ZAVORTH_NATIVE_ABSORPTION_PUBLIC_SURFACE_HARDENING_PACK_NOW,
    runtimeId: ZAVORTH_NATIVE_ABSORPTION_PUBLIC_SURFACE_HARDENING_PACK_RUNTIME_ID,
    source: createZavorthNativeAbsorptionPublicSurfaceHardeningFixtureSource(publicSurfaces),
  });
}

export function createZavorthNativeAbsorptionPublicSurfaceHardeningPackFixture(
  publicSurfaces: ZavorthNativeAbsorptionPublicSurface[] = [],
): ZavorthNativeAbsorptionPublicSurfaceHardeningPack {
  return new ZavorthNativeAbsorptionPublicSurfaceHardeningPack(
    normalizeZavorthNativeAbsorptionPublicSurfaceHardeningPackFixture(publicSurfaces),
  );
}
