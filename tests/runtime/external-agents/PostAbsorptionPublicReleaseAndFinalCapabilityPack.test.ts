import fs from 'node:fs';
import path from 'node:path';

import {
  createPostAbsorptionPublicReleaseAndFinalCapabilityPackFixture,
  createPostAbsorptionPublicReleaseFinalCapabilitySource,
  normalizePostAbsorptionPublicReleaseAndFinalCapabilityPack,
  POST_ABSORPTION_PUBLIC_RELEASE_AND_FINAL_CAPABILITY_PACK_RUNTIME_ID,
} from '../../../src/runtime/external-agents/index.js';
import type {
  PostAbsorptionPublicReleaseFinalCapabilitySource,
  PostAbsorptionPublicReleaseState,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/262-post-absorption-public-release-and-final-capability-pack.md';
const BOUNDARY = 'src/runtime/external-agents/PostAbsorptionPublicReleaseAndFinalCapabilityPack.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const PACKAGE_JSON = 'package.json';
const BIN_SHIM = 'bin/zavorth.js';
const ROADMAP_257 = 'docs/257-post-absorption-final-maintenance-backlog-and-roadmap-pack.md';

const PUBLIC_DOCS = [
  'README.md',
  'docs/02-quickstart.md',
  'docs/09-operations.md',
  'docs/10-troubleshooting.md',
  'docs/34-zavorth-cli.md',
];

const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

const EXPECTED_STATES: PostAbsorptionPublicReleaseState[] = [
  'publishReadiness=ready-dry-run-only',
  'npmCreateZavorth=implemented-or-designed-with-concrete-blocker',
  'heavyShardOptimization=optimized-or-measured-with-plan',
  'limitedProductionSend=policy-ready-no-send',
  'rawSqliteImporter=disabled-design-ready',
  'adapterRetirement=domain-scoped-only',
  'monitoringPolish=local-receipts-ready',
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function assertNoRawSecretOrContent(serialized: string): void {
  expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  expect(serialized).not.toMatch(/(?<![A-Za-z])sk-[A-Za-z0-9_-]{20,}/);
  expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{20,}/);
  expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{20,}/);
  expect(serialized).not.toContain('synthetic-raw-credential-sentinel-that-must-not-appear');
  expect(serialized).not.toContain('<redacted-local-secret>');
  expect(serialized).not.toContain('raw user message body that must never migrate');
  expect(serialized).not.toContain('unredacted private message fixture');
}

describe('Post-absorption public release and final capability pack', () => {
  let source: PostAbsorptionPublicReleaseFinalCapabilitySource;
  let pack: ReturnType<typeof createPostAbsorptionPublicReleaseAndFinalCapabilityPackFixture>;

  beforeAll(() => {
    source = createPostAbsorptionPublicReleaseFinalCapabilitySource();
    pack = createPostAbsorptionPublicReleaseAndFinalCapabilityPackFixture();
  });

  it('documents 262 as a public release and final capability pack with expected states', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `public-release-final-capability-ready`');
    expect(content).toContain('PostAbsorptionPublicReleaseAndFinalCapabilityPack.ts');
    expect(content).toContain('PostAbsorptionPublicReleaseAndFinalCapabilityPack/v1');
    expect(content).toContain('PostAbsorptionNpmPublishReadiness/v1');
    expect(content).toContain('PostAbsorptionNpmCreateZavorthBootstrap/v1');
    expect(content).toContain('PostAbsorptionHeavyShardOptimization/v1');
    expect(content).toContain('PostAbsorptionLimitedProductionSendPolicy/v1');
    expect(content).toContain('PostAbsorptionRawSqliteImporterPosture/v1');
    expect(content).toContain('PostAbsorptionFallbackAdapterRetirementPosture/v1');
    EXPECTED_STATES.forEach((state) => expect(content).toContain(state));
    expect(content).toContain('npmPublishActuallyPerformed=false');
    expect(content).toContain('Do not advance beyond `262`');
    assertNoRawSecretOrContent(content);
  });

  it('exports the 262 boundary and keeps the fixture ready', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('PostAbsorptionPublicReleaseAndFinalCapabilityPack/v1');
    expect(boundary).toContain('PostAbsorptionNpmPublishReadiness/v1');
    expect(boundary).toContain('PostAbsorptionPublicReleaseCheck/v1');
    expect(index).toContain("from './PostAbsorptionPublicReleaseAndFinalCapabilityPack.js'");
    expect(index).toContain('POST_ABSORPTION_PUBLIC_RELEASE_AND_FINAL_CAPABILITY_PACK_RUNTIME_ID');
    expect(pack.normalization.decision).toBe('public-release-final-capability-ready');
    EXPECTED_STATES.forEach((state) => expect(pack.expectedState(state)).toBe(true));
  });

  it('records npm publish readiness as dry-run only and never publish-approved', () => {
    const pkg = JSON.parse(read(PACKAGE_JSON)) as {
      name: string;
      bin: Record<string, string>;
      scripts: Record<string, string>;
      files: string[];
    };

    expect(pkg.name).toBe('zavorth');
    expect(pkg.bin.zavorth).toBe('./bin/zavorth.js');
    expect(pkg.scripts.prepack).toBe('npm run build --silent');
    expect(pkg.scripts.cli).toBe('npm run build --silent && node bin/zavorth.js');
    expect(pkg.scripts.cli).not.toContain('node dist/zavorth-cli.js');
    expect(pkg.files).toEqual(expect.arrayContaining(['bin/', 'dist/', 'dist-ops/', 'README.md']));
    expect(pack.normalization.publishReadiness).toEqual({
      nativeContract: 'PostAbsorptionNpmPublishReadiness/v1',
      publishReadiness: 'ready-dry-run-only',
      npmPublishActuallyPerformed: false,
      explicitOperatorApprovalForPublish: false,
      buildCommand: 'npm run build --silent',
      packDryRunCommand: 'npm pack --dry-run',
      packageName: 'zavorth',
      binEntrypoint: './bin/zavorth.js',
      packageContentsDryRunOnly: true,
      rawSecretSerialized: false,
    });
    expect(pack.publishAllowed()).toBe(false);
  });

  it('records npm create as designed with a concrete create-package blocker and npx setup fallback', () => {
    expect(pack.normalization.npmCreateZavorth).toEqual(expect.objectContaining({
      nativeContract: 'PostAbsorptionNpmCreateZavorthBootstrap/v1',
      npmCreateZavorth: 'implemented-or-designed-with-concrete-blocker',
      status: 'design-ready-with-blocker',
      smallestCompatibleCurrentPath: 'npx zavorth setup',
      monorepoInvented: false,
      bootstrapRuntimePersisted: false,
      secretsWritten: false,
      providerOrTransportCalled: false,
      rawSecretSerialized: false,
    }));
    expect(pack.normalization.npmCreateZavorth.concreteBlocker).toContain('create-zavorth');
    expect(pack.normalization.npmCreateZavorth.concreteBlocker).toContain('not a create-package monorepo');
  });

  it('keeps the missing build message human and aligned with package distribution', () => {
    const shim = read(BIN_SHIM);

    expect(shim).toContain('Zavorth CLI build not found.');
    expect(shim).toContain('npm run build');
    expect(shim).toContain('npm run setup');
    expect(shim).toContain('npm run go');
    expect(shim).toContain('npx or a global install');
    expect(shim).toContain('package integrity issue');
    expect(shim).not.toContain('Cannot find module');
    assertNoRawSecretOrContent(shim);
  });

  it('records heavy shard measurement/optimization posture without coverage reduction', () => {
    expect(pack.normalization.heavyShardOptimization).toEqual(expect.objectContaining({
      nativeContract: 'PostAbsorptionHeavyShardOptimization/v1',
      heavyShardOptimization: 'optimized-or-measured-with-plan',
      knownHeavyShards: ['8/16', '3/16', '12/16', '11/16', '15/16'],
      measuredShard: '8/16',
      measurementCommand: 'npm run test:external-agents:shard -- 8/16 --testTimeout=30000',
      measuredResult: '8/16 passed 11 suites and 103 tests in 113.179s',
      coverageReductionAllowed: false,
      assertionsReducedForSpeed: false,
      externalExecutorLiveRequiredForUnitTests: false,
      rawSecretSerialized: false,
    }));
    expect(pack.normalization.heavyShardOptimization.optimizationPlan.length).toBeGreaterThanOrEqual(4);
  });

  it('consolidates limited production send as policy-ready with no send', () => {
    expect(pack.normalization.limitedProductionSend).toEqual({
      nativeContract: 'PostAbsorptionLimitedProductionSendPolicy/v1',
      limitedProductionSend: 'policy-ready-no-send',
      featureFlagRequired: 'ZAVORTH_LIMITED_PRODUCTION_MESSAGE_SEND_EXECUTE',
      targetChannelTransportAllowlistRequired: true,
      explicitApprovalRequired: true,
      idempotencyKeyRequired: true,
      rateLimitRequired: true,
      immediateDryRunBeforeLiveRequired: true,
      auditReceiptRequired: true,
      realMessageSentInThisPack: false,
      rawContentUsageAllowed: false,
      rawSecretSerialized: false,
    });
  });

  it('keeps raw SQLite importer disabled and schema/parity focused', () => {
    expect(pack.normalization.rawSqliteImporter).toEqual({
      nativeContract: 'PostAbsorptionRawSqliteImporterPosture/v1',
      rawSqliteImporter: 'disabled-design-ready',
      defaultMode: 'disabled',
      schemaParityFocus: true,
      operatorHistoryAssumption: 'empty-or-test-history-without-product-value',
      rawDbCopied: false,
      sqliteWriteAllowed: false,
      rawMessageContentSerialized: false,
      attachmentsOrBinariesSerialized: false,
      tokensOrCredentialsSerialized: false,
      rawSecretSerialized: false,
    });
  });

  it('keeps adapter retirement domain-scoped and monitoring local-receipts ready', () => {
    expect(pack.normalization.fallbackAdapterRetirement).toEqual({
      nativeContract: 'PostAbsorptionFallbackAdapterRetirementPosture/v1',
      adapterRetirement: 'domain-scoped-only',
      onlyDomainsWithZavorthNativeSubstituteEligible: true,
      adapterGlobalStillAvailable: true,
      adapterRemovalGlobalAllowed: false,
      refreshReconciliationFallbackPreserved: true,
      defaultRuntimeRequiresAdapter: false,
      publicExternalExecutorIdentityLeak: false,
      rawSecretSerialized: false,
    });
    expect(pack.normalization.monitoringPolish).toEqual({
      nativeContract: 'PostAbsorptionMonitoringReleasePolish/v1',
      monitoringPolish: 'local-receipts-ready',
      localChecksConsolidated: true,
      receiptsRedacted: true,
      externalHeavyMonitoringAdded: false,
      externalExecutorLiveRequiredForMonitoring: false,
      listener18789Required: false,
      rawSecretSerialized: false,
    });
  });

  it('records required validation commands and no external/publish action in checks', () => {
    expect(pack.normalization.validationChecks.map((check) => check.checkId)).toEqual([
      'build',
      'npm-pack-dry-run',
      'bin-help',
      'representative-external-agents',
      'runtime-check',
      'public-surface-scan',
      'redaction-scan',
    ]);
    expect(pack.validationCheck('build')?.commandOrCheck).toBe('npm run build --silent');
    expect(pack.validationCheck('npm-pack-dry-run')?.commandOrCheck).toBe('npm pack --dry-run');
    expect(pack.validationCheck('bin-help')?.commandOrCheck).toBe('node bin/zavorth.js --help');
    pack.normalization.validationChecks.forEach((check) => {
      expect(check.publishAllowed).toBe(false);
      expect(check.externalActionAllowed).toBe(false);
      expect(check.rawSecretSerialized).toBe(false);
    });
  });

  it('keeps public docs from promoting bat files or requiring source runtime identity', () => {
    PUBLIC_DOCS.forEach((relativePath) => {
      const content = read(relativePath);
      expect(content).not.toMatch(/\.bat\b/i);
      expect(content).not.toMatch(/ExternalExecutor|external-executor/);
      expect(content).not.toMatch(/node dist\/zavorth-cli\.js/);
      assertNoRawSecretOrContent(content);
    });
  });

  it('updates the final roadmap only as a post-operator-decision consolidation note', () => {
    const roadmap = read(ROADMAP_257);

    expect(roadmap).toContain('Post-262 Operator Decision Note');
    expect(roadmap).toContain('docs/262-post-absorption-public-release-and-final-capability-pack.md');
    assertNoRawSecretOrContent(roadmap);
  });

  it('keeps exact execution guarantees closed', () => {
    expect(pack.normalization.executionGate).toEqual({
      postAbsorptionPublicReleaseAndFinalCapabilityPackCreated: true,
      publishReadiness: 'ready-dry-run-only',
      npmCreateZavorth: 'implemented-or-designed-with-concrete-blocker',
      heavyShardOptimization: 'optimized-or-measured-with-plan',
      limitedProductionSend: 'policy-ready-no-send',
      rawSqliteImporter: 'disabled-design-ready',
      adapterRetirement: 'domain-scoped-only',
      monitoringPolish: 'local-receipts-ready',
      npmPublishActuallyPerformed: false,
      explicitOperatorApprovalForPublish: false,
      defaultRuntimeZavorthOwned: true,
      publicExternalExecutorIdentityLeak: false,
      batFilesNotProductPath: true,
      rawSecretSerialized: false,
    });
  });

  it('blocks publish, public/source identity, coverage reduction, execution, migration, and adapter removal regressions', () => {
    const blockedCases: Array<keyof PostAbsorptionPublicReleaseFinalCapabilitySource> = [
      'npmPublishAttempted',
      'explicitOperatorApprovalForPublish',
      'packageBlockerFoundUnresolved',
      'monorepoInventedForCreate',
      'coverageReductionAttempted',
      'docsPromoteBatFiles',
      'publicExternalExecutorIdentityExposed',
      'defaultRuntimeRequiresExternalExecutor',
      'messageSendAttempted',
      'providerExecutionAttempted',
      'toolCommandExecutionAttempted',
      'rawSqliteImportAttempted',
      'rawDbCopyAttempted',
      'sqliteWriteAttempted',
      'adapterGlobalRemovalAttempted',
      'externalExecutorLiveCalledForDefaultRuntime',
      'sourceModuleCopyAttempted',
      'rawSecretSerialized',
    ];

    blockedCases.forEach((key) => {
      const normalization = normalizePostAbsorptionPublicReleaseAndFinalCapabilityPack({
        generatedAt: '2026-05-02T01:01:00.000Z',
        runtimeId: POST_ABSORPTION_PUBLIC_RELEASE_AND_FINAL_CAPABILITY_PACK_RUNTIME_ID,
        source: { ...source, [key]: true } as unknown as PostAbsorptionPublicReleaseFinalCapabilitySource,
      });

      expect(normalization.decision).toBe('blocked');
      expect(normalization.executionGate.npmPublishActuallyPerformed).toBe(false);
      expect(normalization.executionGate.defaultRuntimeZavorthOwned).toBe(true);
      expect(normalization.executionGate.publicExternalExecutorIdentityLeak).toBe(false);
      expect(normalization.executionGate.batFilesNotProductPath).toBe(true);
      expect(normalization.executionGate.rawSecretSerialized).toBe(false);
    });
  });

  it('keeps serialized output redacted and terminal at 262', () => {
    const serialized = JSON.stringify(pack.normalization);

    expect(pack.normalization.redaction).toEqual({
      rawSecretSerialized: false,
      rawContentSerialized: false,
      packageSecretsIncluded: false,
      publicSourceIdentityExposed: false,
      receiptsRedacted: true,
      serializedOutputContainsSensitiveFixture: false,
    });
    expect(pack.normalization.terminalGate).toBe('do-not-advance-beyond-262-without-operator-decision');
    assertNoRawSecretOrContent(serialized);
  });
});
