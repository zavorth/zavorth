import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {
  createPostAbsorptionPublishCreateAndStabilityGateFixture,
  createPostAbsorptionPublishCreateAndStabilitySource,
  normalizePostAbsorptionPublishCreateAndStabilityGate,
  POST_ABSORPTION_PUBLISH_CREATE_AND_STABILITY_GATE_RUNTIME_ID,
} from '../../../src/runtime/external-agents/index.js';
import type {
  PostAbsorptionPublishCreateAndStabilityExpectedState,
  PostAbsorptionPublishCreateAndStabilitySource,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/263-post-absorption-publish-create-and-stability-gate.md';
const BOUNDARY = 'src/runtime/external-agents/PostAbsorptionPublishCreateAndStabilityGate.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const PACKAGE_JSON = 'package.json';
const CREATE_BIN = 'bin/create-zavorth.js';
const DOC_262 = 'docs/262-post-absorption-public-release-and-final-capability-pack.md';
const ROADMAP_257 = 'docs/257-post-absorption-final-maintenance-backlog-and-roadmap-pack.md';

const PUBLIC_SURFACES = [
  'README.md',
  'docs/02-quickstart.md',
  'docs/09-operations.md',
  'docs/10-troubleshooting.md',
  'docs/34-zavorth-cli.md',
  'package.json',
];

const EXPECTED_STATES: PostAbsorptionPublishCreateAndStabilityExpectedState[] = [
  'publishGateCreated=true',
  'publishDecision=ready-awaiting-operator-approval',
  'npmPublishActuallyPerformed=false',
  'npmCreateZavorth=blocked-with-concrete-reason',
  'heavyShardOptimization=measured-with-actionable-plan',
  'defaultRuntimeZavorthOwned=true',
  'publicExternalExecutorIdentityLeak=false',
  'batFilesNotProductPath=true',
  'rawImportDefaultDisabled=true',
  'limitedProductionSendStillGated=true',
  'adapterRemovalGlobalAllowed=false',
];

const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

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
  expect(serialized).not.toContain('raw user message body' + ' that must never migrate');
  expect(serialized).not.toContain('unredacted private message' + ' fixture');
}

describe('Post-absorption publish, create, and stability gate', () => {
  let source: PostAbsorptionPublishCreateAndStabilitySource;
  let pack: ReturnType<typeof createPostAbsorptionPublishCreateAndStabilityGateFixture>;

  beforeAll(() => {
    source = createPostAbsorptionPublishCreateAndStabilitySource();
    pack = createPostAbsorptionPublishCreateAndStabilityGateFixture();
  });

  it('documents 263 as a release gate with the expected terminal states', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `publish-create-stability-gate-ready`');
    expect(content).toContain('PostAbsorptionPublishCreateAndStabilityGate.ts');
    expect(content).toContain('publishGateCreated=true');
    expect(content).toContain('publishDecision=ready-awaiting-operator-approval');
    expect(content).toContain('npmPublishActuallyPerformed=false');
    expect(content).toContain('npmCreateZavorth=blocked-with-concrete-reason');
    expect(content).toContain('heavyShardOptimization=measured-with-actionable-plan');
    expect(content).toContain('npm publish --access public');
    expect(content).toContain('Do not advance beyond `263`');
    EXPECTED_STATES.forEach((state) => expect(content).toContain(state));
    assertNoRawSecretOrContent(content);
  });

  it('exports the 263 boundary and keeps the fixture ready', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('PostAbsorptionPublishCreateAndStabilityGate/v1');
    expect(boundary).toContain('PostAbsorptionPublishApprovalReleaseGate/v1');
    expect(boundary).toContain('PostAbsorptionNpmCreateZavorthGate/v1');
    expect(index).toContain("from './PostAbsorptionPublishCreateAndStabilityGate.js'");
    expect(index).toContain('POST_ABSORPTION_PUBLISH_CREATE_AND_STABILITY_GATE_RUNTIME_ID');
    expect(pack.normalization.decision).toBe('publish-create-stability-gate-ready');
    EXPECTED_STATES.forEach((state) => expect(pack.expectedState(state)).toBe(true));
  });

  it('keeps npm publish prepared but unexecuted and approval-gated', () => {
    expect(pack.normalization.publishGate).toEqual(expect.objectContaining({
      nativeContract: 'PostAbsorptionPublishApprovalReleaseGate/v1',
      publishGateCreated: true,
      publishDecision: 'ready-awaiting-operator-approval',
      npmPublishActuallyPerformed: false,
      publishRequiresExplicitOperatorApproval: true,
      publishCommandPreparedButNotExecuted: true,
      publishReadinessFrom262Preserved: true,
      packageName: 'zavorth',
      packageVersion: '1.1.0-alpha.0',
      currentBinEntrypoint: './bin/zavorth.js',
      publishCommandPrepared: 'npm publish --access public',
      explicitOperatorApprovalForPublish: false,
      blockers: [],
      rawSecretSerialized: false,
    }));
    expect(pack.publishAllowed()).toBe(false);
    expect(pack.validationCheck('npm-pack-dry-run')?.commandOrCheck).toBe('npm pack --dry-run');
  });

  it('adds a safe create-zavorth dry-run helper while recording the real npm-create blocker', () => {
    const pkg = JSON.parse(read(PACKAGE_JSON)) as {
      name: string;
      version: string;
      bin: Record<string, string>;
    };
    const createBin = read(CREATE_BIN);
    const dryRun = execFileSync(
      'node',
      ['bin/create-zavorth.js', '--dry-run', '--json', 'sample-zavorth-app'],
      { cwd: process.cwd(), encoding: 'utf8' },
    );
    const parsed = JSON.parse(dryRun) as {
      mode: string;
      projectName: string;
      safety: {
        secretsWritten: boolean;
        runtimeStarted: boolean;
        providerExecuted: boolean;
        toolCommandExecuted: boolean;
        messageSent: boolean;
        npmPublishActuallyPerformed: boolean;
      };
    };

    expect(pkg.name).toBe('zavorth');
    expect(pkg.version).toBe('1.1.0-alpha.0');
    expect(pkg.bin.zavorth).toBe('./bin/zavorth.js');
    expect(pkg.bin['create-zavorth']).toBe('./bin/create-zavorth.js');
    expect(createBin).toContain('only --dry-run is available');
    expect(createBin).toContain('No files were written');
    expect(parsed.mode).toBe('dry-run');
    expect(parsed.projectName).toBe('sample-zavorth-app');
    expect(parsed.safety).toEqual({
      secretsWritten: false,
      runtimeStarted: false,
      providerExecuted: false,
      toolCommandExecuted: false,
      messageSent: false,
      npmPublishActuallyPerformed: false,
    });
    expect(pack.normalization.npmCreateZavorthGate).toEqual(expect.objectContaining({
      npmCreateZavorth: 'blocked-with-concrete-reason',
      localCreateBootstrapPrepared: true,
      localCreateBootstrapBin: './bin/create-zavorth.js',
      futurePackageNeeded: 'create-zavorth',
      monorepoInvented: false,
      bootstrapWritesDefault: false,
      secretsWritten: false,
      runtimePersisted: false,
      externalCallsPerformed: false,
      rawSecretSerialized: false,
    }));
    expect(pack.normalization.npmCreateZavorthGate.concreteBlocker).toContain('separate create-zavorth package');
  });

  it('records all heavy shard measurements without coverage reduction', () => {
    expect(pack.normalization.heavyShardStability).toEqual(expect.objectContaining({
      nativeContract: 'PostAbsorptionHeavyShardStabilityGate/v1',
      heavyShardOptimization: 'measured-with-actionable-plan',
      coverageReductionAllowed: false,
      assertionsReducedForSpeed: false,
      fullUnshardedSuiteRequiredForInteractiveGate: false,
      rawSecretSerialized: false,
    }));
    expect(pack.normalization.heavyShardStability.measuredShards).toEqual([
      expect.objectContaining({ shard: '8/16', suitesPassed: 11, testsPassed: 103, durationSeconds: 71.107, previousKnownSeconds: 113.179 }),
      expect.objectContaining({ shard: '3/16', suitesPassed: 11, testsPassed: 86, durationSeconds: 35.373 }),
      expect.objectContaining({ shard: '12/16', suitesPassed: 10, testsPassed: 70, durationSeconds: 25.746 }),
      expect.objectContaining({ shard: '11/16', suitesPassed: 10, testsPassed: 82, durationSeconds: 43.287 }),
      expect.objectContaining({ shard: '15/16', suitesPassed: 10, testsPassed: 57, durationSeconds: 38.321 }),
    ]);
    expect(pack.normalization.heavyShardStability.nextOptimizationCandidates.length).toBeGreaterThanOrEqual(4);
  });

  it('keeps limited production send, raw import, adapter retirement, and monitoring guarded', () => {
    expect(pack.normalization.limitedProductionSend).toEqual({
      nativeContract: 'PostAbsorptionLimitedProductionSendGate/v1',
      limitedProductionSendStillGated: true,
      limitedProductionSend: 'policy-ready-no-send',
      featureFlagRequired: 'ZAVORTH_LIMITED_PRODUCTION_MESSAGE_SEND_EXECUTE',
      targetChannelTransportAllowlistRequired: true,
      explicitApprovalRequired: true,
      idempotencyKeyRequired: true,
      rateLimitRequired: true,
      immediateDryRunBeforeLiveRequired: true,
      auditReceiptRequired: true,
      realMessageSentInThisPack: false,
      providerRealExecutionAllowed: false,
      toolCommandRealExecutionAllowed: false,
      rawContentUsageAllowed: false,
      rawSecretSerialized: false,
    });
    expect(pack.normalization.rawSqliteImporter.rawImportDefaultDisabled).toBe(true);
    expect(pack.normalization.rawSqliteImporter.rawDbCopied).toBe(false);
    expect(pack.normalization.rawSqliteImporter.sqliteWriteAllowed).toBe(false);
    expect(pack.normalization.adapterRetirement.adapterRemovalGlobalAllowed).toBe(false);
    expect(pack.normalization.adapterRetirement.adapterGlobalStillAvailable).toBe(true);
    expect(pack.normalization.monitoringPolish.monitoringPolish).toBe('local-receipts-ready');
    expect(pack.normalization.monitoringPolish.externalHeavyMonitoringAdded).toBe(false);
  });

  it('records all validation checks as non-publish and non-external-action checks', () => {
    expect(pack.normalization.validationChecks.map((check) => check.checkId)).toEqual([
      'build',
      'npm-pack-dry-run',
      'bin-help',
      'create-zavorth-dry-run',
      'representative-external-agents',
      'heavy-shard-8-of-16',
      'heavy-shard-3-of-16',
      'heavy-shard-12-of-16',
      'heavy-shard-11-of-16',
      'heavy-shard-15-of-16',
      'runtime-check',
      'public-surface-scan',
      'redaction-scan',
    ]);
    pack.normalization.validationChecks.forEach((check) => {
      expect(check.publishAllowed).toBe(false);
      expect(check.externalActionAllowed).toBe(false);
      expect(check.rawSecretSerialized).toBe(false);
    });
  });

  it('updates 262 and the final roadmap with post-263 release gate context', () => {
    const doc262 = read(DOC_262);
    const roadmap257 = read(ROADMAP_257);

    expect(doc262).toContain('Post-263 Publish/Create/Stability Follow-up');
    expect(doc262).toContain('docs/263-post-absorption-publish-create-and-stability-gate.md');
    expect(roadmap257).toContain('Post-263 Release Gate Note');
    expect(roadmap257).toContain('npmCreateZavorth=blocked-with-concrete-reason');
    assertNoRawSecretOrContent(doc262);
    assertNoRawSecretOrContent(roadmap257);
  });

  it('keeps public surfaces from promoting local launchers or source identity requirements', () => {
    PUBLIC_SURFACES.forEach((relativePath) => {
      const content = read(relativePath);
      expect(content).not.toMatch(/\.bat\b/i);
      expect(content).not.toMatch(/ExternalExecutor|external-executor/);
      expect(content).not.toMatch(/node dist\/zavorth-cli\.js/);
      assertNoRawSecretOrContent(content);
    });
  });

  it('keeps exact execution guarantees closed', () => {
    expect(pack.normalization.executionGate).toEqual({
      postAbsorptionPublishCreateAndStabilityGateCreated: true,
      publishGateCreated: true,
      publishDecision: 'ready-awaiting-operator-approval',
      npmPublishActuallyPerformed: false,
      publishRequiresExplicitOperatorApproval: true,
      publishCommandPreparedButNotExecuted: true,
      publishReadinessFrom262Preserved: true,
      npmCreateZavorth: 'blocked-with-concrete-reason',
      heavyShardOptimization: 'measured-with-actionable-plan',
      defaultRuntimeZavorthOwned: true,
      publicExternalExecutorIdentityLeak: false,
      batFilesNotProductPath: true,
      rawImportDefaultDisabled: true,
      limitedProductionSendStillGated: true,
      adapterRemovalGlobalAllowed: false,
      rawSecretSerialized: false,
    });
  });

  it('blocks publish, create, coverage, source identity, execution, migration, and adapter regressions', () => {
    const blockedCases: Array<keyof PostAbsorptionPublishCreateAndStabilitySource> = [
      'npmPublishAttempted',
      'explicitOperatorApprovalForPublish',
      'publishBlockerFound',
      'monorepoInventedForCreate',
      'createBootstrapWritesByDefault',
      'coverageReductionAttempted',
      'assertionsReducedForSpeed',
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
      const normalization = normalizePostAbsorptionPublishCreateAndStabilityGate({
        generatedAt: '2026-05-02T02:30:00.000Z',
        runtimeId: POST_ABSORPTION_PUBLISH_CREATE_AND_STABILITY_GATE_RUNTIME_ID,
        source: { ...source, [key]: true } as unknown as PostAbsorptionPublishCreateAndStabilitySource,
      });

      expect(normalization.decision).toBe('blocked');
      expect(normalization.executionGate.npmPublishActuallyPerformed).toBe(false);
      expect(normalization.executionGate.defaultRuntimeZavorthOwned).toBe(true);
      expect(normalization.executionGate.publicExternalExecutorIdentityLeak).toBe(false);
      expect(normalization.executionGate.batFilesNotProductPath).toBe(true);
      expect(normalization.executionGate.rawImportDefaultDisabled).toBe(true);
      expect(normalization.executionGate.adapterRemovalGlobalAllowed).toBe(false);
      expect(normalization.executionGate.rawSecretSerialized).toBe(false);
    });
  });

  it('keeps serialized output redacted and terminal at 263', () => {
    const serialized = JSON.stringify(pack.normalization);

    expect(pack.normalization.redaction).toEqual({
      rawSecretSerialized: false,
      rawContentSerialized: false,
      packageSecretsIncluded: false,
      publicSourceIdentityExposed: false,
      receiptsRedacted: true,
      serializedOutputContainsSensitiveFixture: false,
    });
    expect(pack.normalization.terminalGate).toBe('do-not-advance-beyond-263-without-operator-decision');
    assertNoRawSecretOrContent(serialized);
  });
});
