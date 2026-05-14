import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
  createZavorthNativeAbsorptionConsolidationPackFixture,
  createZavorthNativeRegistryProductionPersistenceFeatureFlag,
  createZavorthNativeRegistryProductionPersistenceFlaggedFixture,
  createZavorthNativeRegistryProductionRestoreLoadCommandCenterFixture,
  normalizeZavorthNativeAbsorptionConsolidationPack,
  createZavorthNativeAbsorptionConsolidationFixtureSource,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthNativeAbsorptionConsolidationSurfaceId,
  ZavorthNativeRegistryPersistenceKind,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/201-wave-3-native-absorption-consolidation-pack.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const MILESTONE_DOC = 'docs/200-wave-3-native-absorption-milestone-report.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthNativeAbsorptionConsolidationPack.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

const REQUIRED_DOC_SURFACES = [
  'capabilities/plugins',
  'dashboard/Command Center view models',
  'providers',
  'channels',
  'message transports',
  'sessions/history metadata',
  'config/SecretRef/state metadata',
  'refresh/reconciliation',
  'action dispatch',
  'message send',
  'provider execution',
  'command/tool execution',
  'migration/import',
] as const;

const NATIVE_READY_SURFACES: ZavorthNativeAbsorptionConsolidationSurfaceId[] = [
  'capabilities-plugins',
  'dashboard-command-center-view-models',
  'providers',
  'channels',
  'message-transports',
  'sessions-history-metadata',
  'config-secretref-state-metadata',
];

const REQUIRED_REGISTRY_KINDS: ZavorthNativeRegistryPersistenceKind[] = [
  'capability-registry',
  'dashboard-view-model-registry',
  'integration-registry',
  'session-history-registry',
  'config-state-registry',
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function productionRoot(): string {
  return path.join(
    process.cwd(),
    '.tmp',
    'zavorth-native-absorption-consolidation-pack-test',
    ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
  );
}

function productionBaselineRoot(): string {
  return path.join(
    process.cwd(),
    '.tmp',
    'zavorth-native-absorption-consolidation-pack-baseline',
    ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
  );
}

function writeProductionFixture(root: string): void {
  if (fs.existsSync(root)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  fs.cpSync(productionBaselineRoot(), root, { recursive: true });
}

function assertNoRawSecretInJson(root: string): void {
  if (!fs.existsSync(root)) {
    return;
  }

  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop() as string;
    fs.readdirSync(current, { withFileTypes: true }).forEach((entry) => {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(absolute);
        return;
      }
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        return;
      }

      const content = fs.readFileSync(absolute, 'utf8');
      expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
      expect(content).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
      expect(content).not.toMatch(/ghp_[A-Za-z0-9_]{8,}/);
      expect(content).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{8,}/);
    });
  }
}

describe('Wave 3 native absorption consolidation pack', () => {
  const root = productionRoot();
  const baselineRoot = productionBaselineRoot();
  const restoreLoad = createZavorthNativeRegistryProductionRestoreLoadCommandCenterFixture();
  let defaultPack: ReturnType<typeof createZavorthNativeAbsorptionConsolidationPackFixture>;

  beforeAll(() => {
    const persistence = createZavorthNativeRegistryProductionPersistenceFlaggedFixture();
    if (fs.existsSync(baselineRoot)) {
      persistence.cleanup(baselineRoot);
    }
    const receipt = persistence.persist({
      productionRoot: baselineRoot,
      featureFlag: createZavorthNativeRegistryProductionPersistenceFeatureFlag(true),
    });
    expect(receipt.decision).toBe('native-registry-production-persistence-ready');
    defaultPack = createZavorthNativeAbsorptionConsolidationPackFixture();
  });

  afterEach(() => {
    if (fs.existsSync(root)) {
      restoreLoad.cleanup(root);
    }
  });

  afterAll(() => {
    if (fs.existsSync(baselineRoot)) {
      restoreLoad.cleanup(baselineRoot);
    }
  });

  it('documents 201 as one consolidated native absorption pack', () => {
    const content = read(DOC);

    expect(content).toContain('Status: native-absorption-consolidation-ready');
    expect(content).toContain('ZavorthNativeAbsorptionConsolidationPack.ts');
    expect(content).toContain('ZavorthPartialAdapterDeprecationGate');
    expect(content).toContain('ZavorthNativeRegistryRefreshReconciliation');
    expect(content).toContain('ZavorthNativeRegistryProductionRestoreLoadCommandCenter');
    expect(content).toContain('nativeAbsorptionConsolidationPackCreated=true');
    expect(content).toContain('productionLoadedNativeFirstDefaultPrepared=true');
    expect(content).toContain('adapterDefaultPathForNativeReadySurfaces=false');
    expect(content).toContain('runtimeExternalExecutorRequiredForCommandCenterRender=false');
    expect(content).toContain('runtimeExternalExecutorRequiredForNativeRegistryLookup=false');
    expect(content).toContain('adapterRefreshAllowed=true');
    expect(content).toContain('adapterRemovalGlobalAllowed=false');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('keeps a full milestone matrix and explicit gaps inside the pack', () => {
    const content = read(DOC);

    REQUIRED_DOC_SURFACES.forEach((surface) => {
      expect(content).toContain(`| ${surface} |`);
    });
    expect(content).toContain('absorbed-native');
    expect(content).toContain('native-first-refreshable');
    expect(content).toContain('adapter-required');
    expect(content).toContain('blocked');
    expect(content).toContain('global adapter removal remains blocked');
    expect(content).toContain('provider execution remains blocked');
    expect(content).toContain('command/tool execution remains blocked');
    expect(content).toContain('migration/import remains blocked');
  });

  it('updates tracking docs and the previous milestone report for 201', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/201-wave-3-native-absorption-consolidation-pack.md');
    expect(read(PAUSE_DOC)).toContain('`201` is the Wave 3 native absorption consolidation pack');
    expect(read(MILESTONE_DOC)).toContain('Wave 3 consolidation pack follow-up: docs/201-wave-3-native-absorption-consolidation-pack.md');
    expect(read(MILESTONE_DOC)).toContain('advance beyond the consolidation pack');
  });

  it('exports the consolidation pack boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthNativeAbsorptionConsolidationPack/v1');
    expect(boundary).toContain('ZavorthNativeAbsorptionProductionLoadedDefault/v1');
    expect(boundary).toContain('ZavorthNativeAbsorptionDefaultRoute/v1');
    expect(index).toContain("from './ZavorthNativeAbsorptionConsolidationPack.js'");
    expect(index).toContain('ZavorthNativeAbsorptionConsolidationNormalization');
  });

  it('uses production-loaded native registries as the default when valid snapshots exist', () => {
    writeProductionFixture(root);
    const productionRestore = restoreLoad.load(root);
    const pack = createZavorthNativeAbsorptionConsolidationPackFixture(productionRestore);
    const normalization = pack.normalization;

    expect(productionRestore.decision).toBe('production-restore-load-command-center-ready');
    expect(normalization.decision).toBe('native-absorption-consolidation-ready');
    expect(normalization.productionDefault).toEqual(expect.objectContaining({
      status: 'production-loaded-ready',
      productionLoadedNativeFirstDefaultPrepared: true,
      productionLoadedViewCount: 5,
      adapterInvokedForDefaultLookup: false,
      adapterInvokedForDefaultRender: false,
      runtimeExternalExecutorRequiredForProductionLoadedLookup: false,
      runtimeExternalExecutorRequiredForProductionLoadedRender: false,
    }));
    expect(normalization.productionDefault.loadedRegistryKinds.sort()).toEqual(REQUIRED_REGISTRY_KINDS.slice().sort());
    pack.nativeReadyDefaultRoutes().forEach((route) => {
      expect(route.defaultLookupPath).toBe('production-loaded-native-registry');
      expect(route.defaultRenderPath).toBe('production-loaded-native-registry');
      expect(route.fallbackPath).toBe('in-memory-native-registry');
      expect(route.adapterInvokedForDefaultLookup).toBe(false);
      expect(route.adapterInvokedForDefaultRender).toBe(false);
      expect(route.externalExecutorLiveCalledForDefaultPath).toBe(false);
      expect(route.runtimeExternalExecutorRequiredForLookup).toBe(false);
      expect(route.runtimeExternalExecutorRequiredForRender).toBe(false);
    });
    assertNoRawSecretInJson(root);
  });

  it('falls back to in-memory native registries without calling the adapter by default', () => {
    const pack = defaultPack;

    expect(pack.normalization.decision).toBe('native-absorption-consolidation-ready');
    expect(pack.normalization.productionDefault.status).toBe('fallback-in-memory-native');
    NATIVE_READY_SURFACES.forEach((surfaceId) => {
      const route = pack.lookupDefaultRoute(surfaceId);

      expect(route).toEqual(expect.objectContaining({
        defaultLookupPath: 'in-memory-native-registry',
        defaultRenderPath: 'in-memory-native-registry',
        fallbackPath: 'degraded-native-fallback',
        adapterInvokedForDefaultLookup: false,
        adapterInvokedForDefaultRender: false,
        externalExecutorLiveCalledForDefaultPath: false,
      }));
    });
  });

  it('keeps refresh and reconciliation explicit, isolated, and non-default', () => {
    const pack = defaultPack;
    const refreshRoute = pack.lookupDefaultRoute('refresh-reconciliation');

    expect(pack.refreshModes()).toEqual(expect.arrayContaining([
      'disabled',
      'manual',
      'scheduled-future',
      'live-adapter-optional',
      'blocked',
    ]));
    expect(refreshRoute).toEqual(expect.objectContaining({
      defaultLookupPath: 'none',
      defaultRenderPath: 'none',
      fallbackPath: 'explicit-refresh-only',
      adapterMayBeCalledForExplicitRefresh: true,
      adapterInvokedForDefaultLookup: false,
      adapterInvokedForDefaultRender: false,
    }));
    expect(pack.normalization.refreshTighteningPolicy).toEqual(expect.objectContaining({
      adapterCallIsDefaultLookupPath: false,
      adapterCallIsDefaultRenderPath: false,
      refreshFailureBreaksNativeFirst: false,
      registryMutationCommitted: false,
    }));
  });

  it('keeps blocked surfaces blocked and lists decommission candidates without authorizing removal', () => {
    const pack = defaultPack;

    ['message-send', 'provider-execution', 'command-tool-execution', 'migration-import'].forEach((surfaceId) => {
      expect(pack.lookupDefaultRoute(surfaceId as ZavorthNativeAbsorptionConsolidationSurfaceId)).toEqual(expect.objectContaining({
        defaultLookupPath: 'blocked',
        defaultRenderPath: 'blocked',
        adapterMayBeCalledForExplicitRefresh: false,
        messageActuallySent: false,
        providerActuallyExecuted: false,
        commandActuallyExecuted: false,
        toolActuallyExecuted: false,
        stateMigrated: false,
      }));
    });
    expect(pack.normalization.decommissionCandidates).toHaveLength(4);
    pack.normalization.decommissionCandidates.forEach((candidate) => {
      expect(candidate.removeInThisPack).toBe(false);
      expect(candidate.adapterRemovalGlobalAllowed).toBe(false);
    });
  });

  it('blocks forbidden authority and raw secret serialization across the pack output', () => {
    const pack = defaultPack;
    const serialized = JSON.stringify(pack.normalization);

    expect(pack.normalization.executionGate).toEqual({
      nativeAbsorptionConsolidationPackCreated: true,
      productionLoadedNativeFirstDefaultPrepared: true,
      adapterDefaultPathForNativeReadySurfaces: false,
      runtimeExternalExecutorRequiredForCommandCenterRender: false,
      runtimeExternalExecutorRequiredForNativeRegistryLookup: false,
      adapterRefreshAllowed: true,
      adapterRemovalGlobalAllowed: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      stateMigrated: false,
      sourceModuleCopied: false,
      rawSecretSerialized: false,
    });
    expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(serialized).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
    expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{8,}/);
    expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{8,}/);
    expect(serialized).not.toContain('synthetic-raw-credential-sentinel-that-must-not-appear');
  });

  it('can normalize a degraded production restore into native fallback without granting adapter default path', () => {
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(
      path.join(root, 'manifest.json'),
      `${JSON.stringify({ nativeContract: 'invalid-production-manifest-fixture' }, null, 2)}\n`,
      'utf8',
    );
    const degraded = createZavorthNativeRegistryProductionRestoreLoadCommandCenterFixture().load(root);
    const normalization = normalizeZavorthNativeAbsorptionConsolidationPack({
      generatedAt: '2026-04-29T08:30:00.000Z',
      runtimeId: 'zavorth-native-absorption-consolidation-pack-degraded-fixture',
      source: createZavorthNativeAbsorptionConsolidationFixtureSource(degraded),
    });

    expect(degraded.decision).toBe('blocked');
    expect(normalization.decision).toBe('native-absorption-consolidation-ready');
    expect(normalization.productionDefault.status).toBe('production-load-degraded');
    normalization.defaultRoutes
      .filter((route) => route.classification === 'absorbed-native' || route.classification === 'native-first-refreshable')
      .forEach((route) => {
        expect(route.defaultLookupPath).toBe('in-memory-native-registry');
        expect(route.adapterInvokedForDefaultLookup).toBe(false);
        expect(route.externalExecutorLiveCalledForDefaultPath).toBe(false);
      });
  });
});
